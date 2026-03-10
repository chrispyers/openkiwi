import { WorkflowService } from './workflow-service.js';
import { AgentManager } from '../agent-manager.js';
import { loadConfig } from '../config-manager.js';
import { runAgentLoop } from '../agent-loop.js';

export interface WorkflowExecutionResult {
    success: boolean;
    finalResponse: string;
    error?: string;
}

export async function executeWorkflow(workflowId: string, agentId: string): Promise<WorkflowExecutionResult> {
    const workflow = WorkflowService.getWorkflow(workflowId);
    if (!workflow) return { success: false, finalResponse: '', error: 'Workflow not found' };

    const states = WorkflowService.getWorkflowStates(workflowId);
    if (states.length === 0) return { success: false, finalResponse: '', error: 'Workflow has no steps configured' };

    const agent = AgentManager.getAgent(agentId);
    if (!agent) return { success: false, finalResponse: '', error: `Agent "${agentId}" not found` };

    const currentConfig = loadConfig();
    let providerConfig = currentConfig.providers.find(p => p.model === agent.provider || p.description === agent.provider);
    if (!providerConfig && currentConfig.providers.length > 0) {
        providerConfig = currentConfig.providers[0];
    }
    if (!providerConfig) return { success: false, finalResponse: '', error: 'No LLM provider available' };

    const llmConfig = {
        baseUrl: providerConfig.endpoint,
        modelId: providerConfig.model,
        apiKey: providerConfig.apiKey,
        supportsTools: !!providerConfig?.capabilities?.trained_for_tool_use
    };

    const stepDescriptions = states.map((state, i) => {
        let toolId = 'unknown';
        let stepPrompt = state.instructions ?? '';
        try {
            const parsed = JSON.parse(state.instructions ?? '');
            if (parsed.tool_id) toolId = parsed.tool_id;
            if (parsed.prompt !== undefined) stepPrompt = parsed.prompt;
        } catch {
            // instructions is plain text, treat as prompt
        }
        return `STEP ${i + 1}: ${state.name}\nTool: ${toolId}\nInstructions: ${stepPrompt || '(no specific instructions provided)'}`;
    }).join('\n\n');

    const prompt = `You are executing a workflow named "${workflow.name}"${workflow.description ? ` — ${workflow.description}` : ''}.

Execute the following steps IN ORDER. Each step specifies which tool to use and what to do. Pass the relevant output from each step as input to the next step where needed.

${stepDescriptions}

Execute all steps now using the specified tools. After completing all steps, provide a brief summary of what was accomplished.`;

    try {
        const { finalResponse } = await runAgentLoop({
            agentId,
            sessionId: `workflow-${workflowId}-${Date.now()}`,
            llmConfig,
            messages: [
                { role: 'system', content: agent.systemPrompt },
                { role: 'user', content: prompt }
            ],
            maxLoops: states.length * 5,
            signToolUrls: false,
            agentToolsConfig: agent.tools
        });
        return { success: true, finalResponse };
    } catch (error: any) {
        return { success: false, finalResponse: '', error: error.message };
    }
}
