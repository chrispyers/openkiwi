import { resolveWorkspacePath, WORKSPACE_DIR } from '../lib/workspace.js';
import { execInWorkspace } from '../lib/exec.js';

export default {
    definition: {
        name: 'bash',
        displayName: 'Bash Command',
        pluginType: 'tool',
        description: 'Executes shell commands in the workspace environment',
        requiresApproval: true,
        parameters: {
            type: 'object',
            properties: {
                command: {
                    type: 'string',
                    description: 'The shell command to execute'
                },
                cwd: {
                    type: 'string',
                    description: 'The working directory to run inside (relative to workspace). Defaults to root.'
                }
            },
            required: ['command']
        }
    },
    handler: async ({ command, cwd = '' }: { command: string, cwd?: string }) => {
        if (!command || typeof command !== 'string') {
            return { error: 'Missing required parameter: command must be a non-empty string.' };
        }

        // Fall back to workspace root if the path escapes the sandbox (e.g. agent passed an absolute path)
        const { safe } = resolveWorkspacePath(cwd);
        const targetDir = safe || WORKSPACE_DIR;

        console.log(`[bash] Executing \`${command}\` in ${targetDir}`);
        const result = await execInWorkspace(command, targetDir, { timeout: 30_000 });

        if (result.error) {
            return { error: result.error, stdout: result.stdout, stderr: result.stderr };
        }
        return { stdout: result.stdout, stderr: result.stderr };
    }
};
