import { TelegramManager } from './telegram-manager.js';
import { AgentManager } from './agent-manager.js';
import { SessionManager } from './session-manager.js';
import { logger } from './logger.js';
import { loadConfig } from './config-manager.js';
import { runAgentLoop } from './agent-loop.js';
import { ToolManager } from './tool-manager.js';
import { streamChatCompletion } from './llm-provider.js';


interface TelegramMessage {
    chatId: string;
    userId: string;
    username?: string;
    text: string;
    messageId: number;
}

/**
 * Initializes the Telegram message listener and handler logic
 */
export function initTelegramHandler() {
    const telegram = TelegramManager.getInstance();

    // Handle /agents command
    telegram.on('command', async (cmd: { command: string; chatId: string }) => {
        if (cmd.command !== 'agents') return;
        try {
            const agentIds = AgentManager.listAgents();
            const agents = agentIds
                .map(id => AgentManager.getAgent(id))
                .filter(a => a !== null);

            if (agents.length === 0) {
                await TelegramManager.getInstance().sendMessage(cmd.chatId, 'No agents available.');
                return;
            }

            const lines = agents.map(a => `• @${a!.name}`);
            const reply = `Available agents:\n\n${lines.join('\n')}\n\nMention an agent by name to chat with them, e.g. @${agents[0]!.name} hello`;
            await TelegramManager.getInstance().sendMessage(cmd.chatId, reply);
        } catch (err) {
            logger.log({ type: 'error', level: 'error', message: `Telegram /agents command error: ${err}` });
        }
    });

    telegram.on('message', async (msg: TelegramMessage) => {
        try {
            const { chatId, userId, username, text } = msg;

            if (!text) return;

            logger.log({
                type: 'system',
                level: 'info',
                message: `Telegram message from ${username ? '@' + username : userId} (chat ${chatId}): ${text}`
            });

            // Check for agent targeting (e.g. "@luna Hello")
            const agentIds = AgentManager.listAgents();
            const agents = agentIds.map(id => AgentManager.getAgent(id)).filter(a => a !== null);

            let agentId = AgentManager.getDefaultAgentId() || 'assistant';
            let targetFound = false;

            // Build match candidates: full name, first word of name (e.g. "Themis" from "Themis (Umpire)"), and directory id
            // Sort by length desc to ensure we match "@Super Bot" before "@Super" if both exist
            const potentialMatches = agents.flatMap(agent => {
                const firstName = agent!.name.split(/[\s(]/)[0];
                const entries = [
                    { name: agent!.name, id: agent!.id, agent },
                    { name: agent!.id, id: agent!.id, agent }
                ];
                if (firstName.toLowerCase() !== agent!.name.toLowerCase() && firstName.toLowerCase() !== agent!.id.toLowerCase()) {
                    entries.push({ name: firstName, id: agent!.id, agent });
                }
                return entries;
            }).sort((a, b) => b.name.length - a.name.length);

            for (const match of potentialMatches) {
                const escaped = match.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const mentionRegex = new RegExp(`@${escaped}(?:[,.:;!?]?\\s+|[,.:;!?]?$)`, 'i');

                const regexMatch = text.match(mentionRegex);
                if (regexMatch) {
                    agentId = match.id;
                    targetFound = true;
                    break;
                }
            }

            let messageContent = text;
            if (targetFound) {
                // Strip the @mention (anywhere in the message) and surrounding whitespace
                const agent = AgentManager.getAgent(agentId);
                if (agent) {
                    const names = [agent.name, agent.name.split(/[\s(]/)[0], agent.id];
                    for (const name of names) {
                        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const stripRegex = new RegExp(`@${escaped}[,.:;!?]?\\s*`, 'ig');
                        messageContent = messageContent.replace(stripRegex, '');
                    }
                    messageContent = messageContent.trim();
                }
            }

            if (!targetFound) {
                agentId = AgentManager.getDefaultAgentId() || agentId;
            }

            const safeSessionId = `tg-${chatId}_${agentId}`;
            const agent = AgentManager.getAgent(agentId);
            if (!agent) {
                logger.log({ type: 'error', level: 'error', message: `Telegram: Could not find agent ${agentId}` });
                return;
            }

            const currentConfig = loadConfig();
            const providerName = agent?.provider;
            let providerConfig = currentConfig.providers.find(p => p.model === providerName || p.description === providerName);

            if (!providerConfig && currentConfig.providers.length > 0) {
                providerConfig = currentConfig.providers[0];
                logger.log({ type: 'system', level: 'warn', message: `Using default provider ${providerConfig.model} for agent ${agentId} because configured provider ${providerName} was not found.` });
            }

            if (!providerConfig) {
                logger.log({ type: 'error', level: 'error', message: `Telegram: No provider found for agent ${agentId}. Provider name: ${providerName}` });
                await TelegramManager.getInstance().sendMessage(chatId, 'Error: No LLM provider configured.');
                return;
            }

            const llmConfig = {
                baseUrl: providerConfig.endpoint,
                modelId: providerConfig.model,
                apiKey: providerConfig.apiKey,
                maxTokens: providerConfig.maxTokens,
                supportsTools: !!providerConfig?.capabilities?.trained_for_tool_use
            };

            logger.log({
                type: 'system',
                level: 'info',
                message: `Processing Telegram message to ${agentId} using provider ${providerConfig.model}`
            });

            // Load or Create Session
            let session = SessionManager.getSession(safeSessionId);
            if (!session) {
                session = {
                    id: safeSessionId,
                    agentId: agentId,
                    title: messageContent.slice(0, 30) + '...',
                    messages: [],
                    updatedAt: Date.now()
                };
            }

            // Add user message to session
            const timestamp = Math.floor(Date.now() / 1000);
            session.messages.push({
                role: 'user',
                content: messageContent,
                timestamp
            });
            SessionManager.saveSession(session);

            // Prepare prompt payload
            const payload: any[] = [];
            const systemPrompt = agent?.systemPrompt || currentConfig.global?.systemPrompt || "You are a helpful AI assistant.";
            if (systemPrompt) {
                payload.push({ role: 'system', content: systemPrompt });
            }

            const validMessages = session.messages.filter((msg: any) => msg.role !== 'reasoning');
            payload.push(...validMessages);

            const { finalResponse: finalAiResponse } = await runAgentLoop({
                agentId,
                sessionId: safeSessionId,
                llmConfig,
                messages: payload,
                visionEnabled: !!providerConfig?.capabilities?.vision,
                maxLoops: agent?.maxLoops || 100,
                signToolUrls: true,
                agentToolsConfig: agent?.tools
            });

            if (finalAiResponse) {
                const cleanResponse = finalAiResponse.replace(/<(think|thought|reasoning)>[\s\S]*?<\/\1>/gi, '').replace(/<think>[\s\S]*?<\/</think>>/gi, '.').trim();

                if (cleanResponse) {
                    await TelegramManager.getInstance().sendMessage(chatId, cleanResponse);
                }

                session.messages.push({
                    role: 'assistant',
                    content: finalAiResponse,
                    timestamp: Math.floor(Date.now() / 1000)
                });
                SessionManager.saveSession(session);
            }

        } catch (err) {
            logger.log({ type: 'error', level: 'error', message: `Telegram handler error: ${err}` });
        }
    });
}
