
import { AgentManager } from '../agent-manager.js';

export const memory_search = {
    definition: {
        name: 'memory_search',
        displayName: "Memory: Search",
        pluginType: 'skill',
        description: 'Search long-term memory for relevant information. Searches agent-specific memory by default, or shared memory with shared: true.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The search query. Use "recent" to list recent memories.'
                },
                max_results: {
                    type: 'integer',
                    description: 'Maximum number of results to return (default: 5).'
                },
                shared: {
                    type: 'boolean',
                    description: 'If true, searches shared memory instead of agent-specific memory. Defaults to false.'
                }
            },
            required: ['query']
        }
    },
    handler: async ({ query, max_results = 5, shared = false, _context }: { query: string; max_results?: number; shared?: boolean; _context?: { agentId: string } }) => {
        if (!_context?.agentId) {
            return { error: 'Agent context required' };
        }

        try {
            // For shared memory, do a simple text search since it doesn't have a dedicated index manager
            if (shared) {
                const fs = await import('node:fs');
                const path = await import('node:path');
                const sharedPath = path.resolve(process.cwd(), 'config', 'SHARED_MEMORY.md');
                if (!fs.existsSync(sharedPath)) {
                    return { results: [], message: 'No shared memory file exists yet.' };
                }
                const content = fs.readFileSync(sharedPath, 'utf-8');
                const lines = content.split('\n').filter(l => l.trim().startsWith('- ['));
                const queryLower = query.toLowerCase();

                let matched = queryLower === 'recent'
                    ? lines.slice(-max_results)
                    : lines.filter(l => l.toLowerCase().includes(queryLower)).slice(0, max_results);

                if (matched.length === 0) {
                    return { results: [], message: 'No matching shared memory found.' };
                }
                return { results: matched.map(l => ({ text: l.trim(), score: 1.0, location: 'SHARED_MEMORY.md' })) };
            }

            const manager = await AgentManager.getMemoryManager(_context.agentId);
            await manager.sync();

            const results = await manager.search(query, max_results);

            if (results.length === 0) {
                return {
                    results: [],
                    message: "No relevant memory found. The information may still be in your injected context above."
                };
            }

            return {
                results: results.map(r => ({
                    text: r.snippet || r.text,
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
        displayName: 'Memory: Get',
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

/**
 * Convert a category slug (e.g., "personal_info") to a section header (e.g., "Personal Info").
 */
function categoryToHeader(category: string): string {
    return category
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Parse a MEMORY.md file into sections. Returns a map of section header → entries,
 * plus a "preamble" key for content before any section header.
 */
function parseMemorySections(content: string): { preamble: string; sections: Map<string, string[]> } {
    const lines = content.split('\n');
    const sections = new Map<string, string[]>();
    let preamble = '';
    let currentSection: string | null = null;

    for (const line of lines) {
        const headerMatch = line.match(/^## (.+)$/);
        if (headerMatch) {
            currentSection = headerMatch[1].trim();
            if (!sections.has(currentSection)) {
                sections.set(currentSection, []);
            }
        } else if (currentSection) {
            sections.get(currentSection)!.push(line);
        } else {
            preamble += line + '\n';
        }
    }

    return { preamble: preamble.trimEnd(), sections };
}

/**
 * Migrate a flat MEMORY.md (with inline category tags) into section-based format.
 * Returns the restructured content, or null if no migration is needed.
 */
function migrateToSections(content: string): string | null {
    // If there are already section headers, no migration needed
    if (/^## /m.test(content)) return null;

    const lines = content.split('\n');
    const preambleLines: string[] = [];
    const categorized = new Map<string, string[]>();

    for (const line of lines) {
        const match = line.match(/^- \[(\d{4}-\d{2}-\d{2})\] \(([^)]+)\):\s*(.+)$/);
        if (match) {
            const [, date, category, text] = match;
            const header = categoryToHeader(category);
            if (!categorized.has(header)) {
                categorized.set(header, []);
            }
            categorized.get(header)!.push(`- [${date}] ${text}`);
        } else if (line.trim().startsWith('- [')) {
            // Entry without category → put in General
            if (!categorized.has('General')) {
                categorized.set('General', []);
            }
            categorized.get('General')!.push(line);
        } else {
            preambleLines.push(line);
        }
    }

    if (categorized.size === 0) return null;

    let result = preambleLines.join('\n').trimEnd();
    for (const [header, entries] of categorized) {
        result += `\n\n## ${header}\n${entries.join('\n')}`;
    }

    return result.trim() + '\n';
}

/**
 * Write an entry into a section-based MEMORY.md file.
 */
function writeEntryToSection(content: string, category: string, entry: string): string {
    const sectionHeader = categoryToHeader(category);
    const { preamble, sections } = parseMemorySections(content);

    if (sections.has(sectionHeader)) {
        sections.get(sectionHeader)!.push(entry);
    } else {
        sections.set(sectionHeader, [entry]);
    }

    // Reconstruct the file
    let result = preamble;
    for (const [header, entries] of sections) {
        // Filter out empty lines at end of section
        const cleaned = entries.filter((l, i) => i < entries.length - 1 || l.trim() !== '');
        result += `\n\n## ${header}\n${cleaned.join('\n')}`;
    }

    return result.trim() + '\n';
}

export const save_to_memory = {
    definition: {
        name: 'save_to_memory',
        displayName: 'Memory: Save',
        description: 'Save important information to long-term memory. Use this to remember user preferences, important facts, or context that should persist across sessions. Set shared: true for facts useful to all agents (project info, user preferences).',
        parameters: {
            type: 'object',
            properties: {
                text: {
                    type: 'string',
                    description: 'The information to save. Be concise.'
                },
                category: {
                    type: 'string',
                    description: 'Category for the memory (e.g., "preferences", "personal_info", "project_details"). Defaults to "general".'
                },
                shared: {
                    type: 'boolean',
                    description: 'If true, saves to shared memory accessible by all agents. Defaults to false (agent-specific memory).'
                }
            },
            required: ['text']
        }
    },
    handler: async ({ text, category = 'general', shared = false, _context }: { text: string; category?: string; shared?: boolean; _context?: { agentId: string } }) => {
        if (!_context?.agentId) {
            return { error: 'Agent context required' };
        }

        try {
            const fs = await import('node:fs');
            const path = await import('node:path');

            // Determine target file
            const memoryFile = shared
                ? path.resolve(process.cwd(), 'config', 'SHARED_MEMORY.md')
                : path.join(path.resolve(process.cwd(), 'agents', _context.agentId), 'MEMORY.md');

            const memoryDir = path.dirname(memoryFile);
            if (!fs.existsSync(memoryDir)) {
                fs.mkdirSync(memoryDir, { recursive: true });
            }

            // Read existing content
            let existingContent = '';
            if (fs.existsSync(memoryFile)) {
                existingContent = fs.readFileSync(memoryFile, 'utf-8');

                // Check exact match
                if (existingContent.includes(text)) {
                    const lines = existingContent.split('\n');
                    const matchedLine = lines.find(l => l.includes(text));
                    let savedDate = 'an earlier date';
                    if (matchedLine) {
                        const dateMatch = matchedLine.match(/\[(\d{4}-\d{2}-\d{2})\]/);
                        if (dateMatch) savedDate = dateMatch[1];
                    }
                    return { success: true, message: `Already saved on ${savedDate}` };
                }
            }

            // Vector similarity dedup (agent memory only)
            if (!shared) {
                try {
                    const manager = await AgentManager.getMemoryManager(_context.agentId);
                    await manager.sync();
                    const results = await manager.search(text, 1);
                    if (results.length > 0 && results[0].score > 0.85) {
                        const memText = results[0].snippet || results[0].text;
                        let savedDate = 'an earlier date';
                        const dateMatch = memText.match(/\[(\d{4}-\d{2}-\d{2})\]/);
                        if (dateMatch) savedDate = dateMatch[1];
                        return { success: true, message: `Already saved on ${savedDate}` };
                    }
                } catch { }
            }

            // Migrate flat format to sections if needed
            if (existingContent && !shared) {
                const migrated = migrateToSections(existingContent);
                if (migrated) {
                    existingContent = migrated;
                }
            }

            // Format and write
            const date = new Date().toISOString().split('T')[0];
            const entry = `- [${date}] ${text}`;

            if (existingContent && /^## /m.test(existingContent)) {
                // Section-based file — insert into the right section
                const newContent = writeEntryToSection(existingContent, category, entry);
                fs.writeFileSync(memoryFile, newContent, 'utf-8');
            } else {
                // New file or no sections yet — create with section
                const header = existingContent ? existingContent.trimEnd() + '\n\n' : '# Long-term Memory\n\n';
                const sectionHeader = categoryToHeader(category);
                fs.writeFileSync(memoryFile, `${header}## ${sectionHeader}\n${entry}\n`, 'utf-8');
            }

            const target = shared ? 'shared memory' : 'memory';
            return { success: true, message: `Saved to ${target} under "${categoryToHeader(category)}": ${text}` };
        } catch (error: any) {
            return { error: `Memory save failed: ${error.message}` };
        }
    }
};
