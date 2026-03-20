import chromium from '../chromium/chromium.js';

export default {
    definition: {
        name: 'web_search',
        displayName: 'Web Search',
        pluginType: 'tool',
        description: 'Perform web searches with optional domain filtering',
        requiresApproval: true,
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The search query'
                },
                domainFilter: {
                    type: 'string',
                    description: 'Optional domain to restrict searches to (e.g. "github.com")'
                }
            },
            required: ['query']
        }
    },
    handler: async ({ query, domainFilter }: { query: string, domainFilter?: string }) => {
        let finalQuery = query;
        if (domainFilter) {
            finalQuery = `${query} site:${domainFilter}`;
        }
        return chromium.handler({ action: 'search', input: finalQuery });
    }
};
