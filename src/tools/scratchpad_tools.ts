import { Scratchpad } from '../services/scratchpad.js';

export const scratchpad_write = {
    definition: {
        name: 'scratchpad_write',
        displayName: 'Scratchpad: Write',
        pluginType: 'skill',
        description:
            'Write findings to a shared scratchpad so other agents working on the same run can see them. ' +
            'Use this during multi-agent delegation to share intermediate or final results.',
        parameters: {
            type: 'object',
            properties: {
                run_id: {
                    type: 'string',
                    description: 'The shared run ID (provided when you were delegated a task).',
                },
                label: {
                    type: 'string',
                    description: 'A short label describing what this data represents (e.g. "ASO keywords", "competitor reviews").',
                },
                data: {
                    type: 'object',
                    description: 'The findings or results to share. Keep concise — other agents will read this.',
                },
                status: {
                    type: 'string',
                    enum: ['partial', 'complete'],
                    description: 'Whether this is a partial update or your final output. Defaults to "complete".',
                },
            },
            required: ['run_id', 'label', 'data'],
        },
    },
    handler: async ({
        run_id,
        label,
        data,
        status,
        _context,
    }: {
        run_id: string;
        label: string;
        data: any;
        status?: 'partial' | 'complete';
        _context?: { agentId: string };
    }) => {
        if (!_context?.agentId) return { error: 'Agent context required' };
        if (!run_id) return { error: 'run_id is required' };
        if (!label) return { error: 'label is required' };

        Scratchpad.write(run_id, {
            agentId: _context.agentId,
            label,
            timestamp: Date.now(),
            data,
            status: status || 'complete',
        });

        return { success: true, run_id, label };
    },
};

export const scratchpad_read = {
    definition: {
        name: 'scratchpad_read',
        displayName: 'Scratchpad: Read',
        pluginType: 'skill',
        description:
            'Read findings from other agents working on the same run. ' +
            'Use this to consume results from parallel agents before synthesizing your own output.',
        parameters: {
            type: 'object',
            properties: {
                run_id: {
                    type: 'string',
                    description: 'The shared run ID.',
                },
                agent_id: {
                    type: 'string',
                    description: 'Optional: filter entries to a specific agent.',
                },
            },
            required: ['run_id'],
        },
    },
    handler: async ({
        run_id,
        agent_id,
        _context,
    }: {
        run_id: string;
        agent_id?: string;
        _context?: { agentId: string };
    }) => {
        if (!_context?.agentId) return { error: 'Agent context required' };
        if (!run_id) return { error: 'run_id is required' };

        const entries = Scratchpad.read(run_id, agent_id ? { agentId: agent_id } : undefined);

        return {
            run_id,
            entry_count: entries.length,
            entries: entries.map(e => ({
                agent: e.agentId,
                label: e.label,
                status: e.status,
                timestamp: e.timestamp,
                data: e.data,
            })),
        };
    },
};
