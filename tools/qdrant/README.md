# Qdrant

Semantic search across Qdrant vector stores. Converts natural language queries into embeddings and searches for similar content.

## Prerequisites

- A running [Qdrant](https://qdrant.tech/) instance
- An embedding model configured in OpenKIWI (e.g. `text-embedding-nomic-embed-text-v1.5`)

## Configuration

### Global (config.json)

Add stores under `tools.qdrant.stores` and configure the embedding model under `memory`:

```json
{
  "memory": {
    "useEmbeddings": true,
    "embeddingsModel": "text-embedding-nomic-embed-text-v1.5"
  },
  "tools": {
    "qdrant": {
      "stores": {
        "my_store": {
          "url": "http://localhost:6333",
          "collection": "my_collection",
          "dimensions": 192
        }
      }
    }
  }
}
```

### Store Options

| Field | Required | Description |
|-------|----------|-------------|
| `url` | Yes | Qdrant server URL |
| `collection` | Yes | Collection name to search |
| `dimensions` | No | Truncate embeddings to this size ([Matryoshka](https://qdrant.tech/articles/matryoshka-embeddings/) support) |
| `apiKey` | No | Qdrant API key (falls back to `QDRANT_API_KEY` env var) |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `QDRANT_API_KEY` | No | Default API key for all stores |
| `QDRANT_DEBUG` | No | Set to `true` for debug logging |

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `search` | Semantic similarity search | `store`, `query` |

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | `search` |
| `store` | string | Store name (as defined in config) |
| `query` | string | Natural language search query |
| `limit` | number | Max results to return (default: 5) |
| `score_threshold` | number | Minimum similarity score filter |

## Usage Example

**Search for related content:**
```
action: "search", store: "my_store", query: "agile retrospective techniques", limit: 3
```

## How It Works

1. The query text is sent to the configured embedding model
2. The resulting vector is optionally truncated to match the store's `dimensions` setting
3. Qdrant performs a nearest-neighbour search on the collection
4. Results are returned with similarity scores and payloads
