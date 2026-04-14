import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';
import { resolveWorkspacePath, WORKSPACE_DIR } from '../lib/workspace.js';

/**
 * Resolve the LLM provider to use for synthesis.
 * Prefers the provider configured on the calling agent (via agentId in context)
 * so the report uses the same model the workflow is running on, not necessarily
 * the first provider in the list (which may be offline or unloaded).
 */
async function getLlmConfig(agentId?: string) {
    const { loadConfig } = await import('../../src/config-manager.js');
    const config = loadConfig();
    if (!config.providers?.length) throw new Error('No LLM provider configured.');

    if (agentId) {
        const { AgentManager } = await import('../../src/agent-manager.js');
        const agent = AgentManager.getAgent(agentId);
        if (agent?.provider) {
            const match = config.providers.find(
                p => p.model === agent.provider || p.description === agent.provider
            );
            if (match) {
                return {
                    baseUrl: match.endpoint,
                    modelId: match.model,
                    apiKey: match.apiKey,
                    supportsTools: !!match.capabilities?.trained_for_tool_use
                };
            }
        }
    }

    // Fallback to first provider
    const provider = config.providers[0];
    return {
        baseUrl: provider.endpoint,
        modelId: provider.model,
        apiKey: provider.apiKey,
        supportsTools: !!provider.capabilities?.trained_for_tool_use
    };
}

export default {
    definition: {
        name: 'report_writer',
        displayName: 'Report Writer',
        pluginType: 'tool',
        description:
            'Reads files matching a glob pattern from the workspace, synthesizes their content into a ' +
            'report using an AI model, and saves the result to a specified output path. ' +
            'Use this to aggregate scan results, logs, or any set of files into a single executive summary or combined report.',
        parameters: {
            type: 'object',
            properties: {
                glob_pattern: {
                    type: 'string',
                    description:
                        'Glob pattern for input files, relative to the workspace root. ' +
                        'Examples: "security/**/scan-results.md", "logs/**/*.txt", "reports/*.json". ' +
                        'All matching files are read and passed to the model together.'
                },
                prompt: {
                    type: 'string',
                    description:
                        'Instructions describing what report to generate from the files. ' +
                        'Be specific about format, structure, and what to highlight. ' +
                        'Example: "Create a high-level executive summary covering all security findings, ' +
                        'organised by severity. Include a prioritised action plan."'
                },
                output_path: {
                    type: 'string',
                    description:
                        'Output file path relative to the workspace root. ' +
                        'Example: "security/executive_summary.md". ' +
                        'The directory is created automatically if it does not exist.'
                }
            },
            required: ['glob_pattern', 'prompt', 'output_path']
        }
    },

    handler: async (args: {
        glob_pattern: string;
        prompt: string;
        output_path: string;
        _context?: any;
    }) => {
        // Validate output path
        const { safe: safeOut, error: outErr } = resolveWorkspacePath(args.output_path);
        if (outErr || !safeOut) {
            return { error: outErr ?? 'Invalid output_path.' };
        }

        // Resolve glob relative to workspace
        const matchedPaths = await glob(args.glob_pattern, {
            cwd: WORKSPACE_DIR,
            absolute: false,
            nodir: true
        });

        if (matchedPaths.length === 0) {
            return {
                error: `No files matched the pattern "${args.glob_pattern}" in the workspace. ` +
                    'Check the path is correct and the files exist.'
            };
        }

        // Read each matched file, validating it stays inside the workspace
        const fileBlocks: string[] = [];
        for (const rel of matchedPaths.sort()) {
            const { safe, error } = resolveWorkspacePath(rel);
            if (error || !safe) continue;
            try {
                const content = fs.readFileSync(safe, 'utf-8');
                fileBlocks.push(`### ${rel}\n\n${content}`);
            } catch (e: any) {
                fileBlocks.push(`### ${rel}\n\n_(Could not read file: ${e.message})_`);
            }
        }

        // Build the synthesis request
        const combinedContent = fileBlocks.join('\n\n---\n\n');
        const userMessage =
            `The following files were found matching the pattern "${args.glob_pattern}":\n\n` +
            combinedContent +
            `\n\n---\n\n${args.prompt}`;

        let reportContent: string;
        try {
            const llmConfig = await getLlmConfig(args._context?.agentId);
            const { getChatCompletion } = await import('../../src/llm-provider.js');
            const { content } = await getChatCompletion(llmConfig, [
                {
                    role: 'system',
                    content:
                        'You are a technical report writer. Produce clear, well-structured reports in Markdown. ' +
                        'Be concise but thorough. Use tables where they aid readability.'
                },
                { role: 'user', content: userMessage }
            ]);
            reportContent = content;
        } catch (e: any) {
            return { error: `LLM synthesis failed: ${e.message}` };
        }

        // Write the output file
        fs.mkdirSync(path.dirname(safeOut), { recursive: true });
        fs.writeFileSync(safeOut, reportContent, 'utf-8');

        return {
            success: true,
            outputPath: safeOut,
            filesRead: matchedPaths.length,
            files: matchedPaths
        };
    }
};
