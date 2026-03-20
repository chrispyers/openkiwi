# List Files

Lists the files and directories at a given path within the workspace. Use this tool to explore the structure of a project before reading or editing files.

## Parameters

- `path` *(optional)* — Fully qualified absolute path of the directory to list. Omit to list the workspace root.

## Example

```json
{
  "path": "/workspace/my-project/src"
}
```

## Response

Returns an array of entries, each with:
- `name` — The file or directory name.
- `type` — Either `"file"` or `"directory"`.

## Notes

- Only lists the immediate contents of the directory (non-recursive). Use **Glob/Find Files** to search recursively.
- Use **Read File** to view the contents of a specific file after locating it.
