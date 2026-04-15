import express from 'express';

const router = express.Router();

// Mock data for agents
const agents = [
    { id: '1', name: 'Agent One', description: 'Description for agent one.' },
    { id: '2', name: 'Agent Two', description: 'Description for agent two.' }
];

// Endpoint to list all agents as models
router.get('/models', (req, res) => {
    res.json(agents);
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
