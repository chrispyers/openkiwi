# LinkedIn Tool

Publish posts to your LinkedIn profile.

## Setup

1. Go to [developer.linkedin.com](https://developer.linkedin.com) and create a new app
2. Associate the app with a LinkedIn Company Page (you can create a free one)
3. Under **Products**, add **"Share on LinkedIn"** (grants `w_member_social` scope)
4. Wait for LinkedIn to approve the product (can take days)
5. Copy the **Client ID** and **Client Secret** from the Auth tab
6. Set them in your `.env` file:
   ```
   LINKEDIN_CLIENT_ID=your_client_id
   LINKEDIN_CLIENT_SECRET=your_client_secret
   ```
7. Restart the gateway, then connect via **Settings > Connections > LinkedIn**

## Actions

| Action | Description | Requires Approval |
|--------|-------------|-------------------|
| `create_post` | Draft a post and preview for user approval | Yes (configurable) |
| `publish_post` | Publish a post (called after user approves) | No |

## Approval Workflow

By default, posts require user approval before publishing. The agent drafts content, the user reviews it, and then the agent publishes.

To disable approval for a specific agent, set `requireApproval: false` in the agent's config:

```json
{
    "tools": {
        "linkedin": {
            "requireApproval": false
        }
    }
}
```
