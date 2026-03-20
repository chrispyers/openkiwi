import * as fs from 'fs';
import { resolveWorkspacePath } from '../lib/workspace.js';
import { execInWorkspace } from '../lib/exec.js';

export default {
    definition: {
        name: 'glob',
        displayName: 'Glob/Find Files',
        pluginType: 'tool',
        description: 'Finds files based on pattern matching (e.g., "*.js", "**/*.ts")',
        requiresApproval: false,
        parameters: {
            type: 'object',
            properties: {
                pattern: {
                    type: 'string',
                    description: 'The glob pattern or filename to search for'
                },
                path: {
                    type: 'string',
                    description: 'Fully qualified absolute path to the directory to search within. Defaults to root.'
                }
            },
            required: ['pattern']
        }
    },
    handler: async ({ pattern, path: searchPath = '' }: { pattern: string, path?: string }) => {
        const { safe: targetDir, error } = resolveWorkspacePath(searchPath);
        if (error) return { error };
        if (!fs.existsSync(targetDir)) return { error: `Directory not found: ${searchPath}` };

        // Escape single quotes for shell safety
        const safePattern = pattern.replace(/'/g, "'\\''");
        const result = await execInWorkspace(`find . -name '${safePattern}'`, targetDir, { timeout: 5_000 });

        if (result.error) {
            if (result.code === 1) return { files: [] }; // find returns 1 on empty/no match on some platforms
            return { error: `Glob failed: ${result.error}` };
        }
        if (result.stderr) console.warn('[glob] stderr:', result.stderr);
        return { files: result.stdout.split('\n').filter(Boolean) };
    }
};
