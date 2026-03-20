import * as fs from 'fs';
import { resolveWorkspacePath } from '../lib/workspace.js';

export default {
    definition: {
        name: 'read',
        displayName: 'Read File',
        pluginType: 'tool',
        description: 'Read the contents of files',
        requiresApproval: false,
        parameters: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Fully qualified absolute path to the file to read'
                }
            },
            required: ['path']
        }
    },
    handler: async ({ path: filePath }: { path: string }) => {
        const { safe: safePath, error } = resolveWorkspacePath(filePath);
        if (error) return { error };
        if (!fs.existsSync(safePath)) return { error: `File not found: ${filePath}` };
        try {
            return { content: fs.readFileSync(safePath, 'utf-8') };
        } catch (e: any) {
            return { error: `Failed to read file: ${e.message}` };
        }
    }
};
