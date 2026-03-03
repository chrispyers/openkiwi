import { collabDb } from '../db/collab-db.js';
import crypto from 'node:crypto';

export interface Workflow {
    id: string;
    name: string;
    description: string;
    created_at: number;
    updated_at: number;
}

export interface WorkflowState {
    id: string;
    workflow_id: string;
    name: string;
    order_index: number;
    assigned_agent_id: string | null;
    requires_approval: boolean;
    instructions: string | null;
}

export class WorkflowService {
    static getWorkflows(): Workflow[] {
        return collabDb.prepare('SELECT * FROM workflows ORDER BY created_at DESC').all() as Workflow[];
    }

    static getWorkflow(id: string): Workflow | undefined {
        return collabDb.prepare('SELECT * FROM workflows WHERE id = ?').get(id) as Workflow | undefined;
    }

    static createWorkflow(name: string, description: string = ''): Workflow {
        const id = crypto.randomUUID();
        const now = Date.now();
        const stmt = collabDb.prepare(`
            INSERT INTO workflows (id, name, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(id, name, description, now, now);
        return this.getWorkflow(id)!;
    }

    static updateWorkflow(id: string, name: string, description: string): Workflow | undefined {
        const now = Date.now();
        const stmt = collabDb.prepare(`
            UPDATE workflows 
            SET name = ?, description = ?, updated_at = ?
            WHERE id = ?
        `);
        const result = stmt.run(name, description, now, id);
        if (result.changes === 0) return undefined;
        return this.getWorkflow(id);
    }

    static deleteWorkflow(id: string): boolean {
        const stmt = collabDb.prepare('DELETE FROM workflows WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }

    // --- States ---

    static getWorkflowStates(workflowId: string): WorkflowState[] {
        return collabDb.prepare('SELECT * FROM workflow_states WHERE workflow_id = ? ORDER BY order_index ASC').all(workflowId) as WorkflowState[];
    }

    static getWorkflowState(id: string): WorkflowState | undefined {
        return collabDb.prepare('SELECT * FROM workflow_states WHERE id = ?').get(id) as WorkflowState | undefined;
    }

    static createWorkflowState(workflowId: string, name: string, orderIndex: number, assignedAgentId: string | null = null, requiresApproval: boolean = false, instructions: string | null = null): WorkflowState {
        const id = crypto.randomUUID();
        const stmt = collabDb.prepare(`
            INSERT INTO workflow_states (id, workflow_id, name, order_index, assigned_agent_id, requires_approval, instructions)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(id, workflowId, name, orderIndex, assignedAgentId, requiresApproval ? 1 : 0, instructions);
        return collabDb.prepare('SELECT * FROM workflow_states WHERE id = ?').get(id) as WorkflowState;
    }

    static updateWorkflowState(id: string, name: string, orderIndex: number, assignedAgentId: string | null, requiresApproval: boolean, instructions: string | null = null): WorkflowState | undefined {
        const stmt = collabDb.prepare(`
            UPDATE workflow_states 
            SET name = ?, order_index = ?, assigned_agent_id = ?, requires_approval = ?, instructions = ?
            WHERE id = ?
        `);
        const result = stmt.run(name, orderIndex, assignedAgentId, requiresApproval ? 1 : 0, instructions, id);
        if (result.changes === 0) return undefined;
        return collabDb.prepare('SELECT * FROM workflow_states WHERE id = ?').get(id) as WorkflowState;
    }

    static deleteWorkflowState(id: string): boolean {
        const stmt = collabDb.prepare('DELETE FROM workflow_states WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
}
