import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, saveConfig, Config } from './config-manager.js';
import { streamChatCompletion, getChatCompletion } from './lm-studio.js';
import { AgentManager } from './agent-manager.js';
import { SessionManager, Session } from './session-manager.js';
import { ToolManager } from './tool-manager.js';
import { logger } from './logger.js';


const config = loadConfig();
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

async function startServer() {
    console.log('Initializing systems...');
    await ToolManager.discoverTools();

    const PORT = config.gateway.port;
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Gateway service is hot and running on port ${PORT}`);
    });
}

app.use(cors());
app.use(express.json());

// Auth Middleware
app.use((req, res, next) => {
    // Allow initial config check to see if token is needed/exists
    if (req.path === '/api/config' && req.method === 'GET') {
        return next();
    }

    const token = req.headers['authorization']?.replace('Bearer ', '');
    const currentConfig = loadConfig();
    if (token !== currentConfig.gateway.secretToken) {
        console.warn(`[Auth] Blocked request to ${req.path} from ${req.ip}. Token provided: ${token ? 'YES' : 'NO'}`);
        return res.status(401).json({ error: 'Unauthorized: Invalid Secret Token' });
    }
    next();
});

interface ConnectedClient {
    hostname: string;
    ip: string;
    connectedAt: number;
    tools?: string[];
}

const connectedClients = new Map<WebSocket, ConnectedClient>();
const pendingToolCalls = new Map<string, { resolve: (val: any) => void, reject: (err: any) => void }>();

// API to get/update config
app.get('/api/config', (req, res) => {
    res.json(loadConfig());
});

app.get('/api/clients', (req, res) => {
    res.json(Array.from(connectedClients.values()));
});

app.post('/api/config', (req, res) => {
    try {
        const newConfig = req.body as Config;
        saveConfig(newConfig);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: String(error) });
    }
});

// Agents API
app.get('/api/agents', (req, res) => {
    const agentIds = AgentManager.listAgents();
    const agents = agentIds.map(id => AgentManager.getAgent(id));
    res.json(agents);
});

app.post('/api/agents/:id/config', (req, res) => {
    try {
        const { name, emoji } = req.body;
        AgentManager.saveAgentConfig(req.params.id, { name, emoji });
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: String(error) });
    }
});

app.post('/api/agents/:id/files/:filename', (req, res) => {
    try {
        const { content } = req.body;
        const agentDir = path.resolve(process.cwd(), 'agents', req.params.id);
        const filePath = path.join(agentDir, req.params.filename);

        // Security check: ensure the file is within the agent directory
        if (!filePath.startsWith(agentDir)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        fs.writeFileSync(filePath, content, 'utf-8');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

// Sessions API
app.get('/api/sessions', (req, res) => {
    res.json(SessionManager.listSessions());
});

app.get('/api/sessions/:id', (req, res) => {
    const session = SessionManager.getSession(req.params.id);
    if (session) res.json(session);
    else res.status(404).json({ error: 'Session not found' });
});

app.delete('/api/sessions/:id', (req, res) => {
    SessionManager.deleteSession(req.params.id);
    res.json({ success: true });
});

app.get('/api/tools', (req, res) => {
    res.json(ToolManager.getToolDefinitions());
});

app.get('/api/models', async (req, res) => {
    try {
        const queryUrl = req.query.baseUrl as string;
        const currentConfig = loadConfig();
        const rawBaseUrl = queryUrl || currentConfig.lmStudio.baseUrl;

        if (!rawBaseUrl) {
            return res.json({ data: [] });
        }

        const normalizedUrl = rawBaseUrl.replace(/\/$/, '');
        const baseUrl = normalizedUrl.endsWith('/v1') ? normalizedUrl : `${normalizedUrl}/v1`;

        const response = await fetch(`${baseUrl}/models`);
        if (!response.ok) throw new Error(`Failed to fetch models: ${response.statusText}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[Models] Fetch error:', error);
        res.status(500).json({ error: String(error) });
    }
});

app.get('/api/logs', (req, res) => {
    res.json(logger.getLogs());
});

app.post('/api/logs/clear', (req, res) => {
    logger.clear();
    res.json({ success: true });
});

// WebSocket for Chat
wss.on('connection', (ws, req) => {
    const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const ip = rawIp.replace(/^::ffff:/, ''); // Clean up IPv4-mapped IPv6
    const params = new URLSearchParams(req.url?.split('?')[1]);
    const hostname = params.get('hostname') || 'Unknown Device';
    const token = params.get('token');

    console.log(`Client connected: ${hostname} (${ip})`);

    // WS Auth Check
    const currentConfig = loadConfig();

    if (token !== currentConfig.gateway.secretToken) {
        console.log('WS Connection rejected: Invalid Token');
        ws.close(1008, 'Invalid Secret Token');
        return;
    }

    connectedClients.set(ws, {
        hostname,
        ip,
        connectedAt: Date.now()
    });

    ws.on('close', () => {
        const client = connectedClients.get(ws);
        if (client?.tools) {
            client.tools.forEach(toolName => ToolManager.unregisterTool(toolName));
        }
        connectedClients.delete(ws);
        console.log(`Client disconnected: ${hostname} (${ip})`);
    });

    ws.on('message', async (data) => {
        try {
            const parsed = JSON.parse(data.toString());

            // Handle Tool Registration from Workers
            if (parsed.type === 'register_tools') {
                const tools = parsed.tools as any[];
                const client = connectedClients.get(ws);
                if (client) {
                    client.tools = tools.map(t => t.name);
                    tools.forEach(toolDef => {
                        ToolManager.registerTool({
                            definition: toolDef,
                            handler: async (args) => {
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
            const { sessionId, agentId, messages: userMessages, shouldSummarize } = parsed;
            if (!userMessages) return;

            const currentConfig = loadConfig();
            const agent = AgentManager.getAgent(agentId || 'clawdbot');

            const payload: any[] = [];
            const systemPrompt = agent?.systemPrompt || currentConfig.lmStudio.systemPrompt;

            if (systemPrompt) {
                payload.push({ role: 'system', content: systemPrompt });
            }

            if (currentConfig.chat.includeHistory) {
                payload.push(...userMessages);
            } else {
                payload.push(userMessages[userMessages.length - 1]);
            }

            logger.log({
                type: 'request',
                level: 'info',
                agentId: agentId || 'clawdbot',
                sessionId,
                message: `Outgoing request to provider for agent ${agentId || 'clawdbot'}`,
                data: { messages: payload, config: currentConfig.lmStudio }
            });

            const chatHistory = [...payload];
            let toolLoop = true;
            let finalAiResponse = '';

            while (toolLoop) {
                let fullContent = '';
                let toolCalls: any[] = [];

                for await (const delta of streamChatCompletion(currentConfig, chatHistory, ToolManager.getToolDefinitions())) {
                    if (delta.content) {
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
                }

                // Filtering empty slots in toolCalls (Vite/LM Studio stream index might skip)
                const actualToolCalls = toolCalls.filter(Boolean);

                if (actualToolCalls.length > 0) {
                    const assistantMsg = { role: 'assistant', content: fullContent || null, tool_calls: actualToolCalls };
                    chatHistory.push(assistantMsg);

                    for (const toolCall of actualToolCalls) {
                        const name = toolCall.function.name;
                        const args = JSON.parse(toolCall.function.arguments || '{}');

                        try {
                            const result = await ToolManager.callTool(name, args, { agentId: agentId || 'clawdbot' });
                            logger.log({
                                type: 'tool',
                                level: 'info',
                                agentId: agentId || 'clawdbot',
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
                                agentId: agentId || 'clawdbot',
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
                        agentId: agentId || 'clawdbot',
                        sessionId,
                        message: `Final response received for agent ${agentId || 'clawdbot'}`,
                        data: { content: finalAiResponse }
                    });
                }
            }

            ws.send(JSON.stringify({ type: 'done' }));

            // Persistence logic
            if (sessionId) {
                const timestamp = Date.now();
                const existing = SessionManager.getSession(sessionId) || {
                    id: sessionId,
                    agentId: agentId || 'clawdbot',
                    title: userMessages[0].content.slice(0, 30) + '...',
                    messages: [],
                    updatedAt: timestamp
                };

                const newMessages = [...userMessages];
                if (finalAiResponse) {
                    newMessages.push({
                        role: 'assistant',
                        content: finalAiResponse,
                        timestamp: Math.floor(timestamp / 1000)
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
                                { role: 'user', content: `Summarize this conversation in 10 words or less:\n\n${newMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}` }
                            ];
                            const summary = await getChatCompletion(currentConfig, summaryPrompt);
                            const updatedSession = SessionManager.getSession(sessionId);
                            if (updatedSession) {
                                updatedSession.summary = summary.trim();
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
                    errorMessage = `Unable to connect to LM Studio at ${currentConfig.lmStudio.baseUrl}. Please ensure LM Studio is running and accessible.`;
                } else if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
                    errorMessage = `Connection to LM Studio timed out. Please check your network connection and ensure LM Studio is responding.`;
                } else if (error.message.includes('ENOTFOUND')) {
                    errorMessage = `Could not resolve hostname for LM Studio. Please check the baseUrl in your configuration: ${currentConfig.lmStudio.baseUrl}`;
                } else if (error.message.includes('LM Studio API error')) {
                    errorMessage = error.message;
                } else {
                    errorMessage = `Error communicating with LM Studio: ${error.message}`;
                }
            }

            ws.send(JSON.stringify({ type: 'error', message: errorMessage }));
        }
    });
});

startServer().catch(err => {
    console.error('FATAL STARTUP ERROR:', err);
    process.exit(1);
});
