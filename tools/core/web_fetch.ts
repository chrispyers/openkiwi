import chromium from '../chromium/chromium.js';

export default {
    definition: {
        name: 'web_fetch',
        displayName: 'Web Fetch',
        pluginType: 'tool',
        description: 'Fetches content from a specified URL',
        requiresApproval: true,
        parameters: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: 'The URL to fetch'
                },
                screenshot: {
                    type: 'boolean',
                    description: 'Whether to capture a screenshot of the page. Defaults to false. When true, a screenshot_url is included in the result.'
                }
            },
            required: ['url']
        }
    },
    handler: async ({ url, screenshot = false }: { url: string; screenshot?: boolean }) => {
        return chromium.handler({ action: 'browse', input: url, screenshot });
    }
};
