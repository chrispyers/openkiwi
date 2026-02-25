import { Router } from 'express';
import { loadConfig, saveConfig, Config } from '../config-manager.js';
import { AgentManager } from '../agent-manager.js';
import { ToolManager } from '../tool-manager.js';
import { connectedClients } from '../state.js';

const router = Router();

router.get('/public', (req, res) => {
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

router.get('/', (req, res) => {
    res.json(loadConfig());
});

router.post('/', async (req, res) => {
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

// Clients endpoint moved here as it relates to system state/config
router.get('/clients', (req, res) => {
    res.json(Array.from(connectedClients.values()));
});

export default router;
