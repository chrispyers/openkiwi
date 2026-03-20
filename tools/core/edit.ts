import * as fs from 'fs';
import { resolveWorkspacePath } from '../lib/workspace.js';

export default {
    definition: {
        name: 'edit',
        displayName: 'Edit File',
        pluginType: 'tool',
        description: 'Replaces a specific targeted segment of a file with new content',
        requiresApproval: true,
        parameters: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Fully qualified absolute path to the file to edit'
                },
                targetString: {
                    type: 'string',
                    description: 'The exact string of text to replace in the file. Must match character-for-character including whitespace.'
                },
                replacementString: {
                    type: 'string',
                    description: 'The new string to replace the target text with.'
                }
            },
            required: ['path', 'targetString', 'replacementString']
        }
    },
    handler: async ({ path: filePath, targetString, replacementString }: { path: string, targetString: string, replacementString: string }) => {
        const { safe: safePath, error } = resolveWorkspacePath(filePath);
        if (error) return { error };
        if (!fs.existsSync(safePath)) return { error: `File not found: ${filePath}` };
        try {
            let content = fs.readFileSync(safePath, 'utf-8');
            if (!content.includes(targetString)) {
                return { error: `Target string not found in ${filePath}. Make sure you copied the exact text including whitespace.` };
            }
            const targetOccurrences = content.split(targetString).length - 1;
            if (targetOccurrences > 1) {
                return { error: `Target string is ambiguous because it appears ${targetOccurrences} times in the file. Please provide a more specific, unique target string.` };
            }
            content = content.replace(targetString, replacementString);
            fs.writeFileSync(safePath, content, 'utf-8');
            return { success: true, message: `File ${filePath} edited successfully` };
        } catch (e: any) {
            return { error: `Failed to edit file: ${e.message}` };
        }
    }
};
