# Multi-Edit File

Applies multiple text replacements to a single file in one operation. Use this tool when you need to make several distinct changes to the same file at once, avoiding the overhead of multiple sequential `edit` calls.

Each edit specifies a `targetString` to find and a `replacementString` to substitute. Edits are applied in order. Each target must be unique within the file at the time it is matched.

## Parameters

- `path` — Fully qualified absolute path to the file to edit.
- `edits` — An array of edit operations, each containing:
  - `targetString` — The exact text to find and replace.
  - `replacementString` — The new text to substitute.

## Example

```json
{
  "path": "/workspace/src/config.js",
  "edits": [
    {
      "targetString": "const HOST = 'localhost';",
      "replacementString": "const HOST = process.env.HOST || 'localhost';"
    },
    {
      "targetString": "const PORT = 3000;",
      "replacementString": "const PORT = process.env.PORT || 3000;"
    }
  ]
}
```

## Notes

- Edits that fail (target not found, or target is ambiguous) are skipped and reported in the response — they do not abort the remaining edits.
- The file is only written to disk if at least one edit succeeds.
- For a single change, use **Edit File** instead.
- This tool requires approval before execution.
