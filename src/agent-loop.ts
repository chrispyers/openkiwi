import { ToolManager } from './tool-manager.js';
import { streamChatCompletion, getChatCompletion } from './llm-provider.js';
import { loadConfig } from './config-manager.js';
import { logger } from './logger.js';
import { signUrl } from './security.js';
import { processVisionMessages } from './vision.js';
import { AgentManager } from './agent-manager.js';

// --- Context Window Management (Compaction) ---

/**
 * Rough token estimate: ~4 chars per token for English text.
 * This is intentionally conservative — better to compact early than overflow.
 */
function estimateTokens(messages: any[]): number {
    let totalChars = 0;
    for (const msg of messages) {
        if (typeof msg.content === 'string') {
            totalChars += msg.content.length;
        } else if (Array.isArray(msg.content)) {
            for (const part of msg.content) {
                if (part.text) totalChars += part.text.length;
                else if (part.content) totalChars += part.content.length;
            }
        }
        if (msg.tool_calls) {
            totalChars += JSON.stringify(msg.tool_calls).length;
        }
    }
    return Math.ceil(totalChars / 4);
}

/**
 * Determines if compaction is needed based on context usage.
 * Uses lastPromptTokens (actual reported usage from LLM) when available,
 * falls back to character-based estimation.
 * Triggers compaction at 80% of context capacity.
 */
function shouldCompact(messages: any[], maxContextLength: number | undefined, lastPromptTokens: number): boolean {
    if (!maxContextLength) return false;
    const threshold = maxContextLength * 0.80;

    // Prefer actual token count from the LLM if available
    if (lastPromptTokens > 0) {
        return lastPromptTokens >= threshold;
    }

    // Fall back to estimation
    return estimateTokens(messages) >= threshold;
}

/**
 * Compacts chat history by summarizing older messages via an LLM call.
 * Preserves: system prompt, first user message, and recent messages.
 * Replaces everything in between with a concise summary.
 */
async function compactMessages(
    chatHistory: any[],
    llmConfig: any,
    agentId: string,
    sessionId: string,
    onDelta?: (content: string) => void,
): Promise<void> {
    // Find boundaries: system messages, first user message, and recent tail
    const systemMessages: any[] = [];
    let firstUserIdx = -1;
    for (let i = 0; i < chatHistory.length; i++) {
        if (chatHistory[i].role === 'system') {
            systemMessages.push(i);
        } else if (chatHistory[i].role === 'user' && firstUserIdx === -1) {
            firstUserIdx = i;
        }
    }

    // Keep last N messages as recent context (assistant + tool pairs)
    const KEEP_RECENT = 10;
    const recentStart = Math.max(firstUserIdx + 1, chatHistory.length - KEEP_RECENT);

    // If there's nothing meaningful to compact, skip
    if (recentStart <= firstUserIdx + 1) return;

    // Build the middle section to summarize
    const middleMessages = chatHistory.slice(firstUserIdx + 1, recentStart);
    if (middleMessages.length === 0) return;

    // Build a transcript of the middle section for summarization
    const transcript = middleMessages.map(msg => {
        if (msg.role === 'assistant' && msg.tool_calls) {
            const toolNames = msg.tool_calls.map((tc: any) => tc.function?.name || 'unknown').join(', ');
            const text = msg.content ? `${msg.content}\n` : '';
            return `ASSISTANT: ${text}[Called tools: ${toolNames}]`;
        }
        if (msg.role === 'tool') {
            // Truncate very long tool results in the summary input
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            const truncated = content.length > 500
                ? content.slice(0, 250) + '\n[...truncated...]\n' + content.slice(-250)
                : content;
            return `TOOL (${msg.name || 'unknown'}): ${truncated}`;
        }
        if (msg.role === 'user') {
            return `USER: ${msg.content}`;
        }
        return `${msg.role?.toUpperCase()}: ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}`;
    }).join('\n');

    // Cap the transcript size to avoid the summary call itself overflowing
    const MAX_SUMMARY_INPUT = 12000;
    const cappedTranscript = transcript.length > MAX_SUMMARY_INPUT
        ? transcript.slice(0, MAX_SUMMARY_INPUT) + '\n[...additional messages truncated...]'
        : transcript;

    logger.log({
        type: 'system',
        level: 'info',
        agentId,
        sessionId,
        message: `Compacting context: summarizing ${middleMessages.length} messages`,
        data: { middleCount: middleMessages.length, recentCount: chatHistory.length - recentStart }
    });

    // Notify the user that compaction is happening
    if (onDelta) {
        onDelta('\n\n*[Compacting context to free up space...]*\n\n');
    }

    try {
        const summaryResult = await getChatCompletion(llmConfig, [
            {
                role: 'system',
                content: 'You are a context summarizer. Produce a concise summary of the conversation so far. Focus on: what the user asked for, what has been accomplished, what files were created or modified, key decisions made, and what remains to be done. Be specific about file paths and concrete details. Do not include pleasantries. Output only the summary.'
            },
            {
                role: 'user',
                content: `Summarize this conversation excerpt:\n\n${cappedTranscript}`
            }
        ], { maxTokens: 1024 });

        let summary = summaryResult.content || '';
        // Strip thinking tags from reasoning models
        summary = summary.replace(/<(think|thought|reasoning)>[\s\S]*?<\/\1>/gi, '').trim();

        if (!summary) {
            logger.log({ type: 'system', level: 'warn', agentId, sessionId, message: 'Compaction produced empty summary, skipping' });
            return;
        }

        // Splice: remove middle messages and insert summary
        const summaryMessage = {
            role: 'user',
            content: `[CONTEXT COMPACTED — Summary of previous ${middleMessages.length} messages]\n\n${summary}\n\n[End of summary. Continue from where you left off. Do not repeat completed work.]`,
            timestamp: Math.floor(Date.now() / 1000)
        };

        // Replace middle with summary
        chatHistory.splice(firstUserIdx + 1, recentStart - (firstUserIdx + 1), summaryMessage);

        logger.log({
            type: 'system',
            level: 'info',
            agentId,
            sessionId,
            message: `Compaction complete: ${middleMessages.length} messages → 1 summary`,
            data: { newHistoryLength: chatHistory.length, estimatedTokens: estimateTokens(chatHistory) }
        });
    } catch (err) {
        logger.log({
            type: 'error',
            level: 'error',
            agentId,
            sessionId,
            message: `Compaction failed: ${err}`,
            data: { error: String(err) }
        });
        // Compaction failed — don't modify history, continue with what we have
    }
}

/**
 * Checks if an error indicates context window overflow.
 */
function isContextOverflowError(error: any): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    return (
        msg.includes('context') ||
        msg.includes('too long') ||
        msg.includes('maximum') ||
        msg.includes('exceeds') ||
        msg.includes('token limit') ||
        // LM Studio / vLLM / Ollama typically return 500 with these patterns
        (msg.includes('llm api error: 500') && !msg.includes('internal'))
    );
}

function getToolDetails(name: string, args: any): string {
    switch (name) {
        // Core filesystem tools
        case 'read':
            return `Reading ${args.path}...`;
        case 'write':
            return `Writing ${args.path}...`;
        case 'edit':
        case 'multi_edit':
            return `Editing ${args.path}...`;
        case 'ls':
            return `Listing ${args.path || 'directory'}...`;
        case 'glob':
            return `Searching for ${args.pattern}...`;
        case 'grep':
            return `Searching for "${args.pattern}"...`;
        case 'file_manager':
            return `${args.action ? args.action.charAt(0).toUpperCase() + args.action.slice(1) : 'Operating on'} ${args.path}...`;
        // Core system tools
        case 'bash':
            return `Running command...`;
        case 'web_fetch':
            return `Fetching ${args.url || 'URL'}...`;
        case 'web_search':
            return `Searching for "${args.query}"...`;
        // Plugin tools
        case 'chromium':
            return `Browsing ${args.url || 'web'}...`;
        case 'git':
            return `Running git ${args.args?.split(' ')[0] || 'command'}...`;
        case 'security_scanner':
            return `Running ${args.scanner || 'security'} scan...`;
        case 'report_writer':
            return `Writing report to ${args.output_path || 'workspace'}...`;
        case 'curl':
            return `Calling ${args.url || 'API'}...`;
        case 'describe_image':
            return `Analyzing image...`;
        case 'memory_search':
            return `Searching memory for "${args.query}"...`;
        case 'memory_store':
            return `Storing memory...`;
        case 'ask_user':
            return `Asking for input...`;
        case 'finish_task':
            return `Finishing task...`;
        case 'delegate_to_agent':
            return `Delegating to ${args.agent_id || 'agent'}...`;
        case 'wait_for_agents':
            return `Waiting for delegated agents...`;
        case 'scratchpad_write':
            return `Writing "${args.label || 'data'}" to scratchpad...`;
        case 'scratchpad_read':
            return `Reading scratchpad...`;
        default:
            return `Using tool ${name}...`;
    }
}

export interface AgentLoopOptions {
    agentId: string;
    sessionId: string;
    llmConfig: any;
    messages: any[];
    visionEnabled?: boolean;
    maxLoops?: number;
    signToolUrls?: boolean;
    agentToolsConfig?: Record<string, any>;
    onDelta?: (content: string) => void;
    onUsage?: (usageStats: any) => void;
    onToolCall?: (toolCall: any) => void;
    onToolEnd?: (toolCallId: string, name: string, durationMs: number, success: boolean, result?: any) => void;
    onCompact?: () => void;
    /** Called when a tool requires approval. Returns true if approved, false if denied. */
    onToolApprovalRequest?: (toolCallId: string, name: string, args: any) => Promise<boolean>;
    abortSignal?: AbortSignal;
}

export interface AgentLoopResult {
    finalResponse: string;
    chatHistory: any[];
    usage: {
        completion_tokens: number;
        prompt_tokens: number;
        total_tokens: number;
    };
    lastPromptTokens: number;
    lastTps: number;
    yieldState?: any;
}

export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
    let toolLoop = true;
    let loopCount = 0;
    const maxLoops = options.maxLoops ?? 150;

    let finalAiResponse = '';
    let loopYieldState: any = undefined;
    const chatHistory = options.visionEnabled
        ? processVisionMessages([...options.messages], true)
        : [...options.messages];

    let totalUsage = { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 };
    let lastPromptTokens = 0; // Track the last call's prompt tokens (actual context size)
    let lastTps = 0;

    let repeatedToolCallsCount = 0;
    let lastToolCallFingerprint = '';
    let compactionRetries = 0;
    const MAX_COMPACTION_RETRIES = 2;

    while (toolLoop && loopCount < maxLoops) {
        loopCount++;
        let fullContent = '';
        let toolCalls: any[] = [];

        // --- Proactive compaction: check before each LLM call ---
        const maxCtx = options.llmConfig.maxContextLength;
        if (shouldCompact(chatHistory, maxCtx, lastPromptTokens)) {
            logger.log({
                type: 'system',
                level: 'info',
                agentId: options.agentId,
                sessionId: options.sessionId,
                message: `Context approaching limit (${lastPromptTokens || estimateTokens(chatHistory)} tokens / ${maxCtx} max), compacting...`
            });
            if (options.onCompact) options.onCompact();
            await compactMessages(chatHistory, options.llmConfig, options.agentId, options.sessionId, options.onDelta);
        }

        const processedHistory = options.visionEnabled
            ? processVisionMessages([...chatHistory], true)
            : chatHistory;

        let firstTokenTime = 0;
        const requestStartTime = Date.now();

        try {
            for await (const delta of streamChatCompletion(
                options.llmConfig,
                processedHistory,
                options.llmConfig.supportsTools ? ToolManager.getToolDefinitions() : undefined,
                options.abortSignal
            )) {
                if (delta.content) {
                    if (!firstTokenTime) firstTokenTime = Date.now();
                    fullContent += delta.content;
                    if (options.onDelta) {
                        options.onDelta(delta.content);
                    }
                }
                if (delta.tool_calls) {
                    for (const toolCall of delta.tool_calls) {
                        if (!toolCalls[toolCall.index]) {
                            toolCalls[toolCall.index] = { ...toolCall };
                            if (toolCall.function) {
                                toolCalls[toolCall.index].function = { ...toolCall.function };
                            } else {
                                toolCalls[toolCall.index].function = { name: '', arguments: '' };
                            }
                        } else {
                            if (toolCall.id) {
                                toolCalls[toolCall.index].id = toolCall.id;
                            }
                            if (toolCall.type) {
                                toolCalls[toolCall.index].type = toolCall.type;
                            }
                            if (toolCall.function) {
                                if (!toolCalls[toolCall.index].function) {
                                    toolCalls[toolCall.index].function = { name: '', arguments: '' };
                                }
                                if (toolCall.function.name) {
                                    toolCalls[toolCall.index].function.name = (toolCalls[toolCall.index].function.name || '') + toolCall.function.name;
                                }
                                if (toolCall.function.arguments) {
                                    toolCalls[toolCall.index].function.arguments = (toolCalls[toolCall.index].function.arguments || '') + toolCall.function.arguments;
                                }
                            }
                        }
                    }
                }
                if (delta.usage || delta.stats) {
                    const usage = delta.usage || {};
                    const stats = delta.stats || {};

                    const endTime = Date.now();
                    const durationSeconds = (endTime - (firstTokenTime || requestStartTime)) / 1000;
                    const completionTokens = usage.completion_tokens ?? usage.output_tokens ?? stats.total_output_tokens ?? 0;
                    const promptTokens = usage.prompt_tokens ?? usage.input_tokens ?? stats.input_tokens ?? 0;

                    let tps = stats.tokens_per_second ?? usage.tokens_per_second;
                    if (tps === undefined || tps === null) {
                        tps = durationSeconds > 0 ? (completionTokens / durationSeconds) : 0;
                    }

                    lastTps = parseFloat(tps.toFixed(1));
                    totalUsage.completion_tokens += completionTokens;
                    totalUsage.prompt_tokens += promptTokens;
                    totalUsage.total_tokens += (completionTokens + promptTokens);
                    // Track the last call's prompt tokens as the actual context size
                    if (promptTokens > 0) {
                        lastPromptTokens = promptTokens;
                    }

                    const usageStats = {
                        ...usage,
                        ...stats,
                        tps: lastTps,
                        duration: parseFloat(durationSeconds.toFixed(2))
                    };

                    logger.log({
                        type: 'usage',
                        level: 'info',
                        agentId: options.agentId,
                        sessionId: options.sessionId,
                        message: 'Token usage report',
                        data: usageStats
                    });

                    if (options.onUsage) {
                        options.onUsage(usageStats);
                    }
                }
            }
        } catch (error) {
            if (options.abortSignal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
                logger.log({
                    type: 'request',
                    level: 'info',
                    agentId: options.agentId,
                    sessionId: options.sessionId,
                    message: 'Generation aborted by client',
                    data: {}
                });
                // When aborted, we just stop the tool loop and proceed with what we have
                toolLoop = false;
            } else if (isContextOverflowError(error) && compactionRetries < MAX_COMPACTION_RETRIES) {
                // Context overflow — compact and retry
                compactionRetries++;
                logger.log({
                    type: 'system',
                    level: 'warn',
                    agentId: options.agentId,
                    sessionId: options.sessionId,
                    message: `Context overflow detected (attempt ${compactionRetries}/${MAX_COMPACTION_RETRIES}), compacting and retrying...`,
                    data: { error: String(error) }
                });
                if (options.onCompact) options.onCompact();
                await compactMessages(chatHistory, options.llmConfig, options.agentId, options.sessionId, options.onDelta);
                // Decrement loopCount so this retry doesn't count against the limit
                loopCount--;
                continue;
            } else {
                throw error;
            }
        }

        const actualToolCalls = toolCalls.filter(Boolean).map(tc => {
            const name = tc.function?.name;
            if (name) {
                const defs = ToolManager.getToolDefinitions();
                const toolDef = defs.find(d => d.name === name);

                // Be resilient to both 'pluginType' and 'type' property names
                const pType = toolDef?.pluginType || (toolDef as any)?.type || 'skill';

                return {
                    ...tc,
                    displayName: toolDef?.displayName || name,
                    pluginType: pType
                };
            }
            return tc;
        });

        const currentFingerprint = JSON.stringify(actualToolCalls.map(tc => ({ name: tc.function?.name, args: tc.function?.arguments })));
        if (actualToolCalls.length > 0 && currentFingerprint === lastToolCallFingerprint) {
            repeatedToolCallsCount++;
        } else {
            repeatedToolCallsCount = 0;
            if (actualToolCalls.length > 0) {
                lastToolCallFingerprint = currentFingerprint;
            } else {
                lastToolCallFingerprint = '';
            }
        }

        if (repeatedToolCallsCount >= 3) {
            const assistantMsg = {
                role: 'assistant',
                content: fullContent || '',
                tool_calls: actualToolCalls,
                timestamp: Math.floor(Date.now() / 1000)
            };
            chatHistory.push(assistantMsg);

            for (const toolCall of actualToolCalls) {
                chatHistory.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    name: toolCall.function?.name,
                    content: JSON.stringify({ error: "SYSTEM WARNING: You are stuck in a loop endlessly repeating the same action. You must reconsider your approach or use the 'ask_user' tool to request human guidance." }),
                    timestamp: Math.floor(Date.now() / 1000)
                });
            }
            logger.log({
                type: 'system',
                level: 'warn',
                agentId: options.agentId,
                sessionId: options.sessionId,
                message: 'Agent stuck in a loop. Interrupted with system warning.'
            });
            repeatedToolCallsCount = 0;
            continue;
        }

        if (actualToolCalls.length > 0) {
            const assistantMsg = {
                role: 'assistant',
                content: fullContent || '',
                tool_calls: actualToolCalls,
                timestamp: Math.floor(Date.now() / 1000)
            };
            chatHistory.push(assistantMsg);

            for (const toolCall of actualToolCalls) {
                // Stop executing tools if the agent was aborted between calls
                if (options.abortSignal?.aborted) {
                    toolLoop = false;
                    break;
                }

                const name = toolCall.function.name;
                let args: Record<string, unknown>;
                try {
                    args = JSON.parse(toolCall.function.arguments || '{}');
                } catch (parseErr: any) {
                    // Malformed JSON from the LLM — report it back as a tool error so the agent can self-correct
                    logger.log({ type: 'error', level: 'warn', agentId: options.agentId, sessionId: options.sessionId, message: `Skipping tool call '${name}': malformed JSON arguments`, data: { raw: toolCall.function.arguments?.substring(0, 200) } });
                    chatHistory.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name,
                        content: JSON.stringify({ error: `Invalid tool arguments (JSON parse failed): ${parseErr.message}. Please retry with valid JSON arguments.` }),
                        timestamp: Math.floor(Date.now() / 1000)
                    });
                    continue;
                }

                console.log(`[Tool Execution] Calling tool '${name}' with arguments:`, JSON.stringify(args, null, 2));

                // Check if tool requires approval
                const toolDefs = ToolManager.getToolDefinitions();
                const toolDef = toolDefs.find(d => d.name === name);
                if (toolDef?.requiresApproval && options.onToolApprovalRequest) {
                    try {
                        const approved = await options.onToolApprovalRequest(toolCall.id, name, args);
                        if (!approved) {
                            chatHistory.push({
                                role: 'tool',
                                tool_call_id: toolCall.id,
                                name,
                                content: JSON.stringify({ error: `Tool '${name}' was denied by the user. Try a different approach or use ask_user to discuss alternatives.` }),
                                timestamp: Math.floor(Date.now() / 1000)
                            });
                            continue;
                        }
                    } catch (approvalErr) {
                        // If approval mechanism fails (e.g. disconnected), deny by default
                        chatHistory.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            name,
                            content: JSON.stringify({ error: `Tool approval request failed: ${approvalErr}. Tool execution was blocked.` }),
                            timestamp: Math.floor(Date.now() / 1000)
                        });
                        continue;
                    }
                }

                try {
                    if (options.onToolCall) {
                        options.onToolCall(toolCall);
                    }

                    const prevState = AgentManager.getAgentState(options.agentId);
                    const details = getToolDetails(name, args);
                    AgentManager.setAgentState(options.agentId, 'working', details);

                    // Resolve per-tool config: agent config overrides global entirely
                    const globalToolsConfig = loadConfig().tools;
                    const toolConfig = options.agentToolsConfig?.[name] ?? globalToolsConfig?.[name];

                    let result;
                    const toolStartTime = Date.now();
                    let toolSucceeded = false;
                    try {
                        result = await ToolManager.callTool(name, args, { agentId: options.agentId, sessionId: options.sessionId, toolConfig, abortSignal: options.abortSignal });
                        toolSucceeded = true;
                    } catch (toolErr) {
                        result = { error: String(toolErr) };
                        throw toolErr;
                    } finally {
                        AgentManager.setAgentState(options.agentId, prevState.status, prevState.details);
                        if (options.onToolEnd) {
                            options.onToolEnd(toolCall.id, name, Date.now() - toolStartTime, toolSucceeded, result);
                        }
                    }

                    if (options.signToolUrls && result && typeof result === 'object') {
                        if (result.screenshot_url) result.screenshot_url = signUrl(result.screenshot_url);
                        if (result.image_url) result.image_url = signUrl(result.image_url);
                    }

                    // Check for special control signals
                    if (result && typeof result === 'object') {
                        if (result.__YIELD__) {
                            toolLoop = false;
                            loopYieldState = result;
                            break; // Do NOT push a tool result yet. Wait for human.
                        } else if (result.__STOP__) {
                            toolLoop = false;
                            const stopSummary = result.summary as string | undefined;
                            delete result.__STOP__;
                            // Surface the finish_task summary as a visible assistant message
                            if (stopSummary) {
                                finalAiResponse = stopSummary;
                                chatHistory.push({
                                    role: 'assistant',
                                    content: stopSummary,
                                    timestamp: Math.floor(Date.now() / 1000)
                                });
                            }
                        }
                    }

                    logger.log({
                        type: 'tool',
                        level: 'info',
                        agentId: options.agentId,
                        sessionId: options.sessionId,
                        message: `Tool executed: ${name}`,
                        data: { name, args, result }
                    });

                    chatHistory.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name: name,
                        content: JSON.stringify(result),
                        timestamp: Math.floor(Date.now() / 1000)
                    });

                    // Add protection against infinite loops here later if needed
                } catch (err) {
                    logger.log({
                        type: 'error',
                        level: 'error',
                        agentId: options.agentId,
                        sessionId: options.sessionId,
                        message: `Tool execution failed: ${name}`,
                        data: { name, args, error: String(err) }
                    });

                    chatHistory.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name: name,
                        content: JSON.stringify({ error: String(err) }),
                        timestamp: Math.floor(Date.now() / 1000)
                    });
                }
            }
        } else {
            // Final response with no more tool calls
            const assistantMsg = {
                role: 'assistant',
                content: fullContent || '',
                timestamp: Math.floor(Date.now() / 1000)
            };
            chatHistory.push(assistantMsg);
            finalAiResponse = fullContent;
            toolLoop = false;
        }
    }

    return {
        finalResponse: finalAiResponse,
        chatHistory: chatHistory,
        usage: totalUsage,
        lastPromptTokens: lastPromptTokens,
        lastTps: lastTps,
        yieldState: loopYieldState
    };
}
