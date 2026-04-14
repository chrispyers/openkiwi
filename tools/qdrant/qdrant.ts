import * as fs from 'node:fs';
import * as path from 'node:path';
import { QdrantClient } from '@qdrant/js-client-rest';
import { loadConfig } from '../../src/config-manager.js';
import { createEmbedding } from '../../src/llm-provider.js';
import { resolveWorkspacePath, WORKSPACE_DIR } from '../lib/workspace.js';

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
    action: 'search' | 'ingest';
    store: string;
    // search params
    query?: string;
    limit?: number;
    score_threshold?: number;
    filter?: {
        must?: Record<string, unknown>[];
        should?: Record<string, unknown>[];
        must_not?: Record<string, unknown>[];
    };
    // ingest params
    input_path?: string;
    chunk_size?: number;
    chunk_overlap?: number;
    _context?: {
        agentId?: string;
        toolConfig?: {
            stores?: Record<string, QdrantStoreConfig>;
        };
    };
}

// ── Store / provider resolution ────────────────────────────────────────────────

function getAvailableStoreNames(): string[] {
    const names: string[] = [];
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

function resolveStoreConfig(storeName: string, context?: QdrantArgs['_context']): QdrantStoreConfig | { error: string } {
    const stores = context?.toolConfig?.stores;

    if (stores) {
        const validStores = Object.fromEntries(Object.entries(stores).filter(([, s]) => s.url));
        if (Object.keys(validStores).length > 0) {
            const store = validStores[storeName];
            if (!store) {
                return { error: `Store "${storeName}" not found. Available stores: ${Object.keys(validStores).join(', ')}` };
            }
            if (!store.apiKey && process.env.QDRANT_API_KEY) store.apiKey = process.env.QDRANT_API_KEY;
            return store;
        }
    }

    try {
        const config = loadConfig();
        const configStores = (config as any).tools?.qdrant?.stores;
        if (configStores && typeof configStores === 'object') {
            const validStores = Object.fromEntries(Object.entries(configStores).filter(([, s]) => (s as any)?.url));
            if (Object.keys(validStores).length > 0) {
                const store = validStores[storeName] as QdrantStoreConfig | undefined;
                if (!store) {
                    return { error: `Store "${storeName}" not found. Available stores: ${Object.keys(validStores).join(', ')}` };
                }
                if (!store.apiKey && process.env.QDRANT_API_KEY) store.apiKey = process.env.QDRANT_API_KEY;
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
    const providerConfig = providers.find((p: any) => p.description === embeddingsModel)
        ?? providers.find((p: any) => p.model === embeddingsModel);
    if (!providerConfig) {
        return { error: `Embedding provider "${embeddingsModel}" not found in configured providers.` };
    }
    return { baseUrl: providerConfig.endpoint, modelId: providerConfig.model, apiKey: providerConfig.apiKey };
}

// ── Chunking ───────────────────────────────────────────────────────────────────

interface Chunk {
    text: string;
    index: number;
}

/**
 * Split text into overlapping chunks. Tries to split on paragraph boundaries
 * first; falls back to hard splits when paragraphs are too large.
 */
function chunkText(text: string, chunkSize: number, overlap: number): Chunk[] {
    const chunks: Chunk[] = [];
    const paragraphs = text.split(/\n{2,}/);
    let buffer = '';
    let chunkIndex = 0;

    const flush = (force = false) => {
        const trimmed = buffer.trim();
        if (!trimmed) return;
        if (trimmed.length >= chunkSize || force) {
            // Hard-split if the buffer itself is oversized
            if (trimmed.length > chunkSize * 1.5) {
                let pos = 0;
                while (pos < trimmed.length) {
                    chunks.push({ text: trimmed.slice(pos, pos + chunkSize), index: chunkIndex++ });
                    pos += chunkSize - overlap;
                }
            } else {
                chunks.push({ text: trimmed, index: chunkIndex++ });
            }
            // Carry overlap into next buffer
            buffer = trimmed.slice(Math.max(0, trimmed.length - overlap));
        }
    };

    for (const para of paragraphs) {
        buffer += (buffer ? '\n\n' : '') + para;
        if (buffer.length >= chunkSize) flush();
    }
    flush(true);

    return chunks;
}

// ── File discovery ─────────────────────────────────────────────────────────────

function collectMarkdownFiles(dirOrFile: string): string[] {
    const stat = fs.statSync(dirOrFile);
    if (stat.isFile()) return dirOrFile.endsWith('.md') ? [dirOrFile] : [];
    const files: string[] = [];
    const recurse = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) recurse(full);
            else if (entry.isFile() && entry.name.endsWith('.md')) files.push(full);
        }
    };
    recurse(dirOrFile);
    return files;
}

// ── Metadata extraction ────────────────────────────────────────────────────────

/**
 * Pull the title from the first H1 line, and the Confluence source URL
 * from the header block our confluence tool writes.
 */
function extractMetadata(content: string, filePath: string): { title: string; source_url?: string; page_id?: string } {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : path.basename(filePath, '.md');
    const urlMatch = content.match(/^>\s*Source:\s*(.+)$/m);
    const idMatch = content.match(/ID:\s*`([^`]+)`/);
    return {
        title,
        source_url: urlMatch ? urlMatch[1].trim() : undefined,
        page_id: idMatch ? idMatch[1].trim() : undefined,
    };
}

// ── Tool definition ────────────────────────────────────────────────────────────

const storeProperty: Record<string, any> = {
    type: 'string',
    description: 'The name of the Qdrant store to use.',
};
if (availableStores.length > 0) {
    storeProperty.enum = availableStores;
    storeProperty.description = `The Qdrant store to use. Available: ${availableStores.join(', ')}`;
}

export default {
    definition: {
        name: 'qdrant',
        displayName: 'Qdrant',
        description:
            'Vector store tool with two actions: ' +
            '(1) action="ingest" — reads all .md files from a workspace directory, splits them into chunks, generates embeddings, and upserts them into Qdrant. Use this when the user asks to ingest, import, index, or embed files into Qdrant. ' +
            '(2) action="search" — semantic similarity search using a natural language query. ' +
            (availableStores.length > 0 ? `Available stores: ${availableStores.join(', ')}. ` : '') +
            'IMPORTANT: Do NOT use bash or write scripts to do this — use this tool directly.',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['search', 'ingest'],
                    description:
                        '"ingest": read .md files from input_path, embed them, and upsert into Qdrant. ' +
                        '"search": semantic similarity search with a query string.',
                },
                store: storeProperty,
                // search
                query: {
                    type: 'string',
                    description: '(search) Natural language search query.',
                },
                limit: {
                    type: 'number',
                    description: '(search) Maximum number of results to return (default: 5).',
                },
                score_threshold: {
                    type: 'number',
                    description: '(search) Minimum similarity score threshold for results.',
                },
                filter: {
                    type: 'object',
                    description: '(search) Qdrant filter object with must/should/must_not arrays.',
                },
                // ingest
                input_path: {
                    type: 'string',
                    description: '(ingest) Workspace-relative path to a directory or single .md file. All .md files found recursively will be ingested. Example: "confluence/ENG".',
                },
                chunk_size: {
                    type: 'number',
                    description: '(ingest) Target character length per chunk (default: 1500).',
                },
                chunk_overlap: {
                    type: 'number',
                    description: '(ingest) Overlap in characters between consecutive chunks (default: 150).',
                },
            },
            required: ['action', 'store'],
        },
    },

    handler: async (args: QdrantArgs) => {
        const { action, store: storeName, _context } = args;

        const storeConfig = resolveStoreConfig(storeName, _context);
        if ('error' in storeConfig) return storeConfig;

        const embeddingProvider = resolveEmbeddingProvider();
        if ('error' in embeddingProvider) return embeddingProvider;

        const client = new QdrantClient({ url: storeConfig.url, apiKey: storeConfig.apiKey, checkCompatibility: false });

        // ── SEARCH ──────────────────────────────────────────────────────────────
        if (action === 'search') {
            const { query, limit = 5, score_threshold, filter } = args;
            if (!query?.trim()) return { error: 'query is required and must not be empty.' };

            debug('search:', { store: storeName, query: query.slice(0, 80), limit });

            try {
                const embeddings = await createEmbedding(embeddingProvider, query);
                let vector = embeddings[0];
                if (!vector?.length) return { error: 'Embedding returned empty vector. Check your embedding provider.' };
                if (storeConfig.dimensions && vector.length > storeConfig.dimensions) {
                    vector = vector.slice(0, storeConfig.dimensions);
                }

                const searchParams: any = { vector, limit };
                if (score_threshold !== undefined) searchParams.score_threshold = score_threshold;
                if (filter !== undefined) searchParams.filter = filter;

                const searchResult = await client.search(storeConfig.collection, searchParams);
                return {
                    store: storeName,
                    collection: storeConfig.collection,
                    query,
                    results: searchResult.map((point: any) => ({
                        id: point.id,
                        score: point.score,
                        payload: {
                            ...point.payload,
                            text: typeof point.payload?.text === 'string' && point.payload.text.length > 500
                                ? point.payload.text.slice(0, 500) + '…'
                                : point.payload?.text,
                        },
                    })),
                };
            } catch (e: any) {
                return { error: `Qdrant search failed: ${e.message}` };
            }
        }

        // ── INGEST ──────────────────────────────────────────────────────────────
        if (action === 'ingest') {
            const { input_path, chunk_size = 1500, chunk_overlap = 150 } = args;
            if (!input_path) return { error: 'input_path is required for the ingest action.' };

            const { safe: resolvedInput, error: pathError } = resolveWorkspacePath(input_path);
            if (pathError) return { error: pathError };
            if (!fs.existsSync(resolvedInput)) return { error: `Path not found in workspace: ${input_path}` };

            const files = collectMarkdownFiles(resolvedInput);
            if (files.length === 0) return { error: `No .md files found at: ${input_path}` };

            debug('ingest:', { store: storeName, files: files.length, chunk_size, chunk_overlap });

            // Ensure collection exists — probe with a dummy search to detect missing collection
            let dims = storeConfig.dimensions;
            if (!dims) {
                // Determine dimensions from a real embedding
                const probe = await createEmbedding(embeddingProvider, 'probe');
                dims = probe[0]?.length ?? 1536;
            }

            try {
                await client.getCollection(storeConfig.collection);
                debug('collection exists:', storeConfig.collection);
            } catch {
                debug('creating collection:', storeConfig.collection, 'dims:', dims);
                await client.createCollection(storeConfig.collection, {
                    vectors: { size: dims, distance: 'Cosine' },
                });
            }

            let totalChunks = 0;
            let totalFiles = 0;
            const errors: string[] = [];
            const BATCH_SIZE = 32;
            const pointBuffer: any[] = [];
            let pointId = Date.now(); // monotonically increasing ID seed

            const flushBatch = async () => {
                if (pointBuffer.length === 0) return;
                await client.upsert(storeConfig.collection, { wait: true, points: pointBuffer.splice(0) });
            };

            for (const filePath of files) {
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const relPath = path.relative(WORKSPACE_DIR, filePath);
                    const meta = extractMetadata(content, filePath);
                    const chunks = chunkText(content, chunk_size, chunk_overlap);

                    for (const chunk of chunks) {
                        const embeddings = await createEmbedding(embeddingProvider, chunk.text);
                        let vector = embeddings[0];
                        if (!vector?.length) continue;
                        if (storeConfig.dimensions && vector.length > storeConfig.dimensions) {
                            vector = vector.slice(0, storeConfig.dimensions);
                        }

                        pointBuffer.push({
                            id: pointId++,
                            vector,
                            payload: {
                                text: chunk.text,
                                title: meta.title,
                                source_path: relPath,
                                ...(meta.source_url && { source_url: meta.source_url }),
                                ...(meta.page_id && { page_id: meta.page_id }),
                                chunk_index: chunk.index,
                            },
                        });

                        if (pointBuffer.length >= BATCH_SIZE) await flushBatch();
                        totalChunks++;
                    }

                    totalFiles++;
                } catch (e: any) {
                    errors.push(`${path.relative(WORKSPACE_DIR, filePath)}: ${e.message}`);
                }
            }

            await flushBatch(); // flush any remaining

            return {
                success: errors.length === 0,
                filesIngested: totalFiles,
                totalFiles: files.length,
                chunksUpserted: totalChunks,
                collection: storeConfig.collection,
                store: storeName,
                ...(errors.length > 0 && { errors }),
            };
        }

        return { error: `Unknown action: "${action}". Valid actions: search, ingest.` };
    },
};
