# Read File

Reads and returns the full text content of a file in the workspace. Use this tool to inspect source code, configuration files, logs, or any other text file before making decisions or edits.

## Parameters

- `path` — Fully qualified absolute path to the file to read.

## Example

```json
{
  "path": "/workspace/my-project/package.json"
}
```

## Notes

- Returns the raw file content as a string under the `content` key.
- Returns an error if the file does not exist or is outside the workspace.
- Use **List Files** or **Glob/Find Files** first if you need to locate a file before reading it.
- For large files, consider using **Grep Search** to find the specific section you need rather than reading the entire file.
