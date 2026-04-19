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

// POST /chat/completions - OpenAI-compatible chat completions endpoint
	router.post('/chat/completions', async (req, res) => {
	    try {
	        const { model, messages, stream, max_tokens, tools } = req.body;
	
	        if (!model) {
	            return res.status(400).json({ error: 'Missing required field: model' });
	        }
	
	        if (!messages || !Array.isArray(messages)) {
	            return res.status(400).json({ error: 'Missing required field: messages (must be an array)' });
	        }
	
	        // Find the agent (model can be agent id or agent name)
	        let agentId = model;
	        let agent = AgentManager.getAgent(model);
	        
	        if (!agent) {
	            // Try to find by name
	            const agentIds = AgentManager.listAgents();
	            for (const id of agentIds) {
	                const a = AgentManager.getAgent(id);
	                if (a && (a.name.toLowerCase() === model.toLowerCase() || a.id.toLowerCase() === model.toLowerCase())) {
	                    agent = a;
	                    agentId = id;
	                    break;
	                }
	            }
	        }
	
	        if (!agent) {
	            return res.status(404).json({ error: `Agent/model '${model}' not found` });
	        }
	
	        const currentConfig = loadConfig();
	        const providerName = agent.provider;
	        let providerConfig = currentConfig.providers.find(p => p.model === providerName || p.description === providerName);
	
	        if (!providerConfig && currentConfig.providers.length > 0) {
	            providerConfig = currentConfig.providers[0];
	            logger.log({ type: 'system', level: 'warn', message: `Using default provider ${providerConfig.model} for agent ${agentId} because configured provider ${providerName} was not found.` });
	        }
	
	        if (!providerConfig) {
	            logger.log({ type: 'error', level: 'error', message: `No provider found for agent ${agentId}. Provider name: ${providerName}` });
	            return res.status(500).json({ error: 'No LLM provider configured' });
	        }
	
	        const llmConfig = {
	            baseUrl: providerConfig.endpoint,
	            modelId: providerConfig.model,
	            apiKey: providerConfig.apiKey,
	            maxTokens: max_tokens || providerConfig.maxTokens,
	            supportsTool: !!providerConfig?.capabilities?.trained_for_tool_use
	        };
	
	        // Create or load session
	        const sessionId = `oai-${Date.now()}-${Math.random().toString(36).substring(7)}`;
	        let session = SessionManager.getSession(sessionId);
	        if (!session) {
	            const firstUserMessage = messages.find((m: any) => m.role === 'user');
	            session = {
	                id: sessionId,
	                agentId: agentId,
	                title: firstUserMessage?.content?.slice(0, 30) + '...' || 'New chat',
 	                messages: [],
 	                updatedAt: Date.now()
 	            };
 	        }
 	
 	        // Prepare payload: system prompt + messages
 	        const payload: any[] = [];
 	        const systemPrompt = agent?.systemPrompt || currentConfig.global?.systemPrompt || "You are a helpful AI assistant.";
 	        if (systemPrompt) {
 	            payload.push({ role: 'system', content: systemPrompt });
 	        }
 	
 	        // Add user messages (filter out reasoning messages)
 	        const validMessages = messages.filter((msg: any) => msg.role !== 'reasoning');
 	        payload.push(...validMessages);
 	
 	        // Save initial messages to session
 	        const timestamp = Math.floor(Date.now() / 1000);
 	        for (const msg of validMessages) {
 	            session.messages.push({
 	                role: msg.role,
 	                content: msg.content,
 	                timestamp
 	            });
 	        }
 	        SessionManager.saveSession(session);
 	
 	        // Handle streaming vs non-streaming
 	        if (stream) {
 	            res.setHeader('Content-Type', 'text/event-stream');
 	            res.setHeader('Cache-Control', 'no-cache');
 	            res.setHeader('Connection', 'keep-alive');
 	
 	            const abortController = new AbortController();
 	            req.on('close', () => {
 	                abortController.abort();
 	            });
 	
 	            let fullResponse = '';
 	            let usageStats: any = {};
 	
 	            try {
 	                const result = await runAgentLoop({
 	                    agentId,
 	                    sessionId,
 	                    llmConfig,
 	                    messages: payload,
 	                    visionEnabled: !!providerConfig?.capabilities?.vision,
 	                    maxLoops: agent?.maxLoops || 100,
 	                    signToolUrls: true,
 	                    agentToolsConfig: agent?.tools,
 	                    abortSignal: abortController.signal,
 	                    onDelta: (content: string) => {
 	                        fullResponse += content;
 	                        // Send SSE chunk in OpenAI format
 	                        const chunk = {
 	                            id: `chatcmpl-${Date.now()}`,
 	                            object: 'chat.completion.chunk',
 	                            created: Math.floor(Date.now() / 1000),
 	                            model: agentId,
 	                            choices: [{
 	                                index: 0,
 	                                delta: { content },
 	                                finish_reason: null
 	                            }]
 	                        };
 	                        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
 	                    },
 	                    onUsage: (usage: any) => {
 	                        usageStats = usage;
 	                    }
 	                });
 	
 	                // Send final chunk with finish_reason
 	                const finalChunk = {
 	                    id: `chatcmpl-${Date.now()}`,
 	                    object: 'chat.completion.chunk',
 	                    created: Math.floor(Date.now() / 1000),
 	                    model: agentId,
 	                    choices: [{
 	                        index: 0,
 	                        delta: {},
 	                        finish_reason: 'stop'
 	                    }],
 	                    usage: result.usage
 	                };
 	                res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
 	                res.write('data: [DONE]\n\n');
 	                res.end();
 	
 	                // Save assistant response to session
 	                session.messages.push({
 	                    role: 'assistant',
 	                    content: fullResponse,
 	                    timestamp: Math.floor(Date.now() / 1000)
 	                });
 	                SessionManager.saveSession(session);
 	
 	            } catch (error: any) {
 	                logger.log({ type: 'error', level: 'error', message: `Streaming error: ${error.message}` });
 	                const errorChunk = {
 	                    error: { message: error.message, type: 'api_error' }
 	                };
 	                res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
 	                res.end();
 	            }
 	        } else {
 	            // Non-streaming response
 	            const result = await runAgentLoop({
 	                agentId,
 	                sessionId,
 	                llmConfig,
 	                messages: payload,
 	                visionEnabled: !!providerConfig?.capabilities?.vision,
 	                maxLoops: agent?.maxLoops || 100,
 	                signToolUrls: true,
 	                agentToolsConfig: agent?.tools
 	            });
 	
 	            // Clean response (remove reasoning tags)
 	            const cleanResponse = result.finalResponse.replace(/<(think|thought|reasoning)>[\s\S]*?<\/\1>/gi, '').replace(/<think>[\s\S]*?<\/\x66\x6f\x75\x72\x74\x65\x65\x6e>/gi, '.').trim();
 	
 	            // Save assistant response to session
 	            session.messages.push({
 	                role: 'assistant',
 	                content: result.finalResponse,
 	                timestamp: Math.floor(Date.now() / 1000)
 	            });
 	            SessionManager.saveSession(session);
 	
 	            // Return OpenAI-compatible response
 	            res.json({
 	                id: `chatcmpl-${Date.now()}`,
 	                object: 'chat.completion',
 	                created: Math.floor(Date.now() / 1000),
 	                model: agentId,
 	                choices: [{
 	                    index: 0,
 	                    message: {
 	                        role: 'assistant',
 	                        content: cleanResponse
 	                    },
 	                    finish_reason: 'stop'
 	                }],
 	                usage: result.usage
 	            });
 	        }
 	
 	    } catch (error: any) {
 	        logger.log({ type: 'error', level: 'error', message: `Chat completions error: ${error.message}` });
 	        console.error('[Chat/Completions] Error:', error);
 	        res.status(500).json({ error: `Internal server error: ${error.message}` });
 	    }
 	});
 	
export default router;
