import express from 'express';
import { AgentManager } from '../agent-manager.js';
import { runAgentLoop } from '../agent-loop.js';

const router = express.Router();

// Endpoint to list all agents as models
router.get('/models', (req, res) => {
    try {
        const agentIds = AgentManager.listAgents();

        // Transform agents into OpenAI-compatible model objects
        const agents = agentIds.map(id => {
            const agent = AgentManager.getAgent(id);
            return {
                id: agent?.id || id,
                object: 'model',
                created: Math.floor(Date.now() / 1000),
                owned_by: 'openkiwi-agent',
                name: agent?.name || id.charAt(0).toUpperCase() + id.slice(1),
                description: `Agent: ${agent?.name || id}`
            };
        });

        res.json({ data: agents });
    } catch (error) {
        console.error('[Models] Error listing agents:', error);
        res.status(500).json({ error: 'Failed to retrieve agents' });
    }
});


export default router;
