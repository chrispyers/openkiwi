# Finish Task

Explicitly signals that the current task has been completed. Calling this tool stops the agent loop and delivers a final summary to the caller.

Use this tool in agentic / automation contexts (e.g. scheduled heartbeats, workflow steps, sub-agent delegations) where you need to clearly indicate that the objective has been accomplished rather than simply responding with text.

## Parameters

- `summary` — A concise description of what was accomplished. This is returned to the caller and may be stored in the session or workflow record.

## Example

```json
{
  "summary": "Created the project scaffold, installed dependencies, and wrote the initial README. The project is ready for development."
}
```

## Notes

- In interactive chat sessions this tool is rarely needed — a normal text response is sufficient.
- In automated or scheduled tasks, always call this tool when done so the system knows execution has cleanly completed.
