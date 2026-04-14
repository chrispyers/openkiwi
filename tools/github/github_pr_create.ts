import { debug, ghApi, checkToken, type ToolContext } from './shared.js';

export default {
    definition: {
        name: 'github_pr_create',
        displayName: 'GitHub PR Create',
        description: 'Create a pull request in a GitHub repository for review.',
        parameters: {
            type: 'object' as const,
            properties: {
                repo: {
                    type: 'string',
                    description: 'GitHub repository in "owner/repo" format.'
                },
                head: {
                    type: 'string',
                    description: 'The branch containing the changes (e.g. "editorial/blog/my-post").'
                },
                title: {
                    type: 'string',
                    description: 'Pull request title.'
                },
                body: {
                    type: 'string',
                    description: 'Pull request description (markdown).'
                }
            },
            required: ['repo', 'head', 'title', 'body']
        }
    },

    handler: async (args: { repo: string; head: string; title: string; body: string; _context?: ToolContext }) => {
        const { repo, head, title, body } = args;
        debug('github_pr_create called:', { repo, head });

        const tokenErr = checkToken();
        if (tokenErr) return tokenErr;

        try {
            // Get default branch
            const repoInfo = await ghApi(`/repos/${repo}`);
            const base = repoInfo.default_branch || 'main';

            // Check for existing open PR from this branch
            const existing = await ghApi(`/repos/${repo}/pulls?head=${repo.split('/')[0]}:${head}&state=open`);
            if (Array.isArray(existing) && existing.length > 0) {
                return {
                    action: 'existing',
                    pr_number: existing[0].number,
                    url: existing[0].html_url,
                    message: 'A PR already exists for this branch.'
                };
            }

            const data = await ghApi(`/repos/${repo}/pulls`,
                '--method', 'POST',
                '-f', `title=${title}`,
                '-f', `body=${body}`,
                '-f', `head=${head}`,
                '-f', `base=${base}`
            );

            return {
                action: 'created',
                pr_number: data.number,
                url: data.html_url,
                repo,
                head,
                base
            };
        } catch (err: any) {
            return { error: `PR creation failed: ${err.message}` };
        }
    }
};
