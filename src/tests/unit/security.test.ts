import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authMiddleware, generateFileSignature, verifyFileSignature, signUrl, signMarkdown } from '../../security';
import * as configManager from '../../config-manager';

// Mock config manager
vi.mock('../../config-manager', () => ({
    loadConfig: vi.fn(),
}));

describe('Security Utilities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (configManager.loadConfig as any).mockReturnValue({
            gateway: { secretToken: 'test-secret-token' },
        });
    });

    describe('generateFileSignature & verifyFileSignature', () => {
        it('should verify a valid signature', () => {
            const expires = Date.now() + 10000;
            const sig = generateFileSignature('test/path', expires);
            expect(verifyFileSignature('test/path', expires, sig)).toBe(true);
        });

        it('should reject an invalid signature', () => {
            const expires = Date.now() + 10000;
            const sig = generateFileSignature('test/path', expires);
            expect(verifyFileSignature('wrong/path', expires, sig)).toBe(false);
            expect(verifyFileSignature('test/path', expires, 'wrong-sig')).toBe(false);
        });

        it('should reject an expired signature', () => {
            const expires = Date.now() - 10000; // Expired
            const sig = generateFileSignature('test/path', expires);
            expect(verifyFileSignature('test/path', expires, sig)).toBe(false);
        });
    });

    describe('signUrl', () => {
        it('should sign screenshot URLs', () => {
            const url = '/screenshots/test.png';
            const signed = signUrl(url);
            expect(signed).toContain('/api/files/screenshots/test.png?sig=');
            expect(signed).toContain('&expires=');
        });

        it('should bypass non-file URLs', () => {
            const url = 'https://example.com/image.png';
            const result = signUrl(url);
            expect(result).toBe(url);
        });
    });

    describe('signMarkdown', () => {
        it('should replace insecure links with signed links', () => {
            const content = 'Here is an image: /screenshots/test.png and another /workspace-files/doc.txt';
            const signed = signMarkdown(content);
            expect(signed).not.toContain(' /screenshots/test.png');
            expect(signed).toContain('/api/files/screenshots/test.png?sig=');
            expect(signed).toContain('/api/files/workspace-files/doc.txt?sig=');
        });

        it('should not replace already signed links', () => {
            const content = 'Already signed: /api/files/screenshots/test.png?sig=abc&expires=123';
            const signed = signMarkdown(content);
            expect(signed).toBe(content);
        });
    });
});

describe('authMiddleware', () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
        vi.clearAllMocks();
        (configManager.loadConfig as any).mockReturnValue({
            gateway: { secretToken: 'valid-token' },
        });

        // Suppress expected auth warnings in tests
        vi.spyOn(console, 'warn').mockImplementation(() => { });

        req = {
            path: '/api/protected',
            method: 'GET',
            headers: {},
            query: {},
            ip: '127.0.0.1'
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        next = vi.fn();
    });

    it('should allow public config endpoint', () => {
        req.path = '/api/config/public';
        authMiddleware(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should block requests without a token', () => {
        authMiddleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid Secret Token' });
        expect(next).not.toHaveBeenCalled();
    });

    it('should block requests with an invalid token via header', () => {
        req.headers['authorization'] = 'Bearer invalid-token';
        authMiddleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('should allow requests with a valid token via header', () => {
        req.headers['authorization'] = 'Bearer valid-token';
        authMiddleware(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow requests with a valid token via query', () => {
        req.query.token = 'valid-token';
        authMiddleware(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });
});
