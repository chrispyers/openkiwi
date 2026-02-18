
import { AgentManager } from '../agent-manager.js';

export const memory_search = {
    definition: {
        name: 'memory_search',
        description: 'Search the agent\'s long-term memory (MEMORY.md) for relevant information. Use this to recall facts, preferences, or past decisions.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The search query.'
                },
                max_results: {
                    type: 'integer',
                    description: 'Maximum number of results to return (default: 5).'
                }
            },
            required: ['query']
        }
    },
    handler: async ({ query, max_results = 5, _context }: { query: string; max_results?: number; _context?: { agentId: string } }) => {
        if (!_context?.agentId) {
            return { error: 'Agent context required' };
        }

        try {
            const manager = await AgentManager.getMemoryManager(_context.agentId);
            // Ensure we have latest data (optional, but good for "I just told you X")
            // manager.sync() is async, maybe we skip it for speed or trust the watcher? 
            // We implemented sync() to check hash, so it's cheap if no changes.
            await manager.sync();

            const results = await manager.search(query, max_results);

            if (results.length === 0) {
                return {
                    results: [],
                    message: "No relevant memory found."
                };
            }

            return {
                results: results.map(r => ({
                    text: r.snippet || r.text, // Use snippet if available
                    score: r.score,
                    location: `${r.path}:${r.start_line}-${r.end_line}`
                }))
            };
        } catch (error: any) {
            return { error: `Memory search failed: ${error.message}` };
        }
    }
};

export const memory_get = {
    definition: {
        name: 'memory_get',
        description: 'Read a specific section of MEMORY.md. Use this when you need to read the full context around a search result.',
        parameters: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The file path (must be MEMORY.md).'
                },
                start_line: {
                    type: 'integer',
                    description: 'Starting line number (1-indexed).'
                },
                lines: {
                    type: 'integer',
                    description: 'Number of lines to read.'
                }
            },
            required: ['path']
        }
    },
    handler: async ({ path: filePath, start_line, lines, _context }: { path: string; start_line?: number; lines?: number; _context?: { agentId: string } }) => {
        if (!_context?.agentId) {
            return { error: 'Agent context required' };
        }

        try {
            const manager = await AgentManager.getMemoryManager(_context.agentId);
            const text = await manager.readFile(filePath, start_line, lines);

            return {
                path: filePath,
                content: text
            };
        } catch (error: any) {
            return { error: `Memory read failed: ${error.message}` };
        }
    }
};
