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
    messages: ChatMessage[];
    updatedAt: number;
}

const SESSIONS_DIR = path.resolve(process.cwd(), 'sessions');

export class SessionManager {
    static listSessions(): Session[] {
        if (!fs.existsSync(SESSIONS_DIR)) return [];
        return fs.readdirSync(SESSIONS_DIR)
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const data = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8');
                return JSON.parse(data) as Session;
            })
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    static getSession(id: string): Session | null {
        const filePath = path.join(SESSIONS_DIR, `${id}.json`);
        if (!fs.existsSync(filePath)) return null;
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data) as Session;
    }

    static saveSession(session: Session): void {
        if (!fs.existsSync(SESSIONS_DIR)) {
            fs.mkdirSync(SESSIONS_DIR, { recursive: true });
        }
        const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
        session.updatedAt = Date.now();
        fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
    }

    static deleteSession(id: string): void {
        const filePath = path.join(SESSIONS_DIR, `${id}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}
