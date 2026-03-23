import { debug, ghApi, checkToken, validateRepoAccess, ToolContext } from './shared.js';

export default {
    definition: {
        name: 'github_create',
        displayName: 'GitHub Create',
        configKey: 'github',
        description: 'Create a new file in a GitHub repository. Fails if the file already exists — use github_update instead.',
        parameters: {
            type: 'object' as const,
            properties: {
                repo: {
                    type: 'string',
                    description: 'GitHub repository in "owner/repo" format.'
                },
                path: {
                    type: 'string',
                    description: 'File path to create (e.g. "content/blog/2026-03-18-my-post.md").'
                },
                content: {
                    type: 'string',
                    description: 'The full file content to write (e.g. the complete markdown of a blog post).'
                },
                message: {
                    type: 'string',
                    description: 'A short Git commit message (e.g. "Add new blog post about agile coaching").'
                }
            },
            required: ['repo', 'path', 'content', 'message']
        }
    },

    handler: async (args: { repo: string; path: string; content: string; message: string; _context?: ToolContext }) => {
        const { repo, path, content, message, _context } = args;
        debug('github_create called:', { repo, path, hasContent: !!content });

        const tokenErr = checkToken();
        if (tokenErr) return tokenErr;

        const repoErr = validateRepoAccess(repo, path, false, _context);
        if (repoErr) return repoErr;

        const normalizedPath = path.replace(/^\//, '');
        const endpoint = `/repos/${repo}/contents/${normalizedPath}`;

        try {
            // Check the file doesn't already exist
            try {
                await ghApi(endpoint);
                return { error: `File "${normalizedPath}" already exists. Use github_update instead.` };
            } catch {
                // 404 expected — file doesn't exist yet
            }

            const encoded = Buffer.from(content, 'utf-8').toString('base64');
            const data = await ghApi(endpoint,
                '--method', 'PUT',
                '-f', `message=${message}`,
                '-f', `content=${encoded}`
            );

            return {
                action: 'created',
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
