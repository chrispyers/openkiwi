import { QdrantClient } from '@qdrant/js-client-rest';
// relative paths should reach back to the workspace src directory
import { loadConfig } from '../../src/config-manager.js';
import { createEmbedding } from '../../src/llm-provider.js';

const DEBUG = process.env.QDRANT_DEBUG === 'true' || process.env.QDRANT_DEBUG === '1';

function debug(...args: unknown[]) {
    if (DEBUG) console.log('[Qdrant:DEBUG]', ...args);
}

interface QdrantStoreConfig {
    url: string;
    apiKey?: string;
    collection: string;
    dimensions?: number;
}

interface QdrantArgs {
    action: 'search';
    store: string;
    query: string;
    limit?: number;
    score_threshold?: number;
    filter?: {
        must?: Record<string, unknown>[];
        should?: Record<string, unknown>[];
        must_not?: Record<string, unknown>[];
    };
    _context?: {
        agentId?: string;
        toolConfig?: {
            stores?: Record<string, QdrantStoreConfig>;
        };
    };
}

/**
 * Build the list of available store names at load time so we can
 * put them in the tool definition as an enum for the LLM.
 */
function getAvailableStoreNames(): string[] {
    const names: string[] = [];

    // From config
    try {
        const config = loadConfig();
        const stores = (config as any).tools?.qdrant?.stores;
        if (stores && typeof stores === 'object') {
            for (const [name, store] of Object.entries(stores)) {
                if ((store as any)?.url) names.push(name);
            }
        }
    } catch { /* config not available yet */ }

    return names;
}

const availableStores = getAvailableStoreNames();
debug('available stores at load:', availableStores);

function resolveStoreConfig(storeName: string, toolConfig?: QdrantArgs['_context']): QdrantStoreConfig | { error: string } {
    const stores = toolConfig?.toolConfig?.stores;

    // Try configured stores first (skip entries with empty url — treat as unconfigured)
    if (stores) {
        const validStores = Object.fromEntries(
            Object.entries(stores).filter(([, s]) => s.url)
        );
        if (Object.keys(validStores).length > 0) {
            const store = validStores[storeName];
            if (!store) {
                const available = Object.keys(validStores).join(', ');
                return { error: `Store "${storeName}" not found. Available stores: ${available}` };
            }
            // Fall back to QDRANT_API_KEY env var if store has no apiKey
            if (!store.apiKey && process.env.QDRANT_API_KEY) {
                store.apiKey = process.env.QDRANT_API_KEY;
            }
            return store;
        }
    }

    // Fall back to full config file (not per-agent toolConfig)
    try {
        const config = loadConfig();
        const configStores = (config as any).tools?.qdrant?.stores;
        if (configStores && typeof configStores === 'object') {
            const validStores = Object.fromEntries(
                Object.entries(configStores).filter(([, s]) => (s as any)?.url)
            );
            if (Object.keys(validStores).length > 0) {
                const store = validStores[storeName] as QdrantStoreConfig | undefined;
                if (!store) {
                    const available = Object.keys(validStores).join(', ');
                    return { error: `Store "${storeName}" not found. Available stores: ${available}` };
                }
                if (!store.apiKey && process.env.QDRANT_API_KEY) {
                    store.apiKey = process.env.QDRANT_API_KEY;
                }
                return store;
            }
        }
    } catch { /* config not available */ }

    return { error: 'No Qdrant stores configured. Add stores to tools.qdrant.stores in config.' };
}

function resolveEmbeddingProvider(): { baseUrl: string; modelId: string; apiKey?: string } | { error: string } {
    const config = loadConfig();
    const embeddingsModel = config.memory?.embeddingsModel;

    if (!embeddingsModel) {
        return { error: 'No embedding model configured. Set memory.embeddingsModel in config.' };
    }

    const providers = config.providers || [];
    let providerConfig = providers.find((p: any) => p.description === embeddingsModel);
    if (!providerConfig) {
        providerConfig = providers.find((p: any) => p.model === embeddingsModel);
    }

    if (!providerConfig) {
        return { error: `Embedding provider "${embeddingsModel}" not found in configured providers.` };
    }

    return {
        baseUrl: providerConfig.endpoint,
        modelId: providerConfig.model,
        apiKey: providerConfig.apiKey,
    };
}

// Build store property — include enum of known names so the LLM picks the right one
const storeProperty: Record<string, any> = {
    type: 'string',
    description: 'The name of the Qdrant store to search.',
};
if (availableStores.length > 0) {
    storeProperty.enum = availableStores;
    storeProperty.description = `The Qdrant store to search. Available: ${availableStores.join(', ')}`;
}

export default {
    definition: {
        name: 'qdrant',
        displayName: 'Qdrant Search',
        description: `Search a Qdrant vector store semantically. Provide a natural language query and store name.${availableStores.length > 0 ? ` Available stores: ${availableStores.join(', ')}` : ''}`,
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['search'],
                    description: 'The action to perform. Currently only "search" is supported.',
                },
                store: storeProperty,
                query: {
                    type: 'string',
                    description: 'Natural language search query.',
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of results to return (default: 5).',
                },
                score_threshold: {
                    type: 'number',
                    description: 'Minimum similarity score threshold for results.',
                },
                filter: {
                    type: 'object',
                    description: 'Qdrant filter object with must/should/must_not arrays. Example: { "must": [{ "key": "metadata.type", "match": { "value": "article" } }] }',
                },
            },
            required: ['action', 'store', 'query'],
        },
    },

    handler: async (args: QdrantArgs) => {
        const { action, store: storeName, query, limit = 5, score_threshold, filter, _context } = args;

        debug('handler called:', { action, store: storeName, query: query?.slice(0, 80), limit, score_threshold });
        debug('toolConfig stores:', _context?.toolConfig?.stores ? Object.keys(_context.toolConfig.stores) : 'none');

        if (action !== 'search') {
            return { error: `Unknown action: "${action}". Only "search" is supported.` };
        }

        if (!query || query.trim().length === 0) {
            return { error: 'query is required and must not be empty.' };
        }

        // Resolve store config
        const storeConfig = resolveStoreConfig(storeName, _context);
        if ('error' in storeConfig) {
            debug('store resolution failed:', storeConfig.error);
            return storeConfig;
        }
        debug('resolved store:', { url: storeConfig.url, collection: storeConfig.collection, dimensions: storeConfig.dimensions, hasApiKey: !!storeConfig.apiKey });

        // Resolve embedding provider
        const embeddingProvider = resolveEmbeddingProvider();
        if ('error' in embeddingProvider) {
            debug('embedding provider resolution failed:', embeddingProvider.error);
            return embeddingProvider;
        }
        debug('resolved embedding provider:', { baseUrl: embeddingProvider.baseUrl, modelId: embeddingProvider.modelId });

        try {
            // Generate embedding for the query
            debug('generating embedding for query...');
            const embeddings = await createEmbedding(embeddingProvider, query);
            let vector = embeddings[0];
            debug('embedding generated, dimensions:', vector?.length);

            if (!vector || vector.length === 0) {
                debug('ERROR: empty embedding vector returned');
                return { error: 'Embedding returned empty vector. Check your embedding provider.' };
            }

            // Truncate vector to match store dimensions (Matryoshka embeddings)
            if (storeConfig.dimensions && vector.length > storeConfig.dimensions) {
                debug(`truncating embedding from ${vector.length} to ${storeConfig.dimensions} dimensions`);
                vector = vector.slice(0, storeConfig.dimensions);
            }

            // Search Qdrant
            const client = new QdrantClient({
                url: storeConfig.url,
                apiKey: storeConfig.apiKey,
                checkCompatibility: false,
            });
            debug('QdrantClient created, searching collection:', storeConfig.collection);

            const searchParams: any = {
                vector,
                limit,
            };
            if (score_threshold !== undefined) {
                searchParams.score_threshold = score_threshold;
            }
            if (filter !== undefined) {
                searchParams.filter = filter;
            }
            debug('search params:', { vectorDims: vector.length, limit, score_threshold });

            const searchResult = await client.search(storeConfig.collection, searchParams);
            debug('search returned', searchResult.length, 'results');

            if (searchResult.length > 0) {
                debug('top result:', { id: searchResult[0].id, score: searchResult[0].score, payloadKeys: Object.keys(searchResult[0].payload || {}) });
            }

            return {
                store: storeName,
                collection: storeConfig.collection,
                query,
                results: searchResult.map((point: any) => ({
                    id: point.id,
                    score: point.score,
                    payload: point.payload,
                })),
            };
        } catch (err: any) {
            debug('ERROR:', err.message, err.stack);
            return { error: `Qdrant search failed: ${err.message}` };
        }
    },
};
