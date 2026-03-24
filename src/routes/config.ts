import { Router } from 'express';
import { loadConfig, saveConfig, Config, encrypt } from '../config-manager.js';
import { AgentManager } from '../agent-manager.js';
import { ToolManager } from '../tool-manager.js';
import { connectedClients } from '../state.js';

const router = Router();

router.get('/public', (req, res) => {
    const config = loadConfig();
    const safe = JSON.parse(JSON.stringify(config));
    if (safe.gateway?.secretToken) {
        safe.gateway.secretToken = encrypt(safe.gateway.secretToken);
    }
    if (safe.connections?.git) {
        safe.connections.git.forEach((conn: any) => { if (conn.pat) conn.pat = encrypt(conn.pat); });
    }
    if (safe.connections?.anthropic) {
        safe.connections.anthropic.forEach((conn: any) => { if (conn.apiKey) conn.apiKey = encrypt(conn.apiKey); });
    }
    if (safe.connections?.google) {
        safe.connections.google.forEach((conn: any) => { if (conn.apiKey) conn.apiKey = encrypt(conn.apiKey); });
    }
    if (safe.connections?.openai) {
        safe.connections.openai.forEach((conn: any) => { if (conn.apiKey) conn.apiKey = encrypt(conn.apiKey); });
    }
    if (safe.connections?.openrouter) {
        safe.connections.openrouter.forEach((conn: any) => { if (conn.apiKey) conn.apiKey = encrypt(conn.apiKey); });
    }
    res.json(safe);
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
        res.json({ success: true });

        // Re-initialize in the background after responding — don't block or fail the save
        AgentManager.clearMemoryManagers();
        AgentManager.initializeAllMemoryManagers().catch(e => console.error('[Config] Failed to re-init memory managers:', e));
        ToolManager.discoverTools().catch(e => console.error('[Config] Failed to re-discover tools:', e));
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

// Verify an Anthropic API key
router.post('/verify-anthropic-connection', async (req, res) => {
    const { apiKey } = req.body ?? {};
    if (!apiKey) {
        return res.status(400).json({ error: 'apiKey is required' });
    }

    try {
        const r = await fetch('https://api.anthropic.com/v1/models', {
            headers: {
                'x-api-key': apiKey as string,
                'anthropic-version': '2023-06-01',
            }
        });
        const body = await r.text();
        if (r.ok) {
            return res.json({ valid: true });
        }
        const detail = (() => { try { return JSON.parse(body).error?.message ?? body; } catch { return body; } })();
        return res.json({ valid: false, error: `Anthropic responded HTTP ${r.status}: ${detail}` });
    } catch (e: any) {
        return res.json({ valid: false, error: `Could not reach Anthropic: ${e.message}` });
    }
});

// Verify an OpenRouter API key
router.post('/verify-openrouter-connection', async (req, res) => {
    const { apiKey } = req.body ?? {};
    if (!apiKey) {
        return res.status(400).json({ error: 'apiKey is required' });
    }

    try {
        const r = await fetch('https://openrouter.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey as string}` }
        });
        const body = await r.text();
        if (r.ok) {
            return res.json({ valid: true });
        }
        const detail = (() => { try { return JSON.parse(body).error?.message ?? body; } catch { return body; } })();
        return res.json({ valid: false, error: `OpenRouter responded HTTP ${r.status}: ${detail}` });
    } catch (e: any) {
        return res.json({ valid: false, error: `Could not reach OpenRouter: ${e.message}` });
    }
});

// Verify an OpenAI API key
router.post('/verify-openai-connection', async (req, res) => {
    const { apiKey } = req.body ?? {};
    if (!apiKey) {
        return res.status(400).json({ error: 'apiKey is required' });
    }

    try {
        const r = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey as string}` }
        });
        const body = await r.text();
        if (r.ok) {
            return res.json({ valid: true });
        }
        const detail = (() => { try { return JSON.parse(body).error?.message ?? body; } catch { return body; } })();
        return res.json({ valid: false, error: `OpenAI responded HTTP ${r.status}: ${detail}` });
    } catch (e: any) {
        return res.json({ valid: false, error: `Could not reach OpenAI: ${e.message}` });
    }
});

// Verify a Google Gemini API key
router.post('/verify-google-connection', async (req, res) => {
    const { apiKey } = req.body ?? {};
    if (!apiKey) {
        return res.status(400).json({ error: 'apiKey is required' });
    }

    try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey as string)}`);
        const body = await r.text();
        if (r.ok) {
            return res.json({ valid: true });
        }
        const detail = (() => { try { return JSON.parse(body).error?.message ?? body; } catch { return body; } })();
        return res.json({ valid: false, error: `Google responded HTTP ${r.status}: ${detail}` });
    } catch (e: any) {
        return res.json({ valid: false, error: `Could not reach Google: ${e.message}` });
    }
});

export default router;
