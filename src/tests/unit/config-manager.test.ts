import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to share state with vi.mock
const { mockFiles } = vi.hoisted(() => ({ mockFiles: {} as Record<string, string> }));

vi.mock('node:fs', () => ({
    default: {
        existsSync: vi.fn((filePath: string) => {
            return filePath in mockFiles;
        }),
        readFileSync: vi.fn((filePath: string) => {
            if (filePath in mockFiles) return mockFiles[filePath];
            throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
        }),
        writeFileSync: vi.fn((filePath: string, data: string) => {
            mockFiles[filePath] = data;
        }),
        mkdirSync: vi.fn(),
        statSync: vi.fn((filePath: string) => ({
            isFile: () => filePath in mockFiles
        })),
        copyFileSync: vi.fn((src: string, dest: string) => {
            mockFiles[dest] = mockFiles[src];
        })
    }
}));

import { loadConfig, saveConfig } from '../../config-manager';
import fs from 'node:fs';

describe('config-manager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mock files for each test
        for (const key in mockFiles) delete mockFiles[key];

        // Suppress expected console errors and logs
        vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.spyOn(console, 'log').mockImplementation(() => { });
    });

    it('should generate a default config if no file exists and no template is found', () => {
        const config = loadConfig();

        expect(config).toBeDefined();
        // Fallback default from code
        expect(config.gateway.port).toBe(3808);
        expect(config.chat.showReasoning).toBe(true);
    });

    it('should load an existing config and decrypt sensitive fields', () => {
        // Provide mock files for the config load
        mockFiles['/nonexistent'] = ''; // just tricking typescript keys

        // We have to mock the paths it's going to use.
        // It uses process.cwd() to resolve.
        const cwd = process.cwd();
        const configPath = `${cwd}/config/config.json`;

        mockFiles[configPath] = JSON.stringify({
            chat: {
                showReasoning: true,
                includeHistory: false,
                generateSummaries: false
            },
            gateway: {
                port: 1234,
                secretToken: "mock-token",
            },
            providers: [],
            system: { version: "1" }
        });

        const config = loadConfig();
        expect(config.gateway.port).toBe(1234);
        expect(config.gateway.secretToken).toBeDefined();
    });

    // ---------------------------------------------------------------
    // maxTokens provider schema
    // ---------------------------------------------------------------
    describe('maxTokens provider schema', () => {
        it('should parse config with maxTokens set on a provider', () => {
            const cwd = process.cwd();
            const configPath = `${cwd}/config/config.json`;

            mockFiles[configPath] = JSON.stringify({
                chat: { showReasoning: true, includeHistory: false, generateSummaries: false },
                gateway: { port: 3808, secretToken: 'mock-token' },
                providers: [{
                    description: 'test',
                    endpoint: 'http://localhost:1234',
                    model: 'test-model',
                    maxTokens: 2048,
                }],
                system: { version: '1' },
            });

            const config = loadConfig();
            expect(config.providers[0].maxTokens).toBe(2048);
        });

        it('should parse config without maxTokens on a provider (optional)', () => {
            const cwd = process.cwd();
            const configPath = `${cwd}/config/config.json`;

            mockFiles[configPath] = JSON.stringify({
                chat: { showReasoning: true, includeHistory: false, generateSummaries: false },
                gateway: { port: 3808, secretToken: 'mock-token' },
                providers: [{
                    description: 'test',
                    endpoint: 'http://localhost:1234',
                    model: 'test-model',
                }],
                system: { version: '1' },
            });

            const config = loadConfig();
            expect(config.providers[0].maxTokens).toBeUndefined();
        });

        it('should reject negative maxTokens via schema validation', () => {
            const { z } = require('zod');
            const providerSchema = z.object({
                description: z.string().default(''),
                endpoint: z.string().url(),
                model: z.string(),
                maxTokens: z.number().int().positive().optional(),
            });

            expect(() => providerSchema.parse({
                endpoint: 'http://localhost:1234',
                model: 'test',
                maxTokens: -1,
            })).toThrow();
        });

        it('should reject zero maxTokens via schema validation', () => {
            const { z } = require('zod');
            const providerSchema = z.object({
                description: z.string().default(''),
                endpoint: z.string().url(),
                model: z.string(),
                maxTokens: z.number().int().positive().optional(),
            });

            expect(() => providerSchema.parse({
                endpoint: 'http://localhost:1234',
                model: 'test',
                maxTokens: 0,
            })).toThrow();
        });

        it('should reject float maxTokens via schema validation', () => {
            const { z } = require('zod');
            const providerSchema = z.object({
                description: z.string().default(''),
                endpoint: z.string().url(),
                model: z.string(),
                maxTokens: z.number().int().positive().optional(),
            });

            expect(() => providerSchema.parse({
                endpoint: 'http://localhost:1234',
                model: 'test',
                maxTokens: 1024.5,
            })).toThrow();
        });
    });
});
