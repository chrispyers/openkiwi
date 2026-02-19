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


const config = loadConfig();
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

async function startServer() {
    console.log('Initializing systems...');
    await ToolManager.discoverTools();
    await AgentManager.initializeAllMemoryManagers();
    await HeartbeatManager.start();

    // Initialize WhatsApp
    WhatsAppManager.getInstance();

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
const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}
app.use('/screenshots', express.static(SCREENSHOTS_DIR));

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
        AgentManager.clearMemoryManagers(); // Force reload of providers/memory settings
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

app.post('/api/agents', (req, res) => {
    try {
        const { name } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Agent name is required' });
        }
        const agent = AgentManager.createAgent(name.trim());
        res.json(agent);
    } catch (error) {
        res.status(400).json({ error: String(error) });
    }
});

app.post('/api/agents/:id/config', (req, res) => {
    try {
        AgentManager.saveAgentConfig(req.params.id, req.body);
        HeartbeatManager.refreshAgent(req.params.id);
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

import { listModels } from './llm-provider.js';

app.post('/api/models', async (req, res) => {
    try {
        const { endpoint, apiKey } = req.body;
        const currentConfig = loadConfig();

        // Use provided config or fall back to default provider
        let providerConfig;

        if (endpoint) {
            providerConfig = {
                baseUrl: endpoint,
                modelId: '', // Not needed for listing
                apiKey: apiKey // Optional, for new providers
            };
        } else {
            const defaultProvider = currentConfig.providers[0];
            if (!defaultProvider) {
                return res.json({ data: [] });
            }
            providerConfig = {
                baseUrl: defaultProvider.endpoint,
                modelId: defaultProvider.model,
                apiKey: defaultProvider.apiKey
            };
        }

        const models = await listModels(providerConfig);

        logger.log({
            type: 'system',
            level: 'info',
            message: `Discovered ${models.length} models from ${providerConfig.baseUrl}`,
            data: models
        });

        // Normalize to expected format
        res.json({ data: models });
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

// WhatsApp API
app.get('/api/whatsapp/status', (req, res) => {
    res.json(WhatsAppManager.getInstance().getStatus());
});

app.post('/api/whatsapp/logout', async (req, res) => {
    await WhatsAppManager.getInstance().logout();
    res.json({ success: true });
});

// Helper to extract text from various message types
function getMessageText(msg: WAMessage): string | null {
    if (!msg.message) return null;
    const content = msg.message;

    // Check for standard text types
    let text = content.conversation ||
        content.extendedTextMessage?.text ||
        content.ephemeralMessage?.message?.extendedTextMessage?.text ||
        content.ephemeralMessage?.message?.conversation ||
        content.viewOnceMessage?.message?.listMessage?.description ||
        content.viewOnceMessage?.message?.buttonsMessage?.contentText;

    // Handle history sync messages if they contain conversation/text
    // Usually history sync logic is internal, but if Baileys exposes it as a WAMessage with protocol content,
    // we generally ignore it unless we specifically want to process history.
    // However, the logs showed "protocolMessage" type. 
    // If the user's message is wrapped in a way we missed, let's look deeper.
    // But based on logs, the messages are type HISTORY_SYNC_NOTIFICATION, which are NOT user messages.
    // User messages to self usually come as standard messages with fromMe=true.

    return text || null;
}

// WhatsApp Message Handler
WhatsAppManager.getInstance().on('message', async (msg) => {
    try {
        let remoteJid = msg.key.remoteJid;
        const text = getMessageText(msg);

        // Debug log to understand message structure if text is missing
        if (!text) {
            logger.log({
                type: 'system',
                level: 'debug',
                message: `WhatsApp: Received message with no extractable text. Structure: ${JSON.stringify(msg.message).substring(0, 200)}...`
            });
            return;
        }

        if (!remoteJid) return;

        // Fix for LID: If the message is from me (Note to Self sent via phone) and comes as LID,
        // we should treat the chat session as being with the main phone number JID, not the LID.
        // This ensures consistent session ID regardless of which device/ID sent it.
        const { myJid, myLid } = WhatsAppManager.getInstance().getUserJids();

        // If it's a self-message, normalize remoteJid to myJid (Phone Number) if available
        if (msg.key.fromMe && myJid) {
            if (areJidsSameUser(remoteJid, myJid) || (myLid && areJidsSameUser(remoteJid, myLid))) {
                remoteJid = myJid;
            }
        }

        logger.log({
            type: 'system',
            level: 'info',
            message: `WhatsApp message from ${remoteJid}: ${text}`
        });


        // Check for agent targeting (e.g. "@luna Hello")
        const agentIds = AgentManager.listAgents();
        const agents = agentIds.map(id => AgentManager.getAgent(id)).filter(a => a !== null);

        let agentId = 'luna';
        let targetFound = false;

        // Sort by length desc to ensure we match "@Super Bot" before "@Super" if both exist
        const potentialMatches = agents.flatMap(agent => [
            { name: agent!.name, id: agent!.id, agent }
        ]).sort((a, b) => b.name.length - a.name.length);

        for (const match of potentialMatches) {
            // Check name match
            const nameRegex = new RegExp(`^@${match.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+|$)`, 'i');
            const idRegex = new RegExp(`^@${match.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+|$)`, 'i');

            let regexMatch = text.match(nameRegex);
            if (!regexMatch) regexMatch = text.match(idRegex);

            if (regexMatch) {
                agentId = match.id;
                // Strip the mention and leading/trailing whitespace
                // We use let text in local scope to override the const text from above if we could, 
                // but we can't re-declare. We will need to update how we use 'text' below.
                // Actually, since 'text' is const, we need to create a new variable 'messageContent'
                // and use that instead of 'text' in the rest of the function.
                targetFound = true;
                break;
            }
        }

        let messageContent = text;
        if (targetFound) {
            // We need to strip the prefix. Re-run the match to get the length.
            const agent = AgentManager.getAgent(agentId);
            if (agent) {
                const nameRegex = new RegExp(`^@${agent.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+|$)`, 'i');
                const idRegex = new RegExp(`^@${agent.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+|$)`, 'i');
                let m = text.match(nameRegex) || text.match(idRegex);
                if (m) {
                    messageContent = text.substring(m[0].length).trim();
                }
            }
        }

        if (!targetFound && agentIds.length > 0) {
            const preferred = agentIds.find(id => id.toLowerCase() === 'luna');
            agentId = preferred || agentIds[0];
        }

        const safeSessionId = `wa-${remoteJid.replace(/[^a-zA-Z0-9]/g, '_')}-${agentId}`;

        const agent = AgentManager.getAgent(agentId);
        if (!agent) {
            logger.log({ type: 'error', level: 'error', message: `WhatsApp: Could not find agent ${agentId}` });
            return;
        }

        const currentConfig = loadConfig();

        // Determine provider
        const providerName = agent?.provider;
        let providerConfig = currentConfig.providers.find(p => p.model === providerName || p.description === providerName);
        if (!providerConfig && currentConfig.providers.length > 0) {
            providerConfig = currentConfig.providers[0];
            logger.log({ type: 'system', level: 'warn', message: `Using default provider ${providerConfig.model} for agent ${agentId} because configured provider ${providerName} was not found.` });
        }

        if (!providerConfig) {
            logger.log({ type: 'error', level: 'error', message: `WhatsApp: No provider found for agent ${agentId}. Provider name: ${providerName}` });
            await WhatsAppManager.getInstance().sendMessage(remoteJid, 'Error: No LLM provider configured.');
            return;
        }

        const llmConfig = {
            baseUrl: providerConfig.endpoint,
            modelId: providerConfig.model,
            apiKey: providerConfig.apiKey
        };

        logger.log({
            type: 'system',
            level: 'info',
            message: `Processing WhatsApp message to ${agentId} using provider ${providerConfig.model}`
        });

        // Load or Create Session
        let session = SessionManager.getSession(safeSessionId);
        if (!session) {
            session = {
                id: safeSessionId,
                agentId: agentId,
                title: messageContent.slice(0, 30) + '...',
                messages: [],
                updatedAt: Date.now()
            };
        }

        // Add user message to session
        const timestamp = Math.floor(Date.now() / 1000);
        session.messages.push({
            role: 'user',
            content: messageContent,
            timestamp
        });
        SessionManager.saveSession(session);

        // Prepare prompt payload
        const payload: any[] = [];
        const systemPrompt = agent?.systemPrompt || currentConfig.global?.systemPrompt || "You are a helpful AI assistant.";
        if (systemPrompt) {
            payload.push({ role: 'system', content: systemPrompt });
        }

        // Add history (filter reasoning)
        const validMessages = session.messages.filter((msg: any) => msg.role !== 'reasoning');
        payload.push(...validMessages);

        // Tool Loop Logic (Non-streaming)
        let toolLoop = true;
        let finalAiResponse = '';
        let loopCount = 0;
        const MAX_LOOPS = 5;

        const chatHistory = [...payload];

        while (toolLoop && loopCount < MAX_LOOPS) {
            loopCount++;
            let fullContent = '';
            let toolCalls: any[] = [];

            // reusing streamChatCompletion but accumulating result
            for await (const delta of streamChatCompletion(llmConfig, chatHistory, ToolManager.getToolDefinitions())) {
                if (delta.content) {
                    fullContent += delta.content;
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

            const actualToolCalls = toolCalls.filter(Boolean);

            if (actualToolCalls.length > 0) {
                const assistantMsg = { role: 'assistant', content: fullContent || null, tool_calls: actualToolCalls };
                chatHistory.push(assistantMsg);

                for (const toolCall of actualToolCalls) {
                    const name = toolCall.function.name;
                    const args = JSON.parse(toolCall.function.arguments || '{}');

                    try {
                        const result = await ToolManager.callTool(name, args, { agentId });
                        logger.log({
                            type: 'tool',
                            level: 'info',
                            agentId,
                            sessionId: safeSessionId,
                            message: `Tool executed: ${name}`,
                            data: { name, args, result }
                        });
                        chatHistory.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            name,
                            content: JSON.stringify(result)
                        });
                    } catch (err) {
                        logger.log({
                            type: 'error',
                            level: 'error',
                            agentId,
                            sessionId: safeSessionId,
                            message: `Tool execution failed: ${name}`,
                            data: { name, args, error: String(err) }
                        });
                        chatHistory.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            name,
                            content: JSON.stringify({ error: String(err) })
                        });
                    }
                }
            } else {
                finalAiResponse = fullContent;
                toolLoop = false;
            }
        }

        if (finalAiResponse) {
            // Clean up thinking tags for WhatsApp
            const cleanResponse = finalAiResponse.replace(/<(think|thought|reasoning)>[\s\S]*?<\/\1>/gi, '').trim();

            if (cleanResponse) {
                await WhatsAppManager.getInstance().sendMessage(remoteJid, cleanResponse);
            }

            // Save assistant response
            session.messages.push({
                role: 'assistant',
                content: finalAiResponse,
                timestamp: Math.floor(Date.now() / 1000)
            });
            SessionManager.saveSession(session);
        }

    } catch (err) {
        logger.log({ type: 'error', level: 'error', message: `WhatsApp handler error: ${err}` });
    }
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
        let sessionId: string | undefined;
        let agentId: string | undefined;

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
                ws.send(JSON.stringify({ type: 'error', message: 'No LLM provider configured. Please add a provider in settings.' }));
                return;
            }

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

            const chatHistory = [...payload];
            let toolLoop = true;
            let finalAiResponse = '';

            while (toolLoop) {
                let fullContent = '';
                let toolCalls: any[] = [];

                for await (const delta of streamChatCompletion(llmConfig, chatHistory, ToolManager.getToolDefinitions())) {
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
                    if (delta.usage) {
                        logger.log({
                            type: 'usage',
                            level: 'info',
                            agentId: effectiveAgentId,
                            sessionId,
                            message: 'Token usage report',
                            data: delta.usage
                        });
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
                            const result = await ToolManager.callTool(name, args, { agentId: effectiveAgentId });
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
