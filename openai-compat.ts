import express from 'express';
import { AgentManager } from './src/agent-manager.js';
import { runAgentLoop } from './src/agent-loop.js';

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

// Endpoint for chat completions (non-streaming only)
router.post('/chat/completions', async (req, res) => {
    try {
        const { model, messages, stream } = req.body;

        // Validate required fields
        if (!model || !messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid request: model and messages array are required',
                    type: 'invalid_request_error',
                    param: null,
                    code: 'invalid_request_error'
                }
            });
        }

        // Explicitly reject streaming requests
        if (stream === true) {
            return res.status(400).json({
                error: {
                    message: 'Streaming is not supported. Please set stream to false or omit it.',
                    type: 'invalid_request_error',
                    param: 'stream',
                    code: 'unsupported_parameter'
                }
            });
        }

        // Get the agent by model ID
        const agent = AgentManager.getAgent(model);
        if (!agent) {
            return res.status(404).json({
                error: {
                    message: `Agent not found: ${model}`,
                    type: 'invalid_request_error',
                    param: 'model',
                    code: 'model_not_found'
                }
            });
        }

        // Extract user message (last message should be from user)
        const userMessage = messages[messages.length - 1];
        if (!userMessage || userMessage.role !== 'user') {
            return res.status(400).json({
                error: {
                    message: 'Last message must be from user',
                    type: 'invalid_request_error',
                    param: 'messages',
                    code: 'invalid_request_error'
                }
            });
        }

        // Build LLM config from agent's provider
        const providerConfig = agent.providerConfig || {};
        const llmConfig = {
            baseUrl: providerConfig.endpoint,
            modelId: providerConfig.model,
            apiKey: providerConfig.apiKey,
            maxTokens: providerConfig.maxTokens,
            supportsTools: !!providerConfig?.capabilities?.trained_for_tool_use,
            maxContextLength: providerConfig.maxContextLength,
        };

        // Run agent loop and collect full response
        let fullResponse = '';
        let usageStats = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        const responseGenerator = runAgentLoop({
            agentId: agent.id,
            sessionId: `openai-${Date.now()}`,
            llmConfig,
            messages: messages.slice(0, -1),
            visionEnabled: !!providerConfig?.capabilities?.vision,
            maxLoops: agent.maxLoops || 100,
        });

        // Collect all chunks from the async generator
        for await (const chunk of responseGenerator) {
            if (typeof chunk === 'string') {
                fullResponse += chunk;
            }
        }

        // Get the final result returned by the generator
        const result = await responseGenerator.return(undefined);
        if (result.value && result.value.usage) {
            usageStats = {
                prompt_tokens: result.value.usage.prompt_tokens || 0,
                completion_tokens: result.value.usage.completion_tokens || 0,
                total_tokens: result.value.usage.total_tokens || 0,
            };
        }

        // If no usage stats from the loop, estimate them
        if (usageStats.total_tokens === 0) {
            const promptText = messages.map((m: any) => m.content || '').join(' ');
            const promptTokens = Math.ceil(promptText.length / 4);
            const completionTokens = Math.ceil(fullResponse.length / 4);
            usageStats = {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: promptTokens + completionTokens,
            };
        }

        // Return OpenAI-compatible response
        res.json({
            id: `chatcmpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            object: 'chat.completion',
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
            usage: usageStats
        });
    } catch (error) {
        console.error('[Chat Completions] Error:', error);
        res.status(500).json({
            error: {
                message: error instanceof Error ? error.message : 'Internal server error',
                type: 'internal_error',
                param: null,
                code: 'internal_error'
            }
        });
    }
});

export default router;
