import fs from 'node:fs';
import path from 'node:path';

const AGENTS_DIR = path.resolve(process.cwd(), 'agents');

export default {
    definition: {
        name: 'save_to_memory',
        description: 'Save important facts or information to your long-term MEMORY.md file.',
        parameters: {
            type: 'object',
            properties: {
                fact: {
                    type: 'string',
                    description: 'The fact or information to remember.'
                },
                category: {
                    type: 'string',
                    description: 'Optional category for the memory (e.g., "preferences", "project_status").'
                }
            },
            required: ['fact']
        }
    },
    handler: async ({ fact, category, _context }: { fact: string; category?: string; _context?: { agentId: string } }) => {
        try {
            if (!_context?.agentId) throw new Error('Agent context not found');

            const agentDir = path.join(AGENTS_DIR, _context.agentId);
            const memoryPath = path.join(agentDir, 'MEMORY.md');

            // Ensure agent directory exists
            if (!fs.existsSync(agentDir)) {
                fs.mkdirSync(agentDir, { recursive: true });
            }

            const timestamp = new Date().toISOString().split('T')[0];
            const entry = `\n- [${timestamp}]${category ? ` (${category})` : ''}: ${fact}`;

            console.log(`[Tool: save_to_memory] Saving to ${memoryPath}:`, entry);

            fs.appendFileSync(memoryPath, entry, 'utf-8');

            return {
                success: true,
                message: `Pushed to MEMORY.md for agent ${_context.agentId}`
            };
        } catch (error: any) {
            return { error: error.message };
        }
    }
};
