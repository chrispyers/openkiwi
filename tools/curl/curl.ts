import dns from 'node:dns';
import { URL } from 'node:url';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB

// Block requests to private/internal IP ranges (SSRF protection)
function isPrivateIP(ip: string): boolean {
    if (ip === '::1' || ip === '127.0.0.1') return true;
    if (ip.startsWith('127.') || ip.startsWith('0.') || ip.startsWith('169.254.')) return true;
    if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
    const parts = ip.split('.');
    if (parts.length === 4 && parts[0] === '172') {
        const second = parseInt(parts[1], 10);
        if (second >= 16 && second <= 31) return true;
    }
    return false;
}

export default {
    definition: {
        name: 'curl',
        displayName: 'Curl',
        description:
            'Make a plain HTTP request to any public URL and return the response body. ' +
            'Ideal for JSON APIs, RSS feeds, and any endpoint that does not require a real browser. ' +
            'Unlike the Chromium tool, this sends no cookies, runs no JavaScript, and leaves no bot-detection footprint.',
        /** Deduplicate retries by HTTP method + URL. */
        resultKey(args: { url: string; method?: string }): string | null {
            const method = (args?.method || 'GET').toUpperCase();
            return `${method}:${args?.url || ''}`;
        },
        parameters: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: 'The full URL to request, including query parameters (e.g. https://www.reddit.com/search.json?q=OpenClaw&sort=new&limit=25).'
                },
                method: {
                    type: 'string',
                    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
                    description: 'HTTP method. Default: GET.'
                },
                headers: {
                    type: 'object',
                    description:
                        'Key/value pairs to send as request headers. ' +
                        'Use this to set User-Agent, Authorization, Content-Type, etc. ' +
                        'Example for Reddit API: { "User-Agent": "openkiwi:reddit-monitor:1.0 (by /u/yourusername)" }'
                },
                body: {
                    type: 'string',
                    description: 'Request body for POST/PUT/PATCH requests. Typically a JSON string.'
                },
                timeout: {
                    type: 'number',
                    description: 'Request timeout in seconds. Default: 30.'
                }
            },
            required: ['url']
        }
    },

    handler: async (args: {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: string;
        timeout?: number;
    }) => {
        const method = (args.method ?? 'GET').toUpperCase();
        const timeoutMs = (args.timeout ?? 30) * 1000;

        // Validate URL
        let parsed: URL;
        try {
            parsed = new URL(args.url);
        } catch {
            return { error: `Invalid URL: ${args.url}` };
        }

        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return { error: `Unsupported protocol: ${parsed.protocol}. Only http and https are allowed.` };
        }

        // SSRF protection — resolve hostname and block private IPs
        try {
            const { address } = await dns.promises.lookup(parsed.hostname);
            if (isPrivateIP(address)) {
                return { error: `Access denied: ${parsed.hostname} resolves to a private IP address (${address}).` };
            }
        } catch (e: any) {
            return { error: `DNS resolution failed for ${parsed.hostname}: ${e.message}` };
        }

        // Build request options
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        // Honour external abort signal (e.g. user pressed Stop)
        const externalSignal = (args as any)._context?.abortSignal as AbortSignal | undefined;
        const onExternalAbort = () => controller.abort();
        externalSignal?.addEventListener('abort', onExternalAbort);

        const requestInit: RequestInit = {
            method,
            signal: controller.signal,
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Encoding': 'gzip, deflate, br',
                ...args.headers
            }
        };

        if (args.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
            requestInit.body = args.body;
        }

        console.log(`[curl] ${method} ${args.url}`);

        try {
            const response = await fetch(args.url, requestInit);
            clearTimeout(timer);

            const contentType = response.headers.get('content-type') ?? '';
            const isJson = contentType.includes('application/json') || args.url.includes('.json');

            // Read response with size guard
            const reader = response.body?.getReader();
            let received = 0;
            const chunks: Uint8Array[] = [];

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    received += value.byteLength;
                    if (received > MAX_RESPONSE_BYTES) {
                        reader.cancel();
                        return {
                            error: `Response too large (exceeded ${MAX_RESPONSE_BYTES / 1024 / 1024}MB limit). ` +
                                'Try adding query parameters to reduce the response size.'
                        };
                    }
                    chunks.push(value);
                }
            }

            const rawText = new TextDecoder().decode(
                chunks.reduce((acc, chunk) => {
                    const merged = new Uint8Array(acc.length + chunk.length);
                    merged.set(acc);
                    merged.set(chunk, acc.length);
                    return merged;
                }, new Uint8Array())
            );

            // Parse JSON if applicable
            let data: unknown = null;
            let parseError: string | null = null;
            if (isJson) {
                try {
                    data = JSON.parse(rawText);
                } catch (e: any) {
                    parseError = e.message;
                }
            }

            const result: Record<string, unknown> = {
                status: response.status,
                ok: response.ok,
                contentType,
                url: response.url // final URL after redirects
            };

            if (!response.ok) {
                result.error = `HTTP ${response.status}: ${response.statusText}`;
            }

            if (data !== null) {
                result.data = data;
            } else {
                result.text = rawText;
                if (parseError) result.parseError = parseError;
            }

            return result;

        } catch (e: any) {
            if (e.name === 'AbortError') {
                if (externalSignal?.aborted) {
                    return { error: 'Request cancelled by user.' };
                }
                return { error: `Request timed out after ${args.timeout ?? 30}s` };
            }
            return { error: `Request failed: ${e.message}` };
        } finally {
            clearTimeout(timer);
            externalSignal?.removeEventListener('abort', onExternalAbort);
        }
    }
};
