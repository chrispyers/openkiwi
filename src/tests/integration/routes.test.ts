import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import routes from '../../routes';
import * as configManager from '../../config-manager';

vi.mock('../../config-manager', () => ({
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
}));

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
        // Even if the route itself is not fully mocked, it should pass auth middleware 
        // and return something (prob 404 if route not actually exported completely or 200). 
        // We just want to check it doesn't return 401.
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

        // As long as it bypasses the 401
        expect(res.status).not.toBe(401);
    });

    it('should block POST /api/config without auth', async () => {
        const res = await request(app)
            .post('/api/config')
            .send({});
        expect(res.status).toBe(401);
    });
});
