# Ask User

Pauses the agent's execution and surfaces a question to the user in the chat interface. Use this tool whenever you need clarification, a decision, a secret (such as a password or API key), or confirmation before taking a consequential action.

When `options` are provided, the UI renders them as clickable quick-reply buttons, making it easy for the user to respond without typing.

## Parameters

- `question` — The question to display to the user. Be specific about what you need and why.
- `options` *(optional)* — A list of short answer choices rendered as buttons (e.g. `["Yes", "No", "Cancel"]`).

## Example

```json
{
  "question": "Should I overwrite the existing config.json file?",
  "options": ["Yes, overwrite it", "No, keep the original"]
}
```

## Notes

- This tool pauses the agent loop. Execution resumes only after the user replies.
- Prefer providing `options` for yes/no or multiple-choice questions to reduce friction.
- Do not use this tool for information you could reasonably infer or look up yourself.
