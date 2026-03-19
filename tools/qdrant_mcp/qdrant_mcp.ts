import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { loadConfig } from '../../src/config-manager.js';

const DEBUG = process.env.QDRANT_MCP_DEBUG === 'true' || process.env.QDRANT_MCP_DEBUG === '1';

function debug(...args: unknown[]) {
    if (DEBUG) console.log('[QdrantMCP:DEBUG]', ...args);
}

interface QdrantMcpConfig {
    command: string;           // e.g. "npx" or "uvx" or path to binary
    args?: string[];           // e.g. ["-y", "@qdrant/mcp-server"]
    env?: Record<string, string>;
}

interface QdrantMcpArgs {
    action: 'search' | 'store' | 'list_collections' | 'get_collection';
    // search
    collection?: string;
    query?: string;
    limit?: number;
    score_threshold?: number;
    filter?: Record<string, unknown>;
    // store
    points?: Array<{
        id?: string;
        payload: Record<string, any>;
        document: string;
    }>;
    // get_collection
    collection_name?: string;
    _context?: {
        agentId?: string;
        toolConfig?: QdrantMcpConfig;
    };
}

function resolveMcpConfig(context?: QdrantMcpArgs['_context']): QdrantMcpConfig | { error: string } {
    // Agent-specific config first
    if (context?.toolConfig?.command) {
        return context.toolConfig;
    }

    // Global config
    try {
        const config = loadConfig();
        const mcpConfig = (config as any).tools?.qdrant_mcp;
        if (mcpConfig?.command) return mcpConfig;
    } catch { /* config not available */ }

    return { error: 'No Qdrant MCP server configured. Set tools.qdrant_mcp.command in config (e.g. "npx" with args ["-y", "@qdrant/mcp-server"]).' };
}

// Connection pool: reuse MCP client connections
let mcpClient: Client | null = null;
let mcpTransport: StdioClientTransport | null = null;
let mcpConfigHash = '';

function configHash(cfg: QdrantMcpConfig): string {
    return JSON.stringify({ command: cfg.command, args: cfg.args, env: cfg.env });
}

async function getMcpClient(cfg: QdrantMcpConfig): Promise<Client> {
    const hash = configHash(cfg);

    // Reuse existing connection if config hasn't changed
    if (mcpClient && mcpConfigHash === hash) {
        debug('reusing existing MCP client connection');
        return mcpClient;
    }

    // Close old connection if exists
    if (mcpTransport) {
        try { await mcpTransport.close(); } catch { /* ignore */ }
        mcpClient = null;
        mcpTransport = null;
    }

    debug('spawning MCP server:', cfg.command, cfg.args);

    const transport = new StdioClientTransport({
        command: cfg.command,
        args: cfg.args,
        env: { ...process.env, ...cfg.env } as Record<string, string>,
    });

    const client = new Client({ name: 'openkiwi-qdrant', version: '1.0.0' });
    await client.connect(transport);

    mcpClient = client;
    mcpTransport = transport;
    mcpConfigHash = hash;

    debug('MCP client connected');
    return client;
}

// Map our action names to the MCP server's tool names
// The official @qdrant/mcp-server exposes: qdrant-store, qdrant-find, qdrant-list-collections, qdrant-get-collection
function resolveToolName(action: string, availableTools: string[]): string | null {
    const mappings: Record<string, string[]> = {
        search: ['qdrant-find', 'qdrant_find', 'qdrant-search', 'qdrant_search', 'search', 'find'],
        store: ['qdrant-store', 'qdrant_store', 'store', 'upsert'],
        list_collections: ['qdrant-list-collections', 'qdrant_list_collections', 'list_collections', 'list-collections'],
        get_collection: ['qdrant-get-collection', 'qdrant_get_collection', 'get_collection', 'get-collection'],
    };

    const candidates = mappings[action] || [action];
    for (const name of candidates) {
        if (availableTools.includes(name)) return name;
    }
    return null;
}

export default {
    definition: {
        name: 'qdrant_mcp',
        displayName: 'Qdrant (MCP)',
        description: 'Search and store data in Qdrant via an MCP server. Supports semantic search, data storage, and collection management. Configure the MCP server command in tools.qdrant_mcp.',
        pluginType: 'integration',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['search', 'store', 'list_collections', 'get_collection'],
                    description: 'The action to perform: search (semantic query), store (upsert points), list_collections, or get_collection.',
                },
                collection: {
                    type: 'string',
                    description: 'The Qdrant collection name to search or store into.',
                },
                query: {
                    type: 'string',
                    description: 'Natural language search query (for search action).',
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of results to return (default: 5, for search action).',
                },
                score_threshold: {
                    type: 'number',
                    description: 'Minimum similarity score threshold (for search action).',
                },
                filter: {
                    type: 'object',
                    description: 'Qdrant filter object with must/should/must_not arrays (for search action).',
                },
                points: {
                    type: 'array',
                    description: 'Array of points to store. Each point has { document: string, payload: object, id?: string }.',
                    items: {
                        type: 'object',
                        properties: {
                            document: { type: 'string', description: 'Text content to embed and store.' },
                            payload: { type: 'object', description: 'Metadata payload to attach to the point.' },
                            id: { type: 'string', description: 'Optional point ID (UUID generated if omitted).' },
                        },
                        required: ['document', 'payload'],
                    },
                },
                collection_name: {
                    type: 'string',
                    description: 'Collection name for get_collection action.',
                },
            },
            required: ['action'],
        },
    },

    handler: async (args: QdrantMcpArgs) => {
        const { action, collection, query, limit = 5, score_threshold, filter, points, collection_name, _context } = args;

        debug('handler called:', { action, collection, query: query?.slice(0, 80), limit });

        const mcpConfig = resolveMcpConfig(_context);
        if ('error' in mcpConfig) {
            debug('config resolution failed:', mcpConfig.error);
            return mcpConfig;
        }

        try {
            const client = await getMcpClient(mcpConfig);

            // Discover available tools from the MCP server
            const { tools } = await client.listTools();
            const toolNames = tools.map((t: any) => t.name);
            debug('MCP server tools:', toolNames);

            const toolName = resolveToolName(action, toolNames);
            if (!toolName) {
                return { error: `MCP server does not support action "${action}". Available tools: ${toolNames.join(', ')}` };
            }

            // Build arguments based on action
            let toolArgs: Record<string, any> = {};

            switch (action) {
                case 'search': {
                    if (!collection) return { error: 'collection is required for search action' };
                    if (!query || query.trim().length === 0) return { error: 'query is required for search action' };
                    toolArgs = { collection_name: collection, query };
                    if (limit) toolArgs.limit = limit;
                    if (score_threshold !== undefined) toolArgs.score_threshold = score_threshold;
                    if (filter) toolArgs.filter = filter;
                    break;
                }
                case 'store': {
                    if (!collection) return { error: 'collection is required for store action' };
                    if (!points || points.length === 0) return { error: 'points array is required for store action' };
                    // The MCP server may accept different argument shapes. Try the common ones.
                    toolArgs = { collection_name: collection, points };
                    break;
                }
                case 'list_collections': {
                    // No arguments needed
                    break;
                }
                case 'get_collection': {
                    const name = collection_name || collection;
                    if (!name) return { error: 'collection_name is required for get_collection action' };
                    toolArgs = { collection_name: name };
                    break;
                }
            }

            debug('calling MCP tool:', toolName, 'with args:', toolArgs);
            const result = await client.callTool({ name: toolName, arguments: toolArgs });
            debug('MCP tool result received');

            // Parse the MCP result — content is typically an array of { type, text } objects
            if (result.content && Array.isArray(result.content)) {
                const textParts = result.content
                    .filter((c: any) => c.type === 'text')
                    .map((c: any) => c.text);

                // Try to parse as JSON for structured results
                const combined = textParts.join('\n');
                try {
                    return JSON.parse(combined);
                } catch {
                    return { result: combined };
                }
            }

            return result;
        } catch (err: any) {
            debug('ERROR:', err.message);

            // If connection failed, reset the client so next call retries
            if (err.message?.includes('spawn') || err.message?.includes('ENOENT') || err.message?.includes('connect')) {
                mcpClient = null;
                mcpTransport = null;
                mcpConfigHash = '';
            }

            return { error: `Qdrant MCP error: ${err.message}` };
        }
    },
};
