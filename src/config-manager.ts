import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';

const ENCRYPTION_PREFIX = 'enc:';
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = crypto.createHash('sha256').update('openkiwi-secure-storage-key').digest();
const ENCRYPTION_IV = Buffer.alloc(16, 0); // Static IV for obfuscation purposes

function encrypt(text: string): string {
    if (!text || text.startsWith(ENCRYPTION_PREFIX)) return text;
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, ENCRYPTION_IV);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${ENCRYPTION_PREFIX}${encrypted}`;
}

function decrypt(text: string): string {
    if (!text || !text.startsWith(ENCRYPTION_PREFIX)) return text;
    try {
        const encryptedText = text.substring(ENCRYPTION_PREFIX.length);
        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, ENCRYPTION_IV);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        console.error('Failed to decrypt value:', e);
        return text;
    }
}

const ConfigSchema = z.object({

    chat: z.object({
        showReasoning: z.boolean(),
        includeHistory: z.boolean(),
        generateSummaries: z.boolean(),
    }).passthrough(),
    gateway: z.object({
        port: z.number().int().positive(),
        secretToken: z.string().default(""),
        endpoint: z.string().url().default("http://localhost:3808"),
    }).passthrough(),
    global: z.object({
        systemPrompt: z.string().default("You are a helpful AI assistant. You have access to a personal workspace where you can read, write, move, and copy files using the 'manage_files' tool. If a user asks about an image in your workspace (like a screenshot), you can visually inspect it using the 'describe_image' tool."),
    }).passthrough().optional(),
    providers: z.array(z.object({
        description: z.string().default(""),
        endpoint: z.string().url(),
        model: z.string(),
        apiKey: z.string().optional(),
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
        version: z.string().default("2026-02-18"),
        latestVersion: z.string().default(""),
    }).passthrough().default({ version: "2026-02-18", latestVersion: "" }),
}).passthrough();

export type Config = z.infer<typeof ConfigSchema>;

const CONFIG_PATH = path.resolve(process.cwd(), 'config.json');
let hasLoggedToken = false;

export function loadConfig(): Config {
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
            hasLoggedToken = true;
        } else if (!hasLoggedToken) {
            const message = `Starting gateway with token: ${config.gateway.secretToken}`;
            const line = '-'.repeat(message.length);
            console.log('\n' + line);
            console.log(message);
            console.log(line + '\n');
            hasLoggedToken = true;
        }

        if (needsMigration) {
            saveConfig(config);
        }

        return config;
    } catch (error) {
        console.error('Failed to load config.json, using defaults:', error);
        return {

            chat: {
                showReasoning: true,
                includeHistory: false,
                generateSummaries: false,
            },
            gateway: {
                port: 3808,
                secretToken: "",
                endpoint: "http://localhost:3808",
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
                version: "2026-02-18",
                latestVersion: "",
            }
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

    const data = JSON.stringify(configToSave, null, 2);
    fs.writeFileSync(CONFIG_PATH, data, 'utf-8');
}
