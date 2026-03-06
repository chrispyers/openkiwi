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
        const oldConfig = loadConfig();
        const newConfig = req.body as Config;

        // Detect provider description changes and update agents accordingly
        const oldProviders = oldConfig.providers || [];
        const newProviders = newConfig.providers || [];

        const descriptionUpdates = new Map<string, string>();

        if (oldProviders.length === newProviders.length) {
            // Check for renames at same indices (most common case from ModelsPage)
            for (let i = 0; i < oldProviders.length; i++) {
                if (oldProviders[i].description !== newProviders[i].description) {
                    descriptionUpdates.set(oldProviders[i].description, newProviders[i].description);
                }
            }
        } else {
            // Check for deletions
            for (const oldP of oldProviders) {
                if (!newProviders.some(p => p.description === oldP.description)) {
                    // Provider is gone, reset agents to use Global Default
                    descriptionUpdates.set(oldP.description, "");
                }
            }
        }

        // Apply updates to agents
        if (descriptionUpdates.size > 0) {
            const agentIds = AgentManager.listAgents();
            for (const agentId of agentIds) {
                const agent = AgentManager.getAgent(agentId);
                if (agent && agent.provider && descriptionUpdates.has(agent.provider)) {
                    const nextProvider = descriptionUpdates.get(agent.provider);
                    AgentManager.saveAgentConfig(agentId, { provider: nextProvider });
                }
            }
        }

        saveConfig(newConfig);
        AgentManager.clearMemoryManagers();
        await AgentManager.initializeAllMemoryManagers(); // Re-initialize to apply new settings immediately
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
