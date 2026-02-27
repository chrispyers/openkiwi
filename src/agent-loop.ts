import { ToolManager } from './tool-manager.js';
import { streamChatCompletion } from './llm-provider.js';
import { logger } from './logger.js';
import { signUrl } from './security.js';
import { processVisionMessages } from './vision.js';

export interface AgentLoopOptions {
    agentId: string;
    sessionId: string;
    llmConfig: any;
    messages: any[];
    visionEnabled?: boolean;
    maxLoops?: number;
    signToolUrls?: boolean;
    onDelta?: (content: string) => void;
    onUsage?: (usageStats: any) => void;
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
}

export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
    let toolLoop = true;
    let loopCount = 0;
    const maxLoops = options.maxLoops || 5;

    let finalAiResponse = '';
    const chatHistory = options.visionEnabled
        ? processVisionMessages([...options.messages], true)
        : [...options.messages];

    let totalUsage = { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 };
    let lastTps = 0;

    while (toolLoop && loopCount < maxLoops) {
        loopCount++;
        let fullContent = '';
        let toolCalls: any[] = [];

        const processedHistory = options.visionEnabled
            ? processVisionMessages([...chatHistory], true)
            : chatHistory;

        let firstTokenTime = 0;
        const requestStartTime = Date.now();

        for await (const delta of streamChatCompletion(
            options.llmConfig,
            processedHistory,
            options.llmConfig.supportsTools ? ToolManager.getToolDefinitions() : undefined
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
                        toolCalls[toolCall.index] = toolCall;
                    } else {
                        if (toolCall.function?.arguments) {
                            toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
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

        const actualToolCalls = toolCalls.filter(Boolean);

        if (actualToolCalls.length > 0) {
            const assistantMsg = { role: 'assistant', content: fullContent || null, tool_calls: actualToolCalls };
            chatHistory.push(assistantMsg);

            for (const toolCall of actualToolCalls) {
                const name = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments || '{}');

                try {
                    let result = await ToolManager.callTool(name, args, { agentId: options.agentId });

                    if (options.signToolUrls && result && typeof result === 'object') {
                        if (result.screenshot_url) result.screenshot_url = signUrl(result.screenshot_url);
                        if (result.image_url) result.image_url = signUrl(result.image_url);
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
                        content: JSON.stringify(result)
                    });
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
                        content: JSON.stringify({ error: String(err) })
                    });
                }
            }
        } else {
            finalAiResponse = fullContent;
            toolLoop = false;
        }
    }

    return {
        finalResponse: finalAiResponse,
        chatHistory: chatHistory,
        usage: totalUsage,
        lastTps: lastTps
    };
}
