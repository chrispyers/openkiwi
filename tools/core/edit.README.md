# Edit File

Replaces a specific, uniquely-identifiable segment of text in a file with new content. This is the preferred tool for making targeted changes to existing files without rewriting them entirely.

The `targetString` must match the file content exactly — including all whitespace, indentation, and newlines. The tool will refuse to make the replacement if the target string appears more than once, to prevent unintended changes.

## Parameters

- `path` — Fully qualified absolute path to the file to edit.
- `targetString` — The exact text to find and replace. Must be unique within the file.
- `replacementString` — The new text to substitute in place of the target.

## Example

```json
{
  "path": "/workspace/src/app.js",
  "targetString": "const PORT = 3000;",
  "replacementString": "const PORT = process.env.PORT || 3000;"
}
```

## Notes

- If the `targetString` is not found, the tool returns an error — double-check whitespace and indentation.
- If the `targetString` matches multiple locations, use a larger, more unique surrounding context.
- For multiple changes to the same file in one step, use **Multi-Edit File** instead.
- This tool requires approval before execution.
