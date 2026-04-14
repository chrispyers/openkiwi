import { Router } from 'express';
import { authMiddleware } from './security.js';
import agentsRouter from './routes/agents.js';
import authRouter, { googleCallbackHandler } from './routes/auth.js';
import sessionsRouter from './routes/sessions.js';
import whatsappRouter from './routes/whatsapp.js';
import configRouter from './routes/config.js';
import toolsRouter from './routes/tools.js';
import skillsRouter from './routes/skills.js';
import systemRouter from './routes/system.js';
import filesRouter from './routes/files.js';
import collaborationRouter from './routes/collaboration.js';
import projectsRouter from './routes/projects.js';
import workspaceRouter from './routes/workspace.js'; // serves /files
import { TelegramManager } from './telegram-manager.js';
import mcpRouter from './routes/mcp.js';

const router = Router();

// Public routes or routes with internal auth
router.use('/files', filesRouter);

// Google OAuth callback must be public — Google redirects here without a token
router.get('/auth/google/callback', googleCallbackHandler);

// Protected routes
router.use((req, res, next) => {
    // Already handled exceptions in filesRouter if needed, but here we protect everything else
    return authMiddleware(req, res, next);
});

router.use('/auth/google', authRouter);
router.use('/agents', agentsRouter);
router.use('/sessions', sessionsRouter);
router.use('/whatsapp', whatsappRouter);
router.use('/config', configRouter);
router.use('/tools', toolsRouter);
router.use('/skills', skillsRouter);
router.use('/system', systemRouter);
router.use('/collaboration', collaborationRouter);
router.use('/projects', projectsRouter);
router.use('/files', workspaceRouter);
router.use('/mcp', mcpRouter);

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
