
# Context Window Compaction

The compaction system enables agents to complete long, multi-step tasks (like building an entire application) without silently stopping mid-task due to context window exhaustion. It is modeled after the approach used by Claude Code.

## Problem

When an agent executes a complex task, the conversation history grows with every tool call:

```
System prompt + tool definitions         ~3,000 tokens
User request                                ~200 tokens
Assistant message + tool call (write)       ~500 tokens
Tool result (file contents, cmd output)   ~2,000 tokens
...repeat for each tool call...
```

A model with a 64K context window can exhaust its budget in as few as 10-15 tool calls. When this happens, the LLM provider either:

1. **Silently truncates** the input, causing the model to produce a text-only response (no tool calls), which the agent loop interprets as "done"
2. **Returns a 500 error**, which previously crashed the session

In both cases, the agent stops working and the user must manually nudge it to continue.

## Solution Overview

```
                    Agent Loop Iteration
                           |
                    +------v------+
                    | Check if    |
                    | context is  |
                    | > 80% full  |
                    +------+------+
                           |
                  +--------+--------+
                  |                 |
                 No                Yes
                  |                 |
                  v          +------v------+
            Send to LLM      | Compact:    |
                  |          | Summarize   |
                  |          | old messages |
                  |          +------+------+
                  |                 |
                  v                 v
            +-----+-----+    Send to LLM
            | Success?  |    (with freed
            +-----+-----+     context)
                  |
          +-------+-------+
          |               |
        Yes           500 Error?
          |               |
          v        +------v------+
       Continue    | Compact &   |
       loop        | retry       |
                   | (up to 2x)  |
                   +-------------+
```

## Architecture

All compaction logic lives in `src/agent-loop.ts`. There are no external dependencies beyond the existing LLM provider.

### Key Functions

| Function | Purpose |
|---|---|
| `estimateTokens(messages)` | Rough token count (~4 chars/token). Used when actual usage data is unavailable. |
| `shouldCompact(messages, maxContextLength, lastPromptTokens)` | Returns `true` when context usage exceeds 80% of the model's limit. Prefers actual `lastPromptTokens` from the LLM over estimation. |
| `compactMessages(chatHistory, llmConfig, ...)` | Core compaction: summarizes older messages via an LLM call, replaces them in-place. |
| `isContextOverflowError(error)` | Detects 500 errors and context-related error messages from providers. |

### What Gets Preserved vs. Summarized

During compaction, the conversation is split into three zones:

```
+--------------------------------------------------+
| PRESERVED: System prompt(s)                      |  Always kept intact
+--------------------------------------------------+
| PRESERVED: First user message                    |  The original task/request
+--------------------------------------------------+
| SUMMARIZED: Middle messages                      |  Assistant responses,
|   - Tool calls and their results                 |  tool calls, tool results
|   - Intermediate assistant messages              |  → replaced with a single
|   - Any follow-up user messages                  |    summary message
+--------------------------------------------------+
| PRESERVED: Last 10 messages                      |  Recent context the agent
|   - Recent tool calls and results                |  needs to continue working
|   - Most recent assistant response               |
+--------------------------------------------------+
```

The summary message is injected as a `user` role message with the format:

```
[CONTEXT COMPACTED -- Summary of previous N messages]

<LLM-generated summary>

[End of summary. Continue from where you left off. Do not repeat completed work.]
```

### Token Estimation Strategy

The system uses a two-tier approach to determine context usage:

1. **Actual token count** (`lastPromptTokens`): Most LLM providers (LM Studio, OpenAI, Anthropic) return `prompt_tokens` in usage stats. This is the most accurate signal and is used when available.

2. **Character-based estimation**: When actual counts are unavailable (e.g., first iteration), the system estimates at ~4 characters per token. This is intentionally conservative to err on the side of compacting early rather than overflowing.

### How `max_context_length` Flows Through the System

```
Provider Config (config.json)
  └─ max_context_length: 65536
       │
       ▼
chat-handler.ts
  └─ llmConfig.maxContextLength
       │
       ▼
agent-loop.ts
  └─ shouldCompact(history, maxContextLength, lastPromptTokens)
       │
       ▼
  Compact if usage > 80% of maxContextLength
```

The `max_context_length` value is set automatically when adding a model via the Models page (LM Studio, Ollama, and Gemini APIs all report this). If it's not available, proactive compaction is disabled but reactive recovery (catching 500 errors) still works.

### Reactive Recovery (500 Error Handling)

When `max_context_length` is unknown, the system cannot proactively compact. Instead, it catches context overflow errors from the LLM provider:

```typescript
// Detected patterns:
"context"        // Generic context errors
"too long"       // OpenAI-style
"maximum"        // Various providers
"exceeds"        // Various providers
"token limit"    // Explicit token limit errors
"llm api error: 500"  // LM Studio / vLLM / Ollama
```

On detection:
1. Compaction is triggered on the current chat history
2. The LLM call is retried with the compacted history
3. This is attempted up to **2 times** before giving up

The loop counter is not incremented for retries, so compaction doesn't eat into the agent's `maxLoops` budget.

## Configuration

### `maxLoops` (per-agent)

Controls the maximum number of tool-call iterations per conversation turn.

| Setting | Default | Location |
|---|---|---|
| Per-agent | `100` | Settings > Agents > Max Tool Loops |
| Heartbeat | `agent.heartbeat.maxLoops` or `10` | Agent `config.json` |
| Delegation | `agent.maxLoops` or `100` | Inherits from delegate agent |

Previously hardcoded to `5`, which was the root cause of agents stopping after just a few tool calls.

Stored in `agents/<agentId>/config.json`:

```json
{
  "name": "Ada",
  "provider": "Qwen 2.5 Coder",
  "maxLoops": 100
}
```

### `max_context_length` (per-provider)

The model's total context window size in tokens. Set automatically when adding models from LM Studio, Ollama, or Gemini. Used by the compaction system to determine the 80% threshold.

Stored in `config/config.json` under the provider entry:

```json
{
  "providers": [
    {
      "description": "Qwen 2.5 Coder 32B",
      "endpoint": "http://localhost:1234",
      "model": "qwen2.5-coder-32b",
      "max_context_length": 65536
    }
  ]
}
```

## Observability

### Log Messages

Compaction events are logged via the standard logger:

| Log | Level | When |
|---|---|---|
| `Context approaching limit (X tokens / Y max), compacting...` | info | Proactive compaction triggered |
| `Compacting context: summarizing N messages` | info | Compaction starting |
| `Compaction complete: N messages -> 1 summary` | info | Compaction succeeded |
| `Compaction produced empty summary, skipping` | warn | LLM returned empty summary |
| `Context overflow detected (attempt N/2), compacting and retrying...` | warn | Reactive recovery triggered |
| `Compaction failed: <error>` | error | Summary LLM call failed |

### WebSocket Events

| Event | Direction | Purpose |
|---|---|---|
| `{ type: 'compacting' }` | Server -> Client | Notifies UI that compaction is in progress |
| `*[Compacting context to free up space...]*` | Streamed as delta | Visible to the user in the chat |

## Testing the Compaction System

### Test 1: maxLoops Fix (Basic Validation)

**Goal**: Confirm the agent can complete a multi-step task that previously failed at 5 loops.

**Setup**: Any model, any context length.

**Prompt**:
```
I want you to create a Kanban board for me. I want you to use NextJS.
I want this to be a single page application with the following requirements:
- 3 columns: TODO, In Progress and Done
- The user can create new tasks. New tasks default to TODO
- The user can drag and drop tasks between columns.
That's it.

Make a new directory in the workspace for this named "kanban-test-v2"
and put all of your files inside of it.
Also provide instructions for how to run the app.
```

**Expected outcome**: The agent completes all files and writes a README without stopping. Previously this task exhausted the 5-loop limit and stopped after writing `globals.css`.

**What to verify**:
- Agent creates all necessary files (page.tsx, types, globals.css, etc.)
- Agent writes a README with run instructions
- Agent finishes on its own without requiring a nudge
- Check logs: should see ~10-15 loop iterations, no compaction needed

---

### Test 2: Proactive Compaction (Context Pressure)

**Goal**: Force the compaction system to trigger proactively during a long task.

**Setup**: Use a model with a 64K context window. Ensure `max_context_length` is set in the provider config.

**Prompt**:
```
Build me a full task management app with NextJS. It needs:
- A kanban board with drag and drop between columns
- A task detail modal with title, description, priority, and due date fields
- Local storage persistence so tasks survive page refresh
- A dark mode toggle
- A search/filter bar that filters tasks by title
Put everything in "task-app-compaction-test".
Include a README with setup and run instructions.
```

**Expected outcome**: The agent completes the task. Partway through (around tool call 15-20), you should see compaction trigger.

**What to verify**:
- `*[Compacting context to free up space...]*` appears in the chat
- Log message: `Context approaching limit... compacting`
- Log message: `Compaction complete: N messages -> 1 summary`
- After compaction, the agent continues working without repeating already-completed steps
- The final app is complete and functional

---

### Test 3: Reactive Recovery (500 Error Path)

**Goal**: Verify the system recovers from context overflow errors when `max_context_length` is unknown or too large.

**Setup**: Load a model with a very small context window (8K-16K). Optionally, remove `max_context_length` from the provider config to disable proactive compaction (this forces the system to rely on 500 error recovery).

**Prompt**: Use the same basic kanban board prompt from Test 1.

**Expected outcome**: The agent hits a 500 error from the LLM provider, the system detects it as a context overflow, compacts the history, and retries successfully.

**What to verify**:
- Log message: `Context overflow detected (attempt 1/2), compacting and retrying...`
- The agent recovers and continues working after compaction
- The task is eventually completed (may require multiple compaction cycles)
- If the context is truly too small for even the compacted history, the error surfaces cleanly after 2 retries rather than hanging

---

### Test 4: No Compaction Needed (Negative Test)

**Goal**: Confirm compaction does NOT trigger unnecessarily on models with large context windows.

**Setup**: Use a model with 128K+ context window with `max_context_length` set correctly.

**Prompt**: Use the basic kanban board prompt from Test 1.

**Expected outcome**: The agent completes the task without any compaction.

**What to verify**:
- No `compacting` messages in the chat
- No compaction-related log messages
- The agent completes normally
