import crypto from 'node:crypto';
import path from 'node:path';
import { loadConfig } from './config-manager.js';

export const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'screenshots');
export const WORKSPACE_DIR = path.resolve(process.cwd(), 'workspace');

/**
 * Generates an HMAC-SHA256 signature for a file path and expiration time.
 */
export function generateFileSignature(pathSuffix: string, expires: number): string {
    const currentConfig = loadConfig();
    return crypto.createHmac('sha256', currentConfig.gateway.secretToken)
        .update(`${pathSuffix}:${expires}`)
        .digest('hex');
}

/**
 * Verifies a file signature.
 */
export function verifyFileSignature(pathSuffix: string, expires: number, signature: string): boolean {
    if (Date.now() > expires) return false;
    const expected = generateFileSignature(pathSuffix, expires);
    return signature === expected;
}

/**
 * Signs a raw screenshot or workspace file URL for secure serving.
 */
export function signUrl(url: string): string {
    if (!url) return url;
    const match = url.match(/^\/?(screenshots|workspace-files)\/([^?#\s]+)/);
    if (!match) return url;

    const type = match[1];
    const filePath = match[2];
    const pathSuffix = `${type}/${filePath}`;
    const expires = Date.now() + 3600000; // 1 hour
    const sig = generateFileSignature(pathSuffix, expires);

    return `/api/files/${type}/${filePath}?sig=${sig}&expires=${expires}`;
}

/**
 * Scans markdown content and replaces any insecure file links with signed links.
 */
export function signMarkdown(content: string): string {
    if (!content || typeof content !== 'string') return content;

    // Regex matches /screenshots/... or /workspace-files/..., and checks if it's preceded by /api/files
    return content.replace(/(\/api\/files)?(\/screenshots\/|\/workspace-files\/)([^ \n\)]+)/g, (match, prefix, type, fileAndQuery) => {
        if (prefix || match.includes('?sig=')) return match;
        // Reconstruct the base url to sign
        return signUrl(`${type}${fileAndQuery}`);
    });
}

/**
 * Express middleware for basic and query-based token authentication.
 */
export const authMiddleware = (req: any, res: any, next: any) => {
    // Allow public config check (redacted) - handle both full path and relative path (if mounted on /api)
    if ((req.path === '/api/config/public' || req.path === '/config/public') && req.method === 'GET') {
        return next();
    }

    // Support both Authorization header and query-based token (for static assets)
    const token = req.headers['authorization']?.replace('Bearer ', '') || (req.query.token as string);
    const currentConfig = loadConfig();

    const providedBuf = Buffer.from(token || '');
    const expectedBuf = Buffer.from(currentConfig.gateway.secretToken || '');

    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
        // Log unauthorized attempts but skip for browser favicon/common probes if noisy
        if (!req.path.includes('favicon.ico')) {
            console.warn(`[Auth] Blocked request to ${req.path} from ${req.ip}. Token provided: ${token ? 'YES' : 'NO'}`);
        }
        return res.status(401).json({ error: 'Unauthorized: Invalid Secret Token' });
    }
    next();
};
