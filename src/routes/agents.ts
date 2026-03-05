import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { AgentManager } from '../agent-manager.js';
import { HeartbeatManager } from '../heartbeat-manager.js';
import { loadConfig } from '../config-manager.js';
import { signMarkdown } from '../security.js';

const router = Router();

router.get('/', (req, res) => {
    const agentIds = AgentManager.listAgents();
    const agents = agentIds.map(id => {
        const agent = AgentManager.getAgent(id);
        if (!agent) return null;
        return {
            ...agent,
            identity: signMarkdown(agent.identity || ''),
            soul: signMarkdown(agent.soul || ''),
            memory: signMarkdown(agent.memory || ''),
            heartbeatInstructions: signMarkdown(agent.heartbeatInstructions || ''),
            systemPrompt: signMarkdown(agent.systemPrompt || '')
        };
    }).filter(Boolean);
    res.json(agents);
});

router.get('/personas', (req, res) => {
    try {
        const personasDir = path.resolve(process.cwd(), 'agent_personas');
        if (!fs.existsSync(personasDir)) return res.json(['Generic']);
        const dirs = fs.readdirSync(personasDir).filter(f => fs.statSync(path.join(personasDir, f)).isDirectory());
        res.json(dirs);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

router.post('/', (req, res) => {
    try {
        const { name, persona } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Agent name is required' });
        }
        const agent = AgentManager.createAgent(name.trim(), persona || 'Generic');
        res.json(agent);
    } catch (error) {
        res.status(400).json({ error: String(error) });
    }
});

const validateAgentId = (req: any, res: any, next: any) => {
    const id = req.params.id;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid agent ID' });
    const sanitized = id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (id !== sanitized || id.length === 0) {
        return res.status(400).json({ error: 'Invalid agent ID format' });
    }
    next();
};

router.post('/:id/config', validateAgentId, (req, res) => {
    try {
        AgentManager.saveAgentConfig(req.params.id, req.body);
        HeartbeatManager.refreshAgent(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: String(error) });
    }
});

router.post('/:id/heartbeat', validateAgentId, (req, res) => {
    const agent = AgentManager.getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const globalConfig = loadConfig();
    const isGloballyAllowed = globalConfig.heartbeat?.allowManualTrigger;
    const isAgentAllowed = agent.heartbeat?.allowManualTrigger;

    if (!isGloballyAllowed && !isAgentAllowed) {
        return res.status(403).json({ error: 'Manual heartbeat triggers are disabled. Enable heartbeat.allowManualTrigger in the global or agent config.' });
    }



    // Fire and forget — heartbeat runs in the background
    HeartbeatManager.executeHeartbeat(req.params.id);
    res.json({ success: true, message: `Heartbeat triggered for ${agent.name}` });
});

router.get('/:id/files', validateAgentId, (req, res) => {
    try {
        const agentDir = path.resolve(process.cwd(), 'agents', req.params.id);
        if (!fs.existsSync(agentDir)) return res.json([]);

        const files = fs.readdirSync(agentDir).filter(f => fs.statSync(path.join(agentDir, f)).isFile());
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

router.get('/:id/files/:filename', validateAgentId, (req, res) => {
    try {
        const agentDir = path.resolve(process.cwd(), 'agents', req.params.id);
        const filePath = path.join(agentDir, req.params.filename);

        if (filePath !== agentDir && !filePath.startsWith(agentDir + path.sep)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!fs.existsSync(filePath)) return res.status(404).send('File not found');

        res.sendFile(filePath);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

router.delete('/:id', validateAgentId, (req, res) => {
    try {
        AgentManager.deleteAgent(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: String(error) });
    }
});

router.post('/:id/files/:filename', validateAgentId, (req, res) => {
    try {
        const { content } = req.body;
        const agentDir = path.resolve(process.cwd(), 'agents', req.params.id);
        const filePath = path.join(agentDir, req.params.filename);

        if (filePath !== agentDir && !filePath.startsWith(agentDir + path.sep)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        fs.writeFileSync(filePath, content, 'utf-8');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

router.post('/:id/avatar', validateAgentId, (req, res) => {
    try {
        const { image } = req.body;
        const agentDir = path.resolve(process.cwd(), 'agents', req.params.id);

        if (!fs.existsSync(agentDir)) return res.status(404).json({ error: 'Agent not found' });

        const match = image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
        if (!match) return res.status(400).json({ error: 'Invalid image data' });

        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const filename = `avatar.${ext}`;
        const filePath = path.join(agentDir, filename);

        const buffer = Buffer.from(match[2], 'base64');
        fs.writeFileSync(filePath, buffer);

        const configPath = path.join(agentDir, 'config.json');
        let config: any = {};
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
        config.avatar = filename;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

        // Notify the frontend some how, or just rely on fetchAgents
        res.json({ success: true, avatar: filename });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

export default router;
