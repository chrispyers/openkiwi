import cron from 'node-cron';
import path from 'node:path';
import fs from 'node:fs';
import { AgentManager, Agent } from './agent-manager.js';
import { loadConfig } from './config-manager.js';
import { streamChatCompletion } from './llm-provider.js';
import { ToolManager } from './tool-manager.js';
import { logger } from './logger.js';

export class HeartbeatManager {
    private static jobs: Map<string, any> = new Map();

    static async start() {
        console.log('💓 Heartbeat Manager: Initializing...');
        this.stopAll();

        const agentIds = AgentManager.listAgents();
        for (const id of agentIds) {
            const agent = AgentManager.getAgent(id);
            if (agent && agent.heartbeat && agent.heartbeat.enabled && agent.heartbeat.schedule) {
                this.scheduleHeartbeat(agent);
            }
        }
        console.log(`💓 Heartbeat Manager: Scheduled ${this.jobs.size} agents.`);
    }

    static stopAll() {
        this.jobs.forEach(job => job.stop());
        this.jobs.clear();
    }

    static refreshAgent(agentId: string) {
        // Stop existing job if any
        if (this.jobs.has(agentId)) {
            this.jobs.get(agentId).stop();
            this.jobs.delete(agentId);
            console.log(`💓 Heartbeat Manager: Stopped existing job for ${agentId}`);
        }

        // Get updated agent config
        const agent = AgentManager.getAgent(agentId);
        if (agent && agent.heartbeat && agent.heartbeat.enabled && agent.heartbeat.schedule) {
            this.scheduleHeartbeat(agent);
        }
    }

    private static scheduleHeartbeat(agent: Agent) {
        if (!agent.heartbeat?.schedule) return;

        try {
            // Validate cron expression
            if (!cron.validate(agent.heartbeat.schedule)) {
                console.error(`❌ Invalid cron schedule for agent ${agent.name}: ${agent.heartbeat.schedule}`);
                return;
            }

            const job = cron.schedule(agent.heartbeat.schedule, () => {
                this.executeHeartbeat(agent.id);
            });

            this.jobs.set(agent.id, job);
            console.log(`✅ Scheduled heartbeat for ${agent.name} (${agent.heartbeat.schedule})`);
        } catch (error) {
            console.error(`❌ Failed to schedule heartbeat for ${agent.name}:`, error);
        }
    }

    private static async executeHeartbeat(agentId: string) {
        const agent = AgentManager.getAgent(agentId);
        if (!agent) return;

        console.log(`💓 Executing heartbeat for ${agent.name}...`);

        // Load HEARTBEAT.md
        const heartbeatPath = path.join(agent.path, 'HEARTBEAT.md');
        if (!fs.existsSync(heartbeatPath)) {
            console.warn(`⚠️ No HEARTBEAT.md found for ${agent.name}, skipping.`);
            return;
        }

        const heartbeatContent = fs.readFileSync(heartbeatPath, 'utf-8');
        if (!heartbeatContent.trim()) {
            console.warn(`⚠️ Empty HEARTBEAT.md for ${agent.name}, skipping.`);
            return;
        }

        // Prepare LLM Request
        const currentConfig = loadConfig();
        const providerName = agent.provider;
        let providerConfig = currentConfig.providers.find(p => p.model === providerName || p.description === providerName);

        if (!providerConfig && currentConfig.providers.length > 0) {
            providerConfig = currentConfig.providers[0];
        }

        if (!providerConfig) {
            console.error(`❌ No provider available for ${agent.name} heartbeat.`);
            return;
        }

        const llmConfig = {
            baseUrl: providerConfig.endpoint,
            modelId: providerConfig.model
        };

        const messages: { role: string; content: string | null; tool_calls?: any[]; tool_call_id?: string; name?: string }[] = [
            { role: 'system', content: agent.systemPrompt },
            {
                role: 'user',
                content: `SYSTEM WAKEUP CALL: It is time to process your HEARTBEAT instructions.
                
# INSTRUCTIONS
${heartbeatContent}

Please execute these instructions now.
`
            }
        ];

        // Execute Loop
        try {
            let toolLoop = true;
            let iterations = 0;
            const MAX_ITERATIONS = 10; // Prevent infinite loops

            while (toolLoop && iterations < MAX_ITERATIONS) {
                iterations++;
                let fullContent = '';
                let toolCalls: any[] = [];

                // Call LLM
                for await (const delta of streamChatCompletion(llmConfig, messages, ToolManager.getToolDefinitions())) {
                    if (delta.content) fullContent += delta.content;
                    if (delta.tool_calls) {
                        for (const toolCall of delta.tool_calls) {
                            if (!toolCalls[toolCall.index]) {
                                toolCalls[toolCall.index] = toolCall;
                            } else {
                                if (toolCall.function?.arguments) {
                                    toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
                                }
                            }
                        }
                    }
                }

                const actualToolCalls = toolCalls.filter(Boolean);

                if (actualToolCalls.length > 0) {
                    messages.push({ role: 'assistant', content: fullContent || null, tool_calls: actualToolCalls });

                    for (const toolCall of actualToolCalls) {
                        const name = toolCall.function.name;
                        const args = JSON.parse(toolCall.function.arguments || '{}');

                        logger.log({
                            type: 'tool',
                            level: 'info',
                            agentId: agent.id,
                            sessionId: 'heartbeat',
                            message: `[Heartbeat] Tool executed: ${name}`,
                            data: { name, args }
                        });

                        try {
                            const result = await ToolManager.callTool(name, args, { agentId: agent.id });
                            messages.push({
                                role: 'tool',
                                tool_call_id: toolCall.id,
                                name: name,
                                content: JSON.stringify(result)
                            });
                        } catch (err) {
                            console.error(`[Heartbeat] Tool error ${name}:`, err);
                            messages.push({
                                role: 'tool',
                                tool_call_id: toolCall.id,
                                name: name,
                                content: JSON.stringify({ error: String(err) })
                            });
                        }
                    }
                } else {
                    toolLoop = false;
                    logger.log({
                        type: 'response',
                        level: 'info',
                        agentId: agent.id,
                        sessionId: 'heartbeat',
                        message: `[Heartbeat] Completed execution`,
                        data: fullContent
                    });
                    console.log(`💓 Heartbeat finished for ${agent.name}:`, fullContent.substring(0, 100) + '...');
                }
            }
        } catch (error) {
            console.error(`❌ Error during heartbeat execution for ${agent.name}:`, error);
        }
    }
}
