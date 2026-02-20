# OpenKIWI

A powerful local AI assistant platform designed for extensibility, personalization, and high-performance local inference.

## 🌟 Overview

This project is a sophisticated AI orchestration layer that sits between your local inference server (like **LM Studio**) and a premium **Control UI**. It enables you to interact with multiple AI "Agents," each with their own distinct personalities and capabilities.

### Key Capabilities

*   **⚡ Local Inference Integration**: First-class support for LM Studio and other OpenAI-compatible local APIs.
*   **🎭 Agent Personalization**: Define agents with unique `IDENTITY.md` (instructions), `SOUL.md` (values), and `MEMORY.md` (stored context).
*   **🛠️ Extensible Skill System**: A modular plugin architecture allowing agents to use tools like:
    *   **Filesystem Management**: Create, read, and delete files/directories in a safe workspace.
    *   **Memory Persistence**: Store and recall facts across sessions.
    *   **Web Integration**: Mock search and weather capabilities.
*   **📡 Real-time Gateway**: A WebSocket-powered backend that handles presence detection across multiple connected computers.
*   **💎 Premium UI**: A modern, responsive React interface with:
    *   Dark and Light mode support.
    *   Syntax-highlighted code blocks.
    *   Real-time streaming and reasoning display.
    *   Comprehensive settings for gateway and agent management.

---

## 🚀 Getting Started

Ensure you have [Node.js](https://nodejs.org/) installed on your machine.

### 🏁 Start Everything
To launch both the Gateway backend and the Control UI simultaneously:

```bash
npm run dev
```

---

## 🔧 Component Specific Start

If you prefer to run the components independently:

### 🖥️ Start Just the Gateway (Backend)
The Gateway handles model communication, tool execution, and state persistence.

```bash
npm run dev:backend
```
*Runs on port `3000` (default) or the port specified in `config.json`.*

### 🎨 Start Just the Control UI (Frontend)
The web-based interface for chatting and managing your agents.

```bash
npm run dev:ui
```
*Runs on `http://localhost:5173` by default.*

---

## 📂 Project Structure

- `src/`: Gateway backend source code (Express + WebSockets).
- `ui/`: React frontend source code (Vite + Tailwind CSS).
- `worker.ts`: **New!** Host-side worker to run native commands (npx, brew, browser).
- `agents/`: Storage for agent definitions and personality files.
- `tools/`: Modular local tool/plugin definitions.
- `workspace/`: Local directory for agent file management.

---

## 🚀 Host Worker (Escape the Container)

By default, the Gateway runs in Docker for safety. If you want your AI to run commands on your Mac (like `npx`, `git`, or opening Chrome), you can run the **Host Worker**:

1.  Open a new terminal on your Mac.
2.  Run: `npx tsx worker.ts`
3.  The agent will now have the `run_host_command` and `open_browser` tools!

---

## ⚙️ Configuration

Global settings such as the LM Studio endpoint and security tokens can be found in `config.json`. These can also be modified directly through the **Settings** panel in the Control UI.
