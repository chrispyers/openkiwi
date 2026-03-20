# Write File

Creates a new file or completely overwrites an existing file with the provided content. Use this tool to generate source code, configuration files, scripts, or any other text artifact from scratch.

Parent directories are created automatically if they do not exist.

## Parameters

- `path` — Fully qualified absolute path of the file to write.
- `content` — The complete text content to write to the file.

## Example

```json
{
  "path": "/workspace/my-project/src/index.js",
  "content": "const express = require('express');\nconst app = express();\n\napp.listen(3000, () => console.log('Running on port 3000'));\n"
}
```

## Notes

- This tool **overwrites** the file entirely. To make targeted changes to an existing file, use **Edit File** or **Multi-Edit File** instead.
- Always write the complete, final file content — do not truncate or use placeholders.
- This tool requires approval before execution.
