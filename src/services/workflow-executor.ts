import * as fs from 'node:fs';
import * as path from 'node:path';
import { WorkflowService } from './workflow-service.js';
import { AgentManager } from '../agent-manager.js';
import { ToolManager } from '../tool-manager.js';
import { loadConfig } from '../config-manager.js';
import { streamChatCompletion, getChatCompletion } from '../llm-provider.js';
import { WORKSPACE_DIR } from '../security.js';

export interface WorkflowExecutionResult {
    success: boolean;
    finalResponse: string;
    error?: string;
    stepResults?: StepResult[];
}

interface StepResult {
    stepName: string;
    toolId: string;
    /** Single result object, or an array when the step made multiple tool calls */
    result: any;
}

/**
 * Build a concise context block from completed step results to inject into
 * subsequent step prompts. Strips large fields (topFindings, rawJson) that
 * would bloat the context while keeping the actionable outputs (paths, counts, etc.).
 */
function buildPriorContext(stepResults: StepResult[]): string {
    if (stepResults.length === 0) return '';

    const lines = stepResults.map((r, i) => {
        const results = Array.isArray(r.result) ? r.result : [r.result];
        const summaries = results.map(res => {
            if (!res || typeof res !== 'object') return String(res);
            // Strip bulky fields that aren't useful as forward context
            const { topFindings: _tf, rawOutputPreview: _ro, ...compact } = res;
            return JSON.stringify(compact);
        });
        return `Step ${i + 1} — ${r.stepName} (${r.toolId}):\n${summaries.join('\n')}`;
    });

    return `\n\nCompleted steps so far:\n${lines.join('\n\n')}`;
}

/**
 * Collect all tool calls from a single streaming LLM response.
 */
async function collectToolCalls(
    llmConfig: any,
    messages: any[],
    toolDefs: any[]
): Promise<{ toolCalls: any[]; textContent: string }> {
    const toolCalls: any[] = [];
    let textContent = '';

    for await (const delta of streamChatCompletion(llmConfig, messages, toolDefs)) {
        if (delta.content) textContent += delta.content;
        if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
                if (!toolCalls[tc.index]) {
                    toolCalls[tc.index] = { ...tc, function: { name: '', arguments: '', ...tc.function } };
                } else {
                    if (tc.id) toolCalls[tc.index].id = tc.id;
                    if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
                    if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
                }
            }
        }
    }

    return { toolCalls: toolCalls.filter(Boolean), textContent };
}

/**
 * Trim a tool result before adding it to the step conversation history.
 * Large results (scan findings, git output) degrade model performance in
 * later iterations as context grows. We keep enough to be useful (success/error
 * status, key paths) while dropping bulk content like raw findings arrays.
 */
function trimToolResult(result: any): any {
    if (!result || typeof result !== 'object') return result;
    const MAX_CHARS = 800;
    const { topFindings: _tf, rawOutputPreview: _ro, rawJson: _rj, ...compact } = result;
    const json = JSON.stringify(compact);
    if (json.length <= MAX_CHARS) return compact;
    // Keep the most useful fields: success/error, key paths, counts
    const { success, error, stdout, stderr, ...rest } = compact;
    const trimmed: any = {};
    if (success !== undefined) trimmed.success = success;
    if (error !== undefined) trimmed.error = error;
    // Keep scalar fields (counts, paths, short strings) and drop arrays/large objects
    for (const [k, v] of Object.entries(rest)) {
        if (v === null || typeof v !== 'object') trimmed[k] = v;
    }
    return trimmed;
}

/**
 * Execute a single workflow step using the agent loop:
 *   LLM call → tool execution → feedback → LLM call → ... → stop
 *
 * The agent has access to its primary tool PLUS glob for environment verification.
 * This mirrors how real agent loops (Claude Code etc.) work: the agent can check
 * the filesystem to confirm all expected operations completed, and self-correct
 * if something was missed.
 */
async function executeStep(
    llmConfig: any,
    toolId: string,
    toolDef: any,
    stepPrompt: string,
    priorContext: string,
    agentId: string
): Promise<any[]> {
    const MAX_ITERATIONS = 30;

    // Give the agent ls and glob as verification tools alongside the primary tool.
    // This lets it check the environment (e.g. list cloned repos, find scan outputs)
    // and self-correct if operations were missed — the same capability that makes
    // Claude Code's agent loop reliable.
    //
    // IMPORTANT: use ls for directory existence checks. The glob tool uses
    // `find -name` which only matches the filename component — patterns containing
    // '/' (e.g. "tmp/repo") will never match. Use ls to list a directory's contents
    // and count/check entries by name.
    const allDefs = ToolManager.getToolDefinitions();
    const globDef = allDefs.find(d => d.name === 'glob');
    const lsDef = allDefs.find(d => d.name === 'ls');
    const verifyTools = [globDef, lsDef].filter(Boolean);
    const availableTools = [toolDef, ...verifyTools];

    const verificationHintSection = (toolDef as any).verificationHint
        ? `\n\nTool-specific verification guidance for ${toolId}: ${(toolDef as any).verificationHint}`
        : '';

    const systemContent =
        `You are executing a workflow step. Your primary tool is "${toolId}".\n\n` +
        `INSTRUCTIONS:\n` +
        `1. Work through every operation listed below one at a time.\n` +
        `2. Do not invent operations that are not explicitly listed.\n` +
        `3. After completing all listed operations, verify the results using ls or glob:\n` +
        `   - To check which directories exist (e.g. cloned repos): use ls on the parent directory ` +
        `(e.g. ls path="tmp") and count the entries — do NOT use glob with a path containing "/".\n` +
        `   - To check which output files exist: use glob with just the filename pattern ` +
        `(e.g. pattern="scan-results.json") and set path to the directory to search within.\n` +
        `4. If verification shows anything is missing, perform only the missing operations.\n` +
        `5. Only stop once verification confirms all expected results are present.\n\n` +
        `Workspace directory: ${WORKSPACE_DIR}\n` +
        `Use paths relative to the workspace root (e.g. "tmp/repo"). ` +
        `Never use container paths such as /app/workspace.` +
        verificationHintSection +
        priorContext;

    const messages: any[] = [
        { role: 'system', content: systemContent },
        { role: 'user', content: stepPrompt || `Call the ${toolId} tool.` }
    ];

    const callResults: any[] = [];
    // When the tool defines resultKey(), we deduplicate results by key so that
    // retries of the same operation replace earlier failures instead of inflating
    // the result count, and verification/housekeeping calls (key === null) are
    // excluded entirely.
    const resultKeyFn = typeof (toolDef as any).resultKey === 'function'
        ? (toolDef as any).resultKey as (args: any) => string | null
        : null;
    const resultKeyIndex = new Map<string, number>();

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
        let collected: { toolCalls: any[]; textContent: string };
        try {
            collected = await collectToolCalls(llmConfig, messages, availableTools);
        } catch (e: any) {
            callResults.push({ error: `LLM call failed: ${e.message}` });
            break;
        }

        if (collected.toolCalls.length === 0) {
            // LLM produced no tool call — done
            break;
        }

        // Add the assistant turn to the conversation history
        messages.push({
            role: 'assistant',
            content: collected.textContent || '',
            tool_calls: collected.toolCalls
        });

        // Execute each tool call and feed results back
        for (const tc of collected.toolCalls) {
            const calledTool = tc.function?.name || toolId;
            let args: any;
            try {
                args = JSON.parse(tc.function.arguments || '{}');
            } catch (e: any) {
                const errResult = { error: `Invalid tool arguments: ${e.message}` };
                if (calledTool === toolId) callResults.push(errResult);
                messages.push({ role: 'tool', tool_call_id: tc.id, name: calledTool, content: JSON.stringify(errResult) });
                continue;
            }

            let result: any;
            try {
                result = await ToolManager.callTool(calledTool, args, { agentId });
            } catch (e: any) {
                result = { error: e.message };
            }

            // Only track results from the primary tool — glob/ls calls are housekeeping.
            // When resultKey is available, deduplicate by key (retries replace earlier
            // failures) and skip verification calls (key === null).
            if (calledTool === toolId) {
                if (resultKeyFn) {
                    let key: string | null;
                    try { key = resultKeyFn(args); } catch { key = undefined as any; }
                    if (key === null || key === undefined) {
                        // Verification / informational call — don't track
                    } else {
                        const existing = resultKeyIndex.get(key);
                        if (existing !== undefined) {
                            callResults[existing] = result;
                        } else {
                            resultKeyIndex.set(key, callResults.length);
                            callResults.push(result);
                        }
                    }
                } else {
                    callResults.push(result);
                }
            }

            // Trim result before adding to history to prevent context bloat
            messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                name: calledTool,
                content: JSON.stringify(trimToolResult(result))
            });
        }
    }

    return callResults;
}

/**
 * Persist a run report to workspace/workflows/logs/{workflow-name}/{timestamp}/.
 * Always runs regardless of how the workflow was triggered (chat, API, cron).
 * Errors are swallowed — a report write failure must never break a workflow run.
 */
function persistRunReport(
    workflowName: string,
    success: boolean,
    summary: string,
    stepResults: StepResult[]
): string | null {
    try {
        const slug = workflowName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const runDir = path.join(WORKSPACE_DIR, 'workflows', 'logs', slug, timestamp);
        fs.mkdirSync(runDir, { recursive: true });

        // summary.md — the LLM-generated plain-language summary
        const mdLines: string[] = [
            `# Workflow Run: ${workflowName}`,
            ``,
            `| | |`,
            `|---|---|`,
            `| **Workflow** | ${workflowName} |`,
            `| **Run time** | ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC |`,
            `| **Status** | ${success ? '✅ Success' : '❌ Failed'} |`,
            ``,
            `## Summary`,
            ``,
            summary,
            ``,
            `## Step Results`,
            ``
        ];
        for (let i = 0; i < stepResults.length; i++) {
            const r = stepResults[i];
            mdLines.push(`### Step ${i + 1}: ${r.stepName} (${r.toolId})`, ``);
            mdLines.push('```json');
            mdLines.push(JSON.stringify(r.result, null, 2));
            mdLines.push('```', ``);
        }
        fs.writeFileSync(path.join(runDir, 'summary.md'), mdLines.join('\n'), 'utf-8');

        // results.json — structured data for programmatic access
        fs.writeFileSync(
            path.join(runDir, 'results.json'),
            JSON.stringify({ workflowName, runAt: new Date().toISOString(), success, summary, stepResults }, null, 2),
            'utf-8'
        );

        console.log(`[workflow-executor] Run report written to ${runDir}`);
        return runDir;
    } catch (e: any) {
        console.error('[workflow-executor] Failed to write run report:', e.message);
        return null;
    }
}

export interface WorkflowStepProgress {
    step: number;       // 1-based
    total: number;
    stepName: string;
    toolId: string;
}

/**
 * Resolve LLM config for a specific agent, falling back to the given default provider.
 */
function resolveLlmConfig(stepAgentId: string | null, defaultAgent: any, defaultProviderConfig: any) {
    if (!stepAgentId) {
        return {
            baseUrl: defaultProviderConfig.endpoint,
            modelId: defaultProviderConfig.model,
            apiKey: defaultProviderConfig.apiKey,
            supportsTools: !!defaultProviderConfig?.capabilities?.trained_for_tool_use,
        };
    }

    const stepAgent = AgentManager.getAgent(stepAgentId);
    if (!stepAgent) {
        // Fall back to default if assigned agent doesn't exist
        return {
            baseUrl: defaultProviderConfig.endpoint,
            modelId: defaultProviderConfig.model,
            apiKey: defaultProviderConfig.apiKey,
            supportsTools: !!defaultProviderConfig?.capabilities?.trained_for_tool_use,
        };
    }

    const config = loadConfig();
    const pc = config.providers.find((p: any) => p.model === stepAgent.provider || p.description === stepAgent.provider) || defaultProviderConfig;

    return {
        baseUrl: pc.endpoint,
        modelId: pc.model,
        apiKey: pc.apiKey,
        supportsTools: !!pc?.capabilities?.trained_for_tool_use,
    };
}

/**
 * Parse a WorkflowState's depends_on column. Returns an array of step IDs,
 * or null if unset (meaning "use sequential ordering").
 */
function parseDependsOn(state: any): string[] | null {
    if (!state.depends_on) return null;
    try {
        const parsed = JSON.parse(state.depends_on);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Check whether ANY step in the workflow has an explicit depends_on value.
 * If none do, the workflow runs in legacy sequential mode for backward compat.
 */
function isParallelWorkflow(states: any[]): boolean {
    return states.some(s => s.depends_on !== null && s.depends_on !== undefined);
}

export async function executeWorkflow(
    workflowId: string,
    agentId: string,
    onStepProgress?: (progress: WorkflowStepProgress) => void
): Promise<WorkflowExecutionResult> {
    const workflow = WorkflowService.getWorkflow(workflowId);
    if (!workflow) return { success: false, finalResponse: '', error: 'Workflow not found' };

    const states = WorkflowService.getWorkflowStates(workflowId);
    if (states.length === 0) return { success: false, finalResponse: '', error: 'Workflow has no steps configured' };

    const agent = AgentManager.getAgent(agentId);
    if (!agent) return { success: false, finalResponse: '', error: `Agent "${agentId}" not found` };

    const currentConfig = loadConfig();
    let providerConfig = currentConfig.providers.find((p: any) => p.model === agent.provider || p.description === agent.provider);
    if (!providerConfig && currentConfig.providers.length > 0) providerConfig = currentConfig.providers[0];
    if (!providerConfig) return { success: false, finalResponse: '', error: 'No LLM provider available' };

    const totalSteps = states.length;
    let stepResults: StepResult[];

    if (isParallelWorkflow(states)) {
        // ── DAG-based parallel execution ──────────────────────────────
        stepResults = await executeParallelSteps(states, agentId, agent, providerConfig, totalSteps, onStepProgress);
    } else {
        // ── Legacy sequential execution (backward compatible) ─────────
        stepResults = await executeSequentialSteps(states, agentId, providerConfig, totalSteps, onStepProgress);
    }

    // ── Summarize ─────────────────────────────────────────────────────

    const llmConfig = {
        baseUrl: providerConfig.endpoint,
        modelId: providerConfig.model,
        apiKey: providerConfig.apiKey,
        supportsTools: !!providerConfig?.capabilities?.trained_for_tool_use,
    };

    const allSucceeded = stepResults.every(r => {
        const results = Array.isArray(r.result) ? r.result : [r.result];
        return results.every((res: any) => !res?.error);
    });

    const factLines = stepResults.map((r, i) => {
        const calls = Array.isArray(r.result) ? r.result : [r.result];
        const succeeded = calls.filter((c: any) => !c?.error).length;
        const failed = calls.length - succeeded;
        const status = failed === 0 ? '✅' : succeeded === 0 ? '❌' : '⚠️ partial';
        return `Step ${i + 1} — ${r.stepName} (${r.toolId}): ${status} ${calls.length} call(s) — ${succeeded} succeeded, ${failed} failed`;
    });

    const summaryLines = stepResults.map((r, i) =>
        `Step ${i + 1} — ${r.stepName} (${r.toolId}):\n${JSON.stringify(r.result, null, 2)}`
    ).join('\n\n---\n\n');

    const summaryMessages = [
        { role: 'system', content: agent.systemPrompt },
        {
            role: 'user',
            content:
                `The workflow "${workflow.name}" has completed.\n\n` +
                `AUTHORITATIVE STEP COUNTS (use these exact numbers — do not recount from the JSON):\n${factLines.join('\n')}\n\n` +
                `Full step results:\n\n${summaryLines}\n\n` +
                `Please summarize what happened using the counts above. If any step has an "error" field, clearly report that it failed and explain the error — do not describe it as successful. ` +
                `Only report file paths or other output values that are explicitly present in the step results above.`
        }
    ];

    try {
        const { content: summary } = await getChatCompletion(llmConfig, summaryMessages);
        persistRunReport(workflow.name, allSucceeded, summary, stepResults);
        return { success: allSucceeded, finalResponse: summary, stepResults };
    } catch (e: any) {
        const fallbackSummary = `Workflow completed.\n\n${summaryLines}`;
        persistRunReport(workflow.name, allSucceeded, fallbackSummary, stepResults);
        return { success: allSucceeded, finalResponse: fallbackSummary, stepResults };
    }
}

// ── Sequential execution (original behavior) ─────────────────────────

async function executeSequentialSteps(
    states: any[],
    agentId: string,
    providerConfig: any,
    totalSteps: number,
    onStepProgress?: (progress: WorkflowStepProgress) => void
): Promise<StepResult[]> {
    const llmConfig = {
        baseUrl: providerConfig.endpoint,
        modelId: providerConfig.model,
        apiKey: providerConfig.apiKey,
        supportsTools: !!providerConfig?.capabilities?.trained_for_tool_use,
    };

    const stepResults: StepResult[] = [];

    for (let stateIndex = 0; stateIndex < states.length; stateIndex++) {
        const state = states[stateIndex];
        let toolId = 'unknown';
        let stepPrompt = state.instructions ?? '';
        try {
            const parsed = JSON.parse(state.instructions ?? '');
            if (parsed.tool_id) toolId = parsed.tool_id;
            if (parsed.prompt !== undefined) stepPrompt = parsed.prompt;
        } catch { /* plain text instructions */ }

        const allDefs = ToolManager.getToolDefinitions();
        const toolDef = allDefs.find(d => d.name === toolId);

        if (!toolDef) {
            stepResults.push({ stepName: state.name, toolId, result: { error: `Tool "${toolId}" is not available.` } });
            continue;
        }

        const priorContext = buildPriorContext(stepResults);

        onStepProgress?.({ step: stateIndex + 1, total: totalSteps, stepName: state.name, toolId });

        let callResults: any[];
        try {
            callResults = await executeStep(llmConfig, toolId, toolDef, stepPrompt, priorContext, agentId);
        } catch (e: any) {
            stepResults.push({ stepName: state.name, toolId, result: { error: `Step execution failed: ${e.message}` } });
            continue;
        }

        if (callResults.length === 0) {
            stepResults.push({ stepName: state.name, toolId, result: { error: 'No tool calls were made for this step.' } });
            continue;
        }

        stepResults.push({
            stepName: state.name,
            toolId,
            result: callResults.length === 1 ? callResults[0] : callResults,
        });
    }

    return stepResults;
}

// ── DAG-based parallel execution ──────────────────────────────────────

async function executeParallelSteps(
    states: any[],
    agentId: string,
    defaultAgent: any,
    defaultProviderConfig: any,
    totalSteps: number,
    onStepProgress?: (progress: WorkflowStepProgress) => void
): Promise<StepResult[]> {
    // Build a map of step ID → state and track completion
    const stateById = new Map<string, any>();
    for (const s of states) stateById.set(s.id, s);

    const completed = new Map<string, StepResult>();   // step ID → result
    const pending = new Set<string>(states.map(s => s.id));
    const resultOrder: StepResult[] = [];              // preserves original order for reporting
    let stepsCompleted = 0;
    const MAX_ROUNDS = states.length + 1; // safety valve against infinite loops

    for (let round = 0; round < MAX_ROUNDS && pending.size > 0; round++) {
        // Find all steps whose dependencies are satisfied
        const ready: any[] = [];
        for (const stepId of pending) {
            const state = stateById.get(stepId)!;
            const deps = parseDependsOn(state);

            if (deps === null) {
                // No explicit depends_on — depends on ALL prior steps by order_index
                const priorIds = states
                    .filter(s => s.order_index < state.order_index)
                    .map(s => s.id);
                if (priorIds.every(id => completed.has(id))) {
                    ready.push(state);
                }
            } else if (deps.length === 0) {
                // Explicitly no dependencies — can run immediately
                ready.push(state);
            } else {
                // Explicit dependencies
                if (deps.every(depId => completed.has(depId))) {
                    ready.push(state);
                }
            }
        }

        if (ready.length === 0 && pending.size > 0) {
            // Deadlock: remaining steps have unsatisfiable dependencies
            for (const stepId of pending) {
                const state = stateById.get(stepId)!;
                resultOrder.push({
                    stepName: state.name,
                    toolId: 'unknown',
                    result: { error: `Deadlock: dependencies cannot be satisfied. Check depends_on configuration.` },
                });
            }
            break;
        }

        // Execute all ready steps in parallel
        const batchResults = await Promise.all(
            ready.map(async (state) => {
                // Parse step instructions
                let toolId = 'unknown';
                let stepPrompt = state.instructions ?? '';
                try {
                    const parsed = JSON.parse(state.instructions ?? '');
                    if (parsed.tool_id) toolId = parsed.tool_id;
                    if (parsed.prompt !== undefined) stepPrompt = parsed.prompt;
                } catch { /* plain text */ }

                const allDefs = ToolManager.getToolDefinitions();
                const toolDef = allDefs.find(d => d.name === toolId);

                if (!toolDef) {
                    return { state, stepResult: { stepName: state.name, toolId, result: { error: `Tool "${toolId}" is not available.` } } as StepResult };
                }

                // Build prior context from dependencies only
                const deps = parseDependsOn(state) || [];
                const depResults = deps
                    .map(id => completed.get(id))
                    .filter((r): r is StepResult => !!r);
                const priorContext = buildPriorContext(depResults);

                // Resolve LLM config for this step's assigned agent
                const stepLlmConfig = resolveLlmConfig(state.assigned_agent_id, defaultAgent, defaultProviderConfig);
                const effectiveAgentId = state.assigned_agent_id || agentId;

                stepsCompleted++;
                onStepProgress?.({ step: stepsCompleted, total: totalSteps, stepName: state.name, toolId });

                let callResults: any[];
                try {
                    callResults = await executeStep(stepLlmConfig, toolId, toolDef, stepPrompt, priorContext, effectiveAgentId);
                } catch (e: any) {
                    return { state, stepResult: { stepName: state.name, toolId, result: { error: `Step execution failed: ${e.message}` } } as StepResult };
                }

                if (callResults.length === 0) {
                    return { state, stepResult: { stepName: state.name, toolId, result: { error: 'No tool calls were made for this step.' } } as StepResult };
                }

                return {
                    state,
                    stepResult: {
                        stepName: state.name,
                        toolId,
                        result: callResults.length === 1 ? callResults[0] : callResults,
                    } as StepResult,
                };
            })
        );

        // Record completions
        for (const { state, stepResult } of batchResults) {
            completed.set(state.id, stepResult);
            pending.delete(state.id);
            resultOrder.push(stepResult);
        }
    }

    return resultOrder;
}
