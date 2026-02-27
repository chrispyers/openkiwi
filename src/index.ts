import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import cors from 'cors';
import fs from 'node:fs';
import { loadConfig } from './config-manager.js';
import { AgentManager } from './agent-manager.js';
import { ToolManager } from './tool-manager.js';
import { HeartbeatManager } from './heartbeat-manager.js';
import { WhatsAppManager } from './whatsapp-manager.js';
import { SCREENSHOTS_DIR, WORKSPACE_DIR } from './security.js';
import { initWhatsAppHandler } from './WhatsApp.js';
import apiRouter from './routes.js';
import { checkForUpdates } from './services/update-service.js';
import { handleChatConnection } from './chat-handler.js';

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

        if (allowed.includes(origin) && origin !== '*') {
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
    await AgentManager.initializeAllMemoryManagers();
    await HeartbeatManager.start();

    // Ensure required directories exist
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
        fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
    if (!fs.existsSync(WORKSPACE_DIR)) {
        fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
    }

    // Check for updates on startup and then every hour
    await checkForUpdates();
    setInterval(checkForUpdates, 3600000); // 1 hour

    // Initialize WhatsApp and its message handler
    WhatsAppManager.getInstance();
    initWhatsAppHandler();

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

        if (allowed.includes(origin) || allowed.includes('*')) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'ok', service: 'openkiwi-gateway' }));

app.use('/api', apiRouter);

// WebSocket for Chat
wss.on('connection', handleChatConnection);

startServer().catch(err => {
    console.error('FATAL STARTUP ERROR:', err);
    process.exit(1);
});
