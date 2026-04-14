import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @qdrant/js-client-rest
const mockSearch = vi.fn();
vi.mock('@qdrant/js-client-rest', () => {
    return {
        QdrantClient: class MockQdrantClient {
            url: string;
            apiKey?: string;
            constructor(opts: any) {
                this.url = opts.url;
                this.apiKey = opts.apiKey;
                MockQdrantClient._lastInstance = this;
                MockQdrantClient._lastOpts = opts;
            }
            search = mockSearch;
            static _lastInstance: any;
            static _lastOpts: any;
        },
    };
});

// Mock config-manager
const mockLoadConfig = vi.fn();
vi.mock('../../src/config-manager.js', () => ({
    loadConfig: () => mockLoadConfig(),
}));

// Mock llm-provider
const mockCreateEmbedding = vi.fn();
vi.mock('../../src/llm-provider.js', () => ({
    createEmbedding: (...args: any[]) => mockCreateEmbedding(...args),
}));

import { QdrantClient } from '@qdrant/js-client-rest';
import tool from '../qdrant/qdrant.js';

const MockQdrantClient = QdrantClient as any;

function defaultConfig() {
    return {
        memory: {
            useEmbeddings: true,
            embeddingsModel: 'text-embedding-nomic-embed-text-v1.5',
        },
        providers: [
            {
                description: 'text-embedding-nomic-embed-text-v1.5',
                endpoint: 'http://192.168.0.103:1234',
                model: 'text-embedding-nomic-embed-text-v1.5',
            },
        ],
    };
}

function storeContext(stores: Record<string, any> = {}) {
    return {
        agentId: 'test-agent',
        toolConfig: { stores },
    };
}

describe('qdrant tool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.QDRANT_URL;
        delete process.env.QDRANT_API_KEY;
        delete process.env.QDRANT_COLLECTION;
        mockLoadConfig.mockReturnValue(defaultConfig());
        mockCreateEmbedding.mockResolvedValue([[0.1, 0.2, 0.3]]);
        mockSearch.mockResolvedValue([]);
    });

    describe('definition', () => {
        it('should export a valid tool definition', () => {
            expect(tool.definition.name).toBe('qdrant');
            expect(tool.definition.parameters.type).toBe('object');
            expect(tool.definition.parameters.required).toEqual(['action', 'store']);
            expect(tool.definition.parameters.properties.action.enum).toEqual(['search', 'ingest']);
        });

        it('should have a handler function', () => {
            expect(typeof tool.handler).toBe('function');
        });
    });

    describe('validation', () => {
        it('should reject unknown actions', async () => {
            const result = await tool.handler({
                action: 'delete' as any,
                store: 'kb',
                query: 'test',
                _context: storeContext({ kb: { url: 'http://q:6333', collection: 'c' } }),
            });
            expect(result.error).toMatch(/Unknown action/);
        });

        it('should reject empty query', async () => {
            const result = await tool.handler({
                action: 'search',
                store: 'kb',
                query: '   ',
                _context: storeContext({ kb: { url: 'http://q:6333', collection: 'c' } }),
            });
            expect(result.error).toMatch(/query is required/);
        });

        it('should reject unknown store', async () => {
            const result = await tool.handler({
                action: 'search',
                store: 'nonexistent',
                query: 'test query',
                _context: storeContext({ kb: { url: 'http://q:6333', collection: 'c' } }),
            });
            expect(result.error).toMatch(/Store "nonexistent" not found/);
            expect(result.error).toMatch(/Available stores: kb/);
        });

        it('should reject when no stores configured', async () => {
            const result = await tool.handler({
                action: 'search',
                store: 'anything',
                query: 'test query',
            });
            expect(result.error).toMatch(/No Qdrant stores configured/);
        });

        it('should reject when embedding model not configured', async () => {
            mockLoadConfig.mockReturnValue({ memory: {}, providers: [] });
            const result = await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'test',
                _context: storeContext({ kb: { url: 'http://q:6333', collection: 'c' } }),
            });
            expect(result.error).toMatch(/No embedding model configured/);
        });

        it('should reject when embedding provider not found in providers list', async () => {
            mockLoadConfig.mockReturnValue({
                memory: { embeddingsModel: 'nonexistent-model' },
                providers: [],
            });
            const result = await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'test',
                _context: storeContext({ kb: { url: 'http://q:6333', collection: 'c' } }),
            });
            expect(result.error).toMatch(/Embedding provider "nonexistent-model" not found/);
        });
    });

    describe('config resolution', () => {
        it('should use toolConfig stores when provided', async () => {
            const result = await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'test query',
                _context: storeContext({
                    kb: { url: 'http://qdrant-server:6333', apiKey: 'key123', collection: 'knowledge_base' },
                }),
            });

            expect(result.error).toBeUndefined();
            expect(MockQdrantClient._lastOpts).toEqual({
                url: 'http://qdrant-server:6333',
                apiKey: 'key123',
                checkCompatibility: false,
            });
        });

        it('should fall back to global config when toolConfig stores are empty', async () => {
            mockLoadConfig.mockReturnValue({
                ...defaultConfig(),
                tools: {
                    qdrant: {
                        stores: {
                            mystore: { url: 'http://config-qdrant:6333', collection: 'from_config' },
                        },
                    },
                },
            });

            const result = await tool.handler({
                action: 'search',
                store: 'mystore',
                query: 'test query',
                _context: storeContext({}),
            });

            expect(result.error).toBeUndefined();
            expect(MockQdrantClient._lastOpts).toEqual({
                url: 'http://config-qdrant:6333',
                apiKey: undefined,
                checkCompatibility: false,
            });
            expect(mockSearch).toHaveBeenCalledWith('from_config', expect.any(Object));
        });

        it('should use QDRANT_API_KEY env var when store has no apiKey', async () => {
            process.env.QDRANT_API_KEY = 'env-secret-key';

            const result = await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'test query',
                _context: storeContext({
                    kb: { url: 'http://qdrant:6333', collection: 'c' },
                }),
            });

            expect(result.error).toBeUndefined();
            expect(MockQdrantClient._lastOpts).toEqual({
                url: 'http://qdrant:6333',
                apiKey: 'env-secret-key',
                checkCompatibility: false,
            });
        });

        it('should prefer store apiKey over QDRANT_API_KEY env var', async () => {
            process.env.QDRANT_API_KEY = 'env-key';

            const result = await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'test query',
                _context: storeContext({
                    kb: { url: 'http://qdrant:6333', apiKey: 'store-key', collection: 'c' },
                }),
            });

            expect(result.error).toBeUndefined();
            expect(MockQdrantClient._lastOpts).toEqual({
                url: 'http://qdrant:6333',
                apiKey: 'store-key',
                checkCompatibility: false,
            });
        });

        it('should resolve embedding provider by description', async () => {
            await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'test',
                _context: storeContext({ kb: { url: 'http://q:6333', collection: 'c' } }),
            });

            expect(mockCreateEmbedding).toHaveBeenCalledWith(
                {
                    baseUrl: 'http://192.168.0.103:1234',
                    modelId: 'text-embedding-nomic-embed-text-v1.5',
                    apiKey: undefined,
                },
                'test',
            );
        });

        it('should resolve embedding provider by model name as fallback', async () => {
            mockLoadConfig.mockReturnValue({
                memory: { embeddingsModel: 'text-embedding-nomic-embed-text-v1.5' },
                providers: [
                    {
                        description: 'Different description',
                        endpoint: 'http://192.168.0.103:1234',
                        model: 'text-embedding-nomic-embed-text-v1.5',
                        apiKey: 'model-key',
                    },
                ],
            });

            await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'test',
                _context: storeContext({ kb: { url: 'http://q:6333', collection: 'c' } }),
            });

            expect(mockCreateEmbedding).toHaveBeenCalledWith(
                {
                    baseUrl: 'http://192.168.0.103:1234',
                    modelId: 'text-embedding-nomic-embed-text-v1.5',
                    apiKey: 'model-key',
                },
                'test',
            );
        });
    });

    describe('search', () => {
        it('should embed query and search Qdrant, returning mapped results', async () => {
            mockCreateEmbedding.mockResolvedValue([[0.1, 0.2, 0.3]]);
            mockSearch.mockResolvedValue([
                { id: 'abc-123', score: 0.95, payload: { title: 'Result 1', text: 'Content 1' } },
                { id: 'def-456', score: 0.87, payload: { title: 'Result 2', text: 'Content 2' } },
            ]);

            const result = await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'how to deploy',
                _context: storeContext({
                    kb: { url: 'http://qdrant:6333', collection: 'knowledge_base' },
                }),
            });

            expect(result.store).toBe('kb');
            expect(result.collection).toBe('knowledge_base');
            expect(result.query).toBe('how to deploy');
            expect(result.results).toHaveLength(2);
            expect(result.results[0]).toEqual({
                id: 'abc-123',
                score: 0.95,
                payload: { title: 'Result 1', text: 'Content 1' },
            });
            expect(result.results[1]).toEqual({
                id: 'def-456',
                score: 0.87,
                payload: { title: 'Result 2', text: 'Content 2' },
            });
        });

        it('should return empty results when no matches', async () => {
            mockSearch.mockResolvedValue([]);

            const result = await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'obscure topic',
                _context: storeContext({
                    kb: { url: 'http://qdrant:6333', collection: 'c' },
                }),
            });

            expect(result.results).toEqual([]);
        });

        it('should handle Qdrant errors gracefully', async () => {
            mockSearch.mockRejectedValue(new Error('Connection refused'));

            const result = await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'test',
                _context: storeContext({
                    kb: { url: 'http://qdrant:6333', collection: 'c' },
                }),
            });

            expect(result.error).toMatch(/Qdrant search failed.*Connection refused/);
        });

        it('should handle embedding errors gracefully', async () => {
            mockCreateEmbedding.mockRejectedValue(new Error('Embedding API error: 503'));

            const result = await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'test',
                _context: storeContext({
                    kb: { url: 'http://qdrant:6333', collection: 'c' },
                }),
            });

            expect(result.error).toMatch(/Qdrant search failed.*Embedding API error/);
        });
    });

    describe('options passthrough', () => {
        it('should pass default limit of 5', async () => {
            await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'test',
                _context: storeContext({ kb: { url: 'http://q:6333', collection: 'c' } }),
            });

            expect(mockSearch).toHaveBeenCalledWith('c', {
                vector: [0.1, 0.2, 0.3],
                limit: 5,
            });
        });

        it('should pass custom limit', async () => {
            await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'test',
                limit: 10,
                _context: storeContext({ kb: { url: 'http://q:6333', collection: 'c' } }),
            });

            expect(mockSearch).toHaveBeenCalledWith('c', {
                vector: [0.1, 0.2, 0.3],
                limit: 10,
            });
        });

        it('should pass score_threshold when provided', async () => {
            await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'test',
                score_threshold: 0.8,
                _context: storeContext({ kb: { url: 'http://q:6333', collection: 'c' } }),
            });

            expect(mockSearch).toHaveBeenCalledWith('c', {
                vector: [0.1, 0.2, 0.3],
                limit: 5,
                score_threshold: 0.8,
            });
        });

        it('should not include score_threshold when not provided', async () => {
            await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'test',
                _context: storeContext({ kb: { url: 'http://q:6333', collection: 'c' } }),
            });

            const searchParams = mockSearch.mock.calls[0][1];
            expect(searchParams).not.toHaveProperty('score_threshold');
        });

        it('should pass filter when provided', async () => {
            const filter = {
                must: [{ key: 'metadata.chunk_type', match: { value: 'large' } }],
            };

            await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'test',
                filter,
                _context: storeContext({ kb: { url: 'http://q:6333', collection: 'c' } }),
            });

            expect(mockSearch).toHaveBeenCalledWith('c', {
                vector: [0.1, 0.2, 0.3],
                limit: 5,
                filter,
            });
        });

        it('should not include filter when not provided', async () => {
            await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'test',
                _context: storeContext({ kb: { url: 'http://q:6333', collection: 'c' } }),
            });

            const searchParams = mockSearch.mock.calls[0][1];
            expect(searchParams).not.toHaveProperty('filter');
        });
    });

    describe('dimensions truncation', () => {
        it('should truncate embedding to store dimensions', async () => {
            // Embedding model returns 768 dims, store expects 192
            const fullVector = Array.from({ length: 768 }, (_, i) => i * 0.001);
            mockCreateEmbedding.mockResolvedValue([fullVector]);

            await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'test',
                _context: storeContext({
                    kb: { url: 'http://q:6333', collection: 'c', dimensions: 192 },
                }),
            });

            const searchParams = mockSearch.mock.calls[0][1];
            expect(searchParams.vector).toHaveLength(192);
            expect(searchParams.vector).toEqual(fullVector.slice(0, 192));
        });

        it('should not truncate when embedding matches store dimensions', async () => {
            const vector = Array.from({ length: 192 }, (_, i) => i * 0.001);
            mockCreateEmbedding.mockResolvedValue([vector]);

            await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'test',
                _context: storeContext({
                    kb: { url: 'http://q:6333', collection: 'c', dimensions: 192 },
                }),
            });

            const searchParams = mockSearch.mock.calls[0][1];
            expect(searchParams.vector).toHaveLength(192);
        });

        it('should not truncate when no dimensions configured', async () => {
            await tool.handler({
                action: 'search',
                store: 'kb',
                query: 'test',
                _context: storeContext({
                    kb: { url: 'http://q:6333', collection: 'c' },
                }),
            });

            const searchParams = mockSearch.mock.calls[0][1];
            expect(searchParams.vector).toEqual([0.1, 0.2, 0.3]);
        });
    });
});
