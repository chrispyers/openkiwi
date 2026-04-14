import { WorkflowService } from '../services/workflow-service.js';
import { broadcastMessage } from '../state.js';

export const execute_workflow = {
    definition: {
        name: 'execute_workflow',
        displayName: 'Workflows: Execute',
        pluginType: 'skill',
        description: 'Execute a previously saved workflow by its exact name or ID. ONLY use this when the user explicitly asks to run a named workflow (e.g. "run the Reddit monitor workflow"). Do NOT use this for ad-hoc tool calls or when the user asks you to call a specific tool directly.',
        parameters: {
            type: 'object',
            properties: {
                workflow_name: {
                    type: 'string',
                    description: 'The name of the workflow to execute (case-insensitive). Use this if you know the name.'
                },
                workflow_id: {
                    type: 'string',
                    description: 'The ID of the workflow to execute. Use this if you have the exact ID.'
                }
            },
            required: []
        }
    },
    handler: async ({ workflow_name, workflow_id, _context }: { workflow_name?: string; workflow_id?: string; _context?: { agentId: string } }) => {
        if (!_context?.agentId) return { error: 'Agent context required' };

        let targetId = workflow_id;
        if (!targetId) {
            if (!workflow_name) return { error: 'Provide either workflow_name or workflow_id' };
            const workflows = WorkflowService.getWorkflows();
            // Strip surrounding quotes and whitespace the LLM sometimes includes
            const cleanName = workflow_name.trim().replace(/^["']|["']$/g, '').trim();
            const needle = cleanName.toLowerCase();
            // Exact → workflow name contains needle → needle contains workflow name (handles "run the X workflow" phrasing)
            const found = workflows.find(w => w.name.toLowerCase() === needle)
                       ?? workflows.find(w => w.name.toLowerCase().includes(needle))
                       ?? workflows.find(w => needle.includes(w.name.toLowerCase()));
            if (!found) {
                const available = workflows.map(w => `"${w.name}" (id: ${w.id})`).join(', ');
                return { error: `No workflow found matching "${cleanName}". Available workflows: ${available || 'none — no workflows have been created yet'}` };
            }
            targetId = found.id;
        }

        const { executeWorkflow } = await import('../services/workflow-executor.js');
        const result = await executeWorkflow(targetId, _context.agentId, (progress) => {
            broadcastMessage({ type: 'workflow_step_progress', agentId: _context.agentId, ...progress });
        });
        if (result.error) return { error: result.error };
        return { success: result.success, summary: result.finalResponse, stepResults: result.stepResults };
    }
};

export const list_workflows = {
    definition: {
        name: 'list_workflows',
        displayName: 'Workflows: List',
        pluginType: 'skill',
        description: 'List all saved workflows with their names, IDs, and step counts.',
        parameters: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    handler: async ({ _context }: { _context?: { agentId: string } }) => {
        if (!_context?.agentId) return { error: 'Agent context required' };
        try {
            const workflows = WorkflowService.getWorkflows();
            const result = workflows.map(w => {
                const states = WorkflowService.getWorkflowStates(w.id);
                return { id: w.id, name: w.name, description: w.description, steps: states.length };
            });
            return { workflows: result };
        } catch (error: any) {
            return { error: `Failed to list workflows: ${error.message}` };
        }
    }
};
