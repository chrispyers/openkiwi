import { Router } from 'express';
import { TelegramManager } from '../telegram-manager.js';

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

export default router;
