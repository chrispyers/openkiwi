# Qdrant (MCP)

Search and store data in Qdrant via an external MCP (Model Context Protocol) server. This tool delegates to a Qdrant MCP server process, which handles embeddings and vector operations.

## Prerequisites

- A Qdrant MCP server package (e.g. `@qdrant/mcp-server`)
- A running Qdrant instance accessible to the MCP server

## Configuration

### Global (config.json)

Add the MCP server command under `tools.qdrant_mcp`:

```json
{
  "tools": {
    "qdrant_mcp": {
      "command": "npx",
      "args": ["-y", "@qdrant/mcp-server"],
      "env": {
        "QDRANT_URL": "http://localhost:6333",
        "QDRANT_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Using uvx (Python-based server)

```json
{
  "tools": {
    "qdrant_mcp": {
      "command": "uvx",
      "args": ["qdrant-mcp-server"],
      "env": {
        "QDRANT_URL": "http://localhost:6333"
      }
    }
  }
}
```

### Config Options

| Field | Required | Description |
|-------|----------|-------------|
| `command` | Yes | Executable to spawn the MCP server |
| `args` | No | Command line arguments |
| `env` | No | Additional environment variables passed to the server process |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `QDRANT_MCP_DEBUG` | No | Set to `true` for debug logging |

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `search` | Semantic similarity search | `collection`, `query` |
| `store` | Store/upsert points with embeddings | `collection`, `points` |
| `list_collections` | List all collections | — |
| `get_collection` | Get collection info | `collection_name` |

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | `search`, `store`, `list_collections`, or `get_collection` |
| `collection` | string | Collection name |
| `query` | string | Natural language search query (search action) |
| `limit` | number | Max results to return (default: 5) |
| `score_threshold` | number | Minimum similarity score filter |
| `filter` | object | Qdrant filter object |
| `points` | array | Points to store: `[{ document, payload, id? }]` |

## Usage Examples

**Search:**
```
action: "search", collection: "my_docs", query: "machine learning techniques", limit: 3
```

**Store:**
```
action: "store", collection: "my_docs", points: [{ document: "Neural networks are...", payload: { topic: "ML" } }]
```

**List collections:**
```
action: "list_collections"
```

## How It Works

1. OpenKiwi spawns the configured MCP server as a child process (stdio transport)
2. The connection is pooled — subsequent calls reuse the same process
3. Tool calls are forwarded to the MCP server, which handles embedding generation and Qdrant operations
4. Results are returned in structured JSON format

## Differences from the Direct Qdrant Tool

| Feature | `qdrant` (direct) | `qdrant_mcp` (this tool) |
|---------|-------------------|--------------------------|
| Embedding generation | OpenKiwi (via configured provider) | MCP server handles it |
| Connection | Direct to Qdrant REST API | Via MCP server process |
| Actions | Search only | Search, store, list, get |
| Configuration | Store-based (url, collection, dims) | Command-based (spawn MCP server) |
| Dependencies | `@qdrant/js-client-rest` | `@modelcontextprotocol/sdk` |
