import { Router } from 'express';
import { TelegramManager } from '../telegram-manager.js';
import { AgentManager } from '../agent-manager.js';
import { loadConfig, saveConfig } from '../config-manager.js';

const router = Router();

router.get('/status', (req, res) => {
    res.json(TelegramManager.getInstance().getStatus());
});

router.post('/connect', async (req, res) => {
    await TelegramManager.getInstance().connect();
    res.json({ success: true });
});

router.post('/disconnect', async (req, res) => {
    await TelegramManager.getInstance().disconnect();
    res.json({ success: true });
});

// ── Chat discovery ──────────────────────────────────────────────────────────

router.get('/chats', (req, res) => {
    res.json({ chats: TelegramManager.getInstance().getKnownChats() });
});

// ── Channel bindings (chatId → agentId) ─────────────────────────────────────

router.get('/bindings', (req, res) => {
    const config = loadConfig();
    const bindings = config.channelBindings?.telegram || {};
    const knownChats = TelegramManager.getInstance().getKnownChats();

    // Enrich bindings with chat titles where known
    const enriched = Object.entries(bindings).map(([chatId, agentId]) => {
        const chat = knownChats.find(c => c.chatId === chatId);
        return { chatId, agentId, title: chat?.title || null, type: chat?.type || null };
    });

    res.json({ bindings: enriched });
});

router.put('/bindings/:chatId', (req, res) => {
    const { chatId } = req.params;
    const { agentId } = req.body || {};

    if (!agentId || typeof agentId !== 'string') {
        return res.status(400).json({ error: 'agentId is required' });
    }
    if (!AgentManager.getAgent(agentId)) {
        return res.status(404).json({ error: `Agent "${agentId}" not found` });
    }

    const config = loadConfig();
    if (!config.channelBindings) config.channelBindings = { telegram: {}, whatsapp: {} };
    if (!config.channelBindings.telegram) config.channelBindings.telegram = {};
    config.channelBindings.telegram[chatId] = agentId;
    saveConfig(config);

    res.json({ success: true, chatId, agentId });
});

router.delete('/bindings/:chatId', (req, res) => {
    const { chatId } = req.params;
    const config = loadConfig();

    if (config.channelBindings?.telegram?.[chatId]) {
        delete config.channelBindings.telegram[chatId];
        saveConfig(config);
    }

    res.json({ success: true, chatId });
});

export default router;
