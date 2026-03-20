import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkspacePath, WORKSPACE_DIR } from '../lib/workspace.js';

// Ensure workspace exists
if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
}

export default {
    definition: {
        name: 'file_manager',
        displayName: 'File Operations',
        pluginType: 'tool',
        description: 'Perform structural file system operations: delete files or directories, clear a directory\'s contents (rm -rf dir/*), create directories, move/rename, and copy.',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['delete', 'clear', 'mkdir', 'move', 'copy'],
                    description: 'The file operation to perform. Use "clear" to delete all contents inside a directory while keeping the directory itself (equivalent to rm -rf dir/*).'
                },
                path: {
                    type: 'string',
                    description: 'The fully qualified absolute path of the file or directory.'
                },
                newPath: {
                    type: 'string',
                    description: 'The destination path for "move" or "copy" actions.'
                }
            },
            required: ['action', 'path']
        }
    },
    handler: async ({ action, path: filePath, newPath }: { action: string; path: string; newPath?: string }) => {
        try {
            const { safe: safePath, error } = resolveWorkspacePath(filePath);
            if (error) throw new Error(error);

            switch (action) {
                case 'delete':
                    if (!fs.existsSync(safePath)) throw new Error('Path not found');
                    const stats = fs.statSync(safePath);
                    if (stats.isDirectory()) {
                        fs.rmSync(safePath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(safePath);
                    }
                    return { success: true, message: `${stats.isDirectory() ? 'Directory' : 'File'} ${filePath} deleted successfully` };

                case 'clear': {
                    if (!fs.existsSync(safePath)) throw new Error('Path not found');
                    if (!fs.statSync(safePath).isDirectory()) throw new Error('Path is not a directory — use "delete" to remove a file');
                    const entries = fs.readdirSync(safePath);
                    for (const entry of entries) {
                        fs.rmSync(path.join(safePath, entry), { recursive: true, force: true });
                    }
                    return { success: true, message: `Cleared ${entries.length} item${entries.length === 1 ? '' : 's'} from ${filePath}` };
                }

                case 'mkdir':
                    if (fs.existsSync(safePath)) throw new Error('Path already exists');
                    fs.mkdirSync(safePath, { recursive: true });
                    return { success: true, message: `Directory ${filePath} created successfully` };

                case 'move': {
                    if (!fs.existsSync(safePath)) throw new Error('Source path not found');
                    if (!newPath) throw new Error('newPath is required for "move" action');
                    const { safe: destPath, error: destError } = resolveWorkspacePath(newPath);
                    if (destError) throw new Error(destError);
                    const destParentDir = path.dirname(destPath);
                    if (!fs.existsSync(destParentDir)) fs.mkdirSync(destParentDir, { recursive: true });
                    fs.renameSync(safePath, destPath);
                    return { success: true, message: `Moved ${filePath} to ${newPath}` };
                }

                case 'copy': {
                    if (!fs.existsSync(safePath)) throw new Error('Source path not found');
                    if (!newPath) throw new Error('newPath is required for "copy" action');
                    const { safe: copyDestPath, error: copyDestError } = resolveWorkspacePath(newPath);
                    if (copyDestError) throw new Error(copyDestError);
                    const copyDestParentDir = path.dirname(copyDestPath);
                    if (!fs.existsSync(copyDestParentDir)) fs.mkdirSync(copyDestParentDir, { recursive: true });
                    if (fs.statSync(safePath).isDirectory()) {
                        fs.cpSync(safePath, copyDestPath, { recursive: true });
                    } else {
                        fs.copyFileSync(safePath, copyDestPath);
                    }
                    return { success: true, message: `Copied ${filePath} to ${newPath}` };
                }

                default:
                    throw new Error(`Unknown action: ${action}`);
            }
        } catch (error: any) {
            return { error: error.message };
        }
    }
};
