# Google Tasks

Manage Google Tasks: list task lists, list tasks, add tasks, and update task status.

## Prerequisites

- A Google Cloud project with the [Tasks API](https://console.cloud.google.com/apis/library/tasks.googleapis.com) enabled
- OAuth 2.0 credentials (Client ID, Client Secret, and Refresh Token)

## Setup

### 1. Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (type: Desktop app)
3. Note the Client ID and Client Secret

### 2. Obtain a Refresh Token

Use the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) or run the OAuth flow manually:

1. Authorize with scope `https://www.googleapis.com/auth/tasks`
2. Exchange the authorization code for a refresh token

### 3. Configure Environment

Add to your `.env` file:

```
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
```

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `list_tasklists` | List all task lists | None |
| `list_tasks` | List tasks in a task list | `tasklist_id` |
| `add_task` | Add a new task | `tasklist_id`, `title` |
| `update_task` | Update an existing task | `tasklist_id`, `task_id` |

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | The action to perform (see above) |
| `tasklist_id` | string | Task list ID (from `list_tasklists`) |
| `task_id` | string | Task ID (from `list_tasks`) |
| `title` | string | Task title |
| `notes` | string | Task description/notes |
| `due` | string | Due date in `YYYY-MM-DD` format |
| `status` | string | `needsAction` or `completed` |

## Usage Examples

**List all task lists:**
```
action: "list_tasklists"
```

**List tasks in a list:**
```
action: "list_tasks", tasklist_id: "MDk..."
```

**Add a task with a due date:**
```
action: "add_task", tasklist_id: "MDk...", title: "Review PR #49", due: "2026-03-05"
```

**Mark a task as completed:**
```
action: "update_task", tasklist_id: "MDk...", task_id: "abc123", status: "completed"
```
