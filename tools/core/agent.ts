import { AgentManager } from '../../src/agent-manager.js';
import { runAgentLoop } from '../../src/agent-loop.js';
import { loadConfig } from '../../src/config-manager.js';

export default {
    definition: {
        name: 'agent',
        displayName: 'Sub-Agent Delegation',
        pluginType: 'tool',
        description: 'Delegates a task to a DIFFERENT named agent. Only use this to hand off work to a specific other agent by ID — do NOT use this to execute your own current task or when you already have the tools needed.',
        requiresApproval: false,
        parameters: {
            type: 'object',
            properties: {
                agentId: {
                    type: 'string',
                    description: 'The ID of the agent to delegate to (e.g. "luna")'
                },
                task: {
                    type: 'string',
                    description: 'The detailed task instructions for the sub-agent'
                }
            },
            required: ['agentId', 'task']
        }
    },
    handler: async ({ agentId, task, _context }: { agentId: string, task: string, _context?: any }) => {
        if (!agentId || !task) {
            return { error: 'Both agentId and task are required.' };
        }

        const agent = AgentManager.getAgent(agentId);
        if (!agent) {
            return { error: `Agent not found: ${agentId}. Available agents: ${AgentManager.listAgents().join(', ')}` };
        }

        try {
            const currentConfig = loadConfig();
            const providerName = agent.provider;
            let providerConfig = currentConfig.providers.find(p => p.model === providerName || p.description === providerName);

            if (!providerConfig && currentConfig.providers.length > 0) {
                providerConfig = currentConfig.providers[0];
            }

            if (!providerConfig) {
                return { error: 'No provider configured for sub-agent.' };
            }

            const llmConfig = {
                baseUrl: providerConfig.endpoint,
                modelId: providerConfig.model,
                apiKey: providerConfig.apiKey,
                supportsTools: !!providerConfig?.capabilities?.trained_for_tool_use
            };

            const messages = [
                { role: 'system', content: agent.systemPrompt },
                { role: 'user', content: `Task delegation from another agent:\n\n${task}` }
            ];

            const result = await runAgentLoop({
                agentId: agent.id,
                sessionId: _context?.sessionId || `sub-task-${Date.now()}`,
                llmConfig,
                messages,
                maxLoops: 10,
                signToolUrls: false,
                agentToolsConfig: agent.tools
            });

            return {
                success: true,
                subAgentResponse: result.finalResponse,
                loopsTaken: result.chatHistory.length
            };
        } catch (e: any) {
            return { error: `Sub-agent execution failed: ${e.message}` };
        }
    }
};
