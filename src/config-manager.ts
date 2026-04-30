import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';

const ENCRYPTION_PREFIX = 'enc:';
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

function loadOrCreateEncryptionKey(): Buffer {
    if (process.env.OPENKIWI_ENCRYPTION_KEY) {
        return Buffer.from(process.env.OPENKIWI_ENCRYPTION_KEY, 'hex');
    }
    const keyPath = path.resolve(process.cwd(), 'config', '.openkiwi.key');
    if (fs.existsSync(keyPath)) {
        const existing = fs.readFileSync(keyPath, 'utf-8').trim();
        if (existing.length === 64) {
            return Buffer.from(existing, 'hex');
        }
    }
    const key = crypto.randomBytes(32);
    fs.writeFileSync(keyPath, key.toString('hex'), { encoding: 'utf-8', mode: 0o600 });
    return key;
}

const ENCRYPTION_KEY = loadOrCreateEncryptionKey();

export function encrypt(text: string): string {
    if (!text || text.startsWith(ENCRYPTION_PREFIX)) return text;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${ENCRYPTION_PREFIX}${iv.toString('hex')}${encrypted}`;
}

function decrypt(text: string): string {
    if (!text || !text.startsWith(ENCRYPTION_PREFIX)) return text;
    try {
        const payload = text.substring(ENCRYPTION_PREFIX.length);
        const iv = Buffer.from(payload.substring(0, 32), 'hex');
        const encryptedText = payload.substring(32);
        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        console.warn('[Config] Failed to decrypt a value (key mismatch or corrupted data). Resetting to empty.');
        return '';
    }
}

const ConfigSchema = z.object({

    chat: z.object({
        showReasoning: z.boolean(),
        includeHistory: z.boolean(),
        generateSummaries: z.boolean(),
        showTokenMetrics: z.boolean().default(true),
    }).passthrough(),
    gateway: z.object({
        port: z.number().int().positive(),
        secretToken: z.string().default(""),
        endpoint: z.string().url().default("http://localhost:3808"),
        allowedOrigins: z.array(z.string()).default(["http://localhost:3000", "http://127.0.0.1:3000"]),
    }).passthrough(),
    global: z.object({
        systemPrompt: z.string().default("You are a helpful AI assistant. You have access to a personal workspace where you can read, write, move, and copy files using the 'manage_files' tool. If a user asks about an image in your workspace (like a screenshot), you can visually inspect it using the 'describe_image' tool."),
    }).passthrough().optional(),
    providers: z.array(z.object({
        description: z.string().default(""),
        endpoint: z.string().url(),
        model: z.string(),
        apiKey: z.string().optional(),
        maxTokens: z.number().int().positive().optional(),
        capabilities: z.object({
            vision: z.boolean().optional(),
            reasoning: z.boolean().optional(),
            trained_for_tool_use: z.boolean().optional(),
        }).passthrough().optional(),
    }).passthrough()).default([]),
    memory: z.object({
        useEmbeddings: z.boolean().default(false),
        embeddingsModel: z.string().default(""),
    }).passthrough().default({ useEmbeddings: false, embeddingsModel: "" }),
    system: z.object({
        latestVersion: z.string().default(""),
        updateCheckInterval: z.number().default(3600000),
    }).passthrough().default({ latestVersion: "", updateCheckInterval: 3600000 }),
    heartbeat: z.object({
        allowManualTrigger: z.boolean().default(false),
    }).passthrough().default({ allowManualTrigger: false }),
    enabledTools: z.record(z.string(), z.boolean()).default({}),
    tools: z.record(z.string(), z.any()).default({}),
    mcpServers: z.record(z.string(), z.object({
        command: z.string(),
        args: z.array(z.string()).default([]),
    }).passthrough()).default({}),
    connections: z.object({
        git: z.array(z.object({
            id: z.string(),
            label: z.string(),
            baseUrl: z.string(),
            pat: z.string().optional(),
            verified: z.boolean().optional(),
            verifiedUsername: z.string().optional(),
        })).default([]),
        anthropic: z.array(z.object({
            id: z.string(),
            label: z.string(),
            apiKey: z.string(),
            verified: z.boolean().optional(),
        })).default([]),
        lmstudio: z.array(z.object({
            id: z.string(),
            label: z.string(),
            endpoint: z.string(),
        })).default([]),
        lemonade: z.array(z.object({
            id: z.string(),
            label: z.string(),
            endpoint: z.string(),
        })).default([]),
        google: z.array(z.object({
            id: z.string(),
            label: z.string(),
            apiKey: z.string(),
            verified: z.boolean().optional(),
        })).default([]),
        openai: z.array(z.object({
            id: z.string(),
            label: z.string(),
            apiKey: z.string(),
            verified: z.boolean().optional(),
        })).default([]),
        ollama: z.array(z.object({
            id: z.string(),
            label: z.string(),
            endpoint: z.string(),
        })).default([]),
        openrouter: z.array(z.object({
            id: z.string(),
            label: z.string(),
            apiKey: z.string(),
            verified: z.boolean().optional(),
        })).default([]),
    }).passthrough().default({ git: [], anthropic: [], lmstudio: [], lemonade: [], google: [], openai: [], ollama: [], openrouter: [] }),
}).passthrough();

export type Config = z.infer<typeof ConfigSchema>;

const CONFIG_PATH = path.resolve(process.cwd(), 'config', 'config.json');
const LEGACY_MOUNT_PATH = path.resolve(process.cwd(), 'config.json.legacy');
const TEMPLATE_PATH = path.resolve(process.cwd(), 'config.json.template');

function ensureConfigDir() {
    const configDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
}

export function loadConfig(): Config {
    // 1. Migration/Initialization logic
    if (!fs.existsSync(CONFIG_PATH)) {
        // Try legacy mount first
        if (fs.existsSync(LEGACY_MOUNT_PATH)) {
            try {
                const stats = fs.statSync(LEGACY_MOUNT_PATH);
                if (stats.isFile()) {
                    console.log('[Config] Found legacy config.json via mount. Migrating to config/config.json...');
                    ensureConfigDir();
                    fs.copyFileSync(LEGACY_MOUNT_PATH, CONFIG_PATH);
                }
            } catch (err) {
                // Likely a directory mount from Docker (new user), ignore it
            }
        }

        // Check for existing old config in root (for non-docker local runs)
        const OLD_ROOT_CONFIG = path.resolve(process.cwd(), 'config.json');
        if (!fs.existsSync(CONFIG_PATH) && fs.existsSync(OLD_ROOT_CONFIG)) {
            try {
                const stats = fs.statSync(OLD_ROOT_CONFIG);
                if (stats.isFile()) {
                    console.log('[Config] Found legacy config.json in root. Migrating...');
                    ensureConfigDir();
                    fs.copyFileSync(OLD_ROOT_CONFIG, CONFIG_PATH);
                }
            } catch (err) { }
        }

        // If still no config, use template
        if (!fs.existsSync(CONFIG_PATH) && fs.existsSync(TEMPLATE_PATH)) {
            console.log('[Config] No config found. Initializing from template...');
            try {
                ensureConfigDir();
                fs.copyFileSync(TEMPLATE_PATH, CONFIG_PATH);
            } catch (err) {
                console.error('[Config] Failed to initialize from template:', err);
            }
        }
    }

    try {
        const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const json = JSON.parse(data);
        let needsMigration = false;

        // Decrypt sensitive fields and check for plain text
        if (json.providers && Array.isArray(json.providers)) {
            json.providers.forEach((p: any) => {
                if (p.apiKey && !p.apiKey.startsWith(ENCRYPTION_PREFIX)) {
                    needsMigration = true;
                }
                if (p.apiKey) p.apiKey = decrypt(p.apiKey);
            });
        }
        if (json.gateway && json.gateway.secretToken) {
            if (json.gateway.secretToken && !json.gateway.secretToken.startsWith(ENCRYPTION_PREFIX)) {
                needsMigration = true;
            }
            json.gateway.secretToken = decrypt(json.gateway.secretToken);
        }

        if (json.connections?.git && Array.isArray(json.connections.git)) {
            json.connections.git.forEach((conn: any) => {
                if (conn.pat && !conn.pat.startsWith(ENCRYPTION_PREFIX)) needsMigration = true;
                if (conn.pat) conn.pat = decrypt(conn.pat);
                if (conn.verifiedUsername && !conn.verifiedUsername.startsWith(ENCRYPTION_PREFIX)) needsMigration = true;
                if (conn.verifiedUsername) conn.verifiedUsername = decrypt(conn.verifiedUsername);
            });
        }
        if (json.connections?.anthropic && Array.isArray(json.connections.anthropic)) {
            json.connections.anthropic.forEach((conn: any) => {
                if (conn.apiKey && !conn.apiKey.startsWith(ENCRYPTION_PREFIX)) needsMigration = true;
                if (conn.apiKey) conn.apiKey = decrypt(conn.apiKey);
            });
        }
        if (json.connections?.google && Array.isArray(json.connections.google)) {
            json.connections.google.forEach((conn: any) => {
                if (conn.apiKey && !conn.apiKey.startsWith(ENCRYPTION_PREFIX)) needsMigration = true;
                if (conn.apiKey) conn.apiKey = decrypt(conn.apiKey);
            });
        }
        if (json.connections?.openai && Array.isArray(json.connections.openai)) {
            json.connections.openai.forEach((conn: any) => {
                if (conn.apiKey && !conn.apiKey.startsWith(ENCRYPTION_PREFIX)) needsMigration = true;
                if (conn.apiKey) conn.apiKey = decrypt(conn.apiKey);
            });
        }
        if (json.connections?.openrouter && Array.isArray(json.connections.openrouter)) {
            json.connections.openrouter.forEach((conn: any) => {
                if (conn.apiKey && !conn.apiKey.startsWith(ENCRYPTION_PREFIX)) needsMigration = true;
                if (conn.apiKey) conn.apiKey = decrypt(conn.apiKey);
            });
        }

        const config = ConfigSchema.parse(json);


        // Auto-generate token if missing or empty
        if (!config.gateway.secretToken) {
            config.gateway.secretToken = crypto.randomBytes(24).toString('hex');
            needsMigration = true;
            const message = `Generated new secure Gateway Token: ${config.gateway.secretToken}`;
            const line = '-'.repeat(message.length);
            console.log('\n' + line);
            console.log(message);
            console.log(line + '\n');
        }

        if (needsMigration) {
            saveConfig(config);
        }

        return config;
    } catch (error: any) {
        if (error?.code === 'ENOENT') {
            console.log('[Config] No config.json found — using defaults.');
        } else {
            console.error('[Config] Failed to load config.json, using defaults:', error);
        }
        return {

            chat: {
                showReasoning: true,
                includeHistory: false,
                generateSummaries: false,
                showTokenMetrics: true,
            },
            gateway: {
                port: 3808,
                secretToken: "",
                endpoint: "http://localhost:3808",
                allowedOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
            },
            global: {
                systemPrompt: "You are a helpful AI assistant.",
            },
            providers: [],
            memory: {
                useEmbeddings: false,
                embeddingsModel: "",
            },
            system: {
                latestVersion: "",
                updateCheckInterval: 3600000,
            },
            heartbeat: {
                allowManualTrigger: false,
            },
            enabledTools: {},
            tools: {},
            mcpServers: {},
            connections: { git: [], anthropic: [], lmstudio: [], lemonade: [], google: [], openai: [], ollama: [], openrouter: [] },
        };
    }
}

export function saveConfig(config: Config): void {
    // Deep copy to avoid modifying the in-memory config object
    const configToSave = JSON.parse(JSON.stringify(config));

    // Encrypt sensitive fields
    if (configToSave.providers && Array.isArray(configToSave.providers)) {
        configToSave.providers.forEach((p: any) => {
            if (p.apiKey) p.apiKey = encrypt(p.apiKey);
        });
    }
    if (configToSave.gateway && configToSave.gateway.secretToken) {
        configToSave.gateway.secretToken = encrypt(configToSave.gateway.secretToken);
    }

    if (configToSave.connections?.git && Array.isArray(configToSave.connections.git)) {
        configToSave.connections.git.forEach((conn: any) => {
            if (conn.pat) conn.pat = encrypt(conn.pat);
            if (conn.verifiedUsername) conn.verifiedUsername = encrypt(conn.verifiedUsername);
        });
    }
    if (configToSave.connections?.anthropic && Array.isArray(configToSave.connections.anthropic)) {
        configToSave.connections.anthropic.forEach((conn: any) => {
            if (conn.apiKey) conn.apiKey = encrypt(conn.apiKey);
        });
    }
    if (configToSave.connections?.google && Array.isArray(configToSave.connections.google)) {
        configToSave.connections.google.forEach((conn: any) => {
            if (conn.apiKey) conn.apiKey = encrypt(conn.apiKey);
        });
    }
    if (configToSave.connections?.openai && Array.isArray(configToSave.connections.openai)) {
        configToSave.connections.openai.forEach((conn: any) => {
            if (conn.apiKey) conn.apiKey = encrypt(conn.apiKey);
        });
    }
    if (configToSave.connections?.openrouter && Array.isArray(configToSave.connections.openrouter)) {
        configToSave.connections.openrouter.forEach((conn: any) => {
            if (conn.apiKey) conn.apiKey = encrypt(conn.apiKey);
        });
    }

    const data = JSON.stringify(configToSave, null, 2);
    fs.writeFileSync(CONFIG_PATH, data, 'utf-8');
}
