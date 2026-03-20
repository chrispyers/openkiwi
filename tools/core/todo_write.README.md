# Write Todo List

Creates or replaces the current session's task list. Use this tool to plan a complex, multi-step objective before beginning work, and to update progress as steps are completed.

The task list is stored as `.agent_todo.md` in the workspace root and can be read back at any time using **Read Todo List**.

## Parameters

- `content` — The complete markdown content of the task list. Overwrites any existing list entirely.

## Example

```json
{
  "content": "# Kanban Board Project\n\n- [x] Scaffold the project directory\n- [x] Install dependencies\n- [ ] Create the board component\n- [ ] Add drag-and-drop support\n- [ ] Write README"
}
```

## Notes

- Always write the full list — this tool overwrites, it does not append.
- Use markdown checkboxes (`- [ ]` / `- [x]`) to track completion status so the list is readable and machine-parseable.
- Update the list as you complete steps so that progress is visible if the task is interrupted.
