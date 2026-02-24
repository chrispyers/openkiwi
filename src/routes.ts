import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { loadConfig, saveConfig, Config } from './config-manager.js';
import { AgentManager } from './agent-manager.js';
import { SessionManager } from './session-manager.js';
import { ToolManager } from './tool-manager.js';
import { logger } from './logger.js';
import { HeartbeatManager } from './heartbeat-manager.js';
import { WhatsAppManager } from './whatsapp-manager.js';
import {
    authMiddleware,
    signUrl,
    signMarkdown,
    verifyFileSignature,
    SCREENSHOTS_DIR,
    WORKSPACE_DIR
} from './security.js';
import { listModels } from './llm-provider.js';
import { WebSocket } from 'ws';

// Move State to a shared location to avoid circular dependencies
export interface ConnectedClient {
    hostname: string;
    ip: string;
    connectedAt: number;
    tools?: string[];
}

export const connectedClients = new Map<WebSocket, ConnectedClient>();

const router = Router();

router.use((req, res, next) => {
    if (req.path.startsWith('/files/screenshots/') || req.path.startsWith('/files/workspace-files/')) {
        return next();
    }
    return authMiddleware(req, res, next);
});

// Dedicated proxy for serving protected static assets - using regex for cross-version compatibility
router.get(/^\/files\/(screenshots|workspace-files)\/(.*)/, (req, res) => {
    const fileType = req.params[0];
    const filePathSegment = req.params[1];
    const signature = req.query.sig as string;
    const expires = parseInt(req.query.expires as string);

    if (fileType !== 'screenshots' && fileType !== 'workspace-files') {
        return res.status(404).json({ error: 'Invalid file type' });
    }

    const baseDir = fileType === 'screenshots' ? SCREENSHOTS_DIR : WORKSPACE_DIR;
    const fullPath = path.resolve(baseDir, filePathSegment);

    if (!fullPath.startsWith(baseDir)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const headerToken = req.headers['authorization']?.replace('Bearer ', '') || (req.query.token as string);
    const currentConfig = loadConfig();

    let isAuthorized = (headerToken === currentConfig.gateway.secretToken);

    if (!isAuthorized && signature && !isNaN(expires)) {
        isAuthorized = verifyFileSignature(`${fileType}/${filePathSegment}`, expires, signature);
    }

    if (!isAuthorized) {
        if (!req.path.includes('favicon.ico')) {
            console.warn(`[Auth] Blocked request to ${req.path} from ${req.ip}. Signature or Token invalid.`);
        }
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    if (!fs.statSync(fullPath).isFile()) {
        return res.status(400).json({ error: 'Requested path is not a file' });
    }

    res.sendFile(fullPath);
});

router.get('/files/sign', (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: 'Path is required' });
    res.json({ url: signUrl(filePath) });
});

router.get('/config/public', (req, res) => {
    const fullConfig = loadConfig();
    const redactedConfig = {
        chat: fullConfig.chat,
        global: fullConfig.global,
        system: fullConfig.system,
        gateway: {
            port: fullConfig.gateway.port,
            endpoint: fullConfig.gateway.endpoint
        },
        providers: fullConfig.providers.map(p => {
            const { apiKey, ...rest } = p;
            return {
                ...rest,
                hasApiKey: !!apiKey
            };
        })
    };
    res.json(redactedConfig);
});

router.get('/config', (req, res) => {
    res.json(loadConfig());
});

router.get('/clients', (req, res) => {
    res.json(Array.from(connectedClients.values()));
});

router.post('/config', async (req, res) => {
    try {
        const newConfig = req.body as Config;
        saveConfig(newConfig);
        AgentManager.clearMemoryManagers();
        await ToolManager.discoverTools();
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: String(error) });
    }
});

// Agents API
router.get('/agents', (req, res) => {
    const agentIds = AgentManager.listAgents();
    const agents = agentIds.map(id => {
        const agent = AgentManager.getAgent(id);
        if (!agent) return null;
        return {
            ...agent,
            identity: signMarkdown(agent.identity),
            soul: signMarkdown(agent.soul),
            memory: signMarkdown(agent.memory),
            heartbeatInstructions: signMarkdown(agent.heartbeatInstructions),
            systemPrompt: signMarkdown(agent.systemPrompt)
        };
    }).filter(Boolean);
    res.json(agents);
});

router.post('/agents', (req, res) => {
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

const validateAgentId = (req: any, res: any, next: any) => {
    const id = req.params.id;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid agent ID' });
    const sanitized = id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (id !== sanitized || id.length === 0) {
        return res.status(400).json({ error: 'Invalid agent ID format' });
    }
    next();
};

router.post('/agents/:id/config', validateAgentId, (req, res) => {
    try {
        AgentManager.saveAgentConfig(req.params.id, req.body);
        HeartbeatManager.refreshAgent(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: String(error) });
    }
});

router.get('/agents/:id/files', validateAgentId, (req, res) => {
    try {
        const agentDir = path.resolve(process.cwd(), 'agents', req.params.id);
        if (!fs.existsSync(agentDir)) return res.json([]);

        const files = fs.readdirSync(agentDir).filter(f => fs.statSync(path.join(agentDir, f)).isFile());
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

router.get('/agents/:id/files/:filename', validateAgentId, (req, res) => {
    try {
        const agentDir = path.resolve(process.cwd(), 'agents', req.params.id);
        const filePath = path.join(agentDir, req.params.filename);

        if (!filePath.startsWith(agentDir)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!fs.existsSync(filePath)) return res.status(404).send('File not found');

        res.sendFile(filePath);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

router.delete('/agents/:id', validateAgentId, (req, res) => {
    try {
        AgentManager.deleteAgent(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: String(error) });
    }
});

router.post('/agents/:id/files/:filename', validateAgentId, (req, res) => {
    try {
        const { content } = req.body;
        const agentDir = path.resolve(process.cwd(), 'agents', req.params.id);
        const filePath = path.join(agentDir, req.params.filename);

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
router.get('/sessions', (req, res) => {
    const sessions = SessionManager.listSessions().map(session => ({
        ...session,
        messages: session.messages.map(m => ({
            ...m,
            content: signMarkdown(m.content)
        }))
    }));
    res.json(sessions);
});

router.get('/sessions/:id', (req, res) => {
    const session = SessionManager.getSession(req.params.id);
    if (session) {
        const signedSession = {
            ...session,
            messages: session.messages.map(m => ({
                ...m,
                content: signMarkdown(m.content)
            }))
        };
        res.json(signedSession);
    }
    else res.status(404).json({ error: 'Session not found' });
});

router.delete('/sessions/:id', (req, res) => {
    SessionManager.deleteSession(req.params.id);
    res.json({ success: true });
});

router.get('/tools', (req, res) => {
    const definitions = ToolManager.getToolDefinitions();
    const availableFiles = ToolManager.getAvailableToolFiles();
    res.json({ definitions, availableFiles });
});

router.post('/models', async (req, res) => {
    try {
        const { endpoint, apiKey } = req.body;
        const currentConfig = loadConfig();

        let providerConfig;

        if (endpoint) {
            providerConfig = {
                baseUrl: endpoint,
                modelId: '',
                apiKey: apiKey
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

        res.json({ data: models });
    } catch (error) {
        console.error('[Models] Fetch error:', error);
        res.status(500).json({ error: String(error) });
    }
});

router.get('/logs', (req, res) => {
    res.json(logger.getLogs());
});

router.post('/logs/clear', (req, res) => {
    logger.clear();
    res.json({ success: true });
});

router.get('/whatsapp/status', (req, res) => {
    res.json(WhatsAppManager.getInstance().getStatus());
});

router.post('/whatsapp/connect', async (req, res) => {
    await WhatsAppManager.getInstance().connect();
    res.json({ success: true });
});

router.post('/whatsapp/logout', async (req, res) => {
    await WhatsAppManager.getInstance().logout();
    res.json({ success: true });
});

export default router;
