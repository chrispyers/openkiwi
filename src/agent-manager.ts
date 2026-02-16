import fs from 'node:fs';
import path from 'node:path';

export interface Agent {
    id: string;
    name: string;
    emoji: string;
    path: string;
    identity: string;
    soul: string;
    memory: string;
    systemPrompt: string;
    provider?: string;
    heartbeat?: {
        enabled: boolean;
        schedule: string;
    };
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

    static getAgent(id: string): Agent | null {
        const agentDir = path.join(AGENTS_DIR, id);
        if (!fs.existsSync(agentDir)) return null;

        const identity = this.readFile(path.join(agentDir, 'IDENTITY.md'));
        const soul = this.readFile(path.join(agentDir, 'SOUL.md'));
        const memory = this.readFile(path.join(agentDir, 'MEMORY.md'));

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

        const systemPrompt = `
You are ${agentConfig.name} ${agentConfig.emoji}.

# IDENTITY
${identity}

# VALUES & SOUL
${soul}

# LONG-TERM MEMORY
${memory || 'Your memory is currently empty.'}

# CAPABILITIES & TOOLS
You have access to specialized tools to interact with the user's environment. 
- Use 'save_to_memory' whenever the user shares personal information, preferences, or important facts you should remember across sessions. Do NOT just say you will remember it; actually call the tool.
- Use 'manage_files' to help the user with their workspace.

Keep your responses concise and focused on the task at hand.
`.trim();

        return {
            id,
            name: agentConfig.name,
            emoji: agentConfig.emoji,
            path: agentDir,
            identity,
            soul,
            memory,
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

        // Create default files
        const defaultIdentity = `# Identity

You are ${name}, a helpful AI assistant.

## Your Purpose
Help users with their tasks and questions in a friendly and efficient manner.

## Your Personality
- Professional yet approachable
- Clear and concise in communication
- Patient and understanding
`;

        const defaultSoul = `# Values & Soul

## Core Values
- **Honesty**: Always be truthful and transparent
- **Helpfulness**: Prioritize being useful and supportive
- **Respect**: Treat all users with dignity and consideration

## Guiding Principles
- Focus on understanding the user's needs
- Provide accurate and well-reasoned responses
- Admit when you don't know something
`;

        const defaultMemory = `# Long-term Memory

This space will be used to store important facts and preferences about users across sessions.
`;

        // Write files
        fs.writeFileSync(path.join(agentDir, 'IDENTITY.md'), defaultIdentity, 'utf-8');
        fs.writeFileSync(path.join(agentDir, 'SOUL.md'), defaultSoul, 'utf-8');
        fs.writeFileSync(path.join(agentDir, 'MEMORY.md'), defaultMemory, 'utf-8');

        // Create config
        const config = { name, emoji: '🤖' };
        fs.writeFileSync(path.join(agentDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');

        // Return the newly created agent
        return this.getAgent(id)!;
    }

    static saveAgentConfig(id: string, config: { name: string; emoji: string; provider?: string }): void {
        const agentDir = path.join(AGENTS_DIR, id);
        if (!fs.existsSync(agentDir)) return;
        const configPath = path.join(agentDir, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    }

    private static readFile(filePath: string): string {
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf-8');
        }
        return '';
    }
}
