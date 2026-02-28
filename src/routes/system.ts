import { Router } from 'express';
import { logger } from '../logger.js';
import { loadConfig } from '../config-manager.js';
import { listModels } from '../llm-provider.js';
import { checkForUpdates } from '../services/update-service.js';

const router = Router();

router.get('/logs', (req, res) => {
    res.json(logger.getLogs());
});

router.post('/logs/clear', (req, res) => {
    logger.clear();
    res.json({ success: true });
});

router.post('/models', async (req, res) => {
    try {
        const { endpoint, apiKey } = req.body;
        const currentConfig = loadConfig();

        let providerConfig;

        if (endpoint) {
            providerConfig = {
                baseUrl: endpoint,
                modelId: '',
                apiKey: apiKey
            };
        } else {
            const defaultProvider = currentConfig.providers[0];
            if (!defaultProvider) {
                return res.json({ data: [] });
            }
            providerConfig = {
                baseUrl: defaultProvider.endpoint,
                modelId: defaultProvider.model,
                apiKey: defaultProvider.apiKey
            };
        }

        const models = await listModels(providerConfig);

        logger.log({
            type: 'system',
            level: 'info',
            message: `Discovered ${models.length} models from ${providerConfig.baseUrl}`,
            data: models
        });

        res.json({ data: models });
    } catch (error) {
        console.error('[Models] Fetch error:', error);
        res.status(500).json({ error: String(error) });
    }
});

router.post('/update', async (req, res) => {
    try {
        await checkForUpdates();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

export default router;
