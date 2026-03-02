[![Test Suite](https://github.com/chrispyers/openkiwi/actions/workflows/test.yml/badge.svg)](https://github.com/chrispyers/openkiwi/actions/workflows/test.yml)

#### [Jump to Quickstart](#quickstart)

## What is it?
OpenKIWI sits in the same automation space as other tools like Openclaw, but differentiates itself with a security-first design and a streamlined onboarding experience that gets you started in minutes.

How is OpenKIWI different?

#### Security by default
* Everything runs in isolated Docker containers
* Agents can only access what you explicitly grant

#### Multi-model, agent-first
* Switch between providers or run local models without rebuilding your workflow logic.

#### No session hijacking or OAuth shenanigans
* OpenKIWI plays by the rules and aims to be enterprise-ready, with a clear and auditable security posture.

#### Onboarding in minutes, not hours.
* Clone the repo, run one command and you're up in about 30 seconds. A few quick settings in the UI and you're running your first agent. The whole process takes about 3 minutes.
* No 20-minute YouTube tutorial required.


<a id="quickstart"></a>
## Quickstart

### 1. Launch the Services
* Clone this repo
* `cd` to the directory where you cloned the repo
    * You should see a `docker-compose.yml` file in this directory
* Run `docker compose up --build`

### 2. Connect to the gateway

* Copy the gateway token from the logs:

![](docs/images/gateway_token.png)

* Go to `http://localhost:3000` and click on Gateway

![](docs/images/gateway-1.png)

* Enter your token and click Connect
* If done correctly, you will see `GATEWAY CONNECTED` at the top of the page.

![](docs/images/gateway-2.png)


### 3. Setup your first model
![](docs/images/models-1.png)
![](docs/images/models-2.png)

### 4. Setup your first agent
![](docs/images/agents-1.png)

### 5. (optional) Setup WhatsApp integration
![](docs/images/whatsapp-1.png)
![](docs/images/whatsapp-2.png)

Start messaging agents from your phone:

<img style="border-radius: 10px;" src="docs/images/whatsapp-3.png" width="200"/>

### 6. (optional) Setup Telegram integration

Connect a Telegram bot so you can message your agents from Telegram.

#### Create a bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts to name your bot
3. Copy the **bot token** BotFather gives you

#### Configure environment

Add to your `.env` file:

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

#### (Recommended) Restrict access

By default, anyone who finds your bot can message it. Add an allowlist to restrict access to specific users:

```
TELEGRAM_ALLOW_LIST=123456789, @yourusername
```

Accepts comma-separated Telegram user IDs and/or `@usernames`. To find your user ID, message [@userinfobot](https://t.me/userinfobot) on Telegram.

#### Messaging agents

- Send any message to your bot — it goes to the default agent
- Mention a specific agent by name: `@Oracle what happened this week?`
- Use `/agents` to list all available agents

#### Heartbeat delivery

Agents can send scheduled heartbeat messages to Telegram. Add a channel to the agent's `config.json`:

```json
{
  "heartbeat": {
    "enabled": true,
    "schedule": "0 16 * * 5",
    "channels": [
      { "type": "telegram", "chatId": "123456789" }
    ]
  }
}
```

The `chatId` is the Telegram chat where messages will be delivered (usually your user ID).

### 7. (optional) Enable tools

OpenKIWI ships with several built-in tools that extend your agents' capabilities. Enable them in the Settings page:

| Tool | Description | Docs |
|------|-------------|------|
| Filesystem | Read/write workspace files | Built-in |
| Vision | Analyse images | Built-in |
| Web Browser | Browse and extract web content | Built-in |
| GitHub | Read/write files in GitHub repos | [tools/github/](tools/github/README.md) |
| Google Tasks | Manage Google Tasks lists and items | [tools/google_tasks/](tools/google_tasks/README.md) |
| Qdrant | Semantic search across vector stores | [tools/qdrant/](tools/qdrant/README.md) |

See [tools/README.md](tools/README.md) for the full list and how to create your own.

### Onboarding Complete 🎉
* Start chatting with your agent
* Analyze images
* Write code
* Build websites
* Schedule ongoing tasks for your agents
* Import your ChatGPT history
* And much more

<img style="border-radius: 10px;" src="tools/chatgpt/importer/chatgpt_importer.png" width="400"/>

![](docs/images/chat-1.png)
![](docs/images/chat-2.png)