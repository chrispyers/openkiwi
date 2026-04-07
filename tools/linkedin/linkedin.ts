import { LinkedInManager } from '../../src/linkedin-manager.js';

export default {
    definition: {
        name: 'linkedin',
        displayName: 'LinkedIn',
        pluginType: 'tool',
        description: [
            'Publish LinkedIn posts to your profile.',
            'Actions: create_post (draft for user approval), publish_post (publish after approval).',
            '',
            'WORKFLOW: To create a post, first call create_post to show the user a preview.',
            'If the user approves, call publish_post with the same text.',
            'If the user wants edits, revise and call create_post again.',
        ].join('\n'),
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['create_post', 'publish_post'],
                    description: 'The action to perform',
                },
                text: {
                    type: 'string',
                    description: 'Post text content',
                },
                image_url: {
                    type: 'string',
                    description: 'Optional image URL to attach to a post',
                },
                link_url: {
                    type: 'string',
                    description: 'Optional link URL to attach to a post',
                },
            },
            required: ['action'],
        },
    },

    handler: async (args: {
        action: string;
        text?: string;
        image_url?: string;
        link_url?: string;
        _context?: any;
    }) => {
        const linkedin = LinkedInManager.getInstance();
        const status = linkedin.getStatus();

        if (!status.connected) {
            return { error: 'LinkedIn is not connected. Please authenticate via Settings > Connections.' };
        }

        const requireApproval = args._context?.toolConfig?.requireApproval !== false; // default true

        switch (args.action) {

            // ── Draft a post for user approval ───────────────────────────
            case 'create_post': {
                if (!args.text) return { error: 'text is required for create_post' };
                if (args.text.length > 3000) {
                    return { error: `Post exceeds LinkedIn's 3000-character limit (${args.text.length} chars). Please shorten it.` };
                }

                if (!requireApproval) {
                    // Skip approval — publish directly
                    try {
                        const result = await linkedin.createPost(args.text, {
                            imageUrl: args.image_url,
                            linkUrl: args.link_url,
                        });
                        return { status: 'published', ...result };
                    } catch (err: any) {
                        return { error: `Failed to publish: ${err.message}` };
                    }
                }

                // Yield for user approval
                let preview = `**LinkedIn Post Preview**\n\n---\n${args.text}\n---`;
                if (args.image_url) preview += `\n\nImage: ${args.image_url}`;
                if (args.link_url) preview += `\nLink: ${args.link_url}`;
                preview += `\n\nCharacters: ${args.text.length}/3000`;

                return {
                    __YIELD__: true,
                    type: 'ask_user',
                    question: preview,
                    options: ['Publish', 'Edit', 'Cancel'],
                };
            }

            // ── Publish a post (after approval) ──────────────────────────
            case 'publish_post': {
                if (!args.text) return { error: 'text is required for publish_post' };
                try {
                    const result = await linkedin.createPost(args.text, {
                        imageUrl: args.image_url,
                        linkUrl: args.link_url,
                    });
                    return { status: 'published', ...result };
                } catch (err: any) {
                    return { error: `Failed to publish: ${err.message}` };
                }
            }

            default:
                return { error: `Unknown action: ${args.action}. Valid actions: create_post, publish_post` };
        }
    },
};
