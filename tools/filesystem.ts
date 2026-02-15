import fs from 'node:fs';
import path from 'node:path';

const WORKSPACE_DIR = path.resolve(process.cwd(), 'workspace');

// Ensure workspace exists
if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
}

export default {
    definition: {
        name: 'manage_files',
        description: 'Manage files and directories in your local workspace. Actions: ls, read, write, delete, mkdir.',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['ls', 'read', 'write', 'delete', 'mkdir'],
                    description: 'The file operation to perform.'
                },
                filename: {
                    type: 'string',
                    description: 'The name or path of the file or directory (relative to workspace).'
                },
                content: {
                    type: 'string',
                    description: 'The content to write (only for "write" action).'
                }
            },
            required: ['action']
        }
    },
    handler: async ({ action, filename, content }: { action: string; filename?: string; content?: string }) => {
        try {
            if (action === 'ls') {
                const results = fs.readdirSync(WORKSPACE_DIR, { withFileTypes: true });
                return results.map(dirent => ({
                    name: dirent.name,
                    type: dirent.isDirectory() ? 'directory' : 'file'
                }));
            }

            if (!filename) throw new Error('Filename or path is required for this action');

            const safePath = path.join(WORKSPACE_DIR, filename);
            if (!safePath.startsWith(WORKSPACE_DIR)) {
                throw new Error('Access denied: File or directory is outside of workspace');
            }

            switch (action) {
                case 'read':
                    if (!fs.existsSync(safePath)) throw new Error('File not found');
                    return { content: fs.readFileSync(safePath, 'utf-8') };

                case 'write':
                    // Ensure parent directory exists for write
                    const parentDir = path.dirname(safePath);
                    if (!fs.existsSync(parentDir)) {
                        fs.mkdirSync(parentDir, { recursive: true });
                    }
                    fs.writeFileSync(safePath, content || '', 'utf-8');
                    return { success: true, message: `File ${filename} written successfully` };

                case 'mkdir':
                    if (fs.existsSync(safePath)) throw new Error('Path already exists');
                    fs.mkdirSync(safePath, { recursive: true });
                    return { success: true, message: `Directory ${filename} created successfully` };

                case 'delete':
                    if (!fs.existsSync(safePath)) throw new Error('Path not found');
                    const stats = fs.statSync(safePath);
                    if (stats.isDirectory()) {
                        fs.rmSync(safePath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(safePath);
                    }
                    return { success: true, message: `${stats.isDirectory() ? 'Directory' : 'File'} ${filename} deleted successfully` };

                default:
                    throw new Error(`Unknown action: ${action}`);
            }
        } catch (error: any) {
            return { error: error.message };
        }
    }
};
