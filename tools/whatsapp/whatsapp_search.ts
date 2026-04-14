import { QdrantClient } from '@qdrant/js-client-rest';
import { loadConfig } from '../../src/config-manager.js';
import { createEmbedding } from '../../src/llm-provider.js';

interface SearchArgs {
    query: string;
    limit?: number;
    chat_jid?: string;
    is_group?: boolean;
    sender_name?: string;
    since?: number; // unix seconds
    until?: number;
    score_threshold?: number;
}

function resolveStore() {
    const cfg = loadConfig() as any;
    const storeName = cfg.tools?.whatsapp_ingest?.store || 'whatsapp_messages';
    const store = cfg.tools?.qdrant?.stores?.[storeName];
    if (!store?.url) return { error: `Qdrant store "${storeName}" not configured.` };
    if (!store.apiKey && cfg.tools?.qdrant?.apiKey) store.apiKey = cfg.tools.qdrant.apiKey;
    if (!store.apiKey && process.env.QDRANT_API_KEY) store.apiKey = process.env.QDRANT_API_KEY;
    return { store, storeName };
}

function resolveEmbeddingProvider() {
    const cfg = loadConfig() as any;
    const modelName = cfg.memory?.embeddingsModel;
    if (!modelName) return { error: 'No embedding model configured (memory.embeddingsModel).' };
    const providers = cfg.providers || [];
    const p = providers.find((x: any) => x.description === modelName) ?? providers.find((x: any) => x.model === modelName);
    if (!p) return { error: `Embedding provider "${modelName}" not found.` };
    return { provider: { baseUrl: p.endpoint, modelId: p.model, apiKey: p.apiKey } };
}

export default {
    definition: {
        name: 'whatsapp_search',
        displayName: 'WhatsApp Search',
        description:
            'Semantic search over ingested WhatsApp messages. Use this to recall what was said in a WhatsApp chat or group. ' +
            'Supports filtering by chat JID, group vs 1:1, sender name, and date range.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Natural language query — what are you looking for in the messages?' },
                limit: { type: 'number', description: 'Max results (default 10).' },
                chat_jid: { type: 'string', description: 'Optional: restrict to a specific chat (e.g. "4479...@s.whatsapp.net" or "1234@g.us").' },
                is_group: { type: 'boolean', description: 'Optional: true for group chats only, false for direct chats only.' },
                sender_name: { type: 'string', description: 'Optional: restrict to messages from a specific sender push-name.' },
                since: { type: 'number', description: 'Optional: unix seconds — only messages at or after this time.' },
                until: { type: 'number', description: 'Optional: unix seconds — only messages at or before this time.' },
                score_threshold: { type: 'number', description: 'Optional: minimum similarity score (0–1).' },
            },
            required: ['query'],
        },
    },

    handler: async (args: SearchArgs) => {
        const { query, limit = 10, chat_jid, is_group, sender_name, since, until, score_threshold } = args;
        if (!query?.trim()) return { error: 'query is required.' };

        const storeResult = resolveStore();
        if ('error' in storeResult) return { error: storeResult.error };
        const { store, storeName } = storeResult;

        const embResult = resolveEmbeddingProvider();
        if ('error' in embResult) return { error: embResult.error };

        const embeddings = await createEmbedding(embResult.provider, query);
        let vector = embeddings[0];
        if (!vector?.length) return { error: 'Embedding returned empty vector.' };
        if (store.dimensions && vector.length > store.dimensions) vector = vector.slice(0, store.dimensions);

        const must: any[] = [];
        if (chat_jid) must.push({ key: 'chat_jid', match: { value: chat_jid } });
        if (typeof is_group === 'boolean') must.push({ key: 'is_group', match: { value: is_group } });
        if (sender_name) must.push({ key: 'sender_name', match: { value: sender_name } });
        if (typeof since === 'number' || typeof until === 'number') {
            const range: any = {};
            if (typeof since === 'number') range.gte = since;
            if (typeof until === 'number') range.lte = until;
            must.push({ key: 'timestamp', range });
        }

        const client = new QdrantClient({ url: store.url, apiKey: store.apiKey, checkCompatibility: false });
        const searchParams: any = { vector, limit };
        if (score_threshold !== undefined) searchParams.score_threshold = score_threshold;
        if (must.length > 0) searchParams.filter = { must };

        try {
            const results = await client.search(store.collection, searchParams);
            return {
                store: storeName,
                query,
                count: results.length,
                results: results.map((r: any) => ({
                    score: r.score,
                    text: typeof r.payload?.text === 'string' && r.payload.text.length > 600
                        ? r.payload.text.slice(0, 600) + '…'
                        : r.payload?.text,
                    chat_jid: r.payload?.chat_jid,
                    chat_name: r.payload?.chat_name,
                    is_group: r.payload?.is_group,
                    sender_name: r.payload?.sender_name,
                    timestamp: r.payload?.timestamp,
                    from_me: r.payload?.from_me,
                })),
            };
        } catch (e: any) {
            return { error: `Search failed: ${e.message || e}` };
        }
    },
};
