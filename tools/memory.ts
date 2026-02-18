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

            // Trigger proactive sync to generate embeddings immediately
            // This ensures the new memory is vector-searchable right away
            try {
                // Dynamically import AgentManager to avoid circular dependencies if any
                const { AgentManager } = await import('../src/agent-manager.js');
                const manager = await AgentManager.getMemoryManager(_context.agentId);
                // Run sync in background so we don't block the tool response too long
                manager.sync(true).catch(err => console.error(`[Tool: save_to_memory] Sync failed: ${err.message}`));
            } catch (syncError) {
                console.error('[Tool: save_to_memory] Failed to trigger sync:', syncError);
            }

            return {
                success: true,
                message: `Pushed to MEMORY.md for agent ${_context.agentId}`
            };
        } catch (error: any) {
            return { error: error.message };
        }
    }
};
