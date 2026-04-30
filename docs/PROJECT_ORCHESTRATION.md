# Project Orchestration

Project Orchestration lets you assemble a team of AI agents, assign them roles, and run them through a structured build-evaluate-revise loop until the work meets a quality bar. It builds on OpenKIWI's existing multi-agent system but adds iterative evaluation, file-based handoffs, and sprint-based project management.

This approach is inspired by [Anthropic's harness design for long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps), which found that separating planning, execution, and evaluation across different agents produces significantly better results than having a single agent do everything.

---

## How It Works

A project run moves through three phases — **Plan**, **Work**, **Evaluate** — with the Evaluator able to send work back for revision. Each phase is handled by a different agent with a fresh context window.

```
  ┌─────────────────────────────────────────────────────────┐
  │                      PROJECT RUN                        │
  │                                                         │
  │  ┌─────────────┐                                        │
  │  │  INITIATOR  │  Reads concept doc                     │
  │  │   (Plan)    │──► Writes spec.md                      │
  │  │             │──► Writes sprint contracts             │
  │  └──────┬──────┘                                        │
  │         │                                               │
  │         ▼                                               │
  │  ┌─────────────────────────────────────────────┐        │
  │  │            SPRINT LOOP (for each sprint)    │        │
  │  │                                             │        │
  │  │  ┌──────────┐     ┌─────────────┐           │        │
  │  │  │  WORKER  │     │  EVALUATOR  │           │        │
  │  │  │  (Build) │     │   (Grade)   │           │        │
  │  │  └────┬─────┘     └──────┬──────┘           │        │
  │  │       │                  │                  │        │
  │  │       ▼                  │                  │        │
  │  │   Reads contract         │                  │        │
  │  │   Produces deliverables  │                  │        │
  │  │       │                  │                  │        │
  │  │       └──────────────────▼                  │        │
  │  │                   Reads contract +          │        │
  │  │                   deliverables              │        │
  │  │                          │                  │        │
  │  │                    ┌─────┴─────┐            │        │
  │  │                    │  PASS?    │            │        │
  │  │                    └─────┬─────┘            │        │
  │  │                   yes/       \no            │        │
  │  │                  /             \            │        │
  │  │          Next sprint     Feedback ──►       │        │
  │  │          or complete     Worker revises     │        │
  │  │                                             │        │
  │  └─────────────────────────────────────────────┘        │
  │                                                         │
  │  ┌─────────────┐                                        │
  │  │  COMPLETE   │  All sprints passed (or max retries)   │
  │  └─────────────┘                                        │
  └─────────────────────────────────────────────────────────┘
```

### Why separate agents?

The key insight from Anthropic's research: **agents cannot reliably evaluate their own work**. When asked to grade output they produced, agents tend to praise it — even when the quality is obviously mediocre to a human. By giving the evaluation job to a separate agent that is prompted to be skeptical, you get honest assessments and real quality improvement through revision.

---

## Concepts

### Roles

Every agent assigned to a project has a role. Three roles are built in:

| Role | What it does |
|------|-------------|
| **Initiator** | Reads the project concept, creates a detailed spec, decides how many sprints are needed, and writes acceptance criteria for each sprint. Think of this as the project manager. |
| **Worker** | Executes each sprint. Reads the sprint contract and produces whatever deliverables it calls for — code, documents, research, designs. Intentionally generic. |
| **Evaluator** | Grades the Worker's deliverables against the sprint contract. Returns PASS or FAIL with detailed feedback. Prompted to be skeptical. |

You can also create custom roles (e.g., "Designer", "Reviewer") for agents that assist in other ways.

### Sprints

A sprint is a unit of work with a clear contract. The Initiator decides how many sprints the project needs and writes a contract for each one. Each contract includes:

- A title and description
- Acceptance criteria (a checklist)
- Expected deliverables

### Sprint Contracts

A sprint contract is a markdown file that defines what "done" looks like. Example:

```markdown
# Sprint 1: User Authentication

## Acceptance Criteria
- [ ] Login form with email and password fields
- [ ] Password validation (min 8 chars, 1 uppercase, 1 number)
- [ ] Error messages displayed for invalid credentials
- [ ] Successful login redirects to dashboard

## Deliverables
- auth-form.tsx: Login form component
- auth-service.ts: Authentication logic
- auth.test.ts: Unit tests

## Constraints
- Must use existing Button and Input components
- No external auth libraries
```

### Evaluations

After the Worker completes a sprint, the Evaluator writes a structured assessment:

```markdown
# Evaluation: Sprint 1

## Result: FAIL

## Criteria Assessment
| Criterion | Status | Score | Notes |
|-----------|--------|-------|-------|
| Login form | PASS | 9/10 | Clean implementation |
| Password validation | FAIL | 4/10 | Missing uppercase check |
| Error messages | PASS | 8/10 | Good UX |
| Login redirect | FAIL | 2/10 | Not implemented |

## Overall Score: 5.75/10

## Feedback for Revision
- Password validation is incomplete: the uppercase character requirement is missing
- Login redirect after successful authentication is not implemented at all
- Consider adding a loading state to the submit button
```

If the result is FAIL, the orchestrator sends the Worker back to revise, including the Evaluator's feedback. This continues until the sprint passes or the maximum number of revisions is reached (default: 3).

### Context Resets

Each phase (planning, working, evaluating) starts with a **completely fresh context window**. The agent receives only:

1. Its persona/system prompt
2. The relevant project files (spec, contract, deliverables, feedback)
3. The task instructions

This is different from context compaction (which summarizes and preserves history). A full reset prevents the agent from losing coherence on long-running tasks and avoids "context anxiety" where models start wrapping up prematurely as the context window fills.

### File-Based Handoffs

All communication between agents happens through files in the project directory. This means:

- Everything is inspectable — you can read any file to see exactly what each agent produced
- Work persists across server restarts
- You can manually edit files between phases (e.g., tweak a sprint contract before the Worker starts)

---

## Getting Started

### Prerequisites

- At least 2 agents configured in OpenKIWI (3 recommended — one per role)
- Each agent needs an LLM provider assigned
- The Projects experimental feature must be enabled in Settings

### Step 1: Enable Projects

Go to **Settings > General** and toggle on **Project Management**.

### Step 2: Create a Project

1. Click **Projects** in the sidebar
2. Click **New Project**
3. Enter a name (e.g., "Todo App")
4. Click **Create Project**

This creates a directory at `workspace/projects/<name>/` with a blank `0-CONCEPT.md` file.

### Step 3: Write Your Concept

Select the project, click on `0-CONCEPT.md`, and click **Edit**. Write a description of what you want built. This is the only input the Initiator will receive, so be clear about your goals. Example:

```markdown
# Todo App Concept

Build a simple todo list web application with:
- Add, complete, and delete tasks
- Tasks persist in localStorage
- Clean, minimal UI with dark mode support
- Filter by: all, active, completed
```

### Step 4: Assign Your Team

1. Switch to the **Team** tab
2. Click **Add Agent** for each agent you want to assign
3. Select the agent and pick a role from the dropdown

A typical team:

| Agent | Role |
|-------|------|
| Luna | Initiator |
| Ada | Worker |
| Max | Evaluator |

You need at minimum an **Initiator** and a **Worker**. The Evaluator is optional — without one, sprints auto-pass after the Worker finishes (no quality gating).

### Step 5: Start a Run

Click **Start Run** on the Team tab. The orchestrator will:

1. Send the Initiator to read your concept and create a spec with sprint contracts
2. For each sprint, send the Worker to build the deliverables
3. Send the Evaluator to grade each sprint
4. Loop back to the Worker with feedback if the sprint fails
5. Mark the project complete when all sprints pass

You can watch progress in real time — the UI shows which phase is active, which agent is working, and the current sprint number.

### Step 6: Review the Output

Switch to the **Files** tab to see everything the agents produced:

```
0-CONCEPT.md              ← Your original concept
spec.md                   ← Initiator's project spec
sprint-1-contract.md      ← Acceptance criteria
sprint-1-work/            ← Worker's deliverables
sprint-1-evaluation.md    ← Evaluator's grade + feedback
sprint-2-contract.md
sprint-2-work/
sprint-2-evaluation.md
...
```

---

## Project Directory Structure

```
workspace/projects/<project-name>/
│
├── project.json               Config: assigned agents, roles, run status
├── 0-CONCEPT.md               Your project concept (you write this)
│
├── spec.md                    Project spec (Initiator writes this)
│
├── sprint-1-contract.md       Sprint 1 acceptance criteria
├── sprint-1-work/             Sprint 1 deliverables (directory)
│   ├── component.tsx
│   ├── service.ts
│   └── ...
├── sprint-1-evaluation.md     Sprint 1 evaluation
│
├── sprint-2-contract.md       Sprint 2 acceptance criteria
├── sprint-2-work/             Sprint 2 deliverables
├── sprint-2-evaluation.md     Sprint 2 evaluation
│
└── ...                        Additional sprints as needed
```

---

## Configuration

### Project Config (`project.json`)

Each project stores its configuration in `project.json`:

```json
{
  "agents": [
    { "agentId": "luna", "role": "Initiator" },
    { "agentId": "ada", "role": "Worker" },
    { "agentId": "max", "role": "Evaluator" }
  ],
  "roles": ["Initiator", "Worker", "Evaluator"],
  "status": "idle",
  "maxRevisionsPerSprint": 3,
  "currentRunId": null
}
```

| Field | Description |
|-------|-------------|
| `agents` | List of assigned agents with their roles |
| `roles` | Available roles (includes 3 defaults, you can add more) |
| `status` | Current state: `idle`, `planning`, `sprinting`, `evaluating`, `complete`, `failed` |
| `maxRevisionsPerSprint` | How many times the Worker can revise before moving on (default: 3) |
| `currentRunId` | ID of the active run, or null |

### Custom Roles

The three built-in roles (Initiator, Worker, Evaluator) drive the orchestration loop. You can add custom roles via the Team tab for organizational purposes — for example, assigning a "Designer" agent that the Worker might delegate to, or a "Reviewer" for additional quality checks in the future.

### Agent Tips

- **Initiator**: Best served by a strong reasoning model (Claude, GPT-4). It needs to understand the concept, break it into sprints, and write clear acceptance criteria.
- **Worker**: Can be any capable model. For code-heavy projects, use a model with good tool use (it needs to write files). For research projects, a model with web search access works well.
- **Evaluator**: Should be a strong model prompted for skepticism. The whole point of the Evaluator is to catch issues the Worker missed — a weak model here defeats the purpose.

---

## API Reference

### Endpoints

All endpoints are under `/api/projects`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List all projects |
| `POST` | `/` | Create a new project |
| `GET` | `/:name` | Get project files and config |
| `GET` | `/:name/config` | Get project config |
| `PUT` | `/:name/config` | Update project config |
| `GET` | `/:name/agents` | Get assigned agents |
| `PUT` | `/:name/agents` | Update agent assignments |
| `PUT` | `/:name/roles` | Update available roles |
| `POST` | `/:name/run` | Start an orchestration run |
| `GET` | `/:name/run/status` | Get current run status |
| `POST` | `/:name/run/stop` | Stop the active run |
| `GET` | `/:name/files/:filename` | Get file content |
| `PUT` | `/:name/files/:filename` | Update file content |

### WebSocket Events

During a run, the server broadcasts `project_run_update` events over the WebSocket connection:

```json
{
  "type": "project_run_update",
  "projectName": "Todo App",
  "runId": "abc-123",
  "phase": "evaluating",
  "sprint": 2,
  "revision": 1,
  "totalSprints": 3,
  "activeAgent": "max",
  "details": "max is evaluating Sprint 2"
}
```

---

## How It Compares

OpenKIWI has two multi-agent patterns. Use whichever fits your task:

| | Ad-hoc Delegation | Project Orchestration |
|---|---|---|
| **Best for** | One-off research, parallel data gathering | Structured work that needs quality gating |
| **Pattern** | Fan-out/fan-in (coordinator delegates, collects) | Plan-build-evaluate loop with revisions |
| **Communication** | In-memory scratchpad | File-based (persistent, inspectable) |
| **Evaluation** | None (coordinator synthesizes) | Dedicated Evaluator agent with structured grading |
| **Context** | Compaction (summarize and continue) | Full reset per phase (fresh context each time) |
| **Setup** | Automatic (any agent can delegate) | Requires project setup with agent-role assignments |
| **Activation** | Chat message or skill trigger | "Start Run" button in Projects UI |

---

## Troubleshooting

**"No agent with Initiator role assigned"** — Make sure you've added at least one agent with the Initiator role in the Team tab before starting a run.

**Sprint always fails** — Check the evaluation file (`sprint-N-evaluation.md`). If the Evaluator is being unreasonably strict, you can manually edit the evaluation to `## Result: PASS` and restart. You can also increase `maxRevisionsPerSprint` in the project config.

**Initiator creates too many/few sprints** — Edit `0-CONCEPT.md` to be more specific about scope. You can also edit `spec.md` after the planning phase to adjust the sprint count (change `## Sprint Count: N`) before the next run.

**Agent produces empty output** — Ensure the agent has an LLM provider configured and that the provider supports tool use (the agent needs file-writing tools to produce deliverables).

**Run seems stuck** — Check the agent status on the Agents page. If an agent shows "working" indefinitely, it may have hit a tool error. Click **Stop Run** and check the server logs for details.
