import { WAMessage, areJidsSameUser } from '@whiskeysockets/baileys';
import { WhatsAppManager } from './whatsapp-manager.js';
import { AgentManager } from './agent-manager.js';
import { SessionManager } from './session-manager.js';
import { ToolManager } from './tool-manager.js';
import { streamChatCompletion } from './llm-provider.js';
import { logger } from './logger.js';
import { loadConfig } from './config-manager.js';
import { signUrl } from './security.js';
import { processVisionMessages } from './vision.js';
import { runAgentLoop } from './agent-loop.js';

/**
 * Extracts text content from various WhatsApp message types
 */
export function getMessageText(msg: WAMessage): string | null {
    if (!msg.message) return null;
    const content = msg.message;

    // Check for standard text types
    let text = content.conversation ||
        content.extendedTextMessage?.text ||
        content.ephemeralMessage?.message?.extendedTextMessage?.text ||
        content.ephemeralMessage?.message?.conversation ||
        content.viewOnceMessage?.message?.listMessage?.description ||
        content.viewOnceMessage?.message?.buttonsMessage?.contentText;

    return text || null;
}

/**
 * Initializes the WhatsApp message listener and handler logic
 */
export function initWhatsAppHandler() {
    WhatsAppManager.getInstance().on('message', async (msg: WAMessage) => {
        try {
            // Agent replies on WhatsApp are opt-in. Ingest happens via a separate
            // listener regardless; this gate only controls whether agents reply.
            const cfg = loadConfig() as any;
            if (cfg.tools?.whatsapp_ingest?.agentRepliesEnabled !== true) {
                return;
            }

            let remoteJid = msg.key.remoteJid;
            const text = getMessageText(msg);

            // Debug log to understand message structure if text is missing
            if (!text) {
                logger.log({
                    type: 'system',
                    level: 'debug',
                    message: `WhatsApp: Received message with no extractable text. Structure: ${JSON.stringify(msg.message).substring(0, 200)}...`
                });
                return;
            }

            if (!remoteJid) return;

            // Fix for LID: If the message is from me (Note to Self sent via phone) and comes as LID,
            // we should treat the chat session as being with the main phone number JID, not the LID.
            const { myJid, myLid } = WhatsAppManager.getInstance().getUserJids();

            // If it's a self-message, normalize remoteJid to myJid (Phone Number) if available
            if (msg.key.fromMe && myJid) {
                if (areJidsSameUser(remoteJid, myJid) || (myLid && areJidsSameUser(remoteJid, myLid))) {
                    remoteJid = myJid;
                }
            }

            logger.log({
                type: 'system',
                level: 'info',
                message: `WhatsApp message from ${remoteJid}: ${text}`
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

            const safeSessionId = `wa-${remoteJid.replace(/[^a-zA-Z0-9]/g, '_')}-${agentId}`;
            const agent = AgentManager.getAgent(agentId);
            if (!agent) {
                logger.log({ type: 'error', level: 'error', message: `WhatsApp: Could not find agent ${agentId}` });
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
                logger.log({ type: 'error', level: 'error', message: `WhatsApp: No provider found for agent ${agentId}. Provider name: ${providerName}` });
                await WhatsAppManager.getInstance().sendMessage(remoteJid, 'Error: No LLM provider configured.');
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
                message: `Processing WhatsApp message to ${agentId} using provider ${providerConfig.model}`
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
                maxLoops: 5,
                signToolUrls: true,
                agentToolsConfig: agent?.tools
            });

            if (finalAiResponse) {
                const cleanResponse = finalAiResponse.replace(/<(think|thought|reasoning)>[\s\S]*?<\/\1>/gi, '').trim();

                if (cleanResponse) {
                    await WhatsAppManager.getInstance().sendMessage(remoteJid, cleanResponse);
                }

                session.messages.push({
                    role: 'assistant',
                    content: finalAiResponse,
                    timestamp: Math.floor(Date.now() / 1000)
                });
                SessionManager.saveSession(session);
            }

        } catch (err) {
            logger.log({ type: 'error', level: 'error', message: `WhatsApp handler error: ${err}` });
        }
    });
}
