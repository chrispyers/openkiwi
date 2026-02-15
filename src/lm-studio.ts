import { Config } from './config-manager.js';

export async function* streamChatCompletion(
    config: Config,
    messages: { role: string; content: string | null; tool_calls?: any[]; tool_call_id?: string; name?: string }[],
    tools?: any[]
) {
    const body: any = {
        model: config.lmStudio.modelId,
        messages,
        stream: true,
    };

    if (tools && tools.length > 0) {
        body.tools = tools.map(t => ({ type: 'function', function: t }));
        body.tool_choice = 'auto';
    }

    const response = await fetch(`${config.lmStudio.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`LM Studio API error: ${response.statusText}`);
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
