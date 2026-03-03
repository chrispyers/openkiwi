import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { WORKSPACE_DIR } from '../security.js';

const router = Router();
const PROJECTS_DIR = path.join(WORKSPACE_DIR, 'projects');

// Initialize projects directory if it doesn't exist
if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}

// Ensure the project name is valid and safe
const isValidName = (name: string) => {
    return /^[a-zA-Z0-9_\- ]+$/.test(name);
};

// Get all projects
router.get('/', (req, res) => {
    try {
        const files = fs.readdirSync(PROJECTS_DIR);
        const projects = files.filter(file => fs.statSync(path.join(PROJECTS_DIR, file)).isDirectory());
        res.json(projects);
    } catch (error) {
        console.error('Error reading projects directory:', error);
        res.status(500).json({ error: 'Failed to read projects' });
    }
});

// Create a new project
router.post('/', (req, res) => {
    const { name } = req.body;

    if (!name || !isValidName(name)) {
        return res.status(400).json({ error: 'Invalid project name' });
    }

    const projectPath = path.join(PROJECTS_DIR, name);

    if (fs.existsSync(projectPath)) {
        return res.status(409).json({ error: 'Project already exists' });
    }

    try {
        fs.mkdirSync(projectPath, { recursive: true });
        const initialContent = `# ${name} Concept\n\n`;
        fs.writeFileSync(path.join(projectPath, '0-CONCEPT.md'), initialContent, 'utf-8');
        res.status(201).json({ name, message: 'Project created successfully' });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// Get project files
router.get('/:name', (req, res) => {
    const { name } = req.params;

    if (!isValidName(name)) {
        return res.status(400).json({ error: 'Invalid project name' });
    }

    const projectPath = path.join(PROJECTS_DIR, name);

    if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
    }

    try {
        const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.md'));
        res.json({ name, files });
    } catch (error) {
        console.error(`Error reading project ${name}:`, error);
        res.status(500).json({ error: 'Failed to read project files' });
    }
});

// Get file content
router.get('/:name/files/:filename', (req, res) => {
    const { name, filename } = req.params;

    if (!isValidName(name) || !isValidName(filename.replace('.md', ''))) {
        return res.status(400).json({ error: 'Invalid name' });
    }

    const filePath = path.join(PROJECTS_DIR, name, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.json({ content });
    } catch (error) {
        console.error(`Error reading file ${filename}:`, error);
        res.status(500).json({ error: 'Failed to read file' });
    }
});

// Update file content
router.put('/:name/files/:filename', (req, res) => {
    const { name, filename } = req.params;
    const { content } = req.body;

    if (!isValidName(name) || !isValidName(filename.replace('.md', ''))) {
        return res.status(400).json({ error: 'Invalid name' });
    }

    if (typeof content !== 'string') {
        return res.status(400).json({ error: 'Content is required and must be a string' });
    }

    const filePath = path.join(PROJECTS_DIR, name, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    try {
        fs.writeFileSync(filePath, content, 'utf-8');
        res.json({ message: 'File updated successfully' });
    } catch (error) {
        console.error(`Error updating file ${filename}:`, error);
        res.status(500).json({ error: 'Failed to update file' });
    }
});

export default router;
