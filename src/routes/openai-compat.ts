import express from 'express';
import { AgentManager } from '../agent-manager.js';

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

// Endpoint for chat completions with streaming support
router.post('/chat/completions', (req, res) => {
    const { messages } = req.body;

    // Simulating streaming responses
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');

    const sendMessage = (message) => {
        res.write(`data: ${JSON.stringify(message)}\n\n`);
    };

    messages.forEach((msg, index) => {
        setTimeout(() => {
            sendMessage({ role: 'assistant', content: `Response to: ${msg.content}` });
        }, index * 1000); // Simulate delay
    });

    setTimeout(() => {
        res.end(); // End the stream after all messages are sent
    }, messages.length * 1000);
});

export default router;
