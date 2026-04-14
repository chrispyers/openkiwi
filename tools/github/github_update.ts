import { debug, ghApi, checkToken, validateRepoAccess, type ToolContext } from './shared.js';

export default {
    definition: {
        name: 'github_update',
        displayName: 'GitHub Update',
        description: 'Update an existing file in a GitHub repository (fails if the file does not exist).',
        parameters: {
            type: 'object' as const,
            properties: {
                repo: {
                    type: 'string',
                    description: 'GitHub repository in "owner/repo" format (e.g. "john-mcfadyen/growingscrummasters.com").'
                },
                path: {
                    type: 'string',
                    description: 'File path inside the repo (e.g. "content/blog/my-post.md").'
                },
                content: {
                    type: 'string',
                    description: 'The full updated file content.'
                },
                message: {
                    type: 'string',
                    description: 'A short Git commit message (e.g. "Update blog post intro").'
                },
                branch: {
                    type: 'string',
                    description: 'Optional branch to commit to (will be created from the default branch if it does not exist). Omit to commit to the default branch.'
                }
            },
            required: ['repo', 'path', 'content', 'message']
        }
    },

    handler: async (args: { repo: string; path: string; content: string; message: string; branch?: string; _context?: ToolContext }) => {
        const { repo, path, content, message, branch, _context } = args;
        debug('github_update called:', { repo, path, branch });

        const tokenErr = checkToken();
        if (tokenErr) return tokenErr;

        const repoErr = validateRepoAccess(repo, path, false, _context);
        if (repoErr) return repoErr;

        const normalizedPath = path.replace(/^\//, '');
        const endpoint = `/repos/${repo}/contents/${normalizedPath}`;

        try {
            // If a branch is specified, ensure it exists (create from default branch if not)
            if (branch) {
                try {
                    await ghApi(`/repos/${repo}/git/ref/heads/${branch}`);
                } catch {
                    // Branch doesn't exist — create it from the default branch
                    const repoInfo = await ghApi(`/repos/${repo}`);
                    const defaultBranch = repoInfo.default_branch || 'main';
                    const defaultRef = await ghApi(`/repos/${repo}/git/ref/heads/${defaultBranch}`);
                    await ghApi(`/repos/${repo}/git/refs`,
                        '--method', 'POST',
                        '-f', `ref=refs/heads/${branch}`,
                        '-f', `sha=${defaultRef.object.sha}`
                    );
                    debug('Created branch:', branch);
                }
            }

            // Fetch current SHA (from the target branch if specified)
            let existing: any;
            try {
                const refParam = branch ? `?ref=${branch}` : '';
                existing = await ghApi(`${endpoint}${refParam}`);
            } catch {
                return { error: `Cannot update "${normalizedPath}": file not found. Use "github_create" instead.` };
            }

            const encoded = Buffer.from(content, 'utf-8').toString('base64');
            const putArgs = [
                endpoint,
                '--method', 'PUT',
                '-f', `message=${message}`,
                '-f', `content=${encoded}`,
                '-f', `sha=${existing.sha}`
            ];
            if (branch) putArgs.push('-f', `branch=${branch}`);
            const data = await ghApi(...putArgs);

            return {
                action: 'updated',
                repo,
                path: normalizedPath,
                branch: branch || 'default',
                sha: data.content?.sha,
                commit: data.commit?.sha
            };
        } catch (err: any) {
            return { error: `GitHub operation failed: ${err.message}` };
        }
    }
};
