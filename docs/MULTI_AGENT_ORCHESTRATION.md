# Multi-Agent Orchestration

OpenKIWI supports parallel multi-agent orchestration — multiple agents working on different parts of a problem simultaneously, sharing findings in real time, and producing a unified result.

This is similar to how Claude Code's Agent Teams work: a coordinator breaks a complex task into subtasks, delegates each to a specialized agent, and synthesizes the results.

## Architecture

```
  User Request
       │
       ▼
┌──────────────┐
│  Coordinator │  (any agent — activated via skill or ad-hoc)
│    Agent     │
└──────┬───────┘
       │        delegate_to_agent (wait: false)
       ├───────────────────────────────────────┐
       │                 │                     │
       ▼                 ▼                     ▼
┌─────────────┐   ┌─────────────┐       ┌─────────────┐
│   Agent A   │   │   Agent B   │  ...  │   Agent N   │
│  (Claude)   │   │  (Gemini)   │       │  (Local LLM)│
└──────┬──────┘   └──────┬──────┘       └──────┬──────┘
       │                 │                     │
       └────────┬────────┴─────────────────────┘
                │  scratchpad_write / scratchpad_read
                ▼
        ┌──────────────┐
        │  Scratchpad  │  (shared in-memory store)
        └──────────────┘
                │
                ▼
         wait_for_agents
                │
                ▼
         Coordinator synthesizes final report
```

### Key Components

| Component | What It Does |
|---|---|
| **Scratchpad** (`src/services/scratchpad.ts`) | In-memory pub/sub store for inter-agent data sharing, keyed by run ID |
| **`delegate_to_agent`** tool | Spawns another agent's LLM loop with its own persona and provider |
| **`wait_for_agents`** tool | Blocks until delegated agents finish, returns all results |
| **`scratchpad_write`** tool | Agents publish findings to the shared scratchpad |
| **`scratchpad_read`** tool | Agents read each other's findings from the scratchpad |
| **Parallel Workflows** | Workflow steps with `depends_on` run concurrently via DAG scheduling |

## How Delegation Works

When an agent calls `delegate_to_agent`, OpenKIWI:

1. Loads the target agent's persona, system prompt, and LLM provider config
2. Injects scratchpad instructions into the delegated agent's system prompt
3. Starts a new `runAgentLoop()` — the same loop used for chat, heartbeats, and workflows
4. If `wait: true` — blocks until the agent finishes and returns its response
5. If `wait: false` — tracks the promise in the Scratchpad service and returns immediately

Each delegated agent has full access to all registered tools (file I/O, web search, bash, etc.) plus the scratchpad tools. Agents can even delegate to other agents, enabling multi-level coordination.

## Activation Methods

There are two ways agents learn to orchestrate:

### 1. Skill-Driven (Recommended)

The `parallel-research` skill teaches any agent how to coordinate parallel research. When a user's request matches the skill description, the agent activates it and follows the coordination protocol.

This works reliably across all model sizes because the skill contains explicit instructions — the model follows a recipe rather than inventing a coordination strategy.

```
User: "Research the market opportunity for a meditation app"
  → Agent activates parallel-research skill
  → Skill instructions tell agent exactly how to decompose, delegate, and synthesize
```

### 2. Ad-Hoc Delegation (Escape Hatch)

When more than one agent is configured, OpenKIWI adds a delegation hint to every agent's system prompt listing available agents and the delegation tools. Strong models (Claude, GPT-4) can use this to delegate on their own judgment without a skill.

This is less deterministic but handles novel coordination patterns that no skill was designed for.

## Tools Reference

### `delegate_to_agent`

Delegate a task to another agent.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `agent_id` | string | Yes | The ID of the agent to delegate to |
| `task` | string | Yes | Clear description of what the agent should do |
| `run_id` | string | No | Shared ID for scratchpad access. Generated if omitted. Use the same run_id for all agents in a session. |
| `wait` | boolean | No | `true` (default) = block until done. `false` = fire-and-forget for parallel execution. |
| `timeout_ms` | number | No | Max wait time in ms. Default: 300000 (5 min). Only applies when wait is true. |

**Returns (wait: true):**
```json
{
  "agent_id": "researcher",
  "run_id": "abc-123",
  "response": "The agent's final text response",
  "usage": { "prompt_tokens": 1500, "completion_tokens": 800, "total_tokens": 2300 }
}
```

**Returns (wait: false):**
```json
{
  "agent_id": "researcher",
  "run_id": "abc-123",
  "status": "started",
  "message": "Agent \"researcher\" is now working in the background..."
}
```

### `wait_for_agents`

Wait for delegated agents to finish.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `run_id` | string | Yes | The shared run ID |
| `agent_ids` | string[] | No | Specific agents to wait for. Omit to wait for all. |
| `timeout_ms` | number | No | Max wait time. Default: 300000 (5 min). |

**Returns:**
```json
{
  "run_id": "abc-123",
  "agents_completed": 3,
  "results": [
    { "agent_id": "researcher", "success": true, "response": "..." },
    { "agent_id": "analyst", "success": true, "response": "..." },
    { "agent_id": "writer", "success": false, "error": "Timed out" }
  ],
  "scratchpad_entries": 5,
  "scratchpad": [
    { "agent": "researcher", "label": "ASO keywords", "status": "complete", "data": {...} },
    ...
  ]
}
```

### `scratchpad_write`

Write findings to the shared scratchpad.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `run_id` | string | Yes | The shared run ID |
| `label` | string | Yes | Short description of what this data represents |
| `data` | object | Yes | The findings to share |
| `status` | string | No | `"partial"` or `"complete"` (default) |

### `scratchpad_read`

Read findings from other agents.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `run_id` | string | Yes | The shared run ID |
| `agent_id` | string | No | Filter entries to a specific agent |

## Parallel Workflows

Workflows now support a `depends_on` field on steps. When any step in a workflow has `depends_on` set, the executor switches from sequential to DAG-based parallel execution.

### How It Works

- Steps with `depends_on: []` (empty array) have no dependencies and run immediately
- Steps with `depends_on: ["step-id-1", "step-id-2"]` wait for those steps to complete
- Steps without `depends_on` (null) fall back to sequential ordering by `order_index`
- Independent steps run concurrently via `Promise.all()`
- Each step can be assigned to a different agent with its own LLM provider

### Backward Compatibility

Existing workflows (where no step has `depends_on` set) run exactly as before — sequentially by `order_index`. No migration needed.

### Example Workflow Definition

```json
{
  "name": "Market Research Pipeline",
  "steps": [
    {
      "id": "step-1",
      "name": "Keyword Research",
      "assigned_agent_id": "researcher",
      "depends_on": [],
      "instructions": { "tool_id": "web_search", "prompt": "Find top ASO keywords for meditation apps" }
    },
    {
      "id": "step-2",
      "name": "Competitor Analysis",
      "assigned_agent_id": "analyst",
      "depends_on": [],
      "instructions": { "tool_id": "web_fetch", "prompt": "Analyze top 5 meditation apps" }
    },
    {
      "id": "step-3",
      "name": "Synthesis",
      "assigned_agent_id": "writer",
      "depends_on": ["step-1", "step-2"],
      "instructions": { "tool_id": "report_writer", "prompt": "Combine keyword and competitor data into a report" }
    }
  ]
}
```

In this example, steps 1 and 2 run in parallel (both have `depends_on: []`). Step 3 waits for both to finish before starting.

## Example Use Cases

### 1. iOS App Market Research (The Original Inspiration)

A manager agent coordinates 5 specialists to find market gaps:

```
User: "Find iOS app market gaps in Latin America, EU, and Asia for productivity tools"

Coordinator (Primary Agent):
  Wave 1 — parallel:
    ├── ASO Researcher → top keywords by search volume
    ├── Competitor Analyst → scrape top apps, extract review sentiment
    └── Regional Analyst → market size and saturation by region

  Wave 2 — depends on Wave 1:
    ├── Keyword Ranker → rank keywords by difficulty + revenue potential
    └── Gap Finder → cross-reference regions × keywords × competitor weaknesses

  Synthesis:
    └── Coordinator Agent reads scratchpad → generates HTML report with ranked opportunities
```

### 2. Codebase Security Audit

Multiple agents audit different layers of a codebase simultaneously:

```
User: "Run a security audit on the project"

Coordinator:
  Wave 1 — parallel:
    ├── Agent A (Claude) → review authentication and session handling
    ├── Agent B (GPT-4) → analyze SQL queries and injection surfaces
    ├── Agent C (Local LLM) → scan dependencies for known CVEs
    └── Agent D (Claude) → review API endpoints for authorization gaps

  Synthesis:
    └── Coordinator merges findings → severity-ranked report with remediation steps
```

### 3. Content Pipeline

Research, draft, and review a blog post with specialized agents:

```
User: "Write a blog post about the future of edge computing"

Coordinator:
  Wave 1 — parallel:
    ├── Researcher → gather recent developments, stats, expert opinions
    └── Competitor Analyst → review what others have published on this topic

  Wave 2 — sequential:
    └── Writer → draft the post using research findings

  Wave 3 — parallel:
    ├── Editor → grammar, style, tone review
    └── Fact Checker → verify all claims against sources
```

### 4. Multi-Language Translation Review

Translate and validate content across languages in parallel:

```
User: "Translate our release notes into Spanish, French, German, and Japanese"

Coordinator:
  Wave 1 — parallel:
    ├── Agent (es) → Spanish translation
    ├── Agent (fr) → French translation
    ├── Agent (de) → German translation
    └── Agent (ja) → Japanese translation

  Wave 2 — parallel (each reviews a different agent's work):
    ├── Agent (es) → review French translation for accuracy
    ├── Agent (fr) → review German translation for accuracy
    ├── Agent (de) → review Japanese translation for accuracy
    └── Agent (ja) → review Spanish translation for accuracy
```

### 5. Due Diligence Report

Research a company from multiple angles simultaneously:

```
User: "Prepare a due diligence report on Acme Corp"

Coordinator:
  Wave 1 — parallel:
    ├── Financial Analyst → revenue, funding, burn rate, public filings
    ├── Market Researcher → market size, competitors, positioning
    ├── Tech Analyst → tech stack, patents, engineering team signals
    └── Legal/Risk → lawsuits, regulatory exposure, compliance

  Synthesis:
    └── Coordinator → executive summary with go/no-go recommendation
```

## Configuration

No special configuration is required. Multi-agent orchestration works automatically when:

1. **Multiple agents exist** — create agents via the UI or API at `/api/agents`
2. **Each agent has an LLM provider** — set in the agent's `config.json` or fall back to the global default
3. **Tools are registered** — delegation and scratchpad tools are built-in and registered at startup

### Agent Setup Tips

- **Specialize agents by persona**: Give each agent a persona that matches its research role (e.g., "You are a market research analyst specializing in mobile app ecosystems")
- **Mix LLM providers**: Use Claude for nuanced analysis, a fast local model for data crunching, Gemini for web-grounded research
- **Keep agent count reasonable**: 3-5 parallel agents is the sweet spot. More than that and you're paying for context windows that may not add value.

## How This Compares to Claude Code

| Aspect | Claude Code Agent Teams | OpenKIWI Multi-Agent |
|---|---|---|
| Execution | Separate OS processes | Concurrent `runAgentLoop()` calls in one Node process |
| Communication | Mailbox + shared task list | Scratchpad (in-memory pub/sub) |
| Model flexibility | Claude models only | Any provider (Claude, GPT, Gemini, local LLMs) |
| Coordination | Lead/teammate roles | Skill-driven or ad-hoc delegation |
| State isolation | Separate context windows | Separate message arrays, shared scratchpad |
| Persistence | Git worktrees | Workflow run reports in `workspace/workflows/logs/` |

The main architectural difference: Claude Code runs teammates as separate processes with their own context windows. OpenKIWI runs them as concurrent async functions in the same Node process, which is simpler and faster but limited to a single machine. If you need to scale beyond one machine, the Scratchpad interface can be swapped for Redis without changing the tool contracts.
