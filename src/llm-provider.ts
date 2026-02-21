
export interface LLMProviderConfig {
    baseUrl: string;
    modelId: string;
    apiKey?: string;
}

/**
 * Determines the correct API URL and headers based on provider type.
 * - Google Gemini: uses /v1beta/openai/chat/completions with Bearer auth
 * - OpenAI-compatible (LM Studio): uses /v1/chat/completions with no auth
 */
function getProviderEndpoint(providerConfig: LLMProviderConfig): { url: string; headers: Record<string, string> } {
    const normalizedUrl = providerConfig.baseUrl.replace(/\/$/, '');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (providerConfig.apiKey) {
        headers['Authorization'] = `Bearer ${providerConfig.apiKey}`;
    }

    // Detect Google Gemini specifically
    if (normalizedUrl.includes('generativelanguage.googleapis.com')) {
        // Google Gemini OpenAI-compatible endpoint
        const baseUrl = normalizedUrl.endsWith('/v1beta')
            ? normalizedUrl
            : `${normalizedUrl}/v1beta`;
        return { url: `${baseUrl}/openai/chat/completions`, headers };
    }

    // Detect Anthropic
    if (normalizedUrl.includes('api.anthropic.com')) {
        headers['x-api-key'] = providerConfig.apiKey || '';
        headers['anthropic-version'] = '2023-06-01';
        // Anthropic uses /v1/messages for chat-like completions
        return { url: `${normalizedUrl}/messages`, headers };
    }

    // Standard OpenAI-compatible (LM Studio, OpenAI, etc.)
    const baseUrl = normalizedUrl.endsWith('/v1') ? normalizedUrl : `${normalizedUrl}/v1`;
    return { url: `${baseUrl}/chat/completions`, headers };
}

export async function* streamChatCompletion(
    providerConfig: LLMProviderConfig,
    messages: { role: string; content: string | { type: string; text?: string; image_url?: { url: string } }[] | null; tool_calls?: any[]; tool_call_id?: string; name?: string }[],
    tools?: any[]
) {
    const isAnthropic = providerConfig.baseUrl.includes('api.anthropic.com');
    const { url, headers } = getProviderEndpoint(providerConfig);

    let body: any;

    if (isAnthropic) {
        // Transform to Anthropic format
        const systemMessage = messages.find(m => m.role === 'system');
        const otherMessages = messages.filter(m => m.role !== 'system');

        // Anthropic requires alternating user/assistant roles.
        // We'll merge consecutive messages of the same role.
        const normalizedMessages: any[] = [];
        otherMessages.forEach(m => {
            const role = m.role === 'assistant' ? 'assistant' : 'user';
            const last = normalizedMessages[normalizedMessages.length - 1];

            let content: any = m.content;
            if (m.role === 'tool') {
                content = [
                    {
                        type: 'tool_result',
                        tool_use_id: m.tool_call_id,
                        content: m.content
                    }
                ];
            } else if (m.role === 'assistant' && m.tool_calls) {
                const assistantContent: any[] = [];
                if (m.content) assistantContent.push({ type: 'text', text: m.content });
                m.tool_calls.forEach(tc => {
                    assistantContent.push({
                        type: 'tool_use',
                        id: tc.id,
                        name: tc.function.name,
                        input: JSON.parse(tc.function.arguments || '{}')
                    });
                });
                content = assistantContent;
            }

            if (last && last.role === role) {
                // Merge content
                if (Array.isArray(last.content) && Array.isArray(content)) {
                    last.content.push(...content);
                } else if (Array.isArray(last.content)) {
                    last.content.push({ type: 'text', text: String(content) });
                } else if (Array.isArray(content)) {
                    last.content = [{ type: 'text', text: String(last.content) }, ...content];
                } else {
                    last.content = String(last.content) + '\n\n' + String(content);
                }
            } else {
                normalizedMessages.push({ role, content });
            }
        });

        body = {
            model: providerConfig.modelId,
            system: typeof systemMessage?.content === 'string' ? systemMessage.content : undefined,
            messages: normalizedMessages,
            max_tokens: 4096,
            stream: true
        };

        if (tools && tools.length > 0) {
            body.tools = tools.map(t => ({
                name: t.name,
                description: t.description,
                input_schema: t.parameters
            }));
            body.tool_choice = { type: 'auto' };
        }
    } else {
        // OpenAI format
        body = {
            model: providerConfig.modelId,
            messages,
            stream: true,
            stream_options: { include_usage: true },
        };

        if (tools && tools.length > 0) {
            body.tools = tools.map(t => ({ type: 'function', function: t }));
            body.tool_choice = 'auto';
        }
    }

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`fetch failed: ${error.message}`);
        }
        throw error;
    }

    if (!response.ok) {
        let errorMsg = `LLM API error: ${response.status} ${response.statusText}`;
        try {
            const errorText = await response.text();
            if (errorText) {
                try {
                    const json = JSON.parse(errorText);
                    errorMsg += ` - ${JSON.stringify(json)}`;
                } catch {
                    errorMsg += ` - ${errorText}`;
                }
            }
        } catch (e) {
            // Ignore body read error
        }
        throw new Error(errorMsg);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') return;
                try {
                    const json = JSON.parse(data);

                    if (isAnthropic) {
                        // Anthropic Stream Parsing
                        if (json.type === 'content_block_start' && json.content_block?.type === 'tool_use') {
                            yield {
                                tool_calls: [{
                                    index: json.index,
                                    id: json.content_block.id,
                                    function: {
                                        name: json.content_block.name,
                                        arguments: ''
                                    }
                                }]
                            };
                        } else if (json.type === 'content_block_delta') {
                            if (json.delta?.type === 'text_delta') {
                                yield { content: json.delta.text };
                            } else if (json.delta?.type === 'thinking_delta') {
                                yield { content: `<think>${json.delta.thinking}</think>` };
                            } else if (json.delta?.type === 'input_json_delta') {
                                yield {
                                    tool_calls: [{
                                        index: json.index,
                                        function: {
                                            arguments: json.delta.partial_json
                                        }
                                    }]
                                };
                            }
                        } else if (json.usage) {
                            yield { usage: json.usage };
                        }
                    } else {
                        // OpenAI Stream Parsing
                        const choice = json.choices?.[0];
                        const delta = choice?.delta;

                        if (delta) yield delta;
                        if (json.usage) yield { usage: json.usage };

                        if (choice?.finish_reason) {
                            console.log('[LLM Stream] Finish reason:', choice.finish_reason);
                        }
                    }
                } catch (e) {
                    console.error('[LLM Stream] Parse error:', e);
                }
            }
        }
    }
}

export async function getChatCompletion(
    providerConfig: LLMProviderConfig,
    messages: { role: string; content: string }[]
) {
    // Re-use stream implementation to keep things unified
    // or just implement a simplified version. Since this is mainly used for summaries, we can implement it.
    const isAnthropic = providerConfig.baseUrl.includes('api.anthropic.com');
    const { url, headers } = getProviderEndpoint(providerConfig);

    let body: any;
    if (isAnthropic) {
        const systemMsg = messages.find(m => m.role === 'system');
        const otherMessages = messages.filter(m => m.role !== 'system');
        body = {
            model: providerConfig.modelId,
            system: systemMsg?.content,
            messages: otherMessages.map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            })),
            max_tokens: 4096,
            stream: false
        };
    } else {
        body = {
            model: providerConfig.modelId,
            messages,
            stream: false,
        };
    }

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`fetch failed: ${error.message}`);
        }
        throw error;
    }

    if (!response.ok) {
        let errorMsg = `LLM API error: ${response.status} ${response.statusText}`;
        try {
            const errorText = await response.text();
            if (errorText) {
                try {
                    const json = JSON.parse(errorText);
                    errorMsg += ` - ${JSON.stringify(json)}`;
                } catch {
                    errorMsg += ` - ${errorText}`;
                }
            }
        } catch (e) {
            // Ignore body read error
        }
        throw new Error(errorMsg);
    }

    const json = await response.json();

    if (isAnthropic) {
        return {
            content: json.content?.[0]?.text || '',
            usage: json.usage
        };
    }

    return {
        content: json.choices[0]?.message?.content || '',
        usage: json.usage
    };
}

export async function createEmbedding(
    providerConfig: LLMProviderConfig,
    input: string | string[]
): Promise<number[][]> {
    const { url: chatUrl, headers } = getProviderEndpoint(providerConfig);
    // Infer embedding URL from chat URL base
    // If chatUrl is .../chat/completions, we want .../embeddings
    const url = chatUrl.replace('/chat/completions', '/embeddings');

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: providerConfig.modelId || "text-embedding-3-small", // Use configured model, default to compatible name
                input,
            }),
        });
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`fetch failed: ${error.message}`);
        }
        throw error;
    }

    if (!response.ok) {
        // If 404, maybe the model name is wrong or endpoint is different.
        // For local providers (LM Studio), they might not support embeddings or use a different port/path.
        // But for standard OpenAI compat, this should work.
        throw new Error(`Embedding API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    return json.data.map((d: any) => d.embedding);
}

export async function listModels(
    providerConfig: LLMProviderConfig
): Promise<any[]> {
    // Handling for Google Gemini Native API
    // ... (same as before but returns full object)
    if (providerConfig.baseUrl.includes('generativelanguage.googleapis.com')) {
        const nativeUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        if (providerConfig.apiKey) {
            headers['x-goog-api-key'] = providerConfig.apiKey;
        }

        try {
            const response = await fetch(`${nativeUrl}?pageSize=100`, {
                method: 'GET',
                headers
            });

            if (response.ok) {
                const json = await response.json();
                if (json.models && Array.isArray(json.models)) {
                    // Models returned as "models/gemini-1.5-flash"
                    return json.models.map((m: any) => ({
                        ...m,
                        id: m.name.replace(/^models\//, '')
                    }));
                }
            } else {
                console.warn(`Gemini listModels failed: ${response.status} ${response.statusText}`);
            }
        } catch (e) {
            console.warn(`Gemini listModels exception:`, e);
            // Fallthrough to standard OpenAI attempt
        }
    }

    // Handling for Anthropic Native API
    if (providerConfig.baseUrl.includes('api.anthropic.com')) {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-api-key': providerConfig.apiKey || '',
            'anthropic-version': '2023-06-01'
        };

        try {
            const response = await fetch('https://api.anthropic.com/v1/models', {
                method: 'GET',
                headers
            });

            if (response.ok) {
                const json = await response.json();
                if (json.data && Array.isArray(json.data)) {
                    return json.data;
                }
            } else {
                console.warn(`Anthropic listModels failed: ${response.status} ${response.statusText}`);
            }
        } catch (e) {
            console.warn(`Anthropic listModels exception:`, e);
        }
    }

    // Standard OpenAI compatible URL construction
    const { url: chatUrl, headers } = getProviderEndpoint(providerConfig);
    const url = chatUrl.replace('/chat/completions', '/models');

    // Attempt to fetch from LM Studio's rich metadata endpoint (/api/v1/models) first.
    // This provides 'capabilities' like vision and tool use which are missing from the standard /v1/models endpoint.
    try {
        // Construct rich URL: replace /v1/models with /api/v1/models
        // getProviderEndpoint ensures URL ends with /v1/chat/completions -> /v1/models
        // So we can safely strip /v1/models and append /api/v1/models
        // Or closer simply: if we have /v1/models, try /api/v1/models
        const richUrl = url.replace(/\/v1\/models$/, '/api/v1/models');

        console.log(`[listModels] Trying rich endpoint: ${richUrl}`);

        // Only try if the URL was actually modified (i.e. it had /v1/models)
        if (richUrl !== url) {
            const response = await fetch(richUrl, { method: 'GET', headers });
            console.log(`[listModels] Rich endpoint status: ${response.status}`);

            if (response.ok) {
                const json = await response.json();
                console.log(`[listModels] Rich Data Found:`, !!json.data, !!json.models, Array.isArray(json));

                if (json.data && Array.isArray(json.data)) {
                    return json.data.map((m: any) => typeof m === 'string' ? { id: m } : m);
                }
                if (json.models && Array.isArray(json.models)) {
                    return json.models.map((m: any) => typeof m === 'string' ? { id: m } : m);
                }
                if (Array.isArray(json)) {
                    return json.map((m: any) => typeof m === 'string' ? { id: m } : m);
                }
            }
        }
    } catch (e) {
        console.warn('[listModels] Rich endpoint failed:', e);
    }

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers,
        });

        if (!response.ok) {
            throw new Error(`Models API error: ${response.status} ${response.statusText}`);
        }

        const json = await response.json();

        if (json.data && Array.isArray(json.data)) {
            return json.data.map((m: any) => typeof m === 'string' ? { id: m } : m);
        }

        if (Array.isArray(json)) {
            return json.map((m: any) => typeof m === 'string' ? { id: m } : m);
        }
    } catch (error) {
        console.warn('Failed to list models via OpenAI compat:', error);
        throw error;
    }

    return [];
}

