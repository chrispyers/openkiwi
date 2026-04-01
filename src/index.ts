import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import cors from 'cors';
import fs from 'node:fs';
import { loadConfig } from './config-manager.js';
import { AgentManager } from './agent-manager.js';
import { ToolManager } from './tool-manager.js';
import { SkillManager } from './skill-manager.js';
import { HeartbeatManager } from './heartbeat-manager.js';
import { WhatsAppManager } from './whatsapp-manager.js';
import { TelegramManager } from './telegram-manager.js';
import { SCREENSHOTS_DIR, WORKSPACE_DIR } from './security.js';
import { initWhatsAppHandler } from './WhatsApp.js';
import { initTelegramHandler } from './Telegram.js';
import apiRouter from './routes.js';
import { handleChatConnection } from './chat-handler.js';
import path from 'node:path';
import { checkForUpdates } from './services/update-service.js';

// Manually load .env variables before config starts
const ENV_PATH = path.resolve(process.cwd(), '.env');
if (fs.existsSync(ENV_PATH)) {
    const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

const config = loadConfig();
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({
    server,
    verifyClient: (info, callback) => {
        const origin = info.origin;
        // Allow requests with no origin (direct connections)
        if (!origin) return callback(true);

        const currentConfig = loadConfig();
        const allowed = currentConfig.gateway.allowedOrigins || [];

        if (allowed.includes('*') || allowed.includes(origin)) {
            callback(true);
        } else {
            console.warn(`[WebSocket] Blocked connection from unauthorized origin: ${origin}`);
            callback(false, 403, 'Unauthorized Origin');
        }
    }
});

async function startServer() {
    console.log('Initializing systems...');
    await ToolManager.discoverTools();
    await SkillManager.discoverSkills();
    await AgentManager.initializeAllMemoryManagers();
    await HeartbeatManager.start();

    // Ensure required directories exist
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
        fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
    if (!fs.existsSync(WORKSPACE_DIR)) {
        fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
    }

    // Check for updates
    const currentConfig = loadConfig();
    const updateInterval = currentConfig.system.updateCheckInterval || 3600000;
    checkForUpdates().catch(e => console.error('Initial update check failed:', e));
    setInterval(() => {
        checkForUpdates().catch(e => console.error('Scheduled update check failed:', e));
    }, updateInterval);

    // Initialize WhatsApp and its message handler
    WhatsAppManager.getInstance();
    initWhatsAppHandler();

    // Initialize Telegram and its message handler
    initTelegramHandler();
    if (process.env.TELEGRAM_BOT_TOKEN?.trim()) {
        TelegramManager.getInstance().connect();
    }

    const PORT = config.gateway.port;
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Gateway service is hot and running on port ${PORT}`);
    });
}

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin requests)
        if (!origin) return callback(null, true);

        const currentConfig = loadConfig();
        const allowed = currentConfig.gateway.allowedOrigins || [];

        // Merge in origins from CORS_ALLOWED_ORIGINS env var (comma-separated)
        const envOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];
        const allAllowed = [...allowed, ...envOrigins];

        if (allAllowed.includes('*') || allAllowed.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

app.get('/', (req, res) => res.json({ status: 'ok', service: 'openkiwi-gateway' }));

app.use('/api', apiRouter);

// WebSocket for Chat
wss.on('connection', handleChatConnection);
/* NOTE: agentToolsConfig pass-through needs to be added to chat-handler.ts */

startServer().catch(err => {
    console.error('FATAL STARTUP ERROR:', err);
    process.exit(1);
});
