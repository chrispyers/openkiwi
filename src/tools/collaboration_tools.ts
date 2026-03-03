import { TaskService } from '../services/task-service.js';

export const get_assigned_tasks = {
    definition: {
        name: 'get_assigned_tasks',
        displayName: 'Tasks: Get Assigned',
        pluginType: 'skill',
        description: 'Fetch tasks currently assigned to you. Use this to find out what you should be working on right now.',
        parameters: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    handler: async ({ _context }: { _context?: { agentId: string } }) => {
        if (!_context?.agentId) {
            return { error: 'Agent context required' };
        }
        try {
            const tasks = TaskService.getTasksAssignedToAgent(_context.agentId);
            return { tasks };
        } catch (error: any) {
            return { error: `Failed to fetch tasks: ${error.message}` };
        }
    }
};

export const read_task = {
    definition: {
        name: 'read_task',
        displayName: 'Tasks: Read',
        pluginType: 'skill',
        description: 'Retrieve details and comment history for a specific task.',
        parameters: {
            type: 'object',
            properties: {
                task_id: {
                    type: 'string',
                    description: 'The ID of the task to read.'
                }
            },
            required: ['task_id']
        }
    },
    handler: async ({ task_id, _context }: { task_id: string; _context?: { agentId: string } }) => {
        if (!_context?.agentId) {
            return { error: 'Agent context required' };
        }
        try {
            const task = TaskService.getTask(task_id);
            if (!task) return { error: `Task ${task_id} not found.` };
            const comments = TaskService.getTaskComments(task_id);
            return { task, comments };
        } catch (error: any) {
            return { error: `Failed to read task: ${error.message}` };
        }
    }
};

export const add_task_comment = {
    definition: {
        name: 'add_task_comment',
        displayName: 'Tasks: Add Comment',
        pluginType: 'skill',
        description: 'Leave a comment, feedback, or status update on a task. Always explain what you did or what needs to be fixed before moving a task.',
        parameters: {
            type: 'object',
            properties: {
                task_id: {
                    type: 'string',
                    description: 'The ID of the task.'
                },
                content: {
                    type: 'string',
                    description: 'The comment or feedback content.'
                }
            },
            required: ['task_id', 'content']
        }
    },
    handler: async ({ task_id, content, _context }: { task_id: string; content: string; _context?: { agentId: string } }) => {
        if (!_context?.agentId) {
            return { error: 'Agent context required' };
        }
        try {
            const comment = TaskService.addTaskComment(task_id, _context.agentId, content);
            return { success: true, comment };
        } catch (error: any) {
            return { error: `Failed to add comment: ${error.message}` };
        }
    }
};

export const update_task_state = {
    definition: {
        name: 'update_task_state',
        displayName: 'Tasks: Update State',
        pluginType: 'skill',
        description: 'Move a task to a different state in its workflow pipeline.',
        parameters: {
            type: 'object',
            properties: {
                task_id: {
                    type: 'string',
                    description: 'The ID of the task.'
                },
                state_id: {
                    type: 'string',
                    description: 'The ID of the new workflow state you want to move the task to.'
                }
            },
            required: ['task_id', 'state_id']
        }
    },
    handler: async ({ task_id, state_id, _context }: { task_id: string; state_id: string; _context?: { agentId: string } }) => {
        if (!_context?.agentId) {
            return { error: 'Agent context required' };
        }
        try {
            const task = TaskService.updateTaskState(task_id, state_id);
            if (!task) return { error: `Task ${task_id} or State not found.` };
            return { success: true, task };
        } catch (error: any) {
            return { error: `Failed to update task state: ${error.message}` };
        }
    }
};

export const create_task = {
    definition: {
        name: 'create_task',
        displayName: 'Tasks: Create',
        pluginType: 'skill',
        description: 'Automatically generate and assign a sub-task or new task.',
        parameters: {
            type: 'object',
            properties: {
                workflow_id: {
                    type: 'string',
                    description: 'The ID of the workflow this task belongs to.'
                },
                state_id: {
                    type: 'string',
                    description: 'The ID of the initial workflow state.'
                },
                title: {
                    type: 'string',
                    description: 'A concise title for the task.'
                },
                description: {
                    type: 'string',
                    description: 'A detailed description of the task.'
                },
                parent_task_id: {
                    type: 'string',
                    description: '(Optional) The ID of a parent task if this is a sub-task.'
                }
            },
            required: ['workflow_id', 'state_id', 'title']
        }
    },
    handler: async ({ workflow_id, state_id, title, description, parent_task_id, _context }: { workflow_id: string; state_id: string; title: string; description?: string; parent_task_id?: string; _context?: { agentId: string } }) => {
        if (!_context?.agentId) {
            return { error: 'Agent context required' };
        }
        try {
            const task = TaskService.createTask(workflow_id, state_id, title, description || '', parent_task_id || null);
            return { success: true, task };
        } catch (error: any) {
            return { error: `Failed to create task: ${error.message}` };
        }
    }
};
