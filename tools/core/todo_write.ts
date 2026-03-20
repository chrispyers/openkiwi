import * as path from 'path';
import * as fs from 'fs';

const WORKSPACE_DIR = path.resolve(process.cwd(), 'workspace');
const TODO_FILE = path.resolve(WORKSPACE_DIR, '.agent_todo.md');

export default {
    definition: {
        name: 'todo_write',
        displayName: 'Write Todo List',
        pluginType: 'tool',
        description: 'Creates and manages structured task lists for the current session. Use this to plan complex objectives.',
        requiresApproval: false,
        parameters: {
            type: 'object',
            properties: {
                content: {
                    type: 'string',
                    description: 'The complete markdown content of the task list (e.g., "- [ ] Task 1\\n- [x] Task 2")'
                }
            },
            required: ['content']
        }
    },
    handler: async ({ content }: { content: string }) => {
        try {
            fs.writeFileSync(TODO_FILE, content, 'utf-8');
            return { success: true, message: 'Todo list updated successfully' };
        } catch (e: any) {
            return { error: `Failed to update todo list: ${e.message}` };
        }
    }
};
