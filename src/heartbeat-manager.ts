import cron from 'node-cron';
import path from 'node:path';
import fs from 'node:fs';
import { AgentManager, Agent, HeartbeatChannel } from './agent-manager.js';
import { loadConfig } from './config-manager.js';
import { streamChatCompletion } from './llm-provider.js';
import { ToolManager } from './tool-manager.js';
import { logger } from './logger.js';
import { runAgentLoop } from './agent-loop.js';
import { SessionManager, Session } from './session-manager.js';
import { TelegramManager } from './telegram-manager.js';
import { WhatsAppManager } from './whatsapp-manager.js';
import { connectedClients } from './routes.js';

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
        const key = `${agentId}:heartbeat`;
        if (this.jobs.has(key)) {
            this.jobs.get(key).stop();
            this.jobs.delete(key);
            console.log(`💓 Heartbeat Manager: Stopped existing job for ${key}`);
        }

        // Get updated agent config
        const agent = AgentManager.getAgent(agentId);
        if (agent) {
            if (agent.heartbeat && agent.heartbeat.enabled && agent.heartbeat.schedule) {
                this.scheduleHeartbeat(agent, 'heartbeat');
            }
        }
    }

    private static scheduleHeartbeat(agent: Agent, type: 'heartbeat') {
        const schedule = agent.heartbeat?.schedule;
        if (!schedule) return;

        try {
            // Validate cron expression
            if (!cron.validate(schedule)) {
                console.error(`❌ Invalid cron schedule for agent ${agent.name} (${type}): ${schedule}`);
                return;
            }

            const job = cron.schedule(schedule, () => {
                this.executeHeartbeat(agent.id);
            });

            const key = `${agent.id}:${type}`;
            this.jobs.set(key, job);
            console.log(`✅ Scheduled ${type} for ${agent.name} (${schedule})`);
        } catch (error) {
            console.error(`❌ Failed to schedule ${type} for ${agent.name}:`, error);
        }
    }

    static async executeHeartbeat(agentId: string) {
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
                maxTokens: providerConfig.maxTokens,
                supportsTools: !!providerConfig?.capabilities?.trained_for_tool_use
            };

            const now = new Date();
            const currentTimestampUTC = now.toISOString();
            const currentTimestampLocal = now.toLocaleString(undefined, { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, dateStyle: 'full', timeStyle: 'long' });

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
                maxLoops: agent.heartbeat?.maxLoops || 10,
                signToolUrls: false,
                agentToolsConfig: agent.tools
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

            // Deliver to configured channels
            const channels = agent.heartbeat?.channels;
            if (channels && channels.length > 0 && contentToLog) {
                await this.deliverToChannels(agentId, agent, channels, contentToLog, fullContent);
            }
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

    private static async deliverToChannels(agentId: string, agent: Agent, channels: HeartbeatChannel[], cleanContent: string, rawContent: string) {
        for (const channel of channels) {
            try {
                switch (channel.type) {
                    case 'telegram':
                        await this.deliverToTelegram(agentId, channel.chatId, cleanContent, rawContent);
                        break;
                    case 'whatsapp':
                        await this.deliverToWhatsApp(agentId, channel.jid, cleanContent, rawContent);
                        break;
                    case 'websocket':
                        await this.deliverToWebSocket(agentId, cleanContent, rawContent);
                        break;
                    default:
                        logger.log({ type: 'system', level: 'warn', message: `[Heartbeat] Unknown channel type for ${agentId}: ${(channel as any).type}` });
                }
            } catch (err) {
                logger.log({ type: 'error', level: 'error', message: `[Heartbeat] Failed to deliver to ${channel.type} for ${agentId}`, data: err });
            }
        }
    }

    private static async deliverToTelegram(agentId: string, chatId: string, cleanContent: string, rawContent: string) {
        const tg = TelegramManager.getInstance();
        if (!tg.getStatus().connected) {
            logger.log({ type: 'system', level: 'warn', message: `[Heartbeat] Telegram not connected, skipping delivery for ${agentId}` });
            return;
        }

        const sessionId = `tg-${chatId}_${agentId}`;
        this.saveHeartbeatSession(agentId, sessionId, rawContent);

        await tg.sendMessage(chatId, cleanContent);
        logger.log({ type: 'system', level: 'info', message: `[Heartbeat] Delivered to Telegram chat ${chatId} for ${agentId}` });
    }

    private static async deliverToWhatsApp(agentId: string, jid: string, cleanContent: string, rawContent: string) {
        const wa = WhatsAppManager.getInstance();
        if (!wa.getStatus().connected) {
            logger.log({ type: 'system', level: 'warn', message: `[Heartbeat] WhatsApp not connected, skipping delivery for ${agentId}` });
            return;
        }

        const sanitizedJid = jid.replace(/[^a-zA-Z0-9]/g, '_');
        const sessionId = `wa-${sanitizedJid}-${agentId}`;
        this.saveHeartbeatSession(agentId, sessionId, rawContent);

        await wa.sendMessage(jid, cleanContent);
        logger.log({ type: 'system', level: 'info', message: `[Heartbeat] Delivered to WhatsApp ${jid} for ${agentId}` });
    }

    private static async deliverToWebSocket(agentId: string, cleanContent: string, rawContent: string) {
        const sessionId = `heartbeat-${agentId}-${Date.now()}`;
        this.saveHeartbeatSession(agentId, sessionId, rawContent);

        const payload = JSON.stringify({ type: 'heartbeat_message', agentId, sessionId, content: cleanContent });
        for (const [ws] of connectedClients) {
            try {
                ws.send(payload);
            } catch (err) {
                // Client may have disconnected
            }
        }
        logger.log({ type: 'system', level: 'info', message: `[Heartbeat] Broadcast to ${connectedClients.size} WebSocket client(s) for ${agentId}` });
    }

    private static saveHeartbeatSession(agentId: string, sessionId: string, rawContent: string) {
        let session = SessionManager.getSession(sessionId);
        if (!session) {
            session = {
                id: sessionId,
                agentId,
                title: 'Scheduled check-in',
                messages: [],
                updatedAt: Date.now()
            };
        }

        session.messages.push({
            role: 'user',
            content: '[Scheduled check-in]',
            timestamp: Date.now()
        });
        session.messages.push({
            role: 'assistant',
            content: rawContent,
            timestamp: Date.now()
        });

        SessionManager.saveSession(session);
    }
}
