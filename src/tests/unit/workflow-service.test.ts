import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/collab-db.js', async () => {
    // dynamically import better-sqlite3 inside the mock
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
            depends_on TEXT,
            FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
        );
    `);
    return { collabDb: db };
});

import { collabDb } from '../../db/collab-db.js';
import { WorkflowService } from '../../services/workflow-service';

describe('WorkflowService', () => {
    beforeEach(() => {
        collabDb.exec('DELETE FROM workflow_states; DELETE FROM workflows;');
    });

    it('creates and retrieves a workflow', () => {
        const workflow = WorkflowService.createWorkflow('Test Pipeline', 'Description');
        expect(workflow.name).toBe('Test Pipeline');
        expect(workflow.id).toBeDefined();

        const fetched = WorkflowService.getWorkflow(workflow.id);
        expect(fetched).toBeDefined();
        expect(fetched!.name).toBe('Test Pipeline');
    });

    it('updates a workflow', () => {
        const workflow = WorkflowService.createWorkflow('Test', '');
        const updated = WorkflowService.updateWorkflow(workflow.id, 'Updated Name', 'Updated Desc');
        expect(updated!.name).toBe('Updated Name');
        expect(updated!.description).toBe('Updated Desc');
    });

    it('deletes a workflow', () => {
        const workflow = WorkflowService.createWorkflow('To Delete', '');
        const success = WorkflowService.deleteWorkflow(workflow.id);
        expect(success).toBe(true);
        expect(WorkflowService.getWorkflow(workflow.id)).toBeUndefined();
    });

    it('creates and manages workflow states', () => {
        const workflow = WorkflowService.createWorkflow('Pipeline', '');
        const state1 = WorkflowService.createWorkflowState(workflow.id, 'Todo', 0);
        const state2 = WorkflowService.createWorkflowState(workflow.id, 'In Progress', 1, 'agent-123', true);

        const states = WorkflowService.getWorkflowStates(workflow.id);
        expect(states.length).toBe(2);
        expect(states[0].name).toBe('Todo');
        expect(states[1].name).toBe('In Progress');
        expect(states[1].assigned_agent_id).toBe('agent-123');
        expect(states[1].requires_approval).toBeTruthy();

        // cascade delete
        WorkflowService.deleteWorkflow(workflow.id);
        const leftoverStates = WorkflowService.getWorkflowStates(workflow.id);
        expect(leftoverStates.length).toBe(0);
    });
});
