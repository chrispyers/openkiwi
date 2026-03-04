import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config-manager.js';
import { MemoryIndexManager } from './memory/manager.js';
import { logger } from './logger.js';
import { broadcastMessage } from './state.js';

export interface HeartbeatChannelTelegram { type: 'telegram'; chatId: string; }
export interface HeartbeatChannelWhatsApp { type: 'whatsapp'; jid: string; }
export interface HeartbeatChannelWebSocket { type: 'websocket'; }
export type HeartbeatChannel = HeartbeatChannelTelegram | HeartbeatChannelWhatsApp | HeartbeatChannelWebSocket;

export interface Agent {
    id: string;
    name: string;
    emoji: string;
    path: string;
    identity?: string;
    soul?: string;
    persona?: string;
    memory: string;
    rules: string;
    heartbeatInstructions: string;
    systemPrompt: string;
    provider?: string;
    heartbeat?: {
        enabled: boolean;
        schedule: string;
        allowManualTrigger?: boolean;
        channels?: HeartbeatChannel[];
    };
    collaboration?: {
        enabled: boolean;
        schedule: string;
    };
    tools?: Record<string, any>;
    isDefault?: boolean;
}

export interface AgentState {
    status: 'idle' | 'chatting' | 'working' | string;
    details?: string;
    since: number; // Timestamp when this status was set
}

const AGENTS_DIR = path.resolve(process.cwd(), 'agents');

export class AgentManager {
    static listAgents(): string[] {
        if (!fs.existsSync(AGENTS_DIR)) return [];
        return fs.readdirSync(AGENTS_DIR).filter(file => {
            const fullPath = path.join(AGENTS_DIR, file);
            return fs.statSync(fullPath).isDirectory();
        });
    }

    /**
     * Returns the default agent ID: prefers 'luna', then oldest agent by
     * directory creation time, then first alphabetically.
     */
    static getDefaultAgentId(): string | null {
        const agents = this.listAgents();
        if (agents.length === 0) return null;

        const luna = agents.find(id => id.toLowerCase() === 'luna');
        if (luna) return luna;

        // Sort by directory birthtime (oldest first)
        try {
            const withBirth = agents.map(id => ({
                id,
                birthtime: fs.statSync(path.join(AGENTS_DIR, id)).birthtimeMs
            }));
            withBirth.sort((a, b) => a.birthtime - b.birthtime);
            return withBirth[0].id;
        } catch {
            // If stat fails, fall back to first alphabetically
            return agents[0];
        }
    }

    static getAgent(id: string): Agent | null {
        const agentDir = path.join(AGENTS_DIR, id);
        if (!fs.existsSync(agentDir)) return null;

        const personaPath = path.join(agentDir, 'PERSONA.md');
        const hasPersona = fs.existsSync(personaPath);

        const persona = hasPersona ? this.readFile(personaPath) : undefined;
        const identity = !hasPersona ? this.readFile(path.join(agentDir, 'IDENTITY.md')) : undefined;
        const soul = !hasPersona ? this.readFile(path.join(agentDir, 'SOUL.md')) : undefined;
        const memory = this.readFile(path.join(agentDir, 'MEMORY.md'));
        const heartbeatInstructions = this.readFile(path.join(agentDir, 'HEARTBEAT.md'));
        const rules = this.readFile(path.join(agentDir, hasPersona ? 'RULES.md' : 'AGENT.md'));

        // Load agent-specific config if it exists
        const configPath = path.join(agentDir, 'config.json');
        let agentConfig: any = { name: id.charAt(0).toUpperCase() + id.slice(1), emoji: '', provider: '' };
        if (fs.existsSync(configPath)) {
            try {
                agentConfig = { ...agentConfig, ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) };
            } catch (e) {
                console.error(`Failed to parse config for agent ${id}`);
            }
        }
        const globalConfig = loadConfig();
        const globalSystemPrompt = globalConfig.global?.systemPrompt || '';

        let collaborationPrompt = '';
        if (agentConfig.collaboration?.enabled) {
            collaborationPrompt = `
# COLLABORATION SYSTEM
You are part of an Agent Collaboration System. You have the ability to work on multi-step workflows with other agents.
Use the \`get_assigned_tasks\` tool to see what tasks you are currently assigned to.
When working on a task, you can read its context via \`read_task\`.
Communicate your progress, feedback, and decisions by leaving comments on the task using \`add_task_comment\`.
When you have finished your work on a task for its current stage, move it to the next stage using \`update_task_state\`.
Check your assigned tasks regularly, especially when asked for an update or when participating in a scheduled collaboration event.`;
        }

        const systemPrompt = `
${hasPersona ? persona : identity}

${rules}
${hasPersona ? '' : '\n' + soul}

${memory || 'Your memory is currently empty.'}

${collaborationPrompt}

${globalSystemPrompt}`.trim();

        return {
            id,
            name: agentConfig.name,
            emoji: agentConfig.emoji,
            path: agentDir,
            identity,
            soul,
            persona,
            memory,
            rules,
            heartbeatInstructions,
            systemPrompt,
            provider: agentConfig.provider,
            heartbeat: agentConfig.heartbeat,
            collaboration: agentConfig.collaboration,
            tools: agentConfig.tools,
            isDefault: agentConfig.isDefault
        };
    }

    static createAgent(name: string, personaName: string = 'Generic'): Agent {
        // Create a safe ID from the name
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        if (!id) {
            throw new Error('Invalid agent name');
        }

        const agentDir = path.join(AGENTS_DIR, id);

        // Check if agent already exists
        if (fs.existsSync(agentDir)) {
            throw new Error('An agent with this name already exists');
        }

        // Create agent directory
        if (!fs.existsSync(AGENTS_DIR)) {
            fs.mkdirSync(AGENTS_DIR, { recursive: true });
        }
        fs.mkdirSync(agentDir);

        const personasDir = path.resolve(process.cwd(), 'agent_personas');
        const specificPersonaDir = path.join(personasDir, personaName);

        const filesToCopy = ['PERSONA.md', 'RULES.md', 'MEMORY.md', 'HEARTBEAT.md'];

        for (const file of filesToCopy) {
            const specificPath = path.join(specificPersonaDir, file);
            const fallbackPath = path.join(personasDir, file);
            let sourcePath = null;

            if (fs.existsSync(specificPath)) {
                sourcePath = specificPath;
            } else if (fs.existsSync(fallbackPath)) {
                sourcePath = fallbackPath;
            }

            if (sourcePath) {
                let content = fs.readFileSync(sourcePath, 'utf-8');
                if (file === 'PERSONA.md') {
                    content = content.replace(/\${name}/g, name);
                }
                fs.writeFileSync(path.join(agentDir, file), content, 'utf-8');
            } else if (file !== 'HEARTBEAT.md') {
                if (file === 'PERSONA.md') {
                    fs.writeFileSync(path.join(agentDir, file), `You are ${name}.`, 'utf-8');
                } else {
                    fs.writeFileSync(path.join(agentDir, file), '', 'utf-8');
                }
            }
        }

        // Create config if it doesn't exist (it might have been copied from template)
        const configPath = path.join(agentDir, 'config.json');
        if (!fs.existsSync(configPath)) {
            const config = { name, emoji: '' };
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        } else {
            // If config exists, ensure name is set correctly
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                config.name = name;
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
            } catch (e) {
                console.error(`Failed to update name in copied config for agent ${id}`);
            }
        }

        // Return the newly created agent
        return this.getAgent(id)!;
    }

    static saveAgentConfig(id: string, config: any): void {
        const agentDir = path.join(AGENTS_DIR, id);
        if (!fs.existsSync(agentDir)) return;
        const configPath = path.join(agentDir, 'config.json');

        let existingConfig: any = {};
        if (fs.existsSync(configPath)) {
            try {
                existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            } catch (e) {
                console.error(`Failed to parse existing config for agent ${id}, starting fresh.`);
            }
        }

        const newConfig = { ...existingConfig, ...config };

        fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');

        // If this agent is set as default, remove isDefault from all other agents
        if (config.isDefault === true) {
            const allAgents = this.listAgents();
            for (const otherId of allAgents) {
                if (otherId !== id) {
                    const otherConfigPath = path.join(AGENTS_DIR, otherId, 'config.json');
                    if (fs.existsSync(otherConfigPath)) {
                        try {
                            const otherConfig = JSON.parse(fs.readFileSync(otherConfigPath, 'utf-8'));
                            if (otherConfig.isDefault !== undefined) {
                                delete otherConfig.isDefault;
                                fs.writeFileSync(otherConfigPath, JSON.stringify(otherConfig, null, 2), 'utf-8');
                            }
                        } catch (e) {
                            console.error(`Failed to update default status for agent ${otherId}`);
                        }
                    }
                }
            }
        }
    }

    private static agentStates = new Map<string, AgentState>();

    static getAgentState(id: string): AgentState {
        return this.agentStates.get(id) || { status: 'idle', since: Date.now() };
    }

    static getAllAgentStates(): Record<string, AgentState> {
        const states: Record<string, AgentState> = {};
        for (const id of this.listAgents()) {
            states[id] = this.getAgentState(id);
        }
        return states;
    }

    static setAgentState(id: string, status: string, details?: string) {
        const currentState = this.getAgentState(id);
        const now = Date.now();

        // Only update 'since' if the status itself changed
        const since = (currentState.status === status) ? currentState.since : now;

        const state = { status, details, since };
        this.agentStates.set(id, state);
        broadcastMessage({ type: 'agent_status_update', agentId: id, state });
    }

    private static memoryManagers = new Map<string, MemoryIndexManager>();

    private static readFile(filePath: string): string {
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf-8');
        }
        return '';
    }

    static async getMemoryManager(agentId: string): Promise<MemoryIndexManager> {
        if (this.memoryManagers.has(agentId)) {
            return this.memoryManagers.get(agentId)!;
        }

        const agent = this.getAgent(agentId);
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        const config = loadConfig();
        const providers = config.providers || [];

        // Find provider config
        // Agent.provider might be the description or model name. 
        // We'll try to match description first, then model.
        let llmProviderConfig: any = undefined;

        // Use global memory configuration if enabled
        if (config.memory?.useEmbeddings && config.memory?.embeddingsModel) {
            let providerConfig = providers.find(p => p.description === config.memory?.embeddingsModel);
            if (!providerConfig) {
                providerConfig = providers.find(p => p.model === config.memory?.embeddingsModel);
            }

            if (providerConfig) {
                logger.log({ type: 'system', level: 'info', message: `[AgentManager] Found embedding provider: ${providerConfig.model} for ${agentId}` });
                llmProviderConfig = {
                    baseUrl: providerConfig.endpoint,
                    modelId: providerConfig.model,
                    apiKey: providerConfig.apiKey
                };
            } else {
                logger.log({ type: 'system', level: 'warn', message: `[AgentManager] Embedding provider '${config.memory?.embeddingsModel}' not found. Falling back to keyword search.` });
            }
        }

        const manager = new MemoryIndexManager(agentId, llmProviderConfig);

        // Perform initial sync
        // We do this non-blocking usually, but for first load we might want to wait or just fire and forget
        // Ideally we await it so the first search works.
        try {
            await manager.sync();
        } catch (err) {
            logger.log({ type: 'error', level: 'error', message: `[AgentManager] Failed to sync memory for ${agentId}`, data: err });
        }
        this.memoryManagers.set(agentId, manager);
        return manager;
    }

    static async initializeAllMemoryManagers(): Promise<void> {
        const agents = this.listAgents();
        logger.log({ type: 'system', level: 'info', message: `[AgentManager] Initializing memory for ${agents.length} agents...` });
        for (const agentId of agents) {
            try {
                // Fire and forget (or await if we want to block startup)
                // We'll await to ensure initial index is ready
                await this.getMemoryManager(agentId);
            } catch (err) {
                logger.log({ type: 'error', level: 'error', message: `[AgentManager] Failed to init memory for ${agentId}`, data: err });
            }
        }
    }

    static clearMemoryManagers() {
        this.memoryManagers.clear();
        logger.log({ type: 'system', level: 'info', message: '[AgentManager] Cleared memory manager cache.' });
    }

    static deleteAgent(id: string): void {
        const agentDir = path.join(AGENTS_DIR, id);
        if (fs.existsSync(agentDir)) {
            fs.rmSync(agentDir, { recursive: true, force: true });
        }
        this.memoryManagers.delete(id);
        this.agentStates.delete(id);
        logger.log({ type: 'system', level: 'info', message: `[AgentManager] Deleted agent ${id}` });
    }
}
