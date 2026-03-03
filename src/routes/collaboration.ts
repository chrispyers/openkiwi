import { Router } from 'express';
import { WorkflowService } from '../services/workflow-service.js';
import { TaskService } from '../services/task-service.js';

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
        res.status(500).json({ error: e.message });
    }
});

router.delete('/states/:id', (req, res) => {
    try {
        const success = WorkflowService.deleteWorkflowState(req.params.id);
        if (!success) return res.status(404).json({ error: 'State not found' });
        res.status(204).send();
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Tasks ---

router.get('/tasks', (req, res) => {
    try {
        const { workflowId, stateId, agentId } = req.query;
        let tasks;
        if (agentId) {
            tasks = TaskService.getTasksAssignedToAgent(String(agentId));
        } else if (stateId) {
            tasks = TaskService.getTasksByStateId(String(stateId));
        } else if (workflowId) {
            tasks = TaskService.getTasksByWorkflowId(String(workflowId));
        } else {
            tasks = TaskService.getTasks();
        }
        res.json(tasks);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/tasks', (req, res) => {
    try {
        const { workflow_id, state_id, title, description, parent_task_id } = req.body;
        if (!workflow_id || !state_id || !title) return res.status(400).json({ error: 'Workflow ID, State ID, and Title are required' });
        const task = TaskService.createTask(workflow_id, state_id, title, description, parent_task_id);
        res.status(201).json(task);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/tasks/:id', (req, res) => {
    try {
        const task = TaskService.getTask(req.params.id);
        if (!task) return res.status(404).json({ error: 'Task not found' });
        res.json(task);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/tasks/:id', (req, res) => {
    try {
        const { title, description } = req.body;
        const task = TaskService.updateTask(req.params.id, title, description);
        if (!task) return res.status(404).json({ error: 'Task not found' });
        res.json(task);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/tasks/:id/state', (req, res) => {
    try {
        const { state_id } = req.body;
        if (!state_id) return res.status(400).json({ error: 'State ID is required' });
        const task = TaskService.updateTaskState(req.params.id, state_id);
        if (!task) return res.status(404).json({ error: 'Task not found' });
        res.json(task);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/tasks/:id', (req, res) => {
    try {
        const success = TaskService.deleteTask(req.params.id);
        if (!success) return res.status(404).json({ error: 'Task not found' });
        res.status(204).send();
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Task Comments ---

router.get('/tasks/:id/comments', (req, res) => {
    try {
        const comments = TaskService.getTaskComments(req.params.id);
        res.json(comments);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/tasks/:id/comments', (req, res) => {
    try {
        const { agent_id, content } = req.body;
        if (!agent_id || !content) return res.status(400).json({ error: 'Agent ID and content are required' });
        const comment = TaskService.addTaskComment(req.params.id, agent_id, content);
        res.status(201).json(comment);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
