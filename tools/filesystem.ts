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
        description: 'Manage files and directories in your local workspace. Actions: ls, read, write, delete, mkdir, move, copy.',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['ls', 'read', 'write', 'delete', 'mkdir', 'move', 'copy'],
                    description: 'The file operation to perform.'
                },
                filename: {
                    type: 'string',
                    description: 'The name or path of the file or directory (relative to workspace).'
                },
                newFilename: {
                    type: 'string',
                    description: 'The new name or path for "move" or "copy" actions (relative to workspace).'
                },
                content: {
                    type: 'string',
                    description: 'The content to write (only for "write" action).'
                }
            },
            required: ['action']
        }
    },
    handler: async ({ action, filename, content, newFilename }: { action: string; filename?: string; content?: string; newFilename?: string }) => {
        try {
            if (action === 'ls') {
                const targetDir = filename ? path.join(WORKSPACE_DIR, filename) : WORKSPACE_DIR;

                // Security check
                if (!targetDir.startsWith(WORKSPACE_DIR)) {
                    throw new Error('Access denied: Directory is outside of workspace');
                }

                if (!fs.existsSync(targetDir)) {
                    throw new Error(`Directory not found: ${filename}`);
                }

                if (!fs.statSync(targetDir).isDirectory()) {
                    throw new Error(`Target is not a directory: ${filename}`);
                }

                const results = fs.readdirSync(targetDir, { withFileTypes: true });
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

                case 'move':
                    if (!fs.existsSync(safePath)) throw new Error('Source path not found');
                    if (!newFilename) throw new Error('newFilename is required for "move" action');

                    const destPath = path.join(WORKSPACE_DIR, newFilename);
                    if (!destPath.startsWith(WORKSPACE_DIR)) {
                        throw new Error('Access denied: Destination is outside of workspace');
                    }

                    // Ensure destination parent directory exists
                    const destParentDir = path.dirname(destPath);
                    if (!fs.existsSync(destParentDir)) {
                        fs.mkdirSync(destParentDir, { recursive: true });
                    }

                    fs.renameSync(safePath, destPath);
                    return { success: true, message: `Moved/Renamed ${filename} to ${newFilename}` };

                case 'copy':
                    if (!fs.existsSync(safePath)) throw new Error('Source path not found');
                    if (!newFilename) throw new Error('newFilename is required for "copy" action');

                    const copyDestPath = path.join(WORKSPACE_DIR, newFilename);
                    if (!copyDestPath.startsWith(WORKSPACE_DIR)) {
                        throw new Error('Access denied: Destination is outside of workspace');
                    }

                    // Ensure destination parent directory exists
                    const copyDestParentDir = path.dirname(copyDestPath);
                    if (!fs.existsSync(copyDestParentDir)) {
                        fs.mkdirSync(copyDestParentDir, { recursive: true });
                    }

                    const srcStats = fs.statSync(safePath);
                    if (srcStats.isDirectory()) {
                        fs.cpSync(safePath, copyDestPath, { recursive: true });
                    } else {
                        fs.copyFileSync(safePath, copyDestPath);
                    }
                    return { success: true, message: `Copied ${filename} to ${newFilename}` };

                default:
                    throw new Error(`Unknown action: ${action}`);
            }
        } catch (error: any) {
            return { error: error.message };
        }
    }
};
