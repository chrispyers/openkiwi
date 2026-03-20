# File Operations

Performs structural file system operations within the workspace: deleting files or directories, creating directories, moving/renaming, and copying.

For reading file contents use **Read File**, for writing use **Write File**, and for listing directory contents use **List Files** — those are dedicated core tools. This tool handles everything else.

## Actions

| Action | Description |
|--------|-------------|
| `delete` | Deletes a file or an entire directory tree |
| `mkdir` | Creates a new directory (including any missing parent directories) |
| `move` | Moves or renames a file or directory |
| `copy` | Copies a file or directory to a new location |

## Parameters

- `action` — One of `delete`, `mkdir`, `move`, `copy`
- `path` — Fully qualified absolute path of the source file or directory
- `newPath` — Destination path, required for `move` and `copy`

## Examples

Delete a file:
```json
{ "action": "delete", "path": "/workspace/project/old-script.js" }
```

Create a directory:
```json
{ "action": "mkdir", "path": "/workspace/project/src/components" }
```

Rename a file:
```json
{
  "action": "move",
  "path": "/workspace/project/index.js",
  "newPath": "/workspace/project/main.js"
}
```

Copy a directory:
```json
{
  "action": "copy",
  "path": "/workspace/project/templates/base",
  "newPath": "/workspace/project/src/new-feature"
}
```
