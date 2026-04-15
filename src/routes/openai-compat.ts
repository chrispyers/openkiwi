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

// Endpoint for chat completions with streaming support
router.post('/chat/completions', async (req, res) => {
    try {
        const { model, messages, stream = false } = req.body;

        // Validate required fields
        if (!model || !messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: 'Invalid request: model and messages array are required'
            });
        }

        // Get the agent by model ID
        const agent = AgentManager.getAgent(model);
        if (!agent) {
            return res.status(404).json({
                error: `Agent not found: ${model}`
            });
        }

        // Extract user message (last message should be from user)
        const userMessage = messages[messages.length - 1];
        if (!userMessage || userMessage.role !== 'user') {
            return res.status(400).json({
                error: 'Last message must be from user'
            });
        }

        // If streaming is requested
        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            try {
                // Run the agent loop and stream responses
                const responseGenerator = runAgentLoop(
                    agent,
                    userMessage.content,
                    messages.slice(0, -1) // Pass conversation history (excluding the last user message)
                );

                // Stream each chunk as it's generated
                for await (const chunk of responseGenerator) {
                    const event = {
                        id: `chatcmpl-${Date.now()}`,
                        object: 'text_completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: model,
                        choices: [
                            {
                                index: 0,
                                delta: {
                                    content: chunk
                                },
                                finish_reason: null
                            }
                        ]
                    };
                    res.write(`data: ${JSON.stringify(event)}\n\n`);
                }

                // Send final event with finish_reason
                const finalEvent = {
                    id: `chatcmpl-${Date.now()}`,
                    object: 'text_completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: model,
                    choices: [
                        {
                            index: 0,
                            delta: {},
                            finish_reason: 'stop'
                        }
                    ]
                };
                res.write(`data: ${JSON.stringify(finalEvent)}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
            } catch (error) {
                console.error('[Chat Completions] Streaming error:', error);
                res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
                res.end();
            }
        } else {
            // Non-streaming response
            try {
                let fullResponse = '';
                const responseGenerator = runAgentLoop(
                    agent,
                    userMessage.content,
                    messages.slice(0, -1)
                );

                // Collect all chunks
                for await (const chunk of responseGenerator) {
                    fullResponse += chunk;
                }

                // Return complete response
                res.json({
                    id: `chatcmpl-${Date.now()}`,
                    object: 'text_completion',
                    created: Math.floor(Date.now() / 1000),
                    model: model,
                    choices: [
                        {
                            index: 0,
                            message: {
                                role: 'assistant',
                                content: fullResponse
                            },
                            finish_reason: 'stop'
                        }
                    ],
                    usage: {
                        prompt_tokens: userMessage.content.split(' ').length,
                        completion_tokens: fullResponse.split(' ').length,
                        total_tokens: (userMessage.content + fullResponse).split(' ').length
                    }
                });
            } catch (error) {
                console.error('[Chat Completions] Error:', error);
                res.status(500).json({
                    error: error.message || 'Failed to generate response'
                });
            }
        }
    } catch (error) {
        console.error('[Chat Completions] Unexpected error:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

export default router;
