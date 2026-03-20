# Glob / Find Files

Finds files within the workspace whose names match a given pattern. Use this tool to locate files by name or extension before reading or editing them.

Internally this uses `find -name`, so standard shell wildcards apply (`*` matches any sequence of characters, `?` matches a single character).

## Parameters

- `pattern` — The filename pattern to match (e.g. `"*.ts"`, `"*.test.js"`, `"config.json"`).
- `path` *(optional)* — Fully qualified absolute path to the directory to search within. Defaults to the workspace root.

## Examples

Find all TypeScript files:
```json
{ "pattern": "*.ts" }
```

Find all test files inside a specific folder:
```json
{
  "pattern": "*.test.js",
  "path": "/workspace/my-project/src"
}
```

## Notes

- Returns a list of relative file paths from the search root.
- For searching file *contents* (rather than names), use **Grep Search** instead.
- Searches are limited to the workspace and time out after 5 seconds.
