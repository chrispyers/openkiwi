import express from 'express';
import { AgentManager } from '../agent-manager.js';
import { runAgentLoop } from '../agent-loop.js';

const router = express.Router();

// Endpoint to list all agents as models
router.get('/models', (req, res) => {
    try {
        const agentIds = AgentManager.listAgents();

        // Transform agents into OpenAI-compatible model objects
        const agents = agentIds.map(id => {
            const agent = AgentManager.getAgent(id);
            return {
                id: agent?.id || id,
                object: 'model',
                created: Math.floor(Date.now() / 1000),
                owned_by: 'openkiwi-agent',
                name: agent?.name || id.charAt(0).toUpperCase() + id.slice(1),
                description: `Agent: ${agent?.name || id}`
            };
        });

        res.json({ data: agents });
    } catch (error) {
        console.error('[Models] Error listing agents:', error);
        res.status(500).json({ error: 'Failed to retrieve agents' });
    }
});

// Endpoint for chat completions (non-streaming only)
router.post('/chat/completions', async (req, res) => {
    try {
        const { model, messages, stream, session_id } = req.body;

        // Validate required fields
        if (!model || !messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid request: model and messages array are required',
                    type: 'invalid_request_error',
                    param: null,
                    code: 'invalid_request_error'
                }
            });
        }

        // Get the agent by model ID
        const agent = AgentManager.getAgent(model);
        if (!agent) {
            return res.status(404).json({
                error: {
                    message: `Agent not found: ${model}`,
                    type: 'invalid_request_error',
                    param: 'model',
                    code: 'model_not_found'
                }
            });
        }

        // Build LLM config from agent's provider
        const { loadConfig } = await import('../config-manager.js');
        const currentConfig = loadConfig();
        
        // Resolve provider config from global config using agent's provider reference
        let providerConfig: any = {};
        if (agent.provider) {
            providerConfig = currentConfig.providers.find(
                (p: any) => p.model === agent.provider || p.description === agent.provider
            ) || {};
        }
        // Fallback to first provider if agent has no specific provider or lookup failed
        if (!providerConfig.endpoint && currentConfig.providers.length > 0) {
            providerConfig = currentConfig.providers[0];
        }
        
        const llmConfig = {
            baseUrl: providerConfig.endpoint,
            modelId: providerConfig.model,
            apiKey: providerConfig.apiKey,
            maxTokens: providerConfig.maxTokens,
            supportsTools: !!providerConfig?.capabilities?.trained_for_tool_use,
        };

        // Build payload with system prompt
        const payload: any[] = [];
        let systemPrompt = agent.systemPrompt || currentConfig.global?.systemPrompt || "You are a helpful AI assistant.";

        // Inject memory if available
        if (agent.path) {
            const { AgentManager: AM } = await import('../agent-manager.js');
            const freshMemory = AM.readFile(require('node:path').join(agent.path, 'MEMORY.md'));
            const sharedMemoryPath = require('node:path').resolve(process.cwd(), 'config', 'SHARED_MEMORY.md');
            const fs = await import('node:fs');
            const freshSharedMemory = fs.default.existsSync(sharedMemoryPath) ? fs.default.readFileSync(sharedMemoryPath, 'utf-8') : undefined;

            systemPrompt = systemPrompt.replace(
                /## Your Memory\n[\s\S]*?(?=\n## (?!Your Memory)|Whenever the user shares)/,
                freshMemory
                    ? `## Your Memory\nThe following is your long-term memory. Use this to recall facts about the user and past interactions without needing to search.\n\n${freshMemory}\n\n`
                    : ''
            );
            systemPrompt = systemPrompt.replace(
                /## Shared Memory \(all agents\)\n[\s\S]*?(?=\n## (?!Shared Memory)|Whenever the user shares)/,
                freshSharedMemory
                    ? `## Shared Memory (all agents)\nThe following memory is shared across all agents.\n\n${freshSharedMemory}\n\n`
                    : ''
            );
        }

        // Add time to system prompt
        const now = new Date();
        const timeString = now.toLocaleString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        });
        systemPrompt += `\n\n[Current Time: ${timeString}]`;

        payload.push({ role: 'system', content: systemPrompt });

        // Handle session persistence
        const sessionId = session_id || `openai-${Date.now()}`;
        const { SessionManager } = await import('../session-manager.js');
        
        // Load existing session or create new one
        let session = SessionManager.getSession(sessionId);
        if (!session) {
            session = {
                id: sessionId,
                agentId: agent.id,
                title: messages.find((m: any) => m.role === 'user')?.content?.slice(0, 30) + '...' || 'New Chat',
                messages: [],
                updatedAt: Date.now()
            };
        }

        // If session exists, use its history; otherwise use provided messages
        const conversationMessages = session && session.messages.length > 0
            ? [...session.messages, ...messages]
            : messages;

        // Filter out reasoning messages
        const validMessages = conversationMessages.filter((msg: any) => msg.role !== 'reasoning');
        payload.push(...validMessages);

        // Run agent loop
        const { runAgentLoop } = await import('../agent-loop.js');
        const result = await runAgentLoop({
            agentId: agent.id,
            sessionId,
            llmConfig,
            messages: payload,
            visionEnabled: !!providerConfig?.capabilities?.vision,
            maxLoops: agent.maxLoops || 100,
            signToolUrls: true,
            agentToolsConfig: agent.tools,
        });

        // Save session with updated messages
        const newGeneratedMessages = result.chatHistory.slice(payload.length);
        session.messages = [...conversationMessages, ...newGeneratedMessages];
        SessionManager.saveSession(session);

        // Calculate token counts from actual usage
        const promptTokens = result.usage.prompt_tokens;
        const completionTokens = result.usage.completion_tokens;

        // Return OpenAI-compatible response
        res.json({
            id: `chatcmpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: result.finalResponse
                    },
                    finish_reason: 'stop'
                }
            ],
            usage: {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: promptTokens + completionTokens
            }
        });
    } catch (error) {
        console.error('[Chat Completions] Error:', error);
        res.status(500).json({
            error: {
                message: error instanceof Error ? error.message : 'Internal server error',
                type: 'internal_error',
                param: null,
                code: 'internal_error'
            }
        });
    }
});

export default router;
