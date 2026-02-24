import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, saveConfig, Config } from './config-manager.js';
import { streamChatCompletion, getChatCompletion } from './llm-provider.js';
import { AgentManager } from './agent-manager.js';
import { SessionManager, Session } from './session-manager.js';
import { ToolManager } from './tool-manager.js';
import { logger } from './logger.js';
import { HeartbeatManager } from './heartbeat-manager.js';
import { WhatsAppManager } from './whatsapp-manager.js';
import { WAMessage, areJidsSameUser, jidNormalizedUser } from '@whiskeysockets/baileys';
import { authMiddleware, signUrl, SCREENSHOTS_DIR, WORKSPACE_DIR } from './security.js';
import { initWhatsAppHandler } from './WhatsApp.js';
import { processVisionMessages } from './vision.js';
import apiRouter, { connectedClients } from './routes.js';



const config = loadConfig();
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({
    server,
    verifyClient: (info, callback) => {
        const origin = info.origin;
        // Allow requests with no origin (direct connections)
        if (!origin) return callback(true);

        const currentConfig = loadConfig();
        const allowed = currentConfig.gateway.allowedOrigins || [];

        if (allowed.includes(origin) || allowed.includes('*')) {
            callback(true);
        } else {
            console.warn(`[WebSocket] Blocked connection from unauthorized origin: ${origin}`);
            callback(false, 403, 'Unauthorized Origin');
        }
    }
});

async function checkForUpdates() {
    try {
        const currentConfig = loadConfig();
        const localReleasePath = path.resolve(process.cwd(), 'LATEST_RELEASE.txt');

        // 1. Sync local version from LATEST_RELEASE.txt
        if (fs.existsSync(localReleasePath)) {
            const localVersion = fs.readFileSync(localReleasePath, 'utf-8').trim();
            if (!currentConfig.system) {
                currentConfig.system = { version: localVersion, latestVersion: "" };
            }

            if (currentConfig.system.version !== localVersion) {
                console.log(`[System] Updating local version in config: ${currentConfig.system.version} -> ${localVersion}`);
                currentConfig.system.version = localVersion;
                saveConfig(currentConfig);
            }
        }

        // 2. Fetch remote version from GitHub
        const url = 'https://raw.githubusercontent.com/chrispyers/openkiwi/refs/heads/main/LATEST_RELEASE.txt';
        const response = await fetch(url);
        if (response.ok) {
            const latestVersion = (await response.text()).trim();

            // Re-load config in case it was updated above
            const updatedConfig = loadConfig();
            if (!updatedConfig.system) {
                updatedConfig.system = { version: "2026-02-18", latestVersion: "" };
            }

            if (updatedConfig.system.latestVersion !== latestVersion) {
                updatedConfig.system.latestVersion = latestVersion;
                saveConfig(updatedConfig);
                console.log(`[Update] New remote version detected: ${latestVersion}`);
            }
        }
    } catch (error) {
        console.error('[Update] Failed to sync versions:', error);
    }
}

async function startServer() {
    console.log('Initializing systems...');
    await ToolManager.discoverTools();
    await AgentManager.initializeAllMemoryManagers();
    await HeartbeatManager.start();

    // Ensure required directories exist
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
        fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
    if (!fs.existsSync(WORKSPACE_DIR)) {
        fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
    }

    // Check for updates on startup and then every hour
    await checkForUpdates();
    setInterval(checkForUpdates, 3600000); // 3,600,000 ms = 1 hour

    // Initialize WhatsApp and its message handler
    WhatsAppManager.getInstance();
    initWhatsAppHandler();

    const PORT = config.gateway.port;
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Gateway service is hot and running on port ${PORT}`);
    });
}

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin requests)
        if (!origin) return callback(null, true);

        const currentConfig = loadConfig();
        const allowed = currentConfig.gateway.allowedOrigins || [];

        if (allowed.includes(origin) || allowed.includes('*')) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'ok', service: 'openkiwi-gateway' }));

app.use('/api', apiRouter);

const pendingToolCalls = new Map<string, { resolve: (val: any) => void, reject: (err: any) => void }>();

// All API routes are now handled by apiRouter

// WebSocket for Chat
wss.on('connection', (ws, req) => {
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
            const systemPrompt = agent?.systemPrompt || currentConfig.global?.systemPrompt || "You are a helpful AI assistant.";

            if (systemPrompt) {
                payload.push({ role: 'system', content: systemPrompt });
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
                apiKey: providerConfig.apiKey
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

            const chatHistory = processVisionMessages([...payload], !!providerConfig?.capabilities?.vision);
            let toolLoop = true;
            let finalAiResponse = '';
            const MAX_LOOPS = 5;
            let loopCount = 0;
            let totalUsage = { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 };
            let lastTps = 0;

            while (toolLoop && loopCount < MAX_LOOPS) {
                loopCount++;
                let fullContent = '';
                let toolCalls: any[] = [];

                // Process vision messages in each loop to catch images returned by tools
                const processedHistory = processVisionMessages([...chatHistory], !!providerConfig?.capabilities?.vision);

                let firstTokenTime = 0;
                const requestStartTime = Date.now();

                for await (const delta of streamChatCompletion(llmConfig, processedHistory, ToolManager.getToolDefinitions())) {
                    if (delta.content) {
                        if (!firstTokenTime) firstTokenTime = Date.now();
                        if (!fullContent) console.log('[WS] Received first delta from LLM');
                        fullContent += delta.content;
                        ws.send(JSON.stringify({ type: 'delta', content: delta.content }));
                    }
                    if (delta.tool_calls) {
                        for (const toolCall of delta.tool_calls) {
                            if (!toolCalls[toolCall.index]) {
                                toolCalls[toolCall.index] = toolCall;
                            } else {
                                if (toolCall.function?.arguments) {
                                    toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
                                }
                            }
                        }
                    }
                    if (delta.usage || delta.stats) {
                        const usage = delta.usage || {};
                        const stats = delta.stats || {};

                        // Calculate TPS (Tokens Per Second)
                        const endTime = Date.now();
                        const durationSeconds = (endTime - (firstTokenTime || requestStartTime)) / 1000;

                        const completionTokens = usage.completion_tokens || usage.output_tokens || stats.total_output_tokens || 0;
                        const promptTokens = usage.prompt_tokens || usage.input_tokens || stats.input_tokens || 0;

                        // Use provider-supplied TPS if available (LM Studio), otherwise calculate
                        let tps = stats.tokens_per_second || usage.tokens_per_second;
                        if (tps === undefined || tps === null) {
                            tps = durationSeconds > 0 ? (completionTokens / durationSeconds) : 0;
                        }

                        lastTps = parseFloat(tps.toFixed(1));
                        totalUsage.completion_tokens += completionTokens;
                        totalUsage.prompt_tokens += promptTokens;
                        totalUsage.total_tokens += (completionTokens + promptTokens);

                        const usageStats = {
                            ...usage,
                            ...stats,
                            tps: lastTps,
                            duration: parseFloat(durationSeconds.toFixed(2))
                        };

                        logger.log({
                            type: 'usage',
                            level: 'info',
                            agentId: effectiveAgentId,
                            sessionId,
                            message: 'Token usage report',
                            data: usageStats
                        });

                        ws.send(JSON.stringify({ type: 'usage', usage: usageStats }));
                    }
                }

                // Filtering empty slots in toolCalls (stream index might skip)
                const actualToolCalls = toolCalls.filter(Boolean);

                if (actualToolCalls.length > 0) {
                    const assistantMsg = { role: 'assistant', content: fullContent || null, tool_calls: actualToolCalls };
                    chatHistory.push(assistantMsg);

                    for (const toolCall of actualToolCalls) {
                        const name = toolCall.function.name;
                        const args = JSON.parse(toolCall.function.arguments || '{}');

                        try {
                            let result = await ToolManager.callTool(name, args, { agentId: effectiveAgentId });

                            // Sign any URLs in the tool result so the LLM gets signed links
                            if (result && typeof result === 'object') {
                                if (result.screenshot_url) result.screenshot_url = signUrl(result.screenshot_url);
                                if (result.image_url) result.image_url = signUrl(result.image_url);
                            }

                            logger.log({
                                type: 'tool',
                                level: 'info',
                                agentId: effectiveAgentId,
                                sessionId,
                                message: `Tool executed: ${name}`,
                                data: { name, args, result }
                            });
                            chatHistory.push({
                                role: 'tool',
                                tool_call_id: toolCall.id,
                                name: name,
                                content: JSON.stringify(result)
                            });
                        } catch (err) {
                            logger.log({
                                type: 'error',
                                level: 'error',
                                agentId: effectiveAgentId,
                                sessionId,
                                message: `Tool execution failed: ${name}`,
                                data: { name, args, error: String(err) }
                            });
                            chatHistory.push({
                                role: 'tool',
                                tool_call_id: toolCall.id,
                                name: name,
                                content: JSON.stringify({ error: String(err) })
                            });
                        }
                    }
                } else {
                    finalAiResponse = fullContent;
                    toolLoop = false;

                    logger.log({
                        type: 'response',
                        level: 'info',
                        agentId: effectiveAgentId,
                        sessionId,
                        message: `Response from ${effectiveAgentId}`,
                        data: finalAiResponse
                    });
                }
            }

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

                const newMessages = [...userMessages];
                if (finalAiResponse) {
                    newMessages.push({
                        role: 'assistant',
                        content: finalAiResponse,
                        timestamp: Math.floor(timestamp / 1000),
                        stats: {
                            tps: lastTps,
                            tokens: totalUsage.completion_tokens,
                            inputTokens: totalUsage.prompt_tokens,
                            outputTokens: totalUsage.completion_tokens,
                            totalTokens: totalUsage.total_tokens
                        } as any
                    });
                }

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
});

startServer().catch(err => {
    console.error('FATAL STARTUP ERROR:', err);
    process.exit(1);
});
