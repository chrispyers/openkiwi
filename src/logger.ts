import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

export interface LogEntry {
    id: number; // SQLite rowid or auto-increment id
    timestamp: number;
    type: 'request' | 'response' | 'error' | 'tool' | 'system' | 'thinking' | 'usage';
    agentId?: string;
    sessionId?: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    data?: any;
}

class Logger {
    private db: Database.Database;
    private maxLogs = 10000; // Increased limit for DB

    constructor() {
        const logsDir = path.resolve(process.cwd(), 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        const dbPath = path.join(logsDir, 'logs.db');
        this.db = new Database(dbPath);

        // Initialize table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                type TEXT NOT NULL,
                agentId TEXT,
                sessionId TEXT,
                level TEXT NOT NULL,
                message TEXT,
                data TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_timestamp ON logs(timestamp DESC);
        `);
    }

    log(entry: Omit<LogEntry, 'id' | 'timestamp'>) {
        const timestamp = Date.now();
        const stmt = this.db.prepare(`
            INSERT INTO logs (timestamp, type, agentId, sessionId, level, message, data)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        try {
            stmt.run(
                timestamp,
                entry.type,
                entry.agentId || null,
                entry.sessionId || null,
                entry.level,
                entry.message,
                entry.data !== undefined && entry.data !== null ? JSON.stringify(entry.data) : null
            );

            // Also log to console for visibility in dev
            const color = entry.level === 'error' ? '\x1b[31m' : entry.level === 'warn' ? '\x1b[33m' : '\x1b[36m';
            console.log(`${color}[${entry.type.toUpperCase()}]\x1b[0m ${entry.message}`);

            // Cleanup old logs periodically (simple check via rand or just let it grow? 
            // Better to prune on insert if we want to strictly limit, or a scheduled job.
            // For now, let's prune every 100th insert to avoid overhead
            if (Math.random() < 0.01) {
                this.prune();
            }
        } catch (err) {
            console.error('Failed to write to log db:', err);
        }
    }

    private prune() {
        const stmt = this.db.prepare(`
            DELETE FROM logs WHERE id NOT IN (
                SELECT id FROM logs ORDER BY timestamp DESC LIMIT ?
            )
        `);
        stmt.run(this.maxLogs);
    }

    getLogs(limit = 500): LogEntry[] {
        const stmt = this.db.prepare(`
            SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?
        `);
        const rows = stmt.all(limit) as any[];

        return rows.map(row => ({
            ...row,
            data: row.data ? JSON.parse(row.data) : undefined
        }));
    }

    clear() {
        this.db.exec('DELETE FROM logs');
        this.db.exec('VACUUM');
    }
}

export const logger = new Logger();
