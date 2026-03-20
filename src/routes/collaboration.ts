import { Router } from 'express';
import { WorkflowService } from '../services/workflow-service.js';
import { executeWorkflow } from '../services/workflow-executor.js';

const router = Router();

// --- Workflows ---

router.get('/workflows', (req, res) => {
    try {
        const workflows = WorkflowService.getWorkflows();
        res.json(workflows);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/workflows', (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const workflow = WorkflowService.createWorkflow(name, description);
        res.status(201).json(workflow);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/workflows/:id', (req, res) => {
    try {
        const workflow = WorkflowService.getWorkflow(req.params.id);
        if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
        res.json(workflow);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/workflows/:id', (req, res) => {
    try {
        const { name, description } = req.body;
        const workflow = WorkflowService.updateWorkflow(req.params.id, name, description);
        if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
        res.json(workflow);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/workflows/:id/run', async (req, res) => {
    try {
        const { agentId } = req.body;
        if (!agentId) return res.status(400).json({ error: 'agentId is required' });
        const workflow = WorkflowService.getWorkflow(req.params.id);
        if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
        const result = await executeWorkflow(req.params.id, agentId);
        if (!result.success) return res.status(400).json({ error: result.error });
        res.json({ success: true, result: result.finalResponse });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/workflows/:id', (req, res) => {
    try {
        const success = WorkflowService.deleteWorkflow(req.params.id);
        if (!success) return res.status(404).json({ error: 'Workflow not found' });
        res.status(204).send();
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Workflow States ---

router.get('/workflows/:workflowId/states', (req, res) => {
    try {
        const states = WorkflowService.getWorkflowStates(req.params.workflowId);
        res.json(states);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/workflows/:workflowId/states', (req, res) => {
    try {
        const { name, order_index, assigned_agent_id, requires_approval, instructions } = req.body;
        if (!name || order_index === undefined) return res.status(400).json({ error: 'Name and order_index are required' });
        const state = WorkflowService.createWorkflowState(req.params.workflowId, name, order_index, assigned_agent_id, requires_approval, instructions);
        res.status(201).json(state);
    } catch (e: any) {
        console.error(`[collaboration] POST /workflows/${req.params.workflowId}/states failed:`, e);
        res.status(500).json({ error: e.message });
    }
});

router.put('/states/:id', (req, res) => {
    try {
        const { name, order_index, assigned_agent_id, requires_approval, instructions } = req.body;
        const state = WorkflowService.updateWorkflowState(req.params.id, name, order_index, assigned_agent_id ?? null, requires_approval, instructions);
        if (!state) return res.status(404).json({ error: 'State not found' });
        res.json(state);
    } catch (e: any) {
        console.error(`[collaboration] PUT /states/${req.params.id} failed:`, e);
        res.status(500).json({ error: e.message });
    }
});

router.delete('/states/:id', (req, res) => {
    try {
        const success = WorkflowService.deleteWorkflowState(req.params.id);
        if (!success) return res.status(404).json({ error: 'State not found' });
        res.status(204).send();
    } catch (e: any) {
        console.error(`[collaboration] DELETE /states/${req.params.id} failed:`, e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
