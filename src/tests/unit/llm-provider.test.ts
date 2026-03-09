import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { streamChatCompletion, getChatCompletion } from '../../llm-provider.js';
import type { LLMProviderConfig } from '../../llm-provider.js';

// --- Helpers ---

let capturedRequests: { url: string; options: any }[] = [];

function mockFetchOk(body: any = {}) {
    return vi.fn(async (url: string, options: any) => {
        capturedRequests.push({ url, options });
        return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => body,
            text: async () => JSON.stringify(body),
            body: {
                getReader: () => {
                    let done = false;
                    return {
                        read: async () => {
                            if (done) return { done: true, value: undefined };
                            done = true;
                            return {
                                done: false,
                                value: new TextEncoder().encode('data: [DONE]\n'),
                            };
                        },
                    };
                },
            },
        } as any;
    });
}

function mockFetchError(status: number, statusText: string, body?: string) {
    return vi.fn(async (url: string, options: any) => {
        capturedRequests.push({ url, options });
        return {
            ok: false,
            status,
            statusText,
            text: async () => body || '',
        } as any;
    });
}

function lastRequestBody(): any {
    const last = capturedRequests[capturedRequests.length - 1];
    return JSON.parse(last.options.body);
}

function lastRequestHeaders(): Record<string, string> {
    const last = capturedRequests[capturedRequests.length - 1];
    return last.options.headers;
}

function lastRequestUrl(): string {
    return capturedRequests[capturedRequests.length - 1].url;
}

const anthropicConfig: LLMProviderConfig = {
    baseUrl: 'https://api.anthropic.com/v1',
    modelId: 'claude-3-sonnet',
    apiKey: 'sk-ant-test',
};

const openaiConfig: LLMProviderConfig = {
    baseUrl: 'http://localhost:1234',
    modelId: 'gpt-4',
    apiKey: 'sk-test',
};

const geminiConfig: LLMProviderConfig = {
    baseUrl: 'https://generativelanguage.googleapis.com',
    modelId: 'gemini-pro',
    apiKey: 'goog-test',
};

const openRouterConfig: LLMProviderConfig = {
    baseUrl: 'https://openrouter.ai/api',
    modelId: 'meta-llama/llama-3',
    apiKey: 'or-test',
};

const simpleMessages = [{ role: 'user', content: 'Hello' }];

// Drain an async generator to trigger the fetch call
async function drain(gen: AsyncGenerator) {
    for await (const _ of gen) { /* consume */ }
}

describe('llm-provider', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        capturedRequests = [];
        originalFetch = globalThis.fetch;
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    // ---------------------------------------------------------------
    // Provider endpoint detection
    // ---------------------------------------------------------------
    describe('provider endpoint detection', () => {
        it('Anthropic URL uses /messages endpoint with correct headers', async () => {
            globalThis.fetch = mockFetchOk();
            await drain(streamChatCompletion(anthropicConfig, simpleMessages));

            expect(lastRequestUrl()).toBe('https://api.anthropic.com/v1/messages');
            expect(lastRequestHeaders()['x-api-key']).toBe('sk-ant-test');
            expect(lastRequestHeaders()['anthropic-version']).toBe('2023-06-01');
        });

        it('Google Gemini URL uses /v1beta/openai/chat/completions', async () => {
            globalThis.fetch = mockFetchOk();
            await drain(streamChatCompletion(geminiConfig, simpleMessages));

            expect(lastRequestUrl()).toBe(
                'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
            );
        });

        it('OpenRouter URL adds HTTP-Referer and X-Title headers', async () => {
            globalThis.fetch = mockFetchOk();
            await drain(streamChatCompletion(openRouterConfig, simpleMessages));

            expect(lastRequestHeaders()['HTTP-Referer']).toBe('https://openkiwi.ai');
            expect(lastRequestHeaders()['X-Title']).toBe('OpenKiwi');
        });

        it('Generic OpenAI-compatible URL uses /v1/chat/completions', async () => {
            globalThis.fetch = mockFetchOk();
            await drain(streamChatCompletion(openaiConfig, simpleMessages));

            expect(lastRequestUrl()).toBe('http://localhost:1234/v1/chat/completions');
        });

        it('Trailing slash is normalised', async () => {
            globalThis.fetch = mockFetchOk();
            const config: LLMProviderConfig = {
                baseUrl: 'http://localhost:1234/',
                modelId: 'test',
            };
            await drain(streamChatCompletion(config, simpleMessages));

            expect(lastRequestUrl()).toBe('http://localhost:1234/v1/chat/completions');
        });
    });

    // ---------------------------------------------------------------
    // streamChatCompletion — maxTokens
    // ---------------------------------------------------------------
    describe('streamChatCompletion — maxTokens', () => {
        it('Anthropic: uses providerConfig.maxTokens when set', async () => {
            globalThis.fetch = mockFetchOk();
            await drain(streamChatCompletion({ ...anthropicConfig, maxTokens: 2048 }, simpleMessages));

            expect(lastRequestBody().max_tokens).toBe(2048);
        });

        it('Anthropic: defaults to 4096 when maxTokens is undefined', async () => {
            globalThis.fetch = mockFetchOk();
            await drain(streamChatCompletion(anthropicConfig, simpleMessages));

            expect(lastRequestBody().max_tokens).toBe(4096);
        });

        it('OpenAI: uses providerConfig.maxTokens when set', async () => {
            globalThis.fetch = mockFetchOk();
            await drain(streamChatCompletion({ ...openaiConfig, maxTokens: 1024 }, simpleMessages));

            expect(lastRequestBody().max_tokens).toBe(1024);
        });

        it('OpenAI: defaults to 8192 when maxTokens is undefined', async () => {
            globalThis.fetch = mockFetchOk();
            await drain(streamChatCompletion(openaiConfig, simpleMessages));

            expect(lastRequestBody().max_tokens).toBe(8192);
        });

        it('sends max_tokens in the request body', async () => {
            globalThis.fetch = mockFetchOk();
            await drain(streamChatCompletion({ ...openaiConfig, maxTokens: 512 }, simpleMessages));

            expect(lastRequestBody()).toHaveProperty('max_tokens', 512);
        });
    });

    // ---------------------------------------------------------------
    // getChatCompletion — maxTokens
    // ---------------------------------------------------------------
    describe('getChatCompletion — maxTokens', () => {
        it('Anthropic: uses providerConfig.maxTokens when set', async () => {
            globalThis.fetch = mockFetchOk({ content: [{ text: 'hi' }], usage: {} });
            await getChatCompletion({ ...anthropicConfig, maxTokens: 2048 }, [{ role: 'user', content: 'hi' }]);

            expect(lastRequestBody().max_tokens).toBe(2048);
        });

        it('Anthropic: defaults to 4096 when maxTokens is undefined', async () => {
            globalThis.fetch = mockFetchOk({ content: [{ text: 'hi' }], usage: {} });
            await getChatCompletion(anthropicConfig, [{ role: 'user', content: 'hi' }]);

            expect(lastRequestBody().max_tokens).toBe(4096);
        });

        it('OpenAI: uses providerConfig.maxTokens when set', async () => {
            globalThis.fetch = mockFetchOk({ choices: [{ message: { content: 'hi' } }], usage: {} });
            await getChatCompletion({ ...openaiConfig, maxTokens: 1024 }, [{ role: 'user', content: 'hi' }]);

            expect(lastRequestBody().max_tokens).toBe(1024);
        });

        it('OpenAI: defaults to 8192 when maxTokens is undefined', async () => {
            globalThis.fetch = mockFetchOk({ choices: [{ message: { content: 'hi' } }], usage: {} });
            await getChatCompletion(openaiConfig, [{ role: 'user', content: 'hi' }]);

            expect(lastRequestBody().max_tokens).toBe(8192);
        });
    });

    // ---------------------------------------------------------------
    // streamChatCompletion — Anthropic message transformation
    // ---------------------------------------------------------------
    describe('streamChatCompletion — Anthropic message transformation', () => {
        it('system message extracted to system field', async () => {
            globalThis.fetch = mockFetchOk();
            const messages = [
                { role: 'system', content: 'You are helpful' },
                { role: 'user', content: 'Hello' },
            ];
            await drain(streamChatCompletion(anthropicConfig, messages));

            const body = lastRequestBody();
            expect(body.system).toBe('You are helpful');
            // System message should not appear in messages array
            expect(body.messages.every((m: any) => m.role !== 'system')).toBe(true);
        });

        it('tool results wrapped in tool_result format', async () => {
            globalThis.fetch = mockFetchOk();
            const messages = [
                { role: 'user', content: 'Use a tool' },
                {
                    role: 'assistant',
                    content: null,
                    tool_calls: [{
                        id: 'call_1',
                        function: { name: 'get_weather', arguments: '{"city":"NYC"}' },
                    }],
                },
                { role: 'tool', content: 'Sunny 72F', tool_call_id: 'call_1', name: 'get_weather' },
            ];
            await drain(streamChatCompletion(anthropicConfig, messages));

            const body = lastRequestBody();
            // The tool result message should be merged into user role with tool_result content
            const userMessages = body.messages.filter((m: any) => m.role === 'user');
            const toolResultContent = userMessages.flatMap((m: any) =>
                Array.isArray(m.content) ? m.content.filter((c: any) => c.type === 'tool_result') : []
            );
            expect(toolResultContent.length).toBeGreaterThan(0);
            expect(toolResultContent[0].tool_use_id).toBe('call_1');
        });

        it('consecutive same-role messages merged', async () => {
            globalThis.fetch = mockFetchOk();
            const messages = [
                { role: 'user', content: 'First message' },
                { role: 'user', content: 'Second message' },
            ];
            await drain(streamChatCompletion(anthropicConfig, messages));

            const body = lastRequestBody();
            // Should be merged into a single user message
            expect(body.messages).toHaveLength(1);
            expect(body.messages[0].role).toBe('user');
            expect(body.messages[0].content).toContain('First message');
            expect(body.messages[0].content).toContain('Second message');
        });
    });

    // ---------------------------------------------------------------
    // streamChatCompletion — Tool formatting
    // ---------------------------------------------------------------
    describe('streamChatCompletion — Tool formatting', () => {
        const tools = [
            {
                name: 'get_weather',
                description: 'Get weather for a city',
                parameters: { type: 'object', properties: { city: { type: 'string' } } },
            },
        ];

        it('Anthropic: tools sent with input_schema', async () => {
            globalThis.fetch = mockFetchOk();
            await drain(streamChatCompletion(anthropicConfig, simpleMessages, tools));

            const body = lastRequestBody();
            expect(body.tools[0].input_schema).toEqual(tools[0].parameters);
            expect(body.tools[0].name).toBe('get_weather');
            // Should NOT have function wrapper
            expect(body.tools[0]).not.toHaveProperty('type');
        });

        it('OpenAI: tools sent with type function wrapper', async () => {
            globalThis.fetch = mockFetchOk();
            await drain(streamChatCompletion(openaiConfig, simpleMessages, tools));

            const body = lastRequestBody();
            expect(body.tools[0].type).toBe('function');
            expect(body.tools[0].function.name).toBe('get_weather');
            expect(body.tools[0].function.parameters).toEqual(tools[0].parameters);
        });
    });

    // ---------------------------------------------------------------
    // Error handling
    // ---------------------------------------------------------------
    describe('error handling', () => {
        it('non-OK response throws descriptive error', async () => {
            globalThis.fetch = mockFetchError(429, 'Too Many Requests', '{"error":"rate_limited"}');

            await expect(
                getChatCompletion(openaiConfig, [{ role: 'user', content: 'hi' }])
            ).rejects.toThrow('LLM API error: 429 Too Many Requests');
        });

        it('fetch failure throws with message', async () => {
            globalThis.fetch = vi.fn(async () => {
                throw new Error('ECONNREFUSED');
            });

            await expect(
                getChatCompletion(openaiConfig, [{ role: 'user', content: 'hi' }])
            ).rejects.toThrow('fetch failed: ECONNREFUSED');
        });
    });
});
