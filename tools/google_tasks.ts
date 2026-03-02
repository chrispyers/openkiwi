import { google } from 'googleapis';

type Action = 'list_tasklists' | 'list_tasks' | 'add_task' | 'update_task';

interface GoogleTasksArgs {
    action: Action;
    tasklist_id?: string;
    task_id?: string;
    title?: string;
    notes?: string;
    due?: string;
    status?: 'needsAction' | 'completed';
}

function getClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Missing Google credentials. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in .env');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return google.tasks({ version: 'v1', auth: oauth2Client });
}

function toRfc3339(dateStr: string): string {
    return `${dateStr}T00:00:00.000Z`;
}

export default {
    definition: {
        name: 'google_tasks',
        description: 'Manage Google Tasks: list task lists, list tasks, add tasks, and update tasks.',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['list_tasklists', 'list_tasks', 'add_task', 'update_task'],
                    description: 'The action to perform.'
                },
                tasklist_id: {
                    type: 'string',
                    description: 'The task list ID. Required for list_tasks, add_task, and update_task.'
                },
                task_id: {
                    type: 'string',
                    description: 'The task ID. Required for update_task.'
                },
                title: {
                    type: 'string',
                    description: 'Task title. Required for add_task, optional for update_task.'
                },
                notes: {
                    type: 'string',
                    description: 'Task notes/description. Optional.'
                },
                due: {
                    type: 'string',
                    description: 'Due date in YYYY-MM-DD format. Optional.'
                },
                status: {
                    type: 'string',
                    enum: ['needsAction', 'completed'],
                    description: 'Task status. Only for update_task.'
                }
            },
            required: ['action']
        }
    },
    handler: async (args: GoogleTasksArgs) => {
        try {
            const tasksApi = getClient();

            switch (args.action) {
                case 'list_tasklists': {
                    const res = await tasksApi.tasklists.list({ maxResults: 100 });
                    const items = res.data.items || [];
                    return {
                        tasklists: items.map(tl => ({
                            id: tl.id,
                            title: tl.title
                        }))
                    };
                }

                case 'list_tasks': {
                    if (!args.tasklist_id) {
                        return { error: 'tasklist_id is required for list_tasks' };
                    }
                    const res = await tasksApi.tasks.list({
                        tasklist: args.tasklist_id,
                        maxResults: 100,
                        showCompleted: true,
                        showHidden: true
                    });
                    const items = res.data.items || [];
                    return {
                        tasks: items.map(t => ({
                            id: t.id,
                            title: t.title,
                            notes: t.notes || null,
                            status: t.status,
                            due: t.due || null
                        }))
                    };
                }

                case 'add_task': {
                    if (!args.tasklist_id) {
                        return { error: 'tasklist_id is required for add_task' };
                    }
                    if (!args.title) {
                        return { error: 'title is required for add_task' };
                    }
                    const body: Record<string, string> = { title: args.title };
                    if (args.notes) body.notes = args.notes;
                    if (args.due) body.due = toRfc3339(args.due);

                    const res = await tasksApi.tasks.insert({
                        tasklist: args.tasklist_id,
                        requestBody: body
                    });
                    return {
                        created: {
                            id: res.data.id,
                            title: res.data.title,
                            status: res.data.status,
                            due: res.data.due || null
                        }
                    };
                }

                case 'update_task': {
                    if (!args.tasklist_id) {
                        return { error: 'tasklist_id is required for update_task' };
                    }
                    if (!args.task_id) {
                        return { error: 'task_id is required for update_task' };
                    }
                    const body: Record<string, string> = {};
                    if (args.title) body.title = args.title;
                    if (args.notes) body.notes = args.notes;
                    if (args.due) body.due = toRfc3339(args.due);
                    if (args.status) body.status = args.status;

                    const res = await tasksApi.tasks.patch({
                        tasklist: args.tasklist_id,
                        task: args.task_id,
                        requestBody: body
                    });
                    return {
                        updated: {
                            id: res.data.id,
                            title: res.data.title,
                            status: res.data.status,
                            due: res.data.due || null
                        }
                    };
                }

                default:
                    return { error: `Unknown action: ${args.action}` };
            }
        } catch (err: any) {
            return { error: err.message || 'Google Tasks API error' };
        }
    }
};
