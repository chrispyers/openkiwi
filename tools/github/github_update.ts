import { debug, ghApi, checkToken, validateRepoAccess, ToolContext } from './shared.js';

export default {
    definition: {
        name: 'github_update',
        displayName: 'GitHub Update',
        configKey: 'github',
        description: 'Update an existing file in a GitHub repository. Fails if the file does not exist — use github_create instead.',
        parameters: {
            type: 'object' as const,
            properties: {
                repo: {
                    type: 'string',
                    description: 'GitHub repository in "owner/repo" format.'
                },
                path: {
                    type: 'string',
                    description: 'File path to update (e.g. "content/blog/my-post.md").'
                },
                content: {
                    type: 'string',
                    description: 'The full replacement file content.'
                },
                message: {
                    type: 'string',
                    description: 'A short Git commit message describing the change.'
                }
            },
            required: ['repo', 'path', 'content', 'message']
        }
    },

    handler: async (args: { repo: string; path: string; content: string; message: string; _context?: ToolContext }) => {
        const { repo, path, content, message, _context } = args;
        debug('github_update called:', { repo, path, hasContent: !!content });

        const tokenErr = checkToken();
        if (tokenErr) return tokenErr;

        const repoErr = validateRepoAccess(repo, path, false, _context);
        if (repoErr) return repoErr;

        const normalizedPath = path.replace(/^\//, '');
        const endpoint = `/repos/${repo}/contents/${normalizedPath}`;

        try {
            // Fetch current SHA
            let existing: any;
            try {
                existing = await ghApi(endpoint);
            } catch {
                return { error: `Cannot update "${normalizedPath}": file not found. Use github_create instead.` };
            }

            const encoded = Buffer.from(content, 'utf-8').toString('base64');
            const data = await ghApi(endpoint,
                '--method', 'PUT',
                '-f', `message=${message}`,
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
        } catch (err: any) {
            return { error: `GitHub operation failed: ${err.message}` };
        }
    }
};
