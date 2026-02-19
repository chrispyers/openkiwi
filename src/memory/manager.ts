
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { ensureMemoryIndexSchema } from './schema.js';
import { createEmbedding, type LLMProviderConfig } from '../llm-provider.js';
import crypto from 'node:crypto';
import { logger } from '../logger.js';

const CHUNK_SIZE_CHARS = 1000;
const VECTOR_DIMENSIONS = 1536; // Default for text-embedding-3-small

export interface MemorySearchResult {
    id: string;
    path: string;
    text: string;
    score: number;
    start_line: number;
    end_line: number;
    snippet?: string;
}

export class MemoryIndexManager {
    private db!: Database.Database;
    private agentDir: string;
    private memoryPath: string;
    private providerConfig?: LLMProviderConfig;
    private watcher: fs.FSWatcher | null = null;
    private syncTimeout: NodeJS.Timeout | null = null;

    constructor(agentId: string, providerConfig?: LLMProviderConfig) {
        this.agentDir = path.resolve(process.cwd(), 'agents', agentId);
        this.createAgentDir(this.agentDir);
        this.memoryPath = path.join(this.agentDir, 'MEMORY.md');
        this.providerConfig = providerConfig;

        const dbPath = path.join(this.agentDir, 'memory_index.db');

        try {
            this.db = new Database(dbPath);
            ensureMemoryIndexSchema(this.db);
        } catch (err: any) {
            // Check for corruption
            const isCorrupt = (err.code === 'SQLITE_CORRUPT') ||
                (err.message && String(err.message).includes('database disk image is malformed'));

            if (isCorrupt) {
                const errorMsg = String(err.message || err);
                logger.log({
                    type: 'error',
                    level: 'error',
                    agentId,
                    message: `[Memory] Database corruption detected at ${dbPath}. Rebuilding index...`,
                    data: { error: errorMsg }
                });

                try {
                    this.db?.close();
                } catch (e) { /* ignore */ }

                if (fs.existsSync(dbPath)) {
                    try { fs.unlinkSync(dbPath); } catch (e) { }
                }

                // Retry creation
                this.db = new Database(dbPath);
                ensureMemoryIndexSchema(this.db);

                // Force a full re-sync immediately to repopulate
                this.startWatcher();
                this.sync(true).catch(e => logger.log({
                    type: 'error',
                    level: 'error',
                    agentId,
                    message: `[Memory] Failed to rebuild corrupt index`,
                    data: { error: String(e) }
                }));
                return;
            }
            throw err;
        }

        this.startWatcher();
    }

    private createAgentDir(dir: string) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    private startWatcher() {
        try {
            // Watch the directory to handle atomic saves (rename/replace) correctly
            this.watcher = fs.watch(this.agentDir, (eventType, filename) => {
                if (filename === 'MEMORY.md') {
                    logger.log({
                        type: 'system',
                        level: 'debug',
                        message: `[Memory] Watcher event: ${eventType} on ${filename}`
                    });
                    this.debouncedSync();
                }
            });
            logger.log({ type: 'system', level: 'info', message: `[Memory] Watcher started for ${this.agentDir}` });
        } catch (err) {
            logger.log({ type: 'error', level: 'error', message: `[Memory] Failed to start watcher: ${err}` });
        }
    }

    private debouncedSync() {
        if (this.syncTimeout) clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(() => {
            logger.log({ type: 'system', level: 'info', message: `[Memory] Detected change in MEMORY.md, syncing...` });
            this.sync().catch(err => logger.log({ type: 'error', level: 'error', message: `[Memory] Auto-sync failed: ${err}` }));
        }, 1000); // Debounce for 1 second
    }

    public async sync(force: boolean = false): Promise<void> {
        if (!fs.existsSync(this.memoryPath)) {
            // If memory file doesn't exist, maybe create an empty one?
            // For now, just skip syncing.
            return;
        }

        const stats = fs.statSync(this.memoryPath);
        const content = fs.readFileSync(this.memoryPath, 'utf-8');
        const fileHash = crypto.createHash('sha256').update(content).digest('hex');

        // Check if file has changed
        const row = this.db.prepare('SELECT hash FROM files WHERE path = ?').get(this.memoryPath) as { hash: string } | undefined;

        if (!force && row && row.hash === fileHash) {
            return;
        }

        console.log(`[Memory] Syncing ${this.memoryPath}...`);

        // 1. Chunking
        const chunks = this.chunkFile(content);

        // 2. Embeddings (Async, so do this before writing to DB if possible, or update later)
        // For simplicity, we'll do it sequentially.
        const chunksWithEmbeddings = [];

        for (const chunk of chunks) {
            let embedding: number[] = [];
            if (this.providerConfig) {
                try {
                    logger.log({ type: 'system', level: 'debug', message: `[Memory] Generating embedding for chunk`, data: { model: this.providerConfig.modelId, textLen: chunk.text.length } });
                    const vectors = await createEmbedding(this.providerConfig, chunk.text);
                    if (vectors && vectors.length > 0) embedding = vectors[0];
                } catch (err) {
                    logger.log({ type: 'error', level: 'error', message: `[Memory] Embedding failed for chunk`, data: { error: String(err) } });
                }
            } else {
                logger.log({ type: 'system', level: 'warn', message: `[Memory] No provider config for embeddings. Skipping.` });
            }
            chunksWithEmbeddings.push({ ...chunk, embedding });
        }

        // 3. Write to DB (Sync transaction)
        const writeTx = this.db.transaction((data: any[]) => {
            this.db.prepare('DELETE FROM chunks WHERE path = ?').run(this.memoryPath);
            // clear FTS
            try { this.db.prepare('DELETE FROM chunks_fts WHERE path = ?').run(this.memoryPath); } catch (e) { }

            const insertChunk = this.db.prepare(`
                INSERT INTO chunks (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at)
                VALUES (@id, @path, 'memory', @startLine, @endLine, @hash, @model, @text, @embedding, @updatedAt)
            `);

            const insertFts = this.db.prepare(`
                INSERT INTO chunks_fts (text, id, path, source, model, start_line, end_line)
                VALUES (@text, @id, @path, 'memory', @model, @startLine, @endLine)
            `);

            for (const c of data) {
                const info = {
                    id: c.id,
                    path: this.memoryPath,
                    startLine: c.startLine,
                    endLine: c.endLine,
                    hash: crypto.createHash('sha256').update(c.text).digest('hex'),
                    model: this.providerConfig?.modelId || 'local',
                    text: c.text,
                    embedding: JSON.stringify(c.embedding),
                    updatedAt: Date.now()
                };
                insertChunk.run(info);
                try { insertFts.run(info); } catch (e) { }
            }

            this.db.prepare(`
                INSERT OR REPLACE INTO files (path, source, hash, mtime, size)
                VALUES (?, 'memory', ?, ?, ?)
            `).run(this.memoryPath, fileHash, stats.mtimeMs, stats.size);
        });

        writeTx(chunksWithEmbeddings);
        logger.log({ type: 'system', level: 'info', message: `[Memory] Sync complete. Indexed ${chunks.length} chunks.` });
    }

    private chunkFile(content: string) {
        const lines = content.split('\n');
        const chunks = [];
        let currentLines: string[] = [];
        let currentSize = 0;
        let startLine = 1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            currentLines.push(line);
            currentSize += line.length;

            if (currentSize >= CHUNK_SIZE_CHARS || i === lines.length - 1) {
                if (currentLines.join('').trim().length > 0) {
                    chunks.push({
                        id: crypto.randomUUID(),
                        text: currentLines.join('\n'),
                        startLine: startLine,
                        endLine: i + 1
                    });
                }
                currentLines = [];
                currentSize = 0;
                startLine = i + 2;
            }
        }
        return chunks;
    }

    public async search(query: string, limit: number = 5): Promise<MemorySearchResult[]> {
        // Simple sanitization for FTS
        const sanitizedQuery = query.replace(/"/g, '""');

        let ftsResults: any[] = [];
        try {
            ftsResults = this.db.prepare(`
                SELECT id, path, text, start_line, end_line, -1 as score
                FROM chunks_fts
                WHERE chunks_fts MATCH ?
                ORDER BY rank
                LIMIT ?
            `).all(`"${sanitizedQuery}"`, limit * 2) as any[];
        } catch (err) {
            console.warn(`[Memory] FTS search failed: ${err}`);
        }

        let vectorResults: MemorySearchResult[] = [];
        if (this.providerConfig) {
            try {
                const vectors = await createEmbedding(this.providerConfig, query);
                if (vectors && vectors.length > 0) {
                    const queryVec = vectors[0];
                    const allChunks = this.db.prepare('SELECT id, path, text, start_line, end_line, embedding FROM chunks').all() as any[];

                    vectorResults = allChunks
                        .map(c => {
                            let vec: number[] = [];
                            try { vec = JSON.parse(c.embedding); } catch (e) { }
                            if (!Array.isArray(vec) || vec.length === 0) return null;
                            const score = this.cosineSimilarity(queryVec, vec);
                            return {
                                id: c.id,
                                path: c.path,
                                text: c.text,
                                start_line: c.start_line,
                                end_line: c.end_line,
                                score,
                                snippet: c.text // For now
                            };
                        })
                        .filter(r => r !== null)
                        .sort((a: any, b: any) => b.score - a.score)
                        .slice(0, limit) as MemorySearchResult[];
                }
            } catch (err) {
                console.error('[Memory] Vector search failed', err);
            }
        }

        // Merge strategy:
        // Use RRF or simply prioritize vector results.
        // For now, if we have vector results, use them. If not, use FTS.
        // It's better to combine them.

        const combined = new Map<string, MemorySearchResult>();

        // Add vector results
        for (const r of vectorResults) {
            combined.set(r.id, r);
        }

        // Add FTS results if not present (give them a lower score if logic dictates, but for now just add)
        for (const r of ftsResults) {
            if (!combined.has(r.id)) {
                combined.set(r.id, {
                    id: r.id,
                    path: r.path,
                    text: r.text,
                    start_line: r.start_line,
                    end_line: r.end_line,
                    score: 0.5, // Arbitrary mid-score for keyword matches
                    snippet: r.text
                });
            }
        }

        const validResults = Array.from(combined.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        if (validResults.length > 0) {
            return validResults;
        }

        // Fallback: If no results found (and we have chunks), return the most recent ones
        // This handles broad queries like "what do you know" or if search fails
        const recentChunks = this.db.prepare('SELECT id, path, text, start_line, end_line, updated_at FROM chunks ORDER BY updated_at DESC LIMIT ?').all(limit) as any[];

        return recentChunks.map(c => ({
            id: c.id,
            path: c.path,
            text: c.text,
            start_line: c.start_line,
            end_line: c.end_line,
            score: 0.1, // Low score to indicate fallback
            snippet: c.text
        }));
    }

    public async readFile(relPath: string, from?: number, lines?: number): Promise<string> {
        const absPath = relPath.startsWith('/') ? relPath : path.join(this.agentDir, relPath);

        if (!fs.existsSync(absPath)) return "";

        // simple security check
        if (!absPath.startsWith(this.agentDir)) {
            throw new Error("Access denied");
        }

        const content = fs.readFileSync(absPath, 'utf8');
        const allLines = content.split('\n');

        const start = (from || 1) - 1;
        const count = lines || allLines.length;

        return allLines.slice(start, start + count).join('\n');
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0;
        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
