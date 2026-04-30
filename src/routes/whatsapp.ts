import { Router } from 'express';
import { WhatsAppManager } from '../whatsapp-manager.js';
import { AgentManager } from '../agent-manager.js';
import { loadConfig, saveConfig } from '../config-manager.js';
import {
    getIngestConfig,
    updateIngestConfig,
    listChats,
    backfillChat,
} from '../whatsapp-ingest.js';

const router = Router();

router.get('/status', (req, res) => {
    res.json(WhatsAppManager.getInstance().getStatus());
});

router.post('/connect', async (req, res) => {
    await WhatsAppManager.getInstance().connect();
    res.json({ success: true });
});

router.post('/logout', async (req, res) => {
    await WhatsAppManager.getInstance().logout();
    res.json({ success: true });
});

// ── Ingest management ────────────────────────────────────────────────────────

router.get('/ingest/config', (req, res) => {
    res.json(getIngestConfig());
});

router.post('/ingest/config', (req, res) => {
    const { enabled, store, excludedChats, agentRepliesEnabled } = req.body || {};
    const patch: any = {};
    if (typeof enabled === 'boolean') patch.enabled = enabled;
    if (typeof store === 'string' && store.trim()) patch.store = store.trim();
    if (Array.isArray(excludedChats)) patch.excludedChats = excludedChats.filter((s: any) => typeof s === 'string');
    if (typeof agentRepliesEnabled === 'boolean') patch.agentRepliesEnabled = agentRepliesEnabled;
    res.json(updateIngestConfig(patch));
});

router.get('/chats', (req, res) => {
    res.json({ chats: listChats() });
});

router.post('/ingest/backfill', async (req, res) => {
    const { jid, count } = req.body || {};
    if (!jid || typeof jid !== 'string') {
        return res.status(400).json({ error: 'jid is required' });
    }
    const result = await backfillChat(jid, typeof count === 'number' ? count : 50);
    if ('error' in result) return res.status(500).json(result);
    res.json(result);
});

// ── Channel bindings (jid → agentId) ────────────────────────────────────────

router.get('/bindings', (req, res) => {
    const config = loadConfig();
    const bindings = config.channelBindings?.whatsapp || {};
    const knownChats = listChats();

    const enriched = Object.entries(bindings).map(([jid, agentId]) => {
        const chat = knownChats.find((c: any) => c.jid === jid);
        return { jid, agentId, title: chat?.name || null };
    });

    res.json({ bindings: enriched });
});

router.put('/bindings/:jid', (req, res) => {
    const { jid } = req.params;
    const { agentId } = req.body || {};

    if (!agentId || typeof agentId !== 'string') {
        return res.status(400).json({ error: 'agentId is required' });
    }
    if (!AgentManager.getAgent(agentId)) {
        return res.status(404).json({ error: `Agent "${agentId}" not found` });
    }

    const config = loadConfig();
    if (!config.channelBindings) config.channelBindings = { telegram: {}, whatsapp: {} };
    if (!config.channelBindings.whatsapp) config.channelBindings.whatsapp = {};
    config.channelBindings.whatsapp[jid] = agentId;
    saveConfig(config);

    res.json({ success: true, jid, agentId });
});

router.delete('/bindings/:jid', (req, res) => {
    const { jid } = req.params;
    const config = loadConfig();

    if (config.channelBindings?.whatsapp?.[jid]) {
        delete config.channelBindings.whatsapp[jid];
        saveConfig(config);
    }

    res.json({ success: true, jid });
});

export default router;
