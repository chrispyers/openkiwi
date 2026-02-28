import { WebSocket } from 'ws';
import { IncomingMessage } from 'node:http';
import { loadConfig } from './config-manager.js';
import { AgentManager } from './agent-manager.js';
import { SessionManager } from './session-manager.js';
import { ToolManager } from './tool-manager.js';
import { logger } from './logger.js';
import { runAgentLoop } from './agent-loop.js';
import { getChatCompletion } from './llm-provider.js';
import { connectedClients, pendingToolCalls } from './state.js';

export function handleChatConnection(ws: WebSocket, req: IncomingMessage) {
    const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const ip = rawIp.replace(/^::ffff:/, ''); // Clean up IPv4-mapped IPv6
    const params = new URLSearchParams(req.url?.split('?')[1]);
    const hostname = params.get('hostname') || 'Unknown Device';
    const token = params.get('token');

    console.log(`Client connected: ${hostname} (${ip})`);

    // WS Auth Check - Start unauthenticated unless token provided in URL
    const currentConfig = loadConfig();
    let isAuthenticated = (token === currentConfig.gateway.secretToken);

    const authTimeout = setTimeout(() => {
        if (!isAuthenticated) {
            console.log(`WS Connection timed out: ${hostname} (${ip})`);
            ws.close(1008, 'Authentication Timeout');
        }
    }, 10000); // 10 second grace period to authenticate

    if (isAuthenticated) {
        console.log(`[Auth] Client authenticated via URL: ${hostname} (${ip})`);
        clearTimeout(authTimeout);
    }

    connectedClients.set(ws, {
        hostname,
        ip,
        connectedAt: Date.now()
    });

    ws.on('close', () => {
        clearTimeout(authTimeout);
        const client = connectedClients.get(ws);
        if (client?.tools) {
            client.tools.forEach(toolName => ToolManager.unregisterTool(toolName));
        }
        connectedClients.delete(ws);
        console.log(`Client disconnected: ${hostname} (${ip})`);
    });

    ws.on('message', async (data) => {
        let sessionId: string | undefined;
        let agentId: string | undefined;

        try {
            const parsed = JSON.parse(data.toString());
            console.log(`[WS] Received message type: ${parsed.type || 'chat'}`);

            // Handle Auth Message
            if (parsed.type === 'auth') {
                const currentConfig = loadConfig();
                if (parsed.token === currentConfig.gateway.secretToken) {
                    isAuthenticated = true;
                    clearTimeout(authTimeout);
                    ws.send(JSON.stringify({ type: 'auth_success' }));
                    ws.send(JSON.stringify({ type: 'initial_agent_states', states: AgentManager.getAllAgentStates() }));
                    console.log(`[Auth] Client authenticated: ${hostname} (${ip})`);
                    return;
                } else {
                    console.warn(`[Auth] Client failed authentication: ${hostname} (${ip})`);
                    ws.close(1008, 'Invalid Secret Token');
                    return;
                }
            }

            // Block all other messages until authenticated
            if (!isAuthenticated) {
                console.warn(`[Auth] Blocked message from unauthenticated client: ${hostname} (${ip})`);
                ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized: Gateway token missing or invalid.' }));
                return;
            }

            // Handle Tool Registration from Workers
            if (parsed.type === 'register_tools') {
                const tools = parsed.tools as any[];
                const client = connectedClients.get(ws);
                if (client) {
                    client.tools = tools.map(t => t.name);
                    tools.forEach(toolDef => {
                        ToolManager.registerTool({
                            definition: toolDef,
                            handler: async (args: any) => {
                                const callId = Math.random().toString(36).substring(7);
                                return new Promise((resolve, reject) => {
                                    pendingToolCalls.set(callId, { resolve, reject });
                                    ws.send(JSON.stringify({
                                        type: 'call_tool',
                                        id: callId,
                                        name: toolDef.name,
                                        args
                                    }));
                                    // Timeout after 30s
                                    setTimeout(() => {
                                        if (pendingToolCalls.has(callId)) {
                                            pendingToolCalls.delete(callId);
                                            reject(new Error('Tool call timed out'));
                                        }
                                    }, 30000);
                                });
                            }
                        });
                    });
                    console.log(`[Gateway] Registered ${tools.length} remote tools from ${hostname}`);
                }
                return;
            }

            // Handle Tool Results from Workers
            if (parsed.type === 'tool_result') {
                const { id, result, error } = parsed;
                const pending = pendingToolCalls.get(id);
                if (pending) {
                    if (error) pending.reject(new Error(error));
                    else pending.resolve(result);
                    pendingToolCalls.delete(id);
                }
                return;
            }

            // Assume it's a Chat Message if not a control type
            const { messages: userMessages, shouldSummarize } = parsed;
            sessionId = parsed.sessionId;
            agentId = parsed.agentId;

            if (!userMessages) return;

            const currentConfig = loadConfig();
            // Resolve agent ID (default to 'luna' or first available if not specified)
            const availableAgents = AgentManager.listAgents();
            const defaultAgentId = availableAgents.find(id => id === 'luna') || availableAgents[0];
            const effectiveAgentId = agentId || defaultAgentId || 'luna';

            const agent = AgentManager.getAgent(effectiveAgentId);

            const payload: any[] = [];
            let systemPrompt = agent?.systemPrompt || currentConfig.global?.systemPrompt || "You are a helpful AI assistant.";

            // Anti-hallucination directive
            systemPrompt += "\n\nCRITICAL INSTRUCTION: If you intend to take an action (like modifying a file, searching memory, etc.), you MUST use the provided tools to do so. NEVER claim to have updated a file or taken an action unless you have explicitly called the corresponding tool and received a successful response. DO NOT hallucinate actions.";

            if (systemPrompt) {
                const now = new Date();
                const timeString = now.toLocaleString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    timeZoneName: 'short'
                });

                const promptWithTime = `${systemPrompt}\n\n[Current Time: ${timeString}]`;
                payload.push({ role: 'system', content: promptWithTime });
            }

            // Determine provider
            const providerName = agent?.provider;
            let providerConfig = currentConfig.providers.find(p => p.model === providerName || p.description === providerName);

            // Fallback to first provider if specific one not found or not specified
            if (!providerConfig && currentConfig.providers.length > 0) {
                providerConfig = currentConfig.providers[0];
            }

            if (!providerConfig) {
                console.error('[WS] No provider config found!');
                ws.send(JSON.stringify({ type: 'error', message: 'No LLM provider configured. Please add a provider in settings.' }));
                return;
            }

            console.log(`[WS] Using provider: ${providerConfig.model} at ${providerConfig.endpoint}`);

            const llmConfig = {
                baseUrl: providerConfig.endpoint,
                modelId: providerConfig.model,
                apiKey: providerConfig.apiKey,
                supportsTools: !!providerConfig?.capabilities?.trained_for_tool_use
            };

            if (currentConfig.chat.includeHistory) {
                // Filter out 'reasoning' messages as many providers only accept user, assistant, system, tool
                const validMessages = userMessages.filter((msg: any) => msg.role !== 'reasoning');
                payload.push(...validMessages);
            } else {
                // Get the last non-reasoning message
                const validMessages = userMessages.filter((msg: any) => msg.role !== 'reasoning');
                if (validMessages.length > 0) {
                    payload.push(validMessages[validMessages.length - 1]);
                }
            }

            logger.log({
                type: 'request',
                level: 'info',
                agentId: effectiveAgentId,
                sessionId,
                message: `User message to ${effectiveAgentId}`,
                data: userMessages[userMessages.length - 1]?.content || 'Empty message'
            });

            let fullContent = '';

            AgentManager.setAgentState(effectiveAgentId, 'chatting', 'Processing user prompt');
            let finalAiResponse, lastTps, totalUsage, chatHistory;
            try {
                const result = await runAgentLoop({
                    agentId: effectiveAgentId,
                    sessionId: sessionId || "unknown",
                    llmConfig,
                    messages: payload,
                    visionEnabled: !!providerConfig?.capabilities?.vision,
                    maxLoops: 5,
                    signToolUrls: true,
                    onDelta: (content: string) => {
                        if (!fullContent) console.log('[WS] Received first delta from LLM');
                        fullContent += content;
                        ws.send(JSON.stringify({ type: 'delta', content }));
                    },
                    onUsage: (usageStats: any) => {
                        ws.send(JSON.stringify({ type: 'usage', usage: usageStats }));
                    },
                    onToolCall: (toolCall: any) => {
                        ws.send(JSON.stringify({ type: 'tool_call', toolCall }));
                    }
                });

                finalAiResponse = result.finalResponse;
                lastTps = result.lastTps;
                totalUsage = result.usage;
                chatHistory = result.chatHistory;
            } finally {
                AgentManager.setAgentState(effectiveAgentId, 'idle');
            }

            logger.log({
                type: 'response',
                level: 'info',
                agentId: effectiveAgentId,
                sessionId,
                message: `Response from ${effectiveAgentId}`,
                data: finalAiResponse
            });

            ws.send(JSON.stringify({ type: 'done' }));

            // Persistence logic
            if (sessionId) {
                const timestamp = Date.now();
                const existing = SessionManager.getSession(sessionId) || {
                    id: sessionId,
                    agentId: effectiveAgentId,
                    title: userMessages[0].content.slice(0, 30) + '...',
                    messages: [],
                    updatedAt: timestamp
                };

                // Overwrite newMessages with the full filtered chat history from runAgentLoop
                // Filter out 'system' messages and any 'reasoning' messages that might be present
                const newMessages = chatHistory.filter((msg: any) => msg.role !== 'system' && msg.role !== 'reasoning').map((msg: any, index, arr) => {
                    const isLast = index === arr.length - 1;
                    if (isLast && msg.role === 'assistant' && finalAiResponse) {
                        return {
                            ...msg,
                            timestamp: Math.floor(timestamp / 1000),
                            stats: {
                                tps: lastTps,
                                tokens: totalUsage.completion_tokens,
                                inputTokens: totalUsage.prompt_tokens,
                                outputTokens: totalUsage.completion_tokens,
                                totalTokens: totalUsage.total_tokens
                            }
                        };
                    }
                    return { ...msg, timestamp: msg.timestamp || Math.floor(timestamp / 1000) };
                });

                existing.messages = newMessages;
                SessionManager.saveSession(existing);

                // Background Summarization if requested
                if (shouldSummarize && finalAiResponse) {
                    (async () => {
                        try {
                            const summaryPrompt = [
                                { role: 'system', content: 'You are a helpful assistant that provides extremely concise, 5-10 word summaries of chat sessions. Do not use quotes or introductory text. Just the summary.' },
                                {
                                    role: 'user', content: `Summarize this conversation in 10 words or less:\n\n${newMessages
                                        .filter(m => m.role !== 'reasoning')
                                        .map(m => {
                                            const cleanContent = m.content.replace(/<(think|thought|reasoning)>[\s\S]*?<\/\1>/gi, '').trim();
                                            return cleanContent ? `${m.role.toUpperCase()}: ${cleanContent}` : '';
                                        })
                                        .filter(Boolean)
                                        .join('\n')}`
                                }
                            ];
                            const completion = await getChatCompletion(llmConfig, summaryPrompt);
                            const rawSummary = completion.content;

                            if (completion.usage) {
                                logger.log({
                                    type: 'usage',
                                    level: 'info',
                                    agentId: effectiveAgentId,
                                    sessionId,
                                    message: 'Summary token usage',
                                    data: completion.usage
                                });
                            }
                            const cleanSummary = rawSummary.replace(/<(think|thought|reasoning)>[\s\S]*?<\/\1>/gi, '').trim();

                            const updatedSession = SessionManager.getSession(sessionId);
                            if (updatedSession) {
                                updatedSession.summary = cleanSummary;
                                SessionManager.saveSession(updatedSession);
                                // Optional: notify client via WS that summary is ready? 
                                // For now, the next time they fetch sessions it will be there.
                            }
                        } catch (err) {
                            console.error('[Summary] Failed to generate summary:', err);
                        }
                    })();
                }
            }

        } catch (error) {
            console.error('WS Error:', error);

            // Provide user-friendly error messages
            let errorMessage = 'An unexpected error occurred';

            if (error instanceof Error) {
                // Check for common connection errors
                if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
                    errorMessage = `Unable to connect to LLM provider. Please ensure the provider is running and accessible.`;
                } else if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
                    errorMessage = `Connection to LLM provider timed out. Please check your network connection.`;
                } else if (error.message.includes('ENOTFOUND')) {
                    errorMessage = `Could not resolve hostname for LLM provider. Please check the endpoint configuration.`;
                } else if (error.message.includes('LLM API error')) {
                    errorMessage = error.message;
                } else {
                    errorMessage = `Error communicating with LLM provider: ${error.message}`;
                }
            }

            logger.log({
                type: 'error',
                level: 'error',
                agentId: agentId || 'clawdbot',
                sessionId: sessionId,
                message: errorMessage,
                data: error instanceof Error ? { stack: error.stack, originalError: error.message } : { error }
            });

            ws.send(JSON.stringify({ type: 'error', message: errorMessage }));
        }
    });
}
