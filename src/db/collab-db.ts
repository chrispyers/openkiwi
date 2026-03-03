import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { logger } from '../logger.js';

class CollabDb {
    private db: Database.Database;

    constructor() {
        const collabDir = path.resolve(process.cwd(), 'workspace', 'agent_collaboration');
        if (!fs.existsSync(collabDir)) {
            fs.mkdirSync(collabDir, { recursive: true });
        }

        const dbPath = path.join(collabDir, 'main.db');
        this.db = new Database(dbPath);

        this.init();
    }

    private init() {
        // Enable foreign keys
        this.db.pragma('foreign_keys = ON');

        try {
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS workflows (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS workflow_states (
                    id TEXT PRIMARY KEY,
                    workflow_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    order_index INTEGER NOT NULL,
                    assigned_agent_id TEXT, -- nullable, if no specific agent is assigned
                    requires_approval BOOLEAN DEFAULT 0,
                    instructions TEXT, -- nullable, instructions for the agent
                    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    parent_task_id TEXT, -- for subtasks
                    workflow_id TEXT NOT NULL,
                    state_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    locked_by TEXT,
                    locked_at INTEGER,
                    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
                    FOREIGN KEY (state_id) REFERENCES workflow_states(id) ON DELETE CASCADE,
                    FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS task_comments (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    agent_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
                );
            `);

            // Migration to add instructions if missing
            try {
                this.db.exec("ALTER TABLE workflow_states ADD COLUMN instructions TEXT;");
            } catch (e) {
                // Column might already exist
            }

            logger.log({ type: 'system', level: 'info', message: '[CollabDb] Initialized collaboration database schema.' });
        } catch (error) {
            logger.log({ type: 'error', level: 'error', message: '[CollabDb] Failed to initialize collaboration database schema.', data: error });
            throw error;
        }
    }

    getDatabase(): Database.Database {
        return this.db;
    }
}

// Export a singleton instance of the database connection
export const collabDb = new CollabDb().getDatabase();
