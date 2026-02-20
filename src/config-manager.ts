import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

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
        systemPrompt: z.string().default("You are a helpful AI assistant."),
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

export function loadConfig(): Config {
    try {
        const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const json = JSON.parse(data);
        const config = ConfigSchema.parse(json);


        // Auto-generate token if missing or empty
        if (!config.gateway.secretToken) {
            const crypto = require('node:crypto');
            config.gateway.secretToken = crypto.randomBytes(24).toString('hex');
            saveConfig(config);
            console.log('Generated new secure Gateway Token:', config.gateway.secretToken);
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
    const data = JSON.stringify(config, null, 2);
    fs.writeFileSync(CONFIG_PATH, data, 'utf-8');
}
