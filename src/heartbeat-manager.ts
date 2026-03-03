import cron from 'node-cron';
import path from 'node:path';
import fs from 'node:fs';
import { AgentManager, Agent } from './agent-manager.js';
import { loadConfig } from './config-manager.js';
import { streamChatCompletion } from './llm-provider.js';
import { ToolManager } from './tool-manager.js';
import { logger } from './logger.js';
import { runAgentLoop } from './agent-loop.js';

export class HeartbeatManager {
    private static jobs: Map<string, any> = new Map();
    private static executingAgents: Set<string> = new Set();

    static async start() {
        console.log('💓 Heartbeat Manager: Initializing...');
        this.stopAll();

        const agentIds = AgentManager.listAgents();
        for (const id of agentIds) {
            const agent = AgentManager.getAgent(id);
            if (agent) {
                if (agent.heartbeat && agent.heartbeat.enabled && agent.heartbeat.schedule) {
                    this.scheduleHeartbeat(agent, 'heartbeat');
                }
                if (agent.collaboration && agent.collaboration.enabled && agent.collaboration.schedule) {
                    this.scheduleHeartbeat(agent, 'collaboration');
                }
            }
        }
        console.log(`💓 Heartbeat Manager: Scheduled ${this.jobs.size} agents.`);
    }

    static stopAll() {
        this.jobs.forEach(job => job.stop());
        this.jobs.clear();
    }

    static refreshAgent(agentId: string) {
        // Stop existing jobs if any
        ['heartbeat', 'collaboration'].forEach(type => {
            const key = `${agentId}:${type}`;
            if (this.jobs.has(key)) {
                this.jobs.get(key).stop();
                this.jobs.delete(key);
                console.log(`💓 Heartbeat Manager: Stopped existing job for ${key}`);
            }
        });

        // Get updated agent config
        const agent = AgentManager.getAgent(agentId);
        if (agent) {
            if (agent.heartbeat && agent.heartbeat.enabled && agent.heartbeat.schedule) {
                this.scheduleHeartbeat(agent, 'heartbeat');
            }
            if (agent.collaboration && agent.collaboration.enabled && agent.collaboration.schedule) {
                this.scheduleHeartbeat(agent, 'collaboration');
            }
        }
    }

    private static scheduleHeartbeat(agent: Agent, type: 'heartbeat' | 'collaboration') {
        const schedule = type === 'heartbeat' ? agent.heartbeat?.schedule : agent.collaboration?.schedule;
        if (!schedule) return;

        try {
            // Validate cron expression
            if (!cron.validate(schedule)) {
                console.error(`❌ Invalid cron schedule for agent ${agent.name} (${type}): ${schedule}`);
                return;
            }

            const job = cron.schedule(schedule, () => {
                if (type === 'heartbeat') {
                    this.executeHeartbeat(agent.id);
                } else {
                    this.executeCollaborationHeartbeat(agent.id);
                }
            });

            const key = `${agent.id}:${type}`;
            this.jobs.set(key, job);
            console.log(`✅ Scheduled ${type} for ${agent.name} (${schedule})`);
        } catch (error) {
            console.error(`❌ Failed to schedule ${type} for ${agent.name}:`, error);
        }
    }

    private static async executeHeartbeat(agentId: string) {
        const taskKey = `${agentId}:heartbeat`;
        if (this.executingAgents.has(taskKey)) {
            console.log(`⚠️ Heartbeat skipped for ${agentId}: Previous execution still running.`);
            return;
        }

        const agent = AgentManager.getAgent(agentId);
        if (!agent) return;

        this.executingAgents.add(taskKey);

        logger.log({
            type: 'system',
            level: 'info',
            agentId: agent.id,
            sessionId: 'heartbeat',
            message: '[Heartbeat] Session started',
            data: null
        });

        console.log(`💓 Executing heartbeat for ${agent.name}...`);

        try {
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
                modelId: providerConfig.model,
                apiKey: providerConfig.apiKey,
                supportsTools: !!providerConfig?.capabilities?.trained_for_tool_use
            };

            const now = new Date();
            const currentTimestampUTC = now.toISOString();
            const currentTimestampLocal = now.toLocaleString('en-US', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, dateStyle: 'full', timeStyle: 'long' });

            const messages: { role: string; content: string | null; tool_calls?: any[]; tool_call_id?: string; name?: string }[] = [
                { role: 'system', content: agent.systemPrompt },
                {
                    role: 'user',
                    content: `SYSTEM WAKEUP CALL: It is time to process your HEARTBEAT instructions.

# CURRENT TIME
- UTC: ${currentTimestampUTC}
- Local: ${currentTimestampLocal}
                
# INSTRUCTIONS
${heartbeatContent}

Please execute these instructions now.
`
                }
            ];

            // Execute Loop
            AgentManager.setAgentState(agent.id, 'working', 'Processing scheduled task');
            const { finalResponse: fullContent } = await runAgentLoop({
                agentId: agent.id,
                sessionId: 'heartbeat',
                llmConfig,
                messages: messages,
                maxLoops: 10,
                signToolUrls: false
            });

            // Parse thinking content
            let contentToLog = fullContent;
            let thinkingContent = '';

            const thinkStart = fullContent.indexOf('<think>');
            const thinkEnd = fullContent.indexOf('</think>');

            if (thinkStart !== -1) {
                if (thinkEnd !== -1) {
                    // Complete think block
                    thinkingContent = fullContent.substring(thinkStart + 7, thinkEnd).trim();
                    contentToLog = fullContent.substring(0, thinkStart) + fullContent.substring(thinkEnd + 8);
                } else {
                    // Incomplete think block (model forgot to close or was truncated)
                    // We treat everything after <think> as thinking content
                    thinkingContent = fullContent.substring(thinkStart + 7).trim();
                    contentToLog = fullContent.substring(0, thinkStart);
                }
            }
            contentToLog = contentToLog.trim();

            // Log reasoning if enabled and present
            if (thinkingContent && currentConfig.chat.showReasoning) {
                logger.log({
                    type: 'thinking',
                    level: 'info',
                    agentId: agent.id,
                    sessionId: 'heartbeat',
                    message: `[Heartbeat] Thinking process`,
                    data: thinkingContent
                });
            }

            // Log final response (cleaned or full depending on parsing)
            if (contentToLog) {
                logger.log({
                    type: 'response',
                    level: 'info',
                    agentId: agent.id,
                    sessionId: 'heartbeat',
                    message: `[Heartbeat] Completed execution`,
                    data: contentToLog
                });
            }
            console.log(`💓 Heartbeat finished for ${agent.name}:`, contentToLog.substring(0, 100) + '...');
        } catch (error) {
            console.error(`❌ Error during heartbeat execution for ${agent.name}:`, error);
        } finally {
            AgentManager.setAgentState(agent.id, 'idle');
            this.executingAgents.delete(`${agent.id}:heartbeat`);
            logger.log({
                type: 'system',
                level: 'info',
                agentId: agent.id,
                sessionId: 'heartbeat',
                message: '[Heartbeat] Session ended',
                data: null
            });
        }
    }

    private static async executeCollaborationHeartbeat(agentId: string) {
        const taskKey = `${agentId}:collaboration`;
        if (this.executingAgents.has(taskKey)) {
            console.log(`⚠️ Collaboration skipped for ${agentId}: Previous execution still running.`);
            return;
        }

        const agent = AgentManager.getAgent(agentId);
        if (!agent) return;

        this.executingAgents.add(taskKey);

        logger.log({
            type: 'system',
            level: 'info',
            agentId: agent.id,
            sessionId: 'collaboration',
            message: '[Collaboration] Session started',
            data: null
        });

        console.log(`🤝 Executing collaboration heartbeat for ${agent.name}...`);

        try {
            // Prepare LLM Request
            const currentConfig = loadConfig();
            const providerName = agent.provider;
            let providerConfig = currentConfig.providers.find(p => p.model === providerName || p.description === providerName);

            if (!providerConfig && currentConfig.providers.length > 0) {
                providerConfig = currentConfig.providers[0];
            }

            if (!providerConfig) {
                console.error(`❌ No provider available for ${agent.name} collaboration.`);
                return;
            }

            const llmConfig = {
                baseUrl: providerConfig.endpoint,
                modelId: providerConfig.model,
                apiKey: providerConfig.apiKey,
                supportsTools: !!providerConfig?.capabilities?.trained_for_tool_use
            };

            const now = new Date();
            const currentTimestampUTC = now.toISOString();
            const currentTimestampLocal = now.toLocaleString('en-US', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, dateStyle: 'full', timeStyle: 'long' });

            const messages: { role: string; content: string | null; tool_calls?: any[]; tool_call_id?: string; name?: string }[] = [
                { role: 'system', content: agent.systemPrompt },
                {
                    role: 'user',
                    content: `SYSTEM COLLABORATION CALL: It is time to process your assigned tasks and collaborate with other agents.

# CURRENT TIME
- UTC: ${currentTimestampUTC}
- Local: ${currentTimestampLocal}
                
# INSTRUCTIONS
You have been woken up to work on the Agent Collaboration System.
1. Use the \`get_assigned_tasks\` tool to check for tasks assigned to you.
2. If there are tasks, read them using \`read_task\`.
3. Perform the necessary work to progress the task, including researching, thinking, reading files, etc.
4. When you make progress, use \`add_task_comment\` to explain what you did and your feedback.
5. If the current workflow state is complete, use \`update_task_state\` to move the task to the next state according to the workflow.
6. If there are no assignments, or you are finished, just output a short status summary.
`
                }
            ];

            // Execute Loop
            AgentManager.setAgentState(agent.id, 'working', 'Processing collaboration tasks');
            const { finalResponse: fullContent } = await runAgentLoop({
                agentId: agent.id,
                sessionId: 'collaboration',
                llmConfig,
                messages: messages,
                maxLoops: 10,
                signToolUrls: false
            });

            // Parse thinking content
            let contentToLog = fullContent;
            let thinkingContent = '';

            const thinkStart = fullContent.indexOf('<think>');
            const thinkEnd = fullContent.indexOf('</think>');

            if (thinkStart !== -1) {
                if (thinkEnd !== -1) {
                    thinkingContent = fullContent.substring(thinkStart + 7, thinkEnd).trim();
                    contentToLog = fullContent.substring(0, thinkStart) + fullContent.substring(thinkEnd + 8);
                } else {
                    thinkingContent = fullContent.substring(thinkStart + 7).trim();
                    contentToLog = fullContent.substring(0, thinkStart);
                }
            }
            contentToLog = contentToLog.trim();

            if (thinkingContent && currentConfig.chat.showReasoning) {
                logger.log({
                    type: 'thinking',
                    level: 'info',
                    agentId: agent.id,
                    sessionId: 'collaboration',
                    message: `[Collaboration] Thinking process`,
                    data: thinkingContent
                });
            }

            if (contentToLog) {
                logger.log({
                    type: 'response',
                    level: 'info',
                    agentId: agent.id,
                    sessionId: 'collaboration',
                    message: `[Collaboration] Completed execution`,
                    data: contentToLog
                });
            }
            console.log(`🤝 Collaboration finished for ${agent.name}:`, contentToLog.substring(0, 100) + '...');
        } catch (error) {
            console.error(`❌ Error during collaboration execution for ${agent.name}:`, error);
        } finally {
            AgentManager.setAgentState(agent.id, 'idle');
            this.executingAgents.delete(taskKey);
            logger.log({
                type: 'system',
                level: 'info',
                agentId: agent.id,
                sessionId: 'collaboration',
                message: '[Collaboration] Session ended',
                data: null
            });
        }
    }
}
