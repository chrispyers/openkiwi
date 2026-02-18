# Agent Memory System

## Features
- **Hybrid Search**: Combines Vector Search (Semantic) and Keyword Search (FTS5) for optimal recall.
- **Auto-Indexing**: Automatically indexes `MEMORY.md` for each agent on startup and before searches.
- **Persistence**: Uses SQLite (`memory_index.db`) in each agent's directory to store chunks and embeddings.
- **Tools**:
  - `memory_search`: Search for facts, preferences, and history.
  - `memory_get`: Retrieve full context from memory files.

## Usage

### For Agents
Agents can use the `memory_search` tool to find information.
Example:
```json
{
  "name": "memory_search",
  "arguments": {
    "query": "What are the user's preferences for frontend frameworks?"
  }
}
```

### Configuration
The memory system is highly configurable via the **Settings > General > Context & Memory** section in the UI.

- **Enable Vector Embeddings**: Toggles semantic search capabilities. When enabled, the system generates embeddings for memory chunks. When disabled, it reverts to Keyword Search (FTS5).
- **Embedding Provider**: Select any configured provider to be used for generating embeddings. The system uses the provider's `model` ID (e.g., `text-embedding-3-small`, `nomic-embed-text`) and endpoint.
- **Auto-Indexing**:
  - **Startup**: Indexes are checked on server startup.
  - **File Watcher**: The system watches `MEMORY.md` for manual changes. If you edit the file directly, it waits for 1 second of inactivity (debounce) and then automatically re-indexes the content in the background.

## Architecture
- **Manager**: `src/memory/manager.ts` handles the lifecycle of the memory index.
- **Storage**: `better-sqlite3` is used for the database.
- **Embeddings**: `src/llm-provider.ts` handles the API calls.
