import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock dependencies ─────────────────────────────────────────────────────────

// Database mock (in-memory SQLite)
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
    `);
    return { collabDb: db };
});

// Agent manager mock
const mockGetAgent = vi.fn();
const mockGetAgentState = vi.fn().mockReturnValue({ status: 'idle', since: Date.now() });
const mockSetAgentState = vi.fn();

vi.mock('../../agent-manager.js', () => ({
    AgentManager: {
        getAgent: (...args: any[]) => mockGetAgent(...args),
        getAgentState: (...args: any[]) => mockGetAgentState(...args),
        setAgentState: (...args: any[]) => mockSetAgentState(...args),
    }
}));

// Tool manager mock
const mockGetToolDefinitions = vi.fn().mockReturnValue([
    { name: 'bash', description: 'Run commands', parameters: { type: 'object', properties: {} } },
    { name: 'glob', description: 'Search files', parameters: { type: 'object', properties: {} } },
    { name: 'ls', description: 'List directory', parameters: { type: 'object', properties: {} } },
]);
const mockCallTool = vi.fn();

vi.mock('../../tool-manager.js', () => ({
    ToolManager: {
        getToolDefinitions: () => mockGetToolDefinitions(),
        callTool: (...args: any[]) => mockCallTool(...args),
    }
}));

// Config manager mock
vi.mock('../../config-manager.js', () => ({
    loadConfig: () => ({
        providers: [
            {
                model: 'test-model',
                description: 'test-provider',
                endpoint: 'http://localhost:1234',
                apiKey: 'test-key',
                capabilities: { trained_for_tool_use: true },
            },
            {
                model: 'agent-specific-model',
                description: 'agent-provider',
                endpoint: 'http://localhost:5678',
                apiKey: 'agent-key',
                capabilities: { trained_for_tool_use: true },
            }
        ],
        tools: {},
    })
}));

// LLM provider mock
const mockStreamChatCompletion = vi.fn();
const mockGetChatCompletion = vi.fn();

vi.mock('../../llm-provider.js', () => ({
    streamChatCompletion: (...args: any[]) => mockStreamChatCompletion(...args),
    getChatCompletion: (...args: any[]) => mockGetChatCompletion(...args),
}));

// Agent loop mock
const mockRunAgentLoop = vi.fn();

vi.mock('../../agent-loop.js', () => ({
    runAgentLoop: (...args: any[]) => mockRunAgentLoop(...args),
}));

// Security mock
vi.mock('../../security.js', () => ({
    WORKSPACE_DIR: '/tmp/test-workspace',
}));

import { collabDb } from '../../db/collab-db.js';
import { WorkflowService } from '../../services/workflow-service.js';
import { executeWorkflow } from '../../services/workflow-executor.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function createTestAgent(id: string, provider: string = 'test-model') {
    return {
        id,
        name: `Test Agent ${id}`,
        path: `/agents/${id}`,
        memory: '',
        rules: '',
        heartbeatInstructions: '',
        systemPrompt: `You are test agent ${id}.`,
        provider,
        tools: { github: { repos: {} } },
    };
}

/** Create a streaming async iterator that immediately ends (no tool calls) */
function createEmptyStream() {
    return (async function* () {
        yield { content: 'Done.' };
    })();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Workflow Executor — Agent-as-Step', () => {
    const workflowAgentId = 'workflow-runner';
    const stepAgentId = 'research-agent';

    beforeEach(() => {
        collabDb.exec('DELETE FROM workflow_states; DELETE FROM workflows;');
        vi.clearAllMocks();

        // Default: workflow runner agent always found
        mockGetAgent.mockImplementation((id: string) => {
            if (id === workflowAgentId) return createTestAgent(workflowAgentId);
            if (id === stepAgentId) return createTestAgent(stepAgentId, 'agent-specific-model');
            return null;
        });

        // Default summary generation
        mockGetChatCompletion.mockResolvedValue({ content: 'Workflow completed successfully.' });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('detects agent step when assigned_agent_id is set and delegates to runAgentLoop', async () => {
        // Create workflow with an agent step
        const workflow = WorkflowService.createWorkflow('Agent Test', 'Test');
        WorkflowService.createWorkflowState(
            workflow.id,
            'Research Step',
            0,
            stepAgentId,  // assigned_agent_id
            false,
            JSON.stringify({ tool_id: 'agent', prompt: 'Research the topic' })
        );

        mockRunAgentLoop.mockResolvedValue({
            finalResponse: 'Research complete: found 5 sources.',
            chatHistory: [],
            usage: { completion_tokens: 100, prompt_tokens: 200, total_tokens: 300 },
            lastTps: 10,
        });

        const result = await executeWorkflow(workflow.id, workflowAgentId);

        expect(result.success).toBe(true);
        expect(mockRunAgentLoop).toHaveBeenCalledOnce();

        // Verify agent loop was called with the step agent's config
        const loopCall = mockRunAgentLoop.mock.calls[0][0];
        expect(loopCall.agentId).toBe(stepAgentId);
        expect(loopCall.agentToolsConfig).toEqual({ github: { repos: {} } });
        expect(loopCall.maxLoops).toBe(30);

        // Verify step result
        expect(result.stepResults).toHaveLength(1);
        expect(result.stepResults![0].toolId).toBe(`agent:${stepAgentId}`);
        expect(result.stepResults![0].result.response).toBe('Research complete: found 5 sources.');
    });

    it('returns error when assigned agent is not found', async () => {
        const workflow = WorkflowService.createWorkflow('Missing Agent', 'Test');
        WorkflowService.createWorkflowState(
            workflow.id,
            'Bad Step',
            0,
            'nonexistent-agent',
            false,
            JSON.stringify({ tool_id: 'agent', prompt: 'Do something' })
        );

        const result = await executeWorkflow(workflow.id, workflowAgentId);

        expect(result.success).toBe(false);
        expect(result.stepResults).toHaveLength(1);
        expect(result.stepResults![0].result.error).toContain('nonexistent-agent');
        expect(result.stepResults![0].result.error).toContain('not found');
        // runAgentLoop should NOT have been called
        expect(mockRunAgentLoop).not.toHaveBeenCalled();
    });

    it('uses the step agent\'s own LLM provider', async () => {
        const workflow = WorkflowService.createWorkflow('Provider Test', 'Test');
        WorkflowService.createWorkflowState(
            workflow.id,
            'Agent Step',
            0,
            stepAgentId,
            false,
            JSON.stringify({ prompt: 'Do research' })
        );

        mockRunAgentLoop.mockResolvedValue({
            finalResponse: 'Done.',
            chatHistory: [],
            usage: { completion_tokens: 50, prompt_tokens: 100, total_tokens: 150 },
            lastTps: 5,
        });

        await executeWorkflow(workflow.id, workflowAgentId);

        // The step agent has provider 'agent-specific-model', which maps to the second provider
        const loopCall = mockRunAgentLoop.mock.calls[0][0];
        expect(loopCall.llmConfig.modelId).toBe('agent-specific-model');
        expect(loopCall.llmConfig.baseUrl).toBe('http://localhost:5678');
    });

    it('passes prior context from completed steps to agent step', async () => {
        const workflow = WorkflowService.createWorkflow('Context Test', 'Test');

        // Step 1: a standard tool step
        WorkflowService.createWorkflowState(
            workflow.id,
            'Fetch Data',
            0,
            null,
            false,
            JSON.stringify({ tool_id: 'bash', prompt: 'echo hello' })
        );
        // Step 2: an agent step that should receive context from step 1
        WorkflowService.createWorkflowState(
            workflow.id,
            'Process Data',
            1,
            stepAgentId,
            false,
            JSON.stringify({ prompt: 'Analyse the data' })
        );

        // Step 1 tool execution: model makes one tool call then stops
        let streamCallCount = 0;
        mockStreamChatCompletion.mockImplementation(() => {
            streamCallCount++;
            if (streamCallCount === 1) {
                // First call: model makes a tool call
                return (async function* () {
                    yield {
                        tool_calls: [{
                            index: 0,
                            id: 'call_1',
                            type: 'function',
                            function: { name: 'bash', arguments: '{"command":"echo hello"}' }
                        }]
                    };
                })();
            }
            // Second call: model stops (no tool calls)
            return createEmptyStream();
        });

        mockCallTool.mockResolvedValue({ stdout: 'hello', success: true });

        mockRunAgentLoop.mockResolvedValue({
            finalResponse: 'Analysis complete.',
            chatHistory: [],
            usage: { completion_tokens: 50, prompt_tokens: 100, total_tokens: 150 },
            lastTps: 5,
        });

        await executeWorkflow(workflow.id, workflowAgentId);

        // Verify the agent step received prior context
        const loopCall = mockRunAgentLoop.mock.calls[0][0];
        const userMessage = loopCall.messages.find((m: any) => m.role === 'user');
        expect(userMessage.content).toContain('Completed steps so far');
        expect(userMessage.content).toContain('Fetch Data');
    });

    it('handles mixed workflow with tool steps and agent steps', async () => {
        const workflow = WorkflowService.createWorkflow('Mixed Workflow', 'Test');

        // Tool step
        WorkflowService.createWorkflowState(
            workflow.id,
            'Setup',
            0,
            null,
            false,
            JSON.stringify({ tool_id: 'bash', prompt: 'mkdir -p output' })
        );
        // Agent step
        WorkflowService.createWorkflowState(
            workflow.id,
            'Research',
            1,
            stepAgentId,
            false,
            JSON.stringify({ prompt: 'Research topic X' })
        );
        // Another tool step
        WorkflowService.createWorkflowState(
            workflow.id,
            'Cleanup',
            2,
            null,
            false,
            JSON.stringify({ tool_id: 'bash', prompt: 'rm -rf tmp' })
        );

        // Tool steps: model makes one call then stops
        let toolStreamCount = 0;
        mockStreamChatCompletion.mockImplementation(() => {
            toolStreamCount++;
            if (toolStreamCount % 2 === 1) {
                return (async function* () {
                    yield {
                        tool_calls: [{
                            index: 0,
                            id: `call_${toolStreamCount}`,
                            type: 'function',
                            function: { name: 'bash', arguments: '{"command":"test"}' }
                        }]
                    };
                })();
            }
            return createEmptyStream();
        });

        mockCallTool.mockResolvedValue({ success: true });

        mockRunAgentLoop.mockResolvedValue({
            finalResponse: 'Research done.',
            chatHistory: [],
            usage: { completion_tokens: 50, prompt_tokens: 100, total_tokens: 150 },
            lastTps: 5,
        });

        const result = await executeWorkflow(workflow.id, workflowAgentId);

        expect(result.stepResults).toHaveLength(3);
        expect(result.stepResults![0].toolId).toBe('bash');
        expect(result.stepResults![1].toolId).toBe(`agent:${stepAgentId}`);
        expect(result.stepResults![2].toolId).toBe('bash');
    });

    it('captures error when runAgentLoop throws', async () => {
        const workflow = WorkflowService.createWorkflow('Error Test', 'Test');
        WorkflowService.createWorkflowState(
            workflow.id,
            'Failing Step',
            0,
            stepAgentId,
            false,
            JSON.stringify({ prompt: 'This will fail' })
        );

        mockRunAgentLoop.mockRejectedValue(new Error('LLM connection timeout'));

        const result = await executeWorkflow(workflow.id, workflowAgentId);

        expect(result.success).toBe(false);
        expect(result.stepResults).toHaveLength(1);
        expect(result.stepResults![0].result.error).toContain('LLM connection timeout');
    });

    it('restores agent state after step completes', async () => {
        const workflow = WorkflowService.createWorkflow('State Test', 'Test');
        WorkflowService.createWorkflowState(
            workflow.id,
            'Agent Step',
            0,
            stepAgentId,
            false,
            JSON.stringify({ prompt: 'Do work' })
        );

        mockGetAgentState.mockReturnValue({ status: 'idle', details: undefined, since: Date.now() });

        mockRunAgentLoop.mockResolvedValue({
            finalResponse: 'Done.',
            chatHistory: [],
            usage: { completion_tokens: 50, prompt_tokens: 100, total_tokens: 150 },
            lastTps: 5,
        });

        await executeWorkflow(workflow.id, workflowAgentId);

        // Should have set state to 'working' then back to 'idle'
        expect(mockSetAgentState).toHaveBeenCalledWith(stepAgentId, 'working', 'Executing workflow step');
        expect(mockSetAgentState).toHaveBeenCalledWith(stepAgentId, 'idle', undefined);
    });

    it('restores agent state even when runAgentLoop throws', async () => {
        const workflow = WorkflowService.createWorkflow('State Recovery', 'Test');
        WorkflowService.createWorkflowState(
            workflow.id,
            'Crashing Step',
            0,
            stepAgentId,
            false,
            JSON.stringify({ prompt: 'Crash' })
        );

        mockGetAgentState.mockReturnValue({ status: 'chatting', details: 'In a conversation', since: Date.now() });
        mockRunAgentLoop.mockRejectedValue(new Error('Boom'));

        await executeWorkflow(workflow.id, workflowAgentId);

        // State should be restored to previous 'chatting' state
        expect(mockSetAgentState).toHaveBeenCalledWith(stepAgentId, 'chatting', 'In a conversation');
    });
});
