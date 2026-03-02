# Tools

OpenKIWI tools extend agent capabilities by connecting them to external services and APIs. Tools are discovered automatically from this directory at startup.

## Available Tools

### Core Tools

| Tool | File | Description |
|------|------|-------------|
| [GitHub](github/README.md) | `github.ts` | Manage files in GitHub repositories (list, read, create, update) |
| [Google Tasks](google_tasks/README.md) | `google_tasks.ts` | Manage Google Tasks (list, add, update, complete) |
| [Qdrant](qdrant/README.md) | `qdrant.ts` | Semantic search across Qdrant vector stores |
| Filesystem | `filesystem.ts` | Read and write files in the workspace directory |
| Vision | `vision.ts` | Analyse images using vision-capable models |
| Weather | `weather.ts` | Get current weather information |
| Web Browser | `web_browser.ts` | Browse and extract content from web pages |

### Community Tools

| Tool | Directory | Description |
|------|-----------|-------------|
| [ChatGPT Authenticator](chatgpt/authenticator/README.md) | `chatgpt/authenticator/` | Authenticate with ChatGPT for token retrieval |
| [ChatGPT Importer](chatgpt/importer/README.md) | `chatgpt/importer/` | Import ChatGPT conversation history |
| [CISA Reporter](cisa_reporter/README.md) | `cisa_reporter/` | Retrieve and display CVEs from CISA |

## Creating a Tool

Tools are TypeScript files that export a default object with a `definition` and `handler`:

```typescript
export default {
  definition: {
    name: 'my_tool',
    description: 'What this tool does.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['do_something'],
          description: 'The action to perform.'
        }
      },
      required: ['action']
    }
  },
  handler: async (args: { action: string }) => {
    // Tool logic here
    return { result: 'done' };
  }
};
```

### Conventions

- **One tool per file** — each `.ts` file in this directory is auto-discovered
- **Test files** — place tests in `tests/` with a `.test.ts` suffix (excluded from discovery)
- **Subdirectory tools** — tools in subdirectories are also discovered; add a `README.md` alongside for documentation
- **Per-agent config** — tools can receive agent-specific config via `args._context.toolConfig`
- **Error handling** — return `{ error: 'message' }` rather than throwing exceptions

## Enabling/Disabling Tools

Tools can be toggled in the UI under Settings, or directly in `config.json`:

```json
{
  "enabledTools": {
    "github.ts": true,
    "google_tasks.ts": true,
    "weather.ts": false
  }
}
```
