import { debug, ghApi, checkToken, validateRepoAccess, ToolContext } from './shared.js';

export default {
    definition: {
        name: 'github_list',
        displayName: 'GitHub List',
        configKey: 'github',
        description: 'List files and directories in a GitHub repository path.',
        parameters: {
            type: 'object' as const,
            properties: {
                repo: {
                    type: 'string',
                    description: 'GitHub repository in "owner/repo" format.'
                },
                path: {
                    type: 'string',
                    description: 'Directory path inside the repo (e.g. "content/blog"). Use "/" or omit for repo root.'
                }
            },
            required: ['repo']
        }
    },

    handler: async (args: { repo: string; path?: string; _context?: ToolContext }) => {
        const { repo, path = '', _context } = args;
        debug('github_list called:', { repo, path });

        const tokenErr = checkToken();
        if (tokenErr) return tokenErr;

        const isRoot = !path || path === '' || path === '/' || path === '.';
        const repoErr = validateRepoAccess(repo, path, isRoot, _context);
        if (repoErr) return repoErr;

        const normalizedPath = path.replace(/^\//, '');
        const endpoint = `/repos/${repo}/contents/${normalizedPath}`;

        try {
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
        } catch (err: any) {
            return { error: `GitHub operation failed: ${err.message}` };
        }
    }
};
