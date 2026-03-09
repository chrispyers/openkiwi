import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/collab-db.js', async () => {
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(`
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
            assigned_agent_id TEXT,
            requires_approval BOOLEAN DEFAULT 0,
            instructions TEXT,
            FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            parent_task_id TEXT, 
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
    return { collabDb: db };
});

import { collabDb } from '../../db/collab-db.js';
import { TaskService } from '../../services/task-service';
import { WorkflowService } from '../../services/workflow-service';

describe('TaskService', () => {
    let workflowId: string;
    let stateId1: string;
    let stateId2: string;

    beforeEach(() => {
        collabDb.exec('DELETE FROM task_comments; DELETE FROM tasks; DELETE FROM workflow_states; DELETE FROM workflows;');
        const w = WorkflowService.createWorkflow('Test Flow', '');
        workflowId = w.id;
        stateId1 = WorkflowService.createWorkflowState(workflowId, 'State 1', 0).id;
        stateId2 = WorkflowService.createWorkflowState(workflowId, 'State 2', 1).id;
    });

    it('creates and retrieves a task', () => {
        const task = TaskService.createTask(workflowId, stateId1, 'My Task', 'Desc');
        expect(task.title).toBe('My Task');
        expect(task.workflow_id).toBe(workflowId);
        expect(task.state_id).toBe(stateId1);

        const fetched = TaskService.getTask(task.id);
        expect(fetched).toBeDefined();
        expect(fetched!.title).toBe('My Task');
    });

    it('manages task locking', () => {
        const task = TaskService.createTask(workflowId, stateId1, 'Lock Task');
        expect(task.locked_by).toBeNull();

        const lock1 = TaskService.lockTask(task.id, 'agent-1');
        expect(lock1).toBe(true);

        const lock2 = TaskService.lockTask(task.id, 'agent-2');
        expect(lock2).toBe(false);

        const lock3 = TaskService.lockTask(task.id, 'agent-1');
        expect(lock3).toBe(true);

        const unlock = TaskService.unlockTask(task.id, 'agent-1');
        expect(unlock).toBe(true);
    });

    it('moves tasks between states and drops locks', () => {
        const task = TaskService.createTask(workflowId, stateId1, 'Move Task');
        TaskService.lockTask(task.id, 'agent-1');

        let t = TaskService.getTask(task.id)!;
        expect(t.locked_by).toBe('agent-1');

        TaskService.updateTaskState(task.id, stateId2);
        t = TaskService.getTask(task.id)!;
        expect(t.state_id).toBe(stateId2);
        expect(t.locked_by).toBeNull();
    });

    it('manages task comments', () => {
        const task = TaskService.createTask(workflowId, stateId1, 'Comment Task');
        TaskService.addTaskComment(task.id, 'agent-1', 'Hello World');

        const comments = TaskService.getTaskComments(task.id);
        expect(comments.length).toBe(1);
        expect(comments[0].agent_id).toBe('agent-1');
        expect(comments[0].content).toBe('Hello World');
    });

    it('fetches tasks assigned to agent', () => {
        WorkflowService.updateWorkflowState(stateId2, 'State 2', 1, 'agent-x', false);

        const task1 = TaskService.createTask(workflowId, stateId1, 'T1');
        const task2 = TaskService.createTask(workflowId, stateId2, 'T2');

        const agentTasks = TaskService.getTasksAssignedToAgent('agent-x');
        expect(agentTasks.length).toBe(1);
        expect(agentTasks[0].id).toBe(task2.id);

        TaskService.lockTask(task2.id, 'agent-y');
        const agentTasksAfterLock = TaskService.getTasksAssignedToAgent('agent-x');
        expect(agentTasksAfterLock.length).toBe(0);
    });
});
