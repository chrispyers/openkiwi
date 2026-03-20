import { Router, Request, Response } from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { SkillManager } from '../skill-manager.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const SKILLS_DIR = path.resolve(process.cwd(), 'skills');

router.get('/', (req: Request, res: Response) => {
    const skills = SkillManager.getSkillDefinitions().map(s => ({
        name: s.name,
        description: s.description,
    }));
    res.json({ skills });
});

router.get('/:name', (req: Request, res: Response) => {
    const skillName = req.params.name as string;
    const skillMdPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
        return res.status(404).json({ error: 'Skill not found.' });
    }
    const content = fs.readFileSync(skillMdPath, 'utf-8');
    res.json({ content });
});

router.post('/install', upload.single('skill'), async (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    let zip: AdmZip;
    try {
        zip = new AdmZip(req.file.buffer);
    } catch {
        return res.status(400).json({ error: 'Invalid zip archive.' });
    }

    // Find SKILL.md — accept at root or inside a single top-level folder
    const entries = zip.getEntries();
    let skillMdEntry = entries.find(e => e.entryName === 'SKILL.md');
    let prefix = '';
    if (!skillMdEntry) {
        skillMdEntry = entries.find(e => /^[^/]+\/SKILL\.md$/.test(e.entryName));
        if (skillMdEntry) {
            prefix = skillMdEntry.entryName.replace('SKILL.md', '');
        }
    }
    if (!skillMdEntry) {
        return res.status(400).json({ error: 'Archive does not contain a SKILL.md file.' });
    }

    const skillMdContent = skillMdEntry.getData().toString('utf-8');
    const metadata = parseFrontmatter(skillMdContent);
    if (!metadata) {
        return res.status(400).json({ error: 'SKILL.md is missing valid frontmatter.' });
    }
    if (!metadata.name) {
        return res.status(400).json({ error: 'SKILL.md frontmatter is missing a name field.' });
    }

    const skillName = metadata.name;
    const destDir = path.join(SKILLS_DIR, skillName);

    // Guard against path traversal in zip entries
    for (const entry of entries) {
        const entryName = entry.entryName.startsWith(prefix) ? entry.entryName.slice(prefix.length) : entry.entryName;
        const resolved = path.resolve(destDir, entryName);
        if (!resolved.startsWith(destDir + path.sep) && resolved !== destDir) {
            return res.status(400).json({ error: 'Archive contains unsafe file paths.' });
        }
    }

    // Extract to skills/{name}
    fs.mkdirSync(destDir, { recursive: true });
    for (const entry of entries) {
        if (entry.isDirectory) continue;
        const relPath = entry.entryName.startsWith(prefix) ? entry.entryName.slice(prefix.length) : entry.entryName;
        if (!relPath) continue;
        const destPath = path.join(destDir, relPath);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.writeFileSync(destPath, entry.getData());
    }

    await SkillManager.discoverSkills();
    res.json({ success: true, skill: { name: skillName, description: metadata.description } });
});

function parseFrontmatter(content: string): Record<string, any> | null {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return null;
    try {
        return parseYaml(match[1]) as Record<string, any>;
    } catch {
        return null;
    }
}

export default router;
