import { ToolManager } from './tool-manager.js';
import { streamChatCompletion } from './llm-provider.js';
import { loadConfig } from './config-manager.js';
import { logger } from './logger.js';
import { signUrl } from './security.js';
import { processVisionMessages } from './vision.js';
import { AgentManager } from './agent-manager.js';

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
    onToolEnd?: (toolCallId: string, name: string, durationMs: number, success: boolean) => void;
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
    let lastTps = 0;

    let repeatedToolCallsCount = 0;
    let lastToolCallFingerprint = '';

    while (toolLoop && loopCount < maxLoops) {
        loopCount++;
        let fullContent = '';
        let toolCalls: any[] = [];

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
                    const completionTokens = usage.completion_tokens || usage.output_tokens || stats.total_output_tokens || 0;
                    const promptTokens = usage.prompt_tokens || usage.input_tokens || stats.input_tokens || 0;

                    let tps = stats.tokens_per_second || usage.tokens_per_second;
                    if (tps === undefined || tps === null) {
                        tps = durationSeconds > 0 ? (completionTokens / durationSeconds) : 0;
                    }

                    lastTps = parseFloat(tps.toFixed(1));
                    totalUsage.completion_tokens += completionTokens;
                    totalUsage.prompt_tokens += promptTokens;
                    totalUsage.total_tokens += (completionTokens + promptTokens);

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
                let args: any;
                try {
                    args = JSON.parse(toolCall.function.arguments || '{}');
                } catch (parseErr: any) {
                    // Malformed JSON from the LLM — report it back as a tool error so the agent can self-correct
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
                    } finally {
                        AgentManager.setAgentState(options.agentId, prevState.status, prevState.details);
                        if (options.onToolEnd) {
                            options.onToolEnd(toolCall.id, name, Date.now() - toolStartTime, toolSucceeded);
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
        lastTps: lastTps,
        yieldState: loopYieldState
    };
}
