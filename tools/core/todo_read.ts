import * as path from 'path';
import * as fs from 'fs';

const WORKSPACE_DIR = path.resolve(process.cwd(), 'workspace');
const TODO_FILE = path.resolve(WORKSPACE_DIR, '.agent_todo.md');

export default {
    definition: {
        name: 'todo_read',
        displayName: 'Read Todo List',
        pluginType: 'tool',
        description: 'Reads the current session\'s structured task list',
        requiresApproval: false,
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    handler: async () => {
        try {
            if (!fs.existsSync(TODO_FILE)) {
                return { content: "" };
            }
            return { content: fs.readFileSync(TODO_FILE, 'utf-8') };
        } catch (e: any) {
            return { error: `Failed to read todo list: ${e.message}` };
        }
    }
};
