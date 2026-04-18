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

// Helper to format SSE data for OpenAI streaming
function formatSSE(data: string): string {
    return `data: ${data}\n\n`;
}

// Endpoint for chat completions (supports both streaming and non-streaming)
router.post('/chat/completions', async (req, res) => {
    try {
        const { model, messages, stream, session_id, tools, tool_choice, temperature, max_tokens, top_p, frequency_penalty, presence_penalty } = req.body;

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

        // Build LLM config from agent's provider
        const { loadConfig } = await import('../config-manager.js');
        const currentConfig = loadConfig();
        
        // Resolve provider config from global config using agent's provider reference
        let providerConfig: any = {};
        if (agent.provider) {
            providerConfig = currentConfig.providers.find(
                (p: any) => p.model === agent.provider || p.description === agent.provider
            ) || {};
        }
        // Fallback to first provider if agent has no specific provider or lookup failed
        if (!providerConfig.endpoint && currentConfig.providers.length > 0) {
            providerConfig = currentConfig.providers[0];
        }
        
        const llmConfig = {
            baseUrl: providerConfig.endpoint,
            modelId: providerConfig.model,
            apiKey: providerConfig.apiKey,
            maxTokens: providerConfig.maxTokens,
            supportsTools: !!providerConfig?.capabilities?.trained_for_tool_use,
        };

        // Build payload with system prompt
        const payload: any[] = [];
        let systemPrompt = agent.systemPrompt || currentConfig.global?.systemPrompt || "You are a helpful AI assistant.";

        // Inject memory if available
        if (agent.path) {
            const { AgentManager: AM } = await import('../agent-manager.js');
            const freshMemory = AM.readFile(require('node:path').join(agent.path, 'MEMORY.md'));
            const sharedMemoryPath = require('node:path').resolve(process.cwd(), 'config', 'SHARED_MEMORY.md');
            const fs = await import('node:fs');
            const freshSharedMemory = fs.default.existsSync(sharedMemoryPath) ? fs.default.readFileSync(sharedMemoryPath, 'utf-8') : undefined;

            systemPrompt = systemPrompt.replace(
                /## Your Memory\n[\s\S]*?(?=\n## (?!Your Memory)|Whenever the user shares)/,
                freshMemory
                    ? `## Your Memory\nThe following is your long-term memory. Use this to recall facts about the user and past interactions without needing to search.\n\n${freshMemory}\n\n`
                    : ''
            );
            systemPrompt = systemPrompt.replace(
                /## Shared Memory \(all agents\)\n[\s\S]*?(?=\n## (?!Shared Memory)|Whenever the user shares)/,
                freshSharedMemory
                    ? `## Shared Memory (all agents)\nThe following memory is shared across all agents.\n\n${freshSharedMemory}\n\n`
                    : ''
            );
        }

        // Add time to system prompt
        const now = new Date();
        const timeString = now.toLocaleString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        });
        systemPrompt += `\n\n[Current Time: ${timeString}]`;

        payload.push({ role: 'system', content: systemPrompt });

        // Handle session persistence
        const sessionId = session_id || `openai-${Date.now()}`;
        const { SessionManager } = await import('../session-manager.js');
        
        // Load existing session or create new one
        let session = SessionManager.getSession(sessionId);
        if (!session) {
            session = {
                id: sessionId,
                agentId: agent.id,
                title: messages.find((m: any) => m.role === 'user')?.content?.slice(0, 30) + '...' || 'New Chat',
                messages: [],
                updatedAt: Date.now()
            };
        }

        // If session exists, use its history; otherwise use provided messages
        const conversationMessages = session && session.messages.length > 0
            ? [...session.messages, ...messages]
            : messages;

        // Filter out reasoning messages
        const validMessages = conversationMessages.filter((msg: any) => msg.role !== 'reasoning');
        payload.push(...validMessages);

        // Handle streaming vs non-streaming
        if (stream) {
            // Set headers for SSE streaming
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');

            const completionId = `chatcmpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const created = Math.floor(Date.now() / 1000);
            
            let fullContent = '';
            let toolCallsAccumulated: any[] = [];
            let usageStats: any = null;

            // Create abort controller for request cancellation
            const abortController = new AbortController();
            req.on('close', () => {
                abortController.abort();
            });

            try {
                // Run agent loop with streaming - pass callbacks for real-time streaming
                const { runAgentLoop } = await import('../agent-loop.js');
                
                let fullContent = '';
                let usageStats: any = null;
                let roleSent = false;
                
                // Create a callback-based streaming approach instead of iterating the generator
                const result = await runAgentLoop({
                    agentId: agent.id,
                    sessionId,
                    llmConfig,
                    messages: payload,
                    visionEnabled: !!providerConfig?.capabilities?.vision,
                    maxLoops: agent.maxLoops || 100,
                    signToolUrls: true,
                    agentToolsConfig: agent.tools,
                    abortSignal: abortController.signal,
                    onDelta: (content: string) => {
                        // Stream each chunk as OpenAI-compatible SSE
                        fullContent += content;
                        
                        // OpenAI streaming format:
                        // 1. First chunk: only role (no content)
                        // 2. Subsequent chunks: only content (no role)
                        // 3. Final chunk: finish_reason with empty delta
                        let delta: any = {};
                        
                        if (!roleSent) {
                            // First chunk: send role only
                            delta.role = 'assistant';
                            roleSent = true;
                            // Don't include content in the role-only chunk
                        } else {
                            // Subsequent chunks: send content only
                            delta.content = content;
                        }
                        
                        const streamChunk = {
                            id: completionId,
                            object: 'chat.completion.chunk',
                            created: created,
                            model: model,
                            choices: [{
                                index: 0,
                                delta: delta,
                                finish_reason: null
                            }]
                        };
                        res.write(formatSSE(JSON.stringify(streamChunk)));
                    },
                    onUsage: (usage: any) => {
                        usageStats = usage;
                    }
                });

                // Send final chunk with finish_reason
                const finalChunk = {
                    id: completionId,
                    object: 'chat.completion.chunk',
                    created: created,
                    model: model,
                    choices: [{
                        index: 0,
                        delta: {},
                        finish_reason: 'stop'
                    }]
                };
                res.write(formatSSE(JSON.stringify(finalChunk)));

                // Send [DONE] marker
                res.write(formatSSE('[DONE]'));
                res.end();

                // Save session with updated messages using the accumulated content
                // We need to reconstruct the messages from the full content
                const generatedMessage = {
                    role: 'assistant',
                    content: fullContent,
                    timestamp: Math.floor(Date.now() / 1000)
                };
                session.messages = [...conversationMessages, generatedMessage];
                SessionManager.saveSession(session);

            } catch (error) {
                if (!abortController.signal.aborted) {
                    console.error('[Chat Completions Streaming] Error:', error);
                    // Send error as SSE
                    const errorChunk = {
                        id: completionId,
                        object: 'chat.completion.chunk',
                        created: created,
                        model: model,
                        choices: [{
                            index: 0,
                            delta: {},
                            finish_reason: 'stop'
                        }],
                        error: {
                            message: error instanceof Error ? error.message : 'Streaming error',
                            type: 'internal_error'
                        }
                    };
                    res.write(formatSSE(JSON.stringify(errorChunk)));
                    res.write(formatSSE('[DONE]'));
                    res.end();
                }
            }
        } else {
            // Non-streaming mode (existing behavior)
            const { runAgentLoop } = await import('../agent-loop.js');
            
            // Collect all chunks from the async generator
            let finalResponse = '';
            let usageStats: any = null;
            
            for await (const chunk of runAgentLoop({
                agentId: agent.id,
                messages: conversationMessages,
                llmConfig: agent.llmConfig,
                maxLoops: agent.maxLoops || 100,
                signToolUrls: true,
                agentToolsConfig: agent.tools,
                abortSignal: abortController.signal,
                onDelta: (content: string) => {
                    finalResponse += content;
                },
                onUsage: (usage: any) => {
                    usageStats = usage;
                }
            })) {
                // Generator yields final result
            }

            // Build OpenAI-compatible response
            const response = {
                id: completionId,
                object: 'chat.completion',
                created: created,
                model: model,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: finalResponse
                    },
                    finish_reason: 'stop'
                }],
                usage: usageStats || {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0
                }
            };

            res.json(response);

            // Save session with updated messages
            const generatedMessage = {
                role: 'assistant',
                content: finalResponse,
                timestamp: Math.floor(Date.now() / 1000)
            };
            session.messages = [...conversationMessages, generatedMessage];
            SessionManager.saveSession(session);
        }
    } catch (error) {
        console.error('[Chat Completions] Error:', error);
        res.status(500).json({
            error: {
                message: error instanceof Error ? error.message : 'Internal server error',
                type: 'internal_error'
            }
        });
    }
}
         