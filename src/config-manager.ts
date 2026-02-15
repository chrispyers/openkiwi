import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const ConfigSchema = z.object({
    lmStudio: z.object({
        baseUrl: z.string().url(),
        modelId: z.string(),
        showReasoning: z.boolean().default(true),
        includeHistory: z.boolean().default(false),
        systemPrompt: z.string().default("You are a helpful AI assistant."),
    }),
    gateway: z.object({
        port: z.number().int().positive(),
        secretToken: z.string().default(""),
    }),
});

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
            lmStudio: {
                baseUrl: 'http://localhost:1234/v1',
                modelId: 'default-model',
                showReasoning: true,
                includeHistory: false,
                systemPrompt: "You are a helpful AI assistant.",
            },
            gateway: {
                port: 3808,
                secretToken: "",
            },
        };
    }
}

export function saveConfig(config: Config): void {
    const data = JSON.stringify(config, null, 2);
    fs.writeFileSync(CONFIG_PATH, data, 'utf-8');
}
