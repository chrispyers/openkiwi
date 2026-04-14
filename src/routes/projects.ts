import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { WORKSPACE_DIR } from '../security.js';
import { ProjectOrchestrator } from '../services/project-orchestrator.js';

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

const DEFAULT_ROLES = ['Initiator', 'Worker', 'Evaluator'];

interface ProjectAgent {
    agentId: string;
    role: string;
}

interface ProjectConfig {
    agents: ProjectAgent[];
    roles: string[];
    status: string;
    maxRevisionsPerSprint: number;
    currentRunId: string | null;
}

function getDefaultConfig(): ProjectConfig {
    return {
        agents: [],
        roles: [...DEFAULT_ROLES],
        status: 'idle',
        maxRevisionsPerSprint: 3,
        currentRunId: null,
    };
}

function readProjectConfig(projectPath: string): ProjectConfig {
    const configPath = path.join(projectPath, 'project.json');
    if (fs.existsSync(configPath)) {
        try {
            return { ...getDefaultConfig(), ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) };
        } catch {
            return getDefaultConfig();
        }
    }
    return getDefaultConfig();
}

function writeProjectConfig(projectPath: string, config: ProjectConfig): void {
    fs.writeFileSync(path.join(projectPath, 'project.json'), JSON.stringify(config, null, 2), 'utf-8');
}

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
        writeProjectConfig(projectPath, getDefaultConfig());
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
        const config = readProjectConfig(projectPath);
        res.json({ name, files, config });
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

// Get project config
router.get('/:name/config', (req, res) => {
    const { name } = req.params;
    if (!isValidName(name)) return res.status(400).json({ error: 'Invalid project name' });

    const projectPath = path.join(PROJECTS_DIR, name);
    if (!fs.existsSync(projectPath)) return res.status(404).json({ error: 'Project not found' });

    res.json(readProjectConfig(projectPath));
});

// Update project config
router.put('/:name/config', (req, res) => {
    const { name } = req.params;
    if (!isValidName(name)) return res.status(400).json({ error: 'Invalid project name' });

    const projectPath = path.join(PROJECTS_DIR, name);
    if (!fs.existsSync(projectPath)) return res.status(404).json({ error: 'Project not found' });

    try {
        const existing = readProjectConfig(projectPath);
        const updated = { ...existing, ...req.body };
        writeProjectConfig(projectPath, updated);
        res.json(updated);
    } catch (error) {
        console.error(`Error updating config for project ${name}:`, error);
        res.status(500).json({ error: 'Failed to update config' });
    }
});

// Get project agents
router.get('/:name/agents', (req, res) => {
    const { name } = req.params;
    if (!isValidName(name)) return res.status(400).json({ error: 'Invalid project name' });

    const projectPath = path.join(PROJECTS_DIR, name);
    if (!fs.existsSync(projectPath)) return res.status(404).json({ error: 'Project not found' });

    const config = readProjectConfig(projectPath);
    res.json(config.agents);
});

// Update project agents
router.put('/:name/agents', (req, res) => {
    const { name } = req.params;
    const { agents } = req.body;

    if (!isValidName(name)) return res.status(400).json({ error: 'Invalid project name' });
    if (!Array.isArray(agents)) return res.status(400).json({ error: 'agents must be an array' });

    const projectPath = path.join(PROJECTS_DIR, name);
    if (!fs.existsSync(projectPath)) return res.status(404).json({ error: 'Project not found' });

    try {
        const config = readProjectConfig(projectPath);
        config.agents = agents;
        writeProjectConfig(projectPath, config);
        res.json(config);
    } catch (error) {
        console.error(`Error updating agents for project ${name}:`, error);
        res.status(500).json({ error: 'Failed to update agents' });
    }
});

// Update project roles
router.put('/:name/roles', (req, res) => {
    const { name } = req.params;
    const { roles } = req.body;

    if (!isValidName(name)) return res.status(400).json({ error: 'Invalid project name' });
    if (!Array.isArray(roles) || roles.some(r => typeof r !== 'string')) {
        return res.status(400).json({ error: 'roles must be an array of strings' });
    }

    const projectPath = path.join(PROJECTS_DIR, name);
    if (!fs.existsSync(projectPath)) return res.status(404).json({ error: 'Project not found' });

    try {
        const config = readProjectConfig(projectPath);
        config.roles = roles;
        writeProjectConfig(projectPath, config);
        res.json(config);
    } catch (error) {
        console.error(`Error updating roles for project ${name}:`, error);
        res.status(500).json({ error: 'Failed to update roles' });
    }
});

// Start a project orchestration run
router.post('/:name/run', async (req, res) => {
    const { name } = req.params;
    if (!isValidName(name)) return res.status(400).json({ error: 'Invalid project name' });

    const projectPath = path.join(PROJECTS_DIR, name);
    if (!fs.existsSync(projectPath)) return res.status(404).json({ error: 'Project not found' });

    try {
        const result = await ProjectOrchestrator.startRun(name);
        res.json(result);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Get run status
router.get('/:name/run/status', (req, res) => {
    const { name } = req.params;
    if (!isValidName(name)) return res.status(400).json({ error: 'Invalid project name' });

    const run = ProjectOrchestrator.getActiveRunForProject(name);
    if (!run) {
        return res.json({ active: false });
    }

    res.json({
        active: true,
        runId: run.runId,
        phase: run.phase,
        sprint: run.sprint,
        revision: run.revision,
        totalSprints: run.totalSprints,
        activeAgent: run.activeAgentId,
    });
});

// Stop a run
router.post('/:name/run/stop', (req, res) => {
    const { name } = req.params;
    if (!isValidName(name)) return res.status(400).json({ error: 'Invalid project name' });

    const run = ProjectOrchestrator.getActiveRunForProject(name);
    if (!run) return res.status(404).json({ error: 'No active run for this project' });

    const stopped = ProjectOrchestrator.stopRun(run.runId);
    res.json({ stopped });
});

export default router;
