import fs from 'node:fs';
import path from 'node:path';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system' | 'reasoning';
    content: string;
    timestamp: number;
}

export interface Session {
    id: string;
    agentId: string;
    title: string;
    summary?: string;
    messages: ChatMessage[];
    updatedAt: number;
}

const SESSIONS_DIR = path.resolve(process.cwd(), 'sessions'); // Legacy
const AGENTS_DIR = path.resolve(process.cwd(), 'agents');

export class SessionManager {
    static listSessions(): Session[] {
        const sessions: Session[] = [];

        // 1. Load legacy sessions
        if (fs.existsSync(SESSIONS_DIR)) {
            const legacyFiles = fs.readdirSync(SESSIONS_DIR).filter(file => file.endsWith('.json'));
            for (const file of legacyFiles) {
                try {
                    const data = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8');
                    sessions.push(JSON.parse(data));
                } catch (e) {
                    console.error(`Failed to load legacy session ${file}`, e);
                }
            }
        }

        // 2. Load agent-specific sessions
        if (fs.existsSync(AGENTS_DIR)) {
            const agents = fs.readdirSync(AGENTS_DIR).filter(item =>
                fs.statSync(path.join(AGENTS_DIR, item)).isDirectory()
            );

            for (const agentId of agents) {
                const agentSessionsDir = path.join(AGENTS_DIR, agentId, 'sessions');
                if (fs.existsSync(agentSessionsDir)) {
                    const sessionFiles = fs.readdirSync(agentSessionsDir).filter(file => file.endsWith('.json'));
                    for (const file of sessionFiles) {
                        try {
                            const data = fs.readFileSync(path.join(agentSessionsDir, file), 'utf-8');
                            sessions.push(JSON.parse(data));
                        } catch (e) {
                            console.error(`Failed to load session ${file} for agent ${agentId}`, e);
                        }
                    }
                }
            }
        }

        // Deduplicate by ID (prefer agent-specific if duplicate exists)
        const sessionMap = new Map<string, Session>();
        sessions.forEach(s => sessionMap.set(s.id, s));

        return Array.from(sessionMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    static getSession(id: string): Session | null {
        // Try legacy first (fast check)
        const legacyPath = path.join(SESSIONS_DIR, `${id}.json`);
        if (fs.existsSync(legacyPath)) {
            try {
                return JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
            } catch (e) { return null; }
        }

        // Search in agents
        if (fs.existsSync(AGENTS_DIR)) {
            const agents = fs.readdirSync(AGENTS_DIR).filter(item =>
                fs.statSync(path.join(AGENTS_DIR, item)).isDirectory()
            );

            for (const agentId of agents) {
                const agentSessionPath = path.join(AGENTS_DIR, agentId, 'sessions', `${id}.json`);
                if (fs.existsSync(agentSessionPath)) {
                    try {
                        return JSON.parse(fs.readFileSync(agentSessionPath, 'utf-8'));
                    } catch (e) { return null; }
                }
            }
        }

        return null;
    }

    static saveSession(session: Session): void {
        session.updatedAt = Date.now();

        if (session.agentId) {
            const agentSessionsDir = path.join(AGENTS_DIR, session.agentId, 'sessions');
            if (!fs.existsSync(agentSessionsDir)) {
                fs.mkdirSync(agentSessionsDir, { recursive: true });
            }

            // If it exists in legacy, delete it there (migrate to agent folder)
            const legacyPath = path.join(SESSIONS_DIR, `${session.id}.json`);
            if (fs.existsSync(legacyPath)) {
                fs.unlinkSync(legacyPath);
            }

            const filePath = path.join(agentSessionsDir, `${session.id}.json`);
            fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
        } else {
            // Fallback to legacy if no agentId
            if (!fs.existsSync(SESSIONS_DIR)) {
                fs.mkdirSync(SESSIONS_DIR, { recursive: true });
            }
            const legacyPath = path.join(SESSIONS_DIR, `${session.id}.json`);
            fs.writeFileSync(legacyPath, JSON.stringify(session, null, 2), 'utf-8');
        }
    }

    static deleteSession(id: string): void {
        const legacyPath = path.join(SESSIONS_DIR, `${id}.json`);
        if (fs.existsSync(legacyPath)) {
            fs.unlinkSync(legacyPath);
            return;
        }

        if (fs.existsSync(AGENTS_DIR)) {
            const agents = fs.readdirSync(AGENTS_DIR).filter(item =>
                fs.statSync(path.join(AGENTS_DIR, item)).isDirectory()
            );

            for (const agentId of agents) {
                const agentSessionPath = path.join(AGENTS_DIR, agentId, 'sessions', `${id}.json`);
                if (fs.existsSync(agentSessionPath)) {
                    fs.unlinkSync(agentSessionPath);
                    return;
                }
            }
        }
    }
}
