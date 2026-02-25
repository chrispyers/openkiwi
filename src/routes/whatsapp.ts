import { Router } from 'express';
import { WhatsAppManager } from '../whatsapp-manager.js';

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

export default router;
