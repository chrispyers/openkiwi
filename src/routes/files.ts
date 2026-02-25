import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { loadConfig } from '../config-manager.js';
import {
    verifyFileSignature,
    signUrl,
    SCREENSHOTS_DIR,
    WORKSPACE_DIR
} from '../security.js';

const router = Router();

// Dedicated proxy for serving protected static assets
router.get(/^\/(screenshots|workspace-files)\/(.*)/, (req, res) => {
    const fileType = req.params[0];
    const filePathSegment = req.params[1];
    const signature = req.query.sig as string;
    const expires = parseInt(req.query.expires as string);

    if (fileType !== 'screenshots' && fileType !== 'workspace-files') {
        return res.status(404).json({ error: 'Invalid file type' });
    }

    const baseDir = fileType === 'screenshots' ? SCREENSHOTS_DIR : WORKSPACE_DIR;
    const fullPath = path.resolve(baseDir, filePathSegment);

    if (fullPath !== baseDir && !fullPath.startsWith(baseDir + path.sep)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const headerToken = req.headers['authorization']?.replace('Bearer ', '') || (req.query.token as string);
    const currentConfig = loadConfig();

    let isAuthorized = (headerToken === currentConfig.gateway.secretToken);

    if (!isAuthorized && signature && !isNaN(expires)) {
        isAuthorized = verifyFileSignature(`${fileType}/${filePathSegment}`, expires, signature);
    }

    if (!isAuthorized) {
        if (!req.path.includes('favicon.ico')) {
            console.warn(`[Auth] Blocked request to ${req.path} from ${req.ip}. Signature or Token invalid.`);
        }
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    if (!fs.statSync(fullPath).isFile()) {
        return res.status(400).json({ error: 'Requested path is not a file' });
    }

    res.sendFile(fullPath);
});

router.get('/sign', (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: 'Path is required' });
    res.json({ url: signUrl(filePath) });
});

export default router;
