import * as fs from 'fs';
import { resolveWorkspacePath } from '../lib/workspace.js';
import { execInWorkspace } from '../lib/exec.js';

export default {
    definition: {
        name: 'grep',
        displayName: 'Grep Search',
        pluginType: 'tool',
        description: 'Searches for text patterns inside files in the workspace using grep',
        requiresApproval: false,
        parameters: {
            type: 'object',
            properties: {
                pattern: {
                    type: 'string',
                    description: 'The search pattern or literal string to look for'
                },
                directory: {
                    type: 'string',
                    description: 'The root directory to search inside (relative to workspace). Leave empty for workspace root.'
                },
                options: {
                    type: 'array',
                    description: 'Grep CLI flags (e.g. "-i" for case insensitive, "-n" for line numbers)',
                    items: { type: 'string' }
                }
            },
            required: ['pattern']
        }
    },
    handler: async ({ pattern, directory = '', options = ['-rn'] }: { pattern: string, directory?: string, options?: string[] }) => {
        const { safe: targetDir, error } = resolveWorkspacePath(directory);
        if (error) return { error };
        if (!fs.existsSync(targetDir)) return { error: `Directory not found: ${directory}` };

        // Only allow simple flags like -i, -n, -r to prevent injection
        const safeOpts = options.filter(opt => /^-[A-Za-z]+$/.test(opt)).join(' ');
        const result = await execInWorkspace(`grep ${safeOpts} ${JSON.stringify(pattern)} .`, targetDir, { timeout: 5_000 });

        if (result.error) {
            if (result.code === 1) return { results: [] }; // grep returns 1 on no match
            return { error: `Grep failed: ${result.error}` };
        }
        if (result.stderr) console.warn('[grep] stderr:', result.stderr);
        return { results: result.stdout.split('\n').filter(Boolean) };
    }
};
