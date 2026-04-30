import crypto from 'node:crypto';
import { AgentManager } from '../agent-manager.js';
import { loadConfig } from '../config-manager.js';
import { runAgentLoop } from '../agent-loop.js';
import { ToolManager } from '../tool-manager.js';
import { Scratchpad } from '../services/scratchpad.js';
import { broadcastMessage } from '../state.js';
import { logger } from '../logger.js';

/**
 * Resolve the LLM provider config for a given agent, falling back to the
 * first global provider. Returns null if nothing is available.
 */
function resolveProvider(agentProvider?: string) {
    const config = loadConfig();
    let providerConfig = config.providers.find(
        (p: any) => p.model === agentProvider || p.description === agentProvider
    );
    if (!providerConfig && config.providers.length > 0) {
        providerConfig = config.providers[0];
    }
    return providerConfig || null;
}

// ── delegate_to_agent ─────────────────────────────────────────────

export const delegate_to_agent = {
    definition: {
        name: 'delegate_to_agent',
        displayName: 'Delegate Task to Agent',
        pluginType: 'skill',
        description:
            'Delegate a task to another agent. The target agent runs its own LLM loop with its own ' +
            'persona and provider. Use wait:false for parallel execution (fire-and-forget), then call ' +
            'wait_for_agents to collect results. Use wait:true (default) for sequential delegation.',
        parameters: {
            type: 'object',
            properties: {
                agent_id: {
                    type: 'string',
                    description: 'The ID of the agent to delegate to.',
                },
                task: {
                    type: 'string',
                    description: 'A clear description of what the agent should accomplish.',
                },
                run_id: {
                    type: 'string',
                    description:
                        'Shared run ID for scratchpad access. If omitted, one will be generated. ' +
                        'Pass the same run_id to all agents that need to share data.',
                },
                wait: {
                    type: 'boolean',
                    description:
                        'If true (default), block until the agent finishes and return its response. ' +
                        'If false, start the agent in the background and return immediately — use ' +
                        'wait_for_agents later to collect results.',
                },
                timeout_ms: {
                    type: 'number',
                    description: 'Max time in ms to wait for the agent (only when wait:true). Default: 300000 (5 min).',
                },
            },
            required: ['agent_id', 'task'],
        },
    },
    handler: async ({
        agent_id,
        task,
        run_id,
        wait = true,
        timeout_ms = 300_000,
        _context,
    }: {
        agent_id: string;
        task: string;
        run_id?: string;
        wait?: boolean;
        timeout_ms?: number;
        _context?: { agentId: string; sessionId?: string };
    }) => {
        if (!_context?.agentId) return { error: 'Agent context required' };

        const agent = AgentManager.getAgent(agent_id);
        if (!agent) {
            const available = AgentManager.listAgents().join(', ');
            return { error: `Agent "${agent_id}" not found. Available agents: ${available || 'none'}` };
        }

        const providerConfig = resolveProvider(agent.provider);
        if (!providerConfig) {
            return { error: `No LLM provider available for agent "${agent_id}"` };
        }

        const effectiveRunId = run_id || crypto.randomUUID();
        const delegationSessionId = `delegation-${effectiveRunId}-${agent_id}-${Date.now()}`;

        const llmConfig = {
            baseUrl: providerConfig.endpoint,
            modelId: providerConfig.model,
            apiKey: providerConfig.apiKey,
            maxTokens: providerConfig.maxTokens,
            supportsTools: !!providerConfig?.capabilities?.trained_for_tool_use,
        };

        // Build system prompt: agent persona + scratchpad instructions
        const scratchpadInstructions =
            `\n\n## Multi-Agent Collaboration\n` +
            `You are working as part of a multi-agent team. Your run ID is: ${effectiveRunId}\n\n` +
            `You have access to a shared scratchpad:\n` +
            `- Use \`scratchpad_write\` to share your findings with other agents.\n` +
            `- Use \`scratchpad_read\` to see what other agents have found so far.\n` +
            `- Always write your final results to the scratchpad before finishing.\n` +
            `- The run_id for all scratchpad calls is: "${effectiveRunId}"\n`;

        const systemPrompt = (agent.systemPrompt || `You are ${agent.name}, a helpful AI assistant.`) + scratchpadInstructions;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: task },
        ];

        logger.log({
            type: 'system',
            level: 'info',
            agentId: _context.agentId,
            message: `Delegating to "${agent_id}": ${task.slice(0, 100)}...`,
            data: { run_id: effectiveRunId, wait, target: agent_id },
        });

        broadcastMessage({
            type: 'agent_status_update',
            agentId: agent_id,
            status: 'working',
            details: `Delegated task: ${task.slice(0, 80)}`,
        });

        const agentPromise = runAgentLoop({
            agentId: agent_id,
            sessionId: delegationSessionId,
            llmConfig,
            messages,
            maxLoops: agent?.maxLoops || 100,
            visionEnabled: !!providerConfig?.capabilities?.vision,
        }).then(result => {
            broadcastMessage({
                type: 'agent_status_update',
                agentId: agent_id,
                status: 'idle',
            });
            return {
                agent_id,
                response: result.finalResponse,
                usage: result.usage,
            };
        }).catch(err => {
            broadcastMessage({
                type: 'agent_status_update',
                agentId: agent_id,
                status: 'idle',
            });
            return {
                agent_id,
                error: err.message,
            };
        });

        if (wait) {
            // Synchronous delegation — block until done or timeout
            try {
                const result = await Promise.race([
                    agentPromise,
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error(`Agent "${agent_id}" timed out after ${timeout_ms}ms`)), timeout_ms)
                    ),
                ]);
                return { ...result, run_id: effectiveRunId };
            } catch (err: any) {
                return { agent_id, run_id: effectiveRunId, error: err.message };
            }
        } else {
            // Async delegation — track and return immediately
            Scratchpad.trackAgent(effectiveRunId, agent_id, agentPromise);
            return {
                agent_id,
                run_id: effectiveRunId,
                status: 'started',
                message: `Agent "${agent_id}" is now working in the background. Use wait_for_agents with run_id "${effectiveRunId}" to collect results.`,
            };
        }
    },
};

// ── wait_for_agents ───────────────────────────────────────────────

export const wait_for_agents = {
    definition: {
        name: 'wait_for_agents',
        displayName: 'Wait for Delegated Agents',
        pluginType: 'skill',
        description:
            'Wait for one or more delegated agents to finish their work. ' +
            'Call this after launching agents with delegate_to_agent(wait:false). ' +
            'Returns each agent\'s final response.',
        parameters: {
            type: 'object',
            properties: {
                run_id: {
                    type: 'string',
                    description: 'The shared run ID used when delegating.',
                },
                agent_ids: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional: specific agent IDs to wait for. If omitted, waits for all agents on this run.',
                },
                timeout_ms: {
                    type: 'number',
                    description: 'Max time in ms to wait. Default: 300000 (5 min).',
                },
            },
            required: ['run_id'],
        },
    },
    handler: async ({
        run_id,
        agent_ids,
        timeout_ms = 300_000,
        _context,
    }: {
        run_id: string;
        agent_ids?: string[];
        timeout_ms?: number;
        _context?: { agentId: string };
    }) => {
        if (!_context?.agentId) return { error: 'Agent context required' };
        if (!run_id) return { error: 'run_id is required' };

        logger.log({
            type: 'system',
            level: 'info',
            agentId: _context.agentId,
            message: `Waiting for agents on run ${run_id}`,
            data: { agent_ids, timeout_ms },
        });

        const results = await Scratchpad.waitForAgents(run_id, agent_ids, timeout_ms);

        const summary = Object.entries(results).map(([id, r]) => ({
            agent_id: id,
            success: r.success,
            response: r.result?.response,
            error: r.error,
            usage: r.result?.usage,
        }));

        // Also include any scratchpad entries these agents wrote
        const scratchpadEntries = Scratchpad.read(run_id);

        return {
            run_id,
            agents_completed: summary.length,
            results: summary,
            scratchpad_entries: scratchpadEntries.length,
            scratchpad: scratchpadEntries.map(e => ({
                agent: e.agentId,
                label: e.label,
                status: e.status,
                data: e.data,
            })),
        };
    },
};
