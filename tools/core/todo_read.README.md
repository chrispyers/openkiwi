# Read Todo List

Reads the current session's task list. The task list is a shared markdown document (`.agent_todo.md`) stored in the workspace, used to track progress on multi-step objectives.

This tool takes no parameters.

## Usage

Call this tool at the start of a complex task to check whether a plan already exists, or at any point during execution to review which steps have been completed and what remains.

## Response

Returns the raw markdown content of the task list, or an empty string if no list has been created yet.

## Notes

- The task list is shared across the session — any agent writing to it will be visible to any agent reading it.
- Use **Write Todo List** to create or update the task list.
- A typical task list uses markdown checkboxes: `- [ ] Pending task` and `- [x] Completed task`.
