import { Router } from 'express';
import { WhatsAppManager } from '../whatsapp-manager.js';
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

export default router;
