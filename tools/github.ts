import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEBUG = process.env.GITHUB_DEBUG === 'true' || process.env.GITHUB_DEBUG === '1';

function debug(...args: unknown[]) {
    if (DEBUG) console.log('[GitHub:DEBUG]', ...args);
}

debug('Module loaded. GH_TOKEN set:', !!process.env.GH_TOKEN);

const toolDescription =
    'Manage files in GitHub repositories (list, read, create, update). ' +
    'Use this tool instead of web_browser for all GitHub repo access — it has authenticated access to private repos.';

async function ghApi(...args: string[]): Promise<any> {
    debug('gh api', args);
    try {
        const { stdout } = await execFileAsync('gh', ['api', ...args], {
            timeout: 30_000,
            maxBuffer: 10 * 1024 * 1024
        });
        debug('gh api response:', stdout.slice(0, 200) + (stdout.length > 200 ? '...' : ''));
        return JSON.parse(stdout);
    } catch (err: any) {
        const msg = err.stderr?.trim() || err.message;
        debug('gh api error:', msg);
        throw new Error(`gh api failed: ${msg}`);
    }
}

export default {
    definition: {
        name: 'github',
        description: toolDescription,
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['list', 'read', 'create', 'update'],
                    description:
                        'The operation to perform. ' +
                        'Use "list" to see files in a directory. ' +
                        'Use "read" to get the full content of a single file. ' +
                        'Use "create" to write a brand new file (fails if file already exists). ' +
                        'Use "update" to overwrite an existing file (fails if file does not exist). ' +
                        'Start with "list" if you are unsure what files exist.'
                },
                repo: {
                    type: 'string',
                    description: 'GitHub repository in "owner/repo" format.'
                },
                path: {
                    type: 'string',
                    description:
                        'File or directory path inside the repo (e.g. "content/blog" or "content/blog/my-post.md").'
                },
                content: {
                    type: 'string',
                    description:
                        'The full file content to write. Required for "create" and "update" actions. ' +
                        'Provide the complete file body (e.g. the full markdown of a blog post). Ignored for "list" and "read".'
                },
                message: {
                    type: 'string',
                    description:
                        'A short Git commit message describing the change. Required for "create" and "update" actions. ' +
                        'Example: "Add new blog post about agile coaching". Ignored for "list" and "read".'
                }
            },
            required: ['action', 'repo', 'path']
        }
    },

    handler: async (args: {
        action: 'create' | 'update' | 'read' | 'list';
        repo: string;
        path: string;
        content?: string;
        message?: string;
        _context?: { agentId?: string; toolConfig?: { repos?: Record<string, string[]> } };
    }) => {
        const { action, repo, path, content, message, _context } = args;

        // --- Validation ---

        debug('handler called:', { action, repo, path, hasContent: !!content, hasMessage: !!message });
        debug('GH_TOKEN at call time:', !!process.env.GH_TOKEN);

        if (!process.env.GH_TOKEN) {
            return { error: 'GH_TOKEN environment variable is not set. Set GH_TOKEN in your .env file.' };
        }

        const reposConfig = _context?.toolConfig?.repos;

        const allowedRepos = reposConfig
            ? Object.keys(reposConfig)
            : (process.env.GITHUB_ALLOWED_REPOS || '').split(',').map(r => r.trim()).filter(Boolean);

        if (allowedRepos.length === 0) {
            return { error: 'No allowed repositories configured. Set repos in tool config or GITHUB_ALLOWED_REPOS env var.' };
        }

        if (!allowedRepos.includes(repo)) {
            return { error: `Repository "${repo}" is not in the allowed list. Allowed: ${allowedRepos.join(', ')}` };
        }

        const allowedPaths = reposConfig
            ? reposConfig[repo] ?? []
            : (process.env.GITHUB_ALLOWED_PATHS || '').split(',').map(p => p.trim()).filter(Boolean);

        // Path validation (skip for list at repo root)
        const isRootList = action === 'list' && (!path || path === '' || path === '/' || path === '.');
        if (!isRootList && allowedPaths.length > 0) {
            const normalizedPath = path.replace(/^\//, '');
            const pathAllowed = allowedPaths.some((prefix) => normalizedPath.startsWith(prefix));
            if (!pathAllowed) {
                return {
                    error: `Path "${path}" is not within allowed prefixes. Allowed: ${allowedPaths.join(', ')}`
                };
            }
        }

        if ((action === 'create' || action === 'update') && !content) {
            return { error: `"content" is required for the "${action}" action.` };
        }

        if ((action === 'create' || action === 'update') && !message) {
            return { error: `"message" (commit message) is required for the "${action}" action.` };
        }

        // --- Actions ---

        const normalizedPath = path.replace(/^\//, '');
        const endpoint = `/repos/${repo}/contents/${normalizedPath}`;

        try {
            if (action === 'list') {
                const data = await ghApi(endpoint);

                if (!Array.isArray(data)) {
                    return { error: 'Path does not point to a directory.' };
                }

                return {
                    repo,
                    path: normalizedPath || '/',
                    files: data.map((item: any) => ({
                        name: item.name,
                        path: item.path,
                        type: item.type,
                        size: item.size
                    }))
                };
            }

            if (action === 'read') {
                const data = await ghApi(endpoint);

                if (data.type !== 'file') {
                    return { error: `"${normalizedPath}" is not a file (type: ${data.type}). Use "list" for directories.` };
                }

                const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
                return {
                    repo,
                    path: normalizedPath,
                    content: decoded,
                    sha: data.sha,
                    size: data.size
                };
            }

            if (action === 'create') {
                // Check the file doesn't already exist
                try {
                    await ghApi(endpoint);
                    return { error: `File "${normalizedPath}" already exists. Use "update" action instead.` };
                } catch {
                    // 404 expected — file doesn't exist yet
                }

                const encoded = Buffer.from(content!, 'utf-8').toString('base64');
                const data = await ghApi(endpoint,
                    '--method', 'PUT',
                    '-f', `message=${message!}`,
                    '-f', `content=${encoded}`
                );

                return {
                    action: 'created',
                    repo,
                    path: normalizedPath,
                    sha: data.content?.sha,
                    commit: data.commit?.sha
                };
            }

            if (action === 'update') {
                // Fetch current SHA
                let existing: any;
                try {
                    existing = await ghApi(endpoint);
                } catch {
                    return { error: `Cannot update "${normalizedPath}": file not found. Use "create" action instead.` };
                }

                const encoded = Buffer.from(content!, 'utf-8').toString('base64');
                const data = await ghApi(endpoint,
                    '--method', 'PUT',
                    '-f', `message=${message!}`,
                    '-f', `content=${encoded}`,
                    '-f', `sha=${existing.sha}`
                );

                return {
                    action: 'updated',
                    repo,
                    path: normalizedPath,
                    sha: data.content?.sha,
                    commit: data.commit?.sha
                };
            }

            return { error: `Unknown action: "${action}". Valid actions: create, update, read, list.` };
        } catch (err: any) {
            console.error('[GitHub] Error:', err);
            return { error: `GitHub operation failed: ${err.message}` };
        }
    }
};
