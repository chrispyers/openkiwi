
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

    // Standard OpenAI-compatible (LM Studio, OpenAI, etc.)
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
        let errorMsg = `LLM API error: ${response.status} ${response.statusText}`;
        try {
            const errorText = await response.text();
            if (errorText) {
                // Try to parse JSON if possible for cleaner error message
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
                    // DEBUG: Log first few tokens or unusual structures
                    if (Math.random() < 0.05 || json.usage) {
                        console.log('[LLM Stream]', JSON.stringify(json).substring(0, 200));
                    }

                    const choice = json.choices?.[0];
                    const delta = choice?.delta;

                    if (delta) yield delta;
                    if (json.usage) yield { usage: json.usage };

                    if (choice?.finish_reason) {
                        console.log('[LLM Stream] Finish reason:', choice.finish_reason);
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
): Promise<string[]> {
    // Handling for Google Gemini Native API
    // The OpenAI compatibility endpoint for listing models is flaky or non-standard,
    // so we use the native Gemini API endpoint for listing models.
    if (providerConfig.baseUrl.includes('generativelanguage.googleapis.com')) {
        const nativeUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
        // Ensure we pass the API key via query param or header (header preferred but needs x-goog-api-key for native)
        // However, standard Bearer auth works for some google endpoints, but let's be safe and use x-goog-api-key if we have it
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
                    return json.models.map((m: any) => m.name.replace(/^models\//, ''));
                }
            } else {
                console.warn(`Gemini listModels failed: ${response.status} ${response.statusText}`);
            }
        } catch (e) {
            console.warn(`Gemini listModels exception:`, e);
            // Fallthrough to standard OpenAI attempt
        }
    }

    // Standard OpenAI compatible URL construction
    const { url: chatUrl, headers } = getProviderEndpoint(providerConfig);
    const url = chatUrl.replace('/chat/completions', '/models');

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
            return json.data.map((m: any) => m.id);
        }

        if (Array.isArray(json)) {
            return json.map((m: any) => m.id || m.name || String(m));
        }
    } catch (error) {
        console.warn('Failed to list models via OpenAI compat:', error);
        throw error;
    }

    return [];
}
