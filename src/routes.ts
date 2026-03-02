import { Router } from 'express';
import { authMiddleware } from './security.js';
import agentsRouter from './routes/agents.js';
import sessionsRouter from './routes/sessions.js';
import whatsappRouter from './routes/whatsapp.js';
import configRouter from './routes/config.js';
import toolsRouter from './routes/tools.js';
import systemRouter from './routes/system.js';
import filesRouter from './routes/files.js';

const router = Router();

// Public routes or routes with internal auth
router.use('/files', filesRouter);

// Protected routes
router.use((req, res, next) => {
    // Already handled exceptions in filesRouter if needed, but here we protect everything else
    return authMiddleware(req, res, next);
});

router.use('/agents', agentsRouter);
router.use('/sessions', sessionsRouter);
router.use('/whatsapp', whatsappRouter);
router.use('/config', configRouter);
router.use('/tools', toolsRouter);
router.use('/system', systemRouter);

// Telegram routes
router.get('/telegram/status', (req, res) => {
    res.json(TelegramManager.getInstance().getStatus());
});

router.post('/telegram/connect', async (req, res) => {
    await TelegramManager.getInstance().connect();
    res.json({ success: true });
});

router.post('/telegram/disconnect', async (req, res) => {
    await TelegramManager.getInstance().disconnect();
    res.json({ success: true });
});

export default router;
export { connectedClients } from './state.js';
export { ConnectedClient } from './state.js';
