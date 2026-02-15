export interface LogEntry {
    id: string;
    timestamp: number;
    type: 'request' | 'response' | 'error' | 'tool' | 'system';
    agentId?: string;
    sessionId?: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    data?: any;
}

class Logger {
    private logs: LogEntry[] = [];
    private maxLogs = 500;

    log(entry: Omit<LogEntry, 'id' | 'timestamp'>) {
        const newEntry: LogEntry = {
            ...entry,
            id: Math.random().toString(36).substring(2, 11),
            timestamp: Date.now()
        };

        this.logs.unshift(newEntry);

        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }

        // Also log to console for visibility in dev
        const color = entry.level === 'error' ? '\x1b[31m' : entry.level === 'warn' ? '\x1b[33m' : '\x1b[36m';
        console.log(`${color}[${newEntry.type.toUpperCase()}]\x1b[0m ${entry.message}`);
    }

    getLogs() {
        return this.logs;
    }

    clear() {
        this.logs = [];
    }
}

export const logger = new Logger();
