import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock all sub-routers and dependencies before importing routes
vi.mock('../../routes/agents.js', () => ({ default: express.Router() }));
vi.mock('../../routes/sessions.js', () => ({ default: express.Router() }));
vi.mock('../../routes/whatsapp.js', () => ({ default: express.Router() }));
vi.mock('../../routes/config.js', () => {
    const router = express.Router();
    router.get('/public', (_req, res) => res.json({ public: true }));
    router.get('/', (_req, res) => res.json({ config: true }));
    router.post('/', (_req, res) => res.json({ saved: true }));
    return { default: router };
});
vi.mock('../../routes/tools.js', () => ({ default: express.Router() }));
vi.mock('../../routes/system.js', () => ({ default: express.Router() }));
vi.mock('../../routes/files.js', () => ({ default: express.Router() }));
vi.mock('../../telegram-manager.js', () => ({
    TelegramManager: {
        getInstance: () => ({
            getStatus: () => ({ connected: false }),
            connect: vi.fn(),
            disconnect: vi.fn(),
        }),
    },
}));

import * as configManager from '../../config-manager.js';

vi.mock('../../config-manager.js', () => ({
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
}));

import routes from '../../routes.js';

// Create a basic express app to test the router
const app = express();
app.use(express.json());
app.use('/api', routes);

describe('API Endpoints Output & Auth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (configManager.loadConfig as any).mockReturnValue({
            gateway: { secretToken: 'valid-token' },
            system: { version: 'test-version' }
        });

        // Suppress expected auth warnings during expected failures
        vi.spyOn(console, 'warn').mockImplementation(() => { });
    });

    it('should allow GET /api/config/public without auth', async () => {
        const res = await request(app).get('/api/config/public');
        expect(res.status).not.toBe(401);
    });

    it('should block GET /api/config without auth', async () => {
        const res = await request(app).get('/api/config');
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized: Invalid Secret Token');
    });

    it('should allow GET /api/config with valid auth header', async () => {
        const res = await request(app)
            .get('/api/config')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).not.toBe(401);
    });

    it('should block POST /api/config without auth', async () => {
        const res = await request(app)
            .post('/api/config')
            .send({});
        expect(res.status).toBe(401);
    });
});
