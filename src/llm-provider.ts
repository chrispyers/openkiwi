
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

    // Detect Google Gemini by apiKey presence
    if (providerConfig.apiKey) {
        // Google Gemini OpenAI-compatible endpoint
        const baseUrl = normalizedUrl.endsWith('/v1beta')
            ? normalizedUrl
            : `${normalizedUrl}/v1beta`;
        headers['Authorization'] = `Bearer ${providerConfig.apiKey}`;
        return { url: `${baseUrl}/openai/chat/completions`, headers };
    }

    // Standard OpenAI-compatible (LM Studio, etc.)
    const baseUrl = normalizedUrl.endsWith('/v1') ? normalizedUrl : `${normalizedUrl}/v1`;
    return { url: `${baseUrl}/chat/completions`, headers };
}

export async function* streamChatCompletion(
    providerConfig: LLMProviderConfig,
    messages: { role: string; content: string | null; tool_calls?: any[]; tool_call_id?: string; name?: string }[],
    tools?: any[]
) {
    const body: any = {
        model: providerConfig.modelId,
        messages,
        stream: true,
        stream_options: { include_usage: true },
    };

    if (tools && tools.length > 0) {
        body.tools = tools.map(t => ({ type: 'function', function: t }));
        body.tool_choice = 'auto';
    }

    const { url, headers } = getProviderEndpoint(providerConfig);

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
        throw new Error(`LLM API error: ${response.statusText}`);
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
                    const delta = json.choices[0]?.delta;
                    if (delta) yield delta;
                    if (json.usage) yield { usage: json.usage };
                } catch (e) {
                    // Ignore parse errors for incomplete JSON
                }
            }
        }
    }
}

export async function getChatCompletion(
    providerConfig: LLMProviderConfig,
    messages: { role: string; content: string }[]
) {
    const { url, headers } = getProviderEndpoint(providerConfig);

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: providerConfig.modelId,
                messages,
                stream: false,
            }),
        });
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`fetch failed: ${error.message}`);
        }
        throw error;
    }

    if (!response.ok) {
        throw new Error(`LLM API error: ${response.statusText}`);
    }

    const json = await response.json();
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
