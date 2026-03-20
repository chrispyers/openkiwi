import { Router } from 'express';
import { loadConfig, saveConfig, Config, encrypt } from '../config-manager.js';
import { AgentManager } from '../agent-manager.js';
import { ToolManager } from '../tool-manager.js';
import { connectedClients } from '../state.js';

const router = Router();

router.get('/public', (req, res) => {
    const config = loadConfig();
    if (config.gateway?.secretToken) {
        config.gateway.secretToken = encrypt(config.gateway.secretToken);
    }
    res.json(config);
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

// Verify a git connection PAT against the provider's API
router.post('/verify-git-connection', async (req, res) => {
    const { baseUrl, pat } = req.body ?? {};
    if (!baseUrl || !pat) {
        return res.status(400).json({ error: 'baseUrl and pat are required' });
    }

    const base = (baseUrl as string).replace(/\/$/, '');
    const isGitHub = base === 'https://github.com';

    try {
        if (isGitHub) {
            const r = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `Bearer ${pat}`, 'User-Agent': 'OpenKiwi/1.0' }
            });
            const body = await r.text();
            console.log(`[verify-git-connection] GitHub /user → HTTP ${r.status}: ${body.slice(0, 500)}`);
            if (r.ok) {
                const data = JSON.parse(body);
                return res.json({ valid: true, username: data.login, name: data.name });
            }
            const detail = (() => { try { return JSON.parse(body).message ?? body; } catch { return body; } })();
            return res.json({ valid: false, error: `GitHub responded HTTP ${r.status}: ${detail}` });
        } else {
            // GitLab-compatible: self-hosted or gitlab.com.
            // Use /personal_access_tokens/self which works with any valid PAT regardless of scope.
            // Fall back to /user for older GitLab instances (< 15.0) that don't have that endpoint.
            const selfUrl = `${base}/api/v4/personal_access_tokens/self`;
            const userUrl = `${base}/api/v4/user`;

            const rSelf = await fetch(selfUrl, { headers: { 'PRIVATE-TOKEN': pat as string } });
            const selfBody = await rSelf.text();
            console.log(`[verify-git-connection] GitLab ${selfUrl} → HTTP ${rSelf.status}: ${selfBody.slice(0, 500)}`);

            if (rSelf.ok) {
                const tokenData = JSON.parse(selfBody);
                // Try to also fetch the username — requires read_user scope, so tolerate failure
                let username = tokenData.name; // fall back to token name
                try {
                    const rUser = await fetch(userUrl, { headers: { 'PRIVATE-TOKEN': pat as string } });
                    if (rUser.ok) {
                        const userData = await rUser.json() as any;
                        username = userData.username;
                    }
                } catch { /* read_user scope not granted — username stays as token name */ }
                return res.json({ valid: true, username, name: username, scopes: tokenData.scopes });
            }

            if (rSelf.status === 404) {
                // GitLab < 15.0 — fall back to /user endpoint
                console.log(`[verify-git-connection] /personal_access_tokens/self not found, falling back to /user`);
                const rUser = await fetch(userUrl, { headers: { 'PRIVATE-TOKEN': pat as string } });
                const userBody = await rUser.text();
                console.log(`[verify-git-connection] GitLab ${userUrl} → HTTP ${rUser.status}: ${userBody.slice(0, 500)}`);
                if (rUser.ok) {
                    const data = JSON.parse(userBody);
                    return res.json({ valid: true, username: data.username, name: data.name });
                }
                const detail = (() => { try { return JSON.parse(userBody).message ?? userBody; } catch { return userBody; } })();
                return res.json({ valid: false, error: `GitLab responded HTTP ${rUser.status}: ${detail}` });
            }

            const detail = (() => { try { return JSON.parse(selfBody).message ?? selfBody; } catch { return selfBody; } })();
            return res.json({ valid: false, error: `GitLab responded HTTP ${rSelf.status}: ${detail}` });
        }
    } catch (e: any) {
        console.error(`[verify-git-connection] Network error reaching ${base}:`, e);
        return res.json({ valid: false, error: `Could not reach ${base}: ${e.message}` });
    }
});

export default router;
