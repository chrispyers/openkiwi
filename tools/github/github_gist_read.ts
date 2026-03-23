import { debug, ghApi, checkToken } from './shared.js';

export default {
    definition: {
        name: 'github_gist_read',
        displayName: 'GitHub Gist Read',
        description: 'Read the contents of a GitHub gist by its ID.',
        parameters: {
            type: 'object' as const,
            properties: {
                gist_id: {
                    type: 'string',
                    description: 'The gist ID (the hash from the gist URL).'
                }
            },
            required: ['gist_id']
        }
    },

    handler: async (args: { gist_id: string }) => {
        const { gist_id } = args;
        debug('github_gist_read called:', { gist_id });

        const tokenErr = checkToken();
        if (tokenErr) return tokenErr;

        try {
            const data = await ghApi(`/gists/${gist_id}`);
            const files = Object.entries(data.files || {}).map(([filename, file]: [string, any]) => ({
                filename,
                content: file.content,
                size: file.size,
                language: file.language
            }));
            return { gist_id, owner: data.owner?.login, files };
        } catch (err: any) {
            return { error: `Failed to read gist: ${err.message}` };
        }
    }
};
