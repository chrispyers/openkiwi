import * as path from 'path';
import * as fs from 'fs';

const WORKSPACE_DIR = path.resolve(process.cwd(), 'workspace');

export default {
    definition: {
        name: 'multi_edit',
        displayName: 'Multi-Edit File',
        pluginType: 'tool',
        description: 'Performs multiple replace modifications simultaneously on a given file',
        requiresApproval: true,
        parameters: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Fully qualified absolute path to the file to edit'
                },
                edits: {
                    type: 'array',
                    description: 'A list of distinct edit operations to perform on the file',
                    items: {
                        type: 'object',
                        properties: {
                            targetString: {
                                type: 'string',
                                description: 'The exact string of text to replace'
                            },
                            replacementString: {
                                type: 'string',
                                description: 'The new string to replace the target text with'
                            }
                        },
                        required: ['targetString', 'replacementString']
                    }
                }
            },
            required: ['path', 'edits']
        }
    },
    handler: async ({ path: filePath, edits }: { path: string, edits: { targetString: string, replacementString: string }[] }) => {
        const safePath = path.resolve(WORKSPACE_DIR, filePath);
        if (safePath !== WORKSPACE_DIR && !safePath.startsWith(WORKSPACE_DIR + path.sep)) {
            return { error: 'Access denied: Path is outside of workspace' };
        }
        if (!fs.existsSync(safePath)) {
            return { error: `File not found: ${filePath}` };
        }
        try {
            let content = fs.readFileSync(safePath, 'utf-8');
            let successCount = 0;
            const errors: string[] = [];

            for (const { targetString, replacementString } of edits) {
                if (!content.includes(targetString)) {
                    errors.push(`Target string not found: ${targetString.substring(0, 30)}...`);
                    continue;
                }
                const targetOccurrences = content.split(targetString).length - 1;
                if (targetOccurrences > 1) {
                    errors.push(`Target string is ambiguous (${targetOccurrences} matches): ${targetString.substring(0, 30)}...`);
                    continue;
                }
                content = content.replace(targetString, replacementString);
                successCount++;
            }

            if (successCount > 0) {
                fs.writeFileSync(safePath, content, 'utf-8');
            }

            return {
                success: successCount > 0,
                message: `Applied ${successCount} out of ${edits.length} edits to ${filePath}`,
                errors: errors.length > 0 ? errors : undefined
            };
        } catch (e: any) {
            return { error: `Failed to multi-edit file: ${e.message}` };
        }
    }
};
