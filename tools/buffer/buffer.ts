const BUFFER_API_URL = 'https://api.buffer.com';
const DEBUG = !!process.env.BUFFER_DEBUG;

function debug(...args: any[]) {
    if (DEBUG) console.log('[Buffer]', ...args);
}

function getApiKey(): string {
    const key = process.env.BUFFER_API_KEY;
    if (!key) {
        throw new Error('BUFFER_API_KEY not found in environment variables');
    }
    return key;
}

async function bufferGraphQL(query: string, variables?: Record<string, any>): Promise<any> {
    const apiKey = getApiKey();
    debug('Request:', JSON.stringify({ query: query.trim(), variables }, null, 2));

    const response = await fetch(BUFFER_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
    });

    const text = await response.text();
    debug('Response status:', response.status);
    debug('Response body:', text);

    if (!response.ok) {
        throw new Error(`Buffer API error (${response.status}): ${text}`);
    }

    let json: any;
    try {
        json = JSON.parse(text);
    } catch {
        throw new Error(`Buffer API returned non-JSON response: ${text.substring(0, 500)}`);
    }

    if (json.errors && json.errors.length > 0) {
        throw new Error(`Buffer GraphQL error: ${json.errors.map((e: any) => e.message).join(', ')}`);
    }
    if (!json.data) {
        throw new Error(`Buffer API returned no data: ${text.substring(0, 500)}`);
    }
    return json.data;
}

export default {
    definition: {
        name: 'buffer',
        displayName: 'Buffer',
        pluginType: 'tool',
        description: 'Manage social media posts via Buffer. List channels, create/schedule posts, list existing posts, and delete posts.',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['get_account', 'list_channels', 'create_post', 'list_posts', 'delete_post'],
                    description: 'The action to perform.'
                },
                organizationId: {
                    type: 'string',
                    description: 'The Buffer organization ID. Required for list_channels, create_post, and list_posts. Use get_account to find this.'
                },
                channelId: {
                    type: 'string',
                    description: 'The channel ID to post to. Required for create_post.'
                },
                text: {
                    type: 'string',
                    description: 'The post text content. Required for create_post.'
                },
                mode: {
                    type: 'string',
                    enum: ['addToQueue', 'shareNext', 'shareNow', 'customScheduled'],
                    description: 'How to schedule the post. Defaults to addToQueue. Use customScheduled with dueAt for a specific time.'
                },
                dueAt: {
                    type: 'string',
                    description: 'ISO 8601 datetime for when to publish (e.g. "2026-04-08T10:00:00Z"). Required when mode is customScheduled.'
                },
                imageUrls: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional array of image URLs to attach to the post.'
                },
                tagIds: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional array of tag IDs to apply to the post.'
                },
                postId: {
                    type: 'string',
                    description: 'The post ID. Required for delete_post.'
                },
                status: {
                    type: 'string',
                    enum: ['draft', 'buffer', 'sent', 'failed', 'scheduled'],
                    description: 'Filter posts by status when using list_posts.'
                },
                channelIds: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Filter posts by channel IDs when using list_posts.'
                },
                limit: {
                    type: 'number',
                    description: 'Number of posts to return for list_posts. Defaults to 20.'
                }
            },
            required: ['action']
        }
    },

    handler: async (args: {
        action: string;
        organizationId?: string;
        channelId?: string;
        text?: string;
        mode?: string;
        dueAt?: string;
        imageUrls?: string[];
        tagIds?: string[];
        postId?: string;
        status?: string;
        channelIds?: string[];
        limit?: number;
        _context?: any;
    }) => {
        try {
            switch (args.action) {
                case 'get_account': {
                    const data = await bufferGraphQL(`
                        query GetAccount {
                            account {
                                id
                                name
                                email
                                timezone
                                organizations {
                                    id
                                    name
                                }
                            }
                        }
                    `);
                    return data.account;
                }

                case 'list_channels': {
                    if (!args.organizationId) {
                        return { error: 'organizationId is required for list_channels. Use get_account first to find it.' };
                    }
                    const data = await bufferGraphQL(`
                        query GetChannels($input: ChannelsInput!) {
                            channels(input: $input) {
                                id
                                name
                                service
                                type
                                avatar
                                isLocked
                            }
                        }
                    `, {
                        input: { organizationId: args.organizationId }
                    });
                    return { channels: data.channels };
                }

                case 'create_post': {
                    if (!args.channelId) {
                        return { error: 'channelId is required for create_post. Use list_channels first to find it.' };
                    }
                    if (!args.text) {
                        return { error: 'text is required for create_post.' };
                    }

                    const mode = args.mode || 'addToQueue';

                    if (mode === 'customScheduled' && !args.dueAt) {
                        return { error: 'dueAt is required when mode is customScheduled.' };
                    }

                    const input: Record<string, any> = {
                        channelId: args.channelId,
                        text: args.text,
                        schedulingType: 'automatic',
                        mode: mode,
                    };

                    if (args.dueAt) {
                        input.dueAt = args.dueAt;
                    }

                    if (args.tagIds && args.tagIds.length > 0) {
                        input.tagIds = args.tagIds;
                    }

                    if (args.imageUrls && args.imageUrls.length > 0) {
                        input.assets = {
                            images: args.imageUrls.map(url => ({ url }))
                        };
                    }

                    const data = await bufferGraphQL(`
                        mutation CreatePost($input: CreatePostInput!) {
                            createPost(input: $input) {
                                __typename
                                ... on PostActionSuccess {
                                    post {
                                        id
                                        status
                                        text
                                        dueAt
                                        createdAt
                                        channelId
                                    }
                                }
                                ... on InvalidInputError {
                                    message
                                }
                                ... on NotFoundError {
                                    message
                                }
                                ... on UnauthorizedError {
                                    message
                                }
                                ... on RestProxyError {
                                    message
                                    code
                                }
                            }
                        }
                    `, { input });

                    const result = data.createPost;
                    debug('createPost result:', JSON.stringify(result));

                    if (!result) {
                        return { error: 'Buffer returned an empty response for createPost.' };
                    }
                    if (result.__typename !== 'PostActionSuccess') {
                        return { error: `Buffer createPost failed (${result.__typename}): ${result.message || 'Unknown error'}` };
                    }
                    if (!result.post) {
                        return { error: 'Buffer returned PostActionSuccess but no post object.' };
                    }
                    return { success: true, post: result.post };
                }

                case 'list_posts': {
                    if (!args.organizationId) {
                        return { error: 'organizationId is required for list_posts. Use get_account first to find it.' };
                    }

                    const input: Record<string, any> = {
                        organizationId: args.organizationId,
                    };

                    if (args.status || args.channelIds) {
                        input.filter = {};
                        if (args.status) input.filter.status = args.status;
                        if (args.channelIds) input.filter.channelIds = args.channelIds;
                    }

                    const data = await bufferGraphQL(`
                        query GetPosts($input: PostsInput!, $first: Int) {
                            posts(input: $input, first: $first) {
                                posts {
                                    id
                                    status
                                    text
                                    dueAt
                                    createdAt
                                    channelId
                                }
                                total
                            }
                        }
                    `, {
                        input,
                        first: args.limit || 20
                    });
                    return data.posts;
                }

                case 'delete_post': {
                    if (!args.postId) {
                        return { error: 'postId is required for delete_post.' };
                    }

                    const data = await bufferGraphQL(`
                        mutation DeletePost($input: DeletePostInput!) {
                            deletePost(input: $input) {
                                __typename
                                ... on DeletePostSuccess {
                                    id
                                }
                                ... on VoidMutationError {
                                    message
                                }
                            }
                        }
                    `, {
                        input: { id: args.postId }
                    });

                    const result = data.deletePost;
                    if (!result || result.__typename !== 'DeletePostSuccess') {
                        return { error: `Buffer deletePost failed (${result?.__typename}): ${result?.message || 'Unknown error'}` };
                    }
                    return { success: true };
                }

                default:
                    return { error: `Unknown action: ${args.action}. Use one of: get_account, list_channels, create_post, list_posts, delete_post` };
            }
        } catch (error: any) {
            console.error('[Buffer] Error:', error);
            return { error: `Buffer API error: ${error.message}` };
        }
    }
};
