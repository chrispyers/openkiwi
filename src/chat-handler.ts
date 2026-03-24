import path from 'node:path';
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
import { SkillManager } from './skill-manager.js';

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

    let currentAbortController: AbortController | null = null;

    ws.on('close', () => {
        if (currentAbortController) {
            currentAbortController.abort();
            currentAbortController = null;
        }
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

            if (parsed.type === 'stop') {
                if (currentAbortController) {
                    currentAbortController.abort();
                    currentAbortController = null;
                }
                return;
            }

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
            // Resolve agent ID (default to luna, then oldest, then first alphabetically)
            const effectiveAgentId = agentId || AgentManager.getDefaultAgentId() || 'assistant';

            const agent = AgentManager.getAgent(effectiveAgentId);

            const payload: any[] = [];
            let systemPrompt = agent?.systemPrompt || currentConfig.global?.systemPrompt || "You are a helpful AI assistant.";

            // Inject available skills into system prompt
            const skillDefs = SkillManager.getSkillDefinitions();
            if (skillDefs.length > 0) {
                const skillList = skillDefs.map(s => `- **${s.name}**: ${s.description}`).join('\n');
                systemPrompt += `\n\n## Available Agent Skills\nThe following skills are available to you. CRITICAL: Before responding to ANY user request, check whether a skill's description matches the task. If a match exists, you MUST call \`activate_skill\` first and follow its instructions — never answer from your own knowledge when a matching skill is available. If a skill is already pre-activated (its instructions appear in this prompt), do NOT call \`activate_skill\` — just execute the instructions directly. If the skill's response includes an \`allowed_tools\` list, those tools are pre-approved for use within that skill's workflow and do NOT require \`ask_user\` confirmation.\n\n${skillList}`;
            }

            // Anti-hallucination directive
            systemPrompt += "\n\nCRITICAL: Always use the provided tools to take actions — never claim to have done something without calling the corresponding tool and receiving a successful response. Use exact tool names; do not invent tool names or use filenames as tool names.";

            if (systemPrompt) {
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
                maxTokens: providerConfig.maxTokens,
                supportsTools: !!providerConfig?.capabilities?.trained_for_tool_use
            };

            if (currentConfig.chat.includeHistory) {
                // Filter out 'reasoning' messages as many providers only accept user, assistant, system, tool
                const validMessages = userMessages.filter((msg: any) => msg.role !== 'reasoning');

                // If a user message immediately follows an unresolved tool call (like ask_user), format it as a tool response
                for (let i = 0; i < validMessages.length; i++) {
                    const msg = validMessages[i];
                    if (msg.role === 'user' && i > 0) {
                        const prevMsg = validMessages[i - 1];
                        if (prevMsg.role === 'assistant' && prevMsg.tool_calls && prevMsg.tool_calls.length > 0) {
                            // Only do this if there's no intermediate tool response
                            const hasToolResponse = validMessages.some((m: any, idx: number) => idx > i - 1 && idx < i && m.role === 'tool');
                            if (!hasToolResponse) {
                                const toolCall = prevMsg.tool_calls[0];
                                validMessages[i] = {
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    name: toolCall.function?.name || 'ask_user',
                                    content: JSON.stringify({ response: msg.content })
                                };
                            }
                        }
                    }
                }

                payload.push(...validMessages);
            } else {
                // Get the last non-reasoning message
                const validMessages = userMessages.filter((msg: any) => msg.role !== 'reasoning');
                if (validMessages.length > 0) {
                    payload.push(validMessages[validMessages.length - 1]);
                }
            }

            // Pre-activate any skill the user explicitly named in their message.
            // This bypasses model non-determinism — if the user says "run the X skill",
            // the skill instructions are injected directly rather than relying on the
            // model deciding to call activate_skill.
            if (skillDefs.length > 0) {
                const lastUserText = (() => {
                    const msgs = userMessages.filter((m: any) => m.role === 'user');
                    const last = msgs[msgs.length - 1];
                    return typeof last?.content === 'string' ? last.content : '';
                })();
                if (lastUserText) {
                    for (const skillDef of skillDefs) {
                        const escaped = skillDef.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        if (new RegExp(`\\b${escaped}\\b`, 'i').test(lastUserText)) {
                            const content = SkillManager.getSkillContent(skillDef.name);
                            if (content) {
                                let instructions = content.body;
                                if (content.scriptFiles.length > 0) {
                                    const scriptsPath = path.join(skillDef.skillPath, 'scripts');
                                    instructions = instructions.replace(
                                        new RegExp(`~/.claude/skills/${skillDef.name}/scripts`, 'g'),
                                        scriptsPath
                                    );
                                }
                                payload.push({
                                    role: 'system',
                                    content: `## Skill Pre-activated: ${skillDef.name}\n\nThis skill is already loaded — DO NOT call \`activate_skill\`. Start executing the skill instructions immediately.\n\n${instructions}`
                                });
                                console.log(`[chat-handler] Pre-activated skill "${skillDef.name}" based on user message`);
                            }
                            break;
                        }
                    }
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

            AgentManager.setAgentState(effectiveAgentId, 'working', 'Processing user prompt');
            let finalAiResponse, lastTps, totalUsage, chatHistory;
            let yieldStateMsg: any = null;
            currentAbortController = new AbortController();
            try {
                const result = await runAgentLoop({
                    agentId: effectiveAgentId,
                    sessionId: sessionId || "unknown",
                    llmConfig,
                    messages: payload,
                    visionEnabled: !!providerConfig?.capabilities?.vision,
                    maxLoops: 5,
                    signToolUrls: true,
                    abortSignal: currentAbortController.signal,
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
                    },
                    onToolEnd: (toolCallId: string, name: string, durationMs: number, success: boolean) => {
                        ws.send(JSON.stringify({ type: 'tool_end', toolCallId, name, durationMs, success }));
                    }
                });

                finalAiResponse = result.finalResponse;
                lastTps = result.lastTps;
                totalUsage = result.usage;
                chatHistory = result.chatHistory;
                if (result.yieldState) {
                    yieldStateMsg = result.yieldState;
                }
            } finally {
                currentAbortController = null;
                if (yieldStateMsg) {
                    AgentManager.setAgentState(effectiveAgentId, 'waiting_for_user', yieldStateMsg.question || 'Waiting for input');
                } else {
                    AgentManager.setAgentState(effectiveAgentId, 'idle');
                }
            }

            logger.log({
                type: 'response',
                level: 'info',
                agentId: effectiveAgentId,
                sessionId,
                message: `Response from ${effectiveAgentId}`,
                data: finalAiResponse
            });

            // Persistence logic
            const completionTimestamp = Math.floor(Date.now() / 1000);

            // The new messages generated by the agent loop (after our initial LLM payload)
            const newGeneratedMessages = chatHistory.slice(payload.length);

            // Full history is original user messages + new generated ones
            const fullHistory = [...userMessages, ...newGeneratedMessages];

            // Filter out 'system' messages, 'reasoning' messages, and empty assistant messages (e.g., from aborted streams)
            const finalizedMessages = fullHistory.filter((msg: any) =>
                msg.role !== 'system' &&
                msg.role !== 'reasoning' &&
                !(msg.role === 'assistant' && !msg.content && (!msg.tool_calls || msg.tool_calls.length === 0))
            ).map((msg: any, index, arr) => {
                const isLast = index === arr.length - 1;
                // If this is the turn we just finished, ensure it has stats and the latest timestamp
                if (isLast && msg.role === 'assistant' && finalAiResponse) {
                    return {
                        ...msg,
                        timestamp: completionTimestamp,
                        stats: {
                            tps: lastTps,
                            tokens: totalUsage.completion_tokens,
                            inputTokens: totalUsage.prompt_tokens,
                            outputTokens: totalUsage.completion_tokens,
                            totalTokens: totalUsage.total_tokens
                        }
                    };
                }
                // Respect existing timestamps from the frontend or the agent loop
                return { ...msg, timestamp: msg.timestamp || completionTimestamp };
            });

            if (sessionId) {
                const existing = SessionManager.getSession(sessionId) || {
                    id: sessionId,
                    agentId: effectiveAgentId,
                    title: userMessages[0]?.content?.slice(0, 30) + '...' || 'New Chat',
                    messages: [],
                    updatedAt: Date.now()
                };

                existing.messages = finalizedMessages;
                SessionManager.saveSession(existing);
            }

            ws.send(JSON.stringify({ type: 'done', messages: finalizedMessages }));

            if (sessionId && finalizedMessages.length > 0 && shouldSummarize) {
                (async () => {
                    try {
                        // Build a truncated transcript for summarization — cap at ~1500 chars to
                        // prevent reasoning models from doing extended chain-of-thought on long histories.
                        const MAX_SUMMARY_INPUT_CHARS = 1500;
                        let transcript = finalizedMessages
                            .filter(m => m.role !== 'reasoning')
                            .map(m => {
                                const cleanContent = (m.content || '').replace(/<(think|thought|reasoning)>[\s\S]*?<\/\1>/gi, '').trim();
                                return cleanContent ? `${m.role.toUpperCase()}: ${cleanContent}` : '';
                            })
                            .filter(Boolean)
                            .join('\n');
                        if (transcript.length > MAX_SUMMARY_INPUT_CHARS) {
                            transcript = transcript.slice(0, MAX_SUMMARY_INPUT_CHARS) + '\n[...truncated]';
                        }

                        const summaryPrompt = [
                            { role: 'system', content: 'You are a summarization assistant. Your ENTIRE response must be a short summary of 5-15 words. Do not explain, do not reason, do not use bullet points or numbered lists. Output the title and nothing else.' },
                            {
                                role: 'user', content: `Conversation to title:\n\n${transcript}\n\nShort title:`
                            }
                        ];
                        // Allow enough tokens for reasoning models to finish thinking, but not much more.
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

                        // Strip XML-style thinking tags (e.g. <think>, <thought>, <reasoning>)
                        let strippedSummary = rawSummary.replace(/<(think|thought|reasoning)>[\s\S]*?<\/\1>/gi, '').trim();

                        // Some reasoning models (Qwen3, QwQ, etc.) emit their chain-of-thought as plain
                        // text — e.g. "Thinking process: 1. Analyze...". Walk lines from the end to find
                        // the first short, clean line that looks like an actual title.
                        const extractTitle = (text: string): string | null => {
                            const NOISE_PATTERNS = [
                                /^thinking\b/i,
                                /^analyze\b/i,
                                /^constraint\b/i,
                                /^task:/i,
                                /^\d+\.\s/,      // numbered list items
                                /^[-*•]\s/,      // bullet points
                            ];
                            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                            for (let i = lines.length - 1; i >= 0; i--) {
                                const line = lines[i];
                                if (line.length > 80) continue;
                                if (NOISE_PATTERNS.some(p => p.test(line))) continue;
                                return line.replace(/^["']|["']$/g, '').trim();
                            }
                            return null; // nothing usable found
                        };

                        // Fall back to the first user message (truncated) if the LLM output is unusable.
                        // This is reliable for all models including reasoning ones.
                        const firstUserMessage = finalizedMessages.find(m => m.role === 'user');
                        const firstUserText = (typeof firstUserMessage?.content === 'string' ? firstUserMessage.content : '')
                            .replace(/<(think|thought|reasoning)>[\s\S]*?<\/\1>/gi, '')
                            .trim()
                            .slice(0, 60);

                        const cleanSummary = extractTitle(strippedSummary) || firstUserText || 'New Chat';

                        const updatedSession = SessionManager.getSession(sessionId);
                        if (updatedSession) {
                            updatedSession.summary = cleanSummary;
                            SessionManager.saveSession(updatedSession);
                            const { broadcastMessage } = await import('./state.js');
                            broadcastMessage({ type: 'session_updated', sessionId });
                        }
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        console.error('[Summary] Failed to generate summary:', errorMessage);

                        // Notify UI via broadcast (presence socket)
                        import('./state.js').then(({ broadcastMessage }) => {
                            broadcastMessage({
                                type: 'system_error',
                                title: 'Summary Generation Failed',
                                message: errorMessage,
                                sessionId: sessionId,
                                agentId: effectiveAgentId
                            });
                        });
                    }
                })();
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
                } else if (error.message.includes('LLM API error: 500')) {
                    errorMessage = `The LLM provider returned a 500 error. This is usually caused by the conversation exceeding the model's context window — the tool results may have been too large to fit. Try reloading the model with a larger context (131k+), or start a new conversation.`;
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
