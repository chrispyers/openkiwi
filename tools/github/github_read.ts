import { debug, ghApi, checkToken, validateRepoAccess, type ToolContext } from './shared.js';

export default {
    definition: {
        name: 'github_read',
        displayName: 'GitHub Read',
        description: 'Read the full content of a single file from a GitHub repository.',
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
                }
            },
            required: ['repo', 'path']
        }
    },

    handler: async (args: { repo: string; path: string; _context?: ToolContext }) => {
        const { repo, path, _context } = args;
        debug('github_read called:', { repo, path });

        const tokenErr = checkToken();
        if (tokenErr) return tokenErr;

        const repoErr = validateRepoAccess(repo, path, false, _context);
        if (repoErr) return repoErr;

        const normalizedPath = path.replace(/^\//, '');
        const endpoint = `/repos/${repo}/contents/${normalizedPath}`;

        try {
            const data = await ghApi(endpoint);
            if (data.type !== 'file') {
                return { error: `"${normalizedPath}" is not a file (type: ${data.type}). Use "github_list" for directories.` };
            }
            const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
            return {
                repo,
                path: normalizedPath,
                content: decoded,
                sha: data.sha,
                size: data.size
            };
        } catch (err: any) {
            return { error: `GitHub operation failed: ${err.message}` };
        }
    }
};
