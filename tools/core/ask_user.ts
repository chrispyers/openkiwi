export default {
    definition: {
        name: 'ask_user',
        displayName: 'Ask User',
        pluginType: 'core',
        description: 'When you need clarity, a password, or a decision, call this tool to ask the user. For simple questions, provide options.',
        requiresApproval: false,
        parameters: {
            type: 'object',
            properties: {
                question: {
                    type: 'string',
                    description: 'The question to ask the user'
                },
                options: {
                    type: 'array',
                    description: 'Optional list of quick-action buttons for the user to click (e.g. ["Yes", "No"])',
                    items: { type: 'string' }
                }
            },
            required: ['question']
        }
    },
    handler: async ({ question, options }: { question: string, options?: string[] }) => {
        // This is a special tool. In Phase 2, the agent-loop will intercept this
        // and pause execution instead of actually running this handler directly.
        // But if it slips through, we return a signal object.
        return {
            __YIELD__: true,
            type: 'ask_user',
            question,
            options
        };
    }
};
