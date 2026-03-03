import { collabDb } from '../db/collab-db.js';
import crypto from 'node:crypto';

export interface Task {
    id: string;
    parent_task_id: string | null;
    workflow_id: string;
    state_id: string;
    title: string;
    description: string;
    created_at: number;
    updated_at: number;
    locked_by: string | null;
    locked_at: number | null;
}

export interface TaskComment {
    id: string;
    task_id: string;
    agent_id: string;
    content: string;
    created_at: number;
}

export class TaskService {
    static getTasks(): Task[] {
        return collabDb.prepare('SELECT * FROM tasks ORDER BY updated_at DESC').all() as Task[];
    }

    static getTask(id: string): Task | undefined {
        return collabDb.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
    }

    static getTasksByWorkflowId(workflowId: string): Task[] {
        return collabDb.prepare('SELECT * FROM tasks WHERE workflow_id = ? ORDER BY updated_at DESC').all(workflowId) as Task[];
    }

    static getTasksByStateId(stateId: string): Task[] {
        return collabDb.prepare('SELECT * FROM tasks WHERE state_id = ? ORDER BY updated_at DESC').all(stateId) as Task[];
    }

    static getTasksAssignedToAgent(agentId: string): Task[] {
        // Find tasks in states where assigned_agent_id = agentId AND NOT locked by another agent
        return collabDb.prepare(`
            SELECT t.* FROM tasks t
            JOIN workflow_states ws ON t.state_id = ws.id
            WHERE ws.assigned_agent_id = ?
            AND (t.locked_by IS NULL OR t.locked_by = ?)
            ORDER BY t.updated_at DESC
        `).all(agentId, agentId) as Task[];
    }

    static createTask(workflowId: string, stateId: string, title: string, description: string = '', parentTaskId: string | null = null): Task {
        const id = crypto.randomUUID();
        const now = Date.now();
        const stmt = collabDb.prepare(`
            INSERT INTO tasks (id, parent_task_id, workflow_id, state_id, title, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(id, parentTaskId, workflowId, stateId, title, description, now, now);
        return this.getTask(id)!;
    }

    static updateTask(id: string, title: string, description: string): Task | undefined {
        const now = Date.now();
        const stmt = collabDb.prepare(`
            UPDATE tasks 
            SET title = ?, description = ?, updated_at = ?
            WHERE id = ?
        `);
        const result = stmt.run(title, description, now, id);
        if (result.changes === 0) return undefined;
        return this.getTask(id);
    }

    static updateTaskState(id: string, newStateId: string): Task | undefined {
        const now = Date.now();
        // Moving to a new state unlocks the task.
        const stmt = collabDb.prepare(`
            UPDATE tasks 
            SET state_id = ?, updated_at = ?, locked_by = NULL, locked_at = NULL
            WHERE id = ?
        `);
        const result = stmt.run(newStateId, now, id);
        if (result.changes === 0) return undefined;
        return this.getTask(id);
    }

    static deleteTask(id: string): boolean {
        const stmt = collabDb.prepare('DELETE FROM tasks WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }

    // --- Concurrency / Locking ---

    static lockTask(taskId: string, agentId: string): boolean {
        const now = Date.now();
        // Only lock if it's currently unlocked OR locked by the same agent
        const stmt = collabDb.prepare(`
            UPDATE tasks
            SET locked_by = ?, locked_at = ?
            WHERE id = ? AND (locked_by IS NULL OR locked_by = ?)
        `);
        const result = stmt.run(agentId, now, taskId, agentId);
        return result.changes > 0;
    }

    static unlockTask(taskId: string, agentId: string): boolean {
        // Only unlock if the locked_by matches the agent requesting the unlock
        const stmt = collabDb.prepare(`
            UPDATE tasks
            SET locked_by = NULL, locked_at = NULL
            WHERE id = ? AND locked_by = ?
        `);
        const result = stmt.run(taskId, agentId);
        return result.changes > 0;
    }

    static forceUnlockTask(taskId: string): boolean {
        const stmt = collabDb.prepare(`
            UPDATE tasks
            SET locked_by = NULL, locked_at = NULL
            WHERE id = ?
        `);
        const result = stmt.run(taskId);
        return result.changes > 0;
    }

    // --- Comments ---

    static getTaskComments(taskId: string): TaskComment[] {
        return collabDb.prepare('SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC').all(taskId) as TaskComment[];
    }

    static addTaskComment(taskId: string, agentId: string, content: string): TaskComment {
        const id = crypto.randomUUID();
        const now = Date.now();
        const stmt = collabDb.prepare(`
            INSERT INTO task_comments (id, task_id, agent_id, content, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(id, taskId, agentId, content, now);

        // Update task's updated_at timestamp
        collabDb.prepare('UPDATE tasks SET updated_at = ? WHERE id = ?').run(now, taskId);

        return collabDb.prepare('SELECT * FROM task_comments WHERE id = ?').get(id) as TaskComment;
    }
}
