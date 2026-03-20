# Bash Command

Executes a shell command inside the workspace environment and returns the output. Use this tool to run scripts, install packages, compile code, run tests, or perform any operation that requires a terminal.

Commands run with a 30-second timeout and are sandboxed to the workspace directory. Attempts to navigate outside the workspace via `cd` or path manipulation are blocked.

## Parameters

- `command` — The shell command to execute (e.g. `"npm install"`, `"python script.py"`).
- `cwd` *(optional)* — A subdirectory within the workspace to use as the working directory. Defaults to the workspace root.

## Example

```json
{
  "command": "npm run build",
  "cwd": "my-project"
}
```

## Notes

- Both `stdout` and `stderr` are returned, even on failure.
- Commands time out after **30 seconds**. For long-running processes, consider breaking the work into smaller steps.
- This tool requires approval before execution.
