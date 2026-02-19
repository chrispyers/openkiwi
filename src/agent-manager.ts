import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config-manager.js';
import { MemoryIndexManager } from './memory/manager.js';
import { logger } from './logger.js';

export interface Agent {
    id: string;
    name: string;
    emoji: string;
    path: string;
    identity: string;
    soul: string;
    memory: string;
    heartbeatInstructions: string;
    systemPrompt: string;
    provider?: string;
    heartbeat?: {
        enabled: boolean;
        schedule: string;
    };
}


const AGENTS_DIR = path.resolve(process.cwd(), 'agents');
const TEMPLATE_DIR = path.resolve(process.cwd(), 'agent_template');

export class AgentManager {
    static listAgents(): string[] {
        if (!fs.existsSync(AGENTS_DIR)) return [];
        return fs.readdirSync(AGENTS_DIR).filter(file => {
            const fullPath = path.join(AGENTS_DIR, file);
            return fs.statSync(fullPath).isDirectory();
        });
    }

    static getAgent(id: string): Agent | null {
        const agentDir = path.join(AGENTS_DIR, id);
        if (!fs.existsSync(agentDir)) return null;

        const identity = this.readFile(path.join(agentDir, 'IDENTITY.md'));
        const soul = this.readFile(path.join(agentDir, 'SOUL.md'));
        const memory = this.readFile(path.join(agentDir, 'MEMORY.md'));
        const heartbeatInstructions = this.readFile(path.join(agentDir, 'HEARTBEAT.md'));

        // Load agent-specific config if it exists
        const configPath = path.join(agentDir, 'config.json');
        let agentConfig: any = { name: id.charAt(0).toUpperCase() + id.slice(1), emoji: '🤖', provider: '' };
        if (fs.existsSync(configPath)) {
            try {
                agentConfig = { ...agentConfig, ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) };
            } catch (e) {
                console.error(`Failed to parse config for agent ${id}`);
            }
        }
        const globalConfig = loadConfig();
        const globalSystemPrompt = globalConfig.global?.systemPrompt || '';

        const systemPrompt = `
${identity}

${soul}

${memory || 'Your memory is currently empty.'}

${globalSystemPrompt}`.trim();

        return {
            id,
            name: agentConfig.name,
            emoji: agentConfig.emoji,
            path: agentDir,
            identity,
            soul,
            memory,
            heartbeatInstructions,
            systemPrompt,
            provider: agentConfig.provider,
            heartbeat: agentConfig.heartbeat
        };
    }

    static createAgent(name: string): Agent {
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

        // Helper to read template files
        const readTemplate = (filename: string): string => {
            const templatePath = path.join(TEMPLATE_DIR, filename);
            if (fs.existsSync(templatePath)) {
                return fs.readFileSync(templatePath, 'utf-8');
            }
            return '';
        };

        // Get template contents
        const identity = readTemplate('IDENTITY.md').replace(/\${name}/g, name);
        const soul = readTemplate('SOUL.md');
        const memory = readTemplate('MEMORY.md');
        const heartbeat = readTemplate('HEARTBEAT.md');

        // Write files
        fs.writeFileSync(path.join(agentDir, 'IDENTITY.md'), identity, 'utf-8');
        fs.writeFileSync(path.join(agentDir, 'SOUL.md'), soul, 'utf-8');
        fs.writeFileSync(path.join(agentDir, 'MEMORY.md'), memory, 'utf-8');
        fs.writeFileSync(path.join(agentDir, 'HEARTBEAT.md'), heartbeat, 'utf-8');

        // Create config
        const config = { name, emoji: '🤖' };
        fs.writeFileSync(path.join(agentDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');

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
}
