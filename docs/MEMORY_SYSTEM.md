
# Agent Memory Subsystem

The Memory Subsystem provides long-term memory capabilities to agents, allowing them to store and retrieve information across sessions. It combines vector search (semantic) and keyword search (FTS5) for optimal recall.

## Core Architecture

### 1. Memory Storage (`MEMORY.md`)
- **Source of Truth**: The primary storage is a readable Markdown file located at `agents/<agent_id>/MEMORY.md`.
- **Format**: Bullet points with timestamps and categories, e.g., `- [YYYY-MM-DD] (category): Fact...`.
- **Manual Editing**: Users can edit this file directly, and the system will automatically re-index it.

### 2. Index Database (`memory_index.db`)
- **Location**: `agents/<agent_id>/memory_index.db`
- **Engine**: SQLite (via `better-sqlite3`)
- **Content**: 
  - `chunks`: Text segments from `MEMORY.md` with their vector embeddings.
  - `chunks_fts`: Virtual table for full-text search.
  - `files`: Metadata to track file modification times and hashes for sync optimization.

### 3. Manager (`src/memory/manager.ts`)
- **Role**: Handles the lifecycle of the memory index for a single agent.
- **Responsibilities**:
  - chunking `MEMORY.md` content.
  - generating embeddings via the configured LLM provider.
  - updating the SQLite index.
  - performing hybrid search (Vector + FTS).
  - **File Watching**: Monitors `MEMORY.md` for changes and triggers an auto-sync (debounced by 1s).

### 4. Agent Manager Integration
- **Role**: Manages instances of `MemoryIndexManager` for each agent.
- **Caching**: Instances are cached in memory to avoid reloading the DB on every request.
- **Cache Clearing**: When the global configuration is updated (e.g., changing the embedding provider), the `AgentManager` clears its cache of memory managers. This ensures that the next request instantiates a new manager with the latest configuration.

## Workflows

### Indexing Process
1. **Trigger**: 
   - Server startup.
   - Manual edit to `MEMORY.md` (detected via file watcher).
   - `save_to_memory` tool usage.
2. **Process**:
   - Calculate file hash. If unchanged, skip.
   - Read file content and split into chunks (line-based).
   - Generate embeddings for each chunk using the configured provider.
   - Transactionally update `chunks` and `chunks_fts` tables in SQLite.

### Search Process
1. **Tool Call**: Agent calls `memory_search(query)`.
2. **Hybrid Search**:
   - **Vector Search**: Computes cosine similarity between the query embedding and chunk embeddings.
   - **Keyword Search**: Uses SQLite FTS5 to find text matches.
   - **Result Merging**: Combines results from both methods (prioritizing vector matches if available).

### Configuration Updates
When you change settings in the UI (e.g., switching from OpenAI to local embeddings):
1. The UI sends the new config to `/api/config`.
2. The server saves `config.json`.
3. **Critical Step**: The server calls `AgentManager.clearMemoryManagers()`.
4. The next time an agent needs memory, a new `MemoryIndexManager` is created with the new provider settings.

## Troubleshooting

- **Logs**: Detailed logs are written to the database and visible in the **Logs** page. Look for `[Memory]` tags.
- **Verification**: You can use the `inspect_memory_db.js` script (if available) to verify the contents of the SQLite index.
- **Force Re-index**: Editing `MEMORY.md` (even adding a whitespace) will force the file watcher to trigger a re-index.
