export default {
    definition: {
        name: 'finish_task',
        displayName: 'Finish Task',
        pluginType: 'core',
        description: 'When you have accomplished the objective, call this tool to explicitly mark the entire task as done.',
        requiresApproval: false,
        parameters: {
            type: 'object',
            properties: {
                summary: {
                    type: 'string',
                    description: 'A summary of what was accomplished'
                }
            },
            required: ['summary']
        }
    },
    handler: async ({ summary }: { summary: string }) => {
        // Also intercepted by agent-loop
        return {
            __STOP__: true,
            type: 'finish_task',
            summary
        };
    }
};
