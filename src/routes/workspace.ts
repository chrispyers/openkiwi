import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { WORKSPACE_DIR } from '../security.js';

const router = Router();

// List directory contents
router.get('/ls', (req, res) => {
    const relativePath = (req.query.path as string) || '';
    const targetDir = path.resolve(WORKSPACE_DIR, relativePath);

    if (targetDir !== WORKSPACE_DIR && !targetDir.startsWith(WORKSPACE_DIR + path.sep)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    if (!fs.existsSync(targetDir)) {
        return res.status(404).json({ error: 'Directory not found' });
    }
    if (!fs.statSync(targetDir).isDirectory()) {
        return res.status(400).json({ error: 'Not a directory' });
    }

    try {
        const entries = fs.readdirSync(targetDir, { withFileTypes: true });
        return res.json({
            entries: entries
                .filter(e => !e.name.startsWith('.'))
                .map(e => ({
                    name: e.name,
                    type: e.isDirectory() ? 'directory' : 'file',
                    path: relativePath ? `${relativePath}/${e.name}` : e.name,
                }))
                .sort((a, b) => {
                    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                    return a.name.localeCompare(b.name);
                })
        });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// Read file content
router.get('/file', (req, res) => {
    const relativePath = req.query.path as string;
    if (!relativePath) return res.status(400).json({ error: 'Path required' });

    const fullPath = path.resolve(WORKSPACE_DIR, relativePath);
    if (fullPath !== WORKSPACE_DIR && !fullPath.startsWith(WORKSPACE_DIR + path.sep)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    if (!fs.statSync(fullPath).isFile()) {
        return res.status(400).json({ error: 'Not a file' });
    }

    try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        return res.json({ content, path: relativePath });
    } catch (e: any) {
        // Likely a binary file
        return res.status(415).json({ error: 'Cannot read file: may be binary or too large' });
    }
});

export default router;
