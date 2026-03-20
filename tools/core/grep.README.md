# Grep Search

Searches for a text pattern inside files within the workspace. Use this tool to find where a specific string, function name, variable, or pattern appears across your project.

By default the search is recursive (`-rn`), returning matching lines with their file paths and line numbers.

## Parameters

- `pattern` — The search string or regular expression to look for.
- `directory` *(optional)* — A subdirectory within the workspace to search inside. Defaults to the workspace root.
- `options` *(optional)* — An array of grep flags to apply. Only simple flags like `-i`, `-n`, `-r` are accepted for safety. Defaults to `["-rn"]`.

## Examples

Case-insensitive search for a function:
```json
{
  "pattern": "handleSubmit",
  "options": ["-rni"]
}
```

Search only inside a specific directory:
```json
{
  "pattern": "TODO",
  "directory": "src"
}
```

## Notes

- Returns an array of matching lines in the format `filepath:linenum:content`.
- Returns an empty array (not an error) when no matches are found.
- For finding files by name rather than content, use **Glob/Find Files** instead.
