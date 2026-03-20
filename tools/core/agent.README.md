# Sub-Agent Delegation

Delegates a task to another configured agent and returns their response. Use this tool when a complex objective is better handled by a specialist agent, or when you want to run a focused sub-task in parallel without polluting your own context.

The sub-agent runs its own full agent loop (up to 10 iterations) using its own system prompt and tool configuration. Only the final response is returned to you — intermediate tool calls made by the sub-agent are not visible.

## Parameters

- `agentId` — The ID of the agent to delegate to (e.g. `"luna"`). Must match an agent configured in the Gateway.
- `task` — Detailed instructions for the sub-agent. Be explicit: the sub-agent starts with no context from the current conversation.

## Example

```json
{
  "agentId": "luna",
  "task": "Search the web for the latest Node.js LTS version and return just the version number."
}
```

## Notes

- The sub-agent uses its own provider and model configuration.
- If the specified agent does not exist, the tool returns an error listing available agent IDs.
- Sub-agent sessions are ephemeral and not saved to the session history.
