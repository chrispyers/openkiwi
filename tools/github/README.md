# GitHub

Manage files in GitHub repositories with authenticated access. Supports listing, reading, creating, and updating files via the `gh` CLI.

## Prerequisites

- [GitHub CLI](https://cli.github.com/) (`gh`) installed and available on `PATH`
- A GitHub personal access token set as `GH_TOKEN` in your `.env` file

## Configuration

### Global (config.json)

Add allowed repositories and path prefixes under `tools.github.repos`:

```json
{
  "tools": {
    "github": {
      "repos": {
        "owner/repo": ["src", "content/blog", "docs"]
      }
    }
  }
}
```

### Per-Agent (agent config.json)

Override global config for specific agents:

```json
{
  "tools": {
    "github": {
      "repos": {
        "owner/repo": ["src", "tests"]
      }
    }
  }
}
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GH_TOKEN` | Yes | GitHub personal access token |
| `GITHUB_DEBUG` | No | Set to `true` for debug logging |

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `list` | List files in a directory | `repo`, `path` |
| `read` | Read the full content of a file | `repo`, `path` |
| `create` | Create a new file (fails if exists) | `repo`, `path`, `content`, `message` |
| `update` | Update an existing file (fails if not found) | `repo`, `path`, `content`, `message` |

## Usage Examples

**List files in a directory:**
```
action: "list", repo: "owner/repo", path: "src"
```

**Read a file:**
```
action: "read", repo: "owner/repo", path: "src/index.ts"
```

**Create a new file:**
```
action: "create", repo: "owner/repo", path: "content/blog/new-post.md",
content: "# My Post\n\nHello world.", message: "Add new blog post"
```

**Update an existing file:**
```
action: "update", repo: "owner/repo", path: "content/blog/new-post.md",
content: "# Updated Post\n\nRevised content.", message: "Update blog post"
```

## Security

- Agents can only access repositories explicitly listed in their config
- Path prefixes restrict access to specific directories within a repo
- All write operations require a commit message for audit trail
