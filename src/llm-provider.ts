
export interface LLMProviderConfig {
    baseUrl: string;
    modelId: string;
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
    };

    if (tools && tools.length > 0) {
        body.tools = tools.map(t => ({ type: 'function', function: t }));
        body.tool_choice = 'auto';
    }

    const normalizedUrl = providerConfig.baseUrl.replace(/\/$/, '');
    const baseUrl = normalizedUrl.endsWith('/v1') ? normalizedUrl : `${normalizedUrl}/v1`;

    let response;
    try {
        response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
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
    const normalizedUrl = providerConfig.baseUrl.replace(/\/$/, '');
    const baseUrl = normalizedUrl.endsWith('/v1') ? normalizedUrl : `${normalizedUrl}/v1`;

    let response;
    try {
        response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
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
    return json.choices[0]?.message?.content || '';
}
