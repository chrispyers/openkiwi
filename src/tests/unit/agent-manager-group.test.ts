import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to share state with vi.mock
const { mockFiles, mockDirs } = vi.hoisted(() => ({
    mockFiles: {} as Record<string, string>,
    mockDirs: {} as Record<string, boolean>,
}));

vi.mock('node:fs', () => ({
    default: {
        existsSync: vi.fn((filePath: string) => {
            return filePath in mockFiles || filePath in mockDirs;
        }),
        readFileSync: vi.fn((filePath: string) => {
            if (filePath in mockFiles) return mockFiles[filePath];
            throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
        }),
        writeFileSync: vi.fn((filePath: string, data: string | Buffer) => {
            mockFiles[filePath] = typeof data === 'string' ? data : data.toString();
        }),
        readdirSync: vi.fn((dirPath: string) => {
            const entries: string[] = [];
            const prefix = dirPath.endsWith('/') ? dirPath : dirPath + '/';
            const seen = new Set<string>();
            for (const key of [...Object.keys(mockFiles), ...Object.keys(mockDirs)]) {
                if (key.startsWith(prefix)) {
                    const rest = key.slice(prefix.length);
                    const name = rest.split('/')[0];
                    if (name && !seen.has(name)) {
                        seen.add(name);
                        entries.push(name);
                    }
                }
            }
            return entries;
        }),
        statSync: vi.fn((filePath: string) => ({
            isDirectory: () => filePath in mockDirs,
            isFile: () => filePath in mockFiles,
            birthtimeMs: 1000,
        })),
        mkdirSync: vi.fn(),
        rmSync: vi.fn(),
    },
}));

vi.mock('../../config-manager.js', () => ({
    loadConfig: vi.fn(() => ({
        global: {},
        providers: [],
    })),
}));

vi.mock('../../memory/manager.js', () => ({
    MemoryIndexManager: vi.fn(),
}));

vi.mock('../../logger.js', () => ({
    logger: { log: vi.fn() },
}));

vi.mock('../../state.js', () => ({
    broadcastMessage: vi.fn(),
}));

import { AgentManager } from '../../agent-manager';
import fs from 'node:fs';

const cwd = process.cwd();
const agentsDir = `${cwd}/agents`;

function setupAgent(id: string, config: Record<string, any>, files: Record<string, string> = {}) {
    const dir = `${agentsDir}/${id}`;
    mockDirs[dir] = true;
    mockFiles[`${dir}/config.json`] = JSON.stringify(config);
    mockFiles[`${dir}/PERSONA.md`] = files['PERSONA.md'] || `You are ${id}.`;
    mockFiles[`${dir}/RULES.md`] = files['RULES.md'] || '';
    mockFiles[`${dir}/MEMORY.md`] = files['MEMORY.md'] || '';
    mockDirs[agentsDir] = true;
}

function clearMockFs() {
    for (const key in mockFiles) delete mockFiles[key];
    for (const key in mockDirs) delete mockDirs[key];
}

describe('AgentManager - group field', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearMockFs();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    describe('getAgent', () => {
        it('should return group when set in config.json', () => {
            setupAgent('alpha', { name: 'Alpha', group: 'Research' });
            const agent = AgentManager.getAgent('alpha');
            expect(agent).not.toBeNull();
            expect(agent!.group).toBe('Research');
        });

        it('should return undefined group when not set in config.json', () => {
            setupAgent('beta', { name: 'Beta' });
            const agent = AgentManager.getAgent('beta');
            expect(agent).not.toBeNull();
            expect(agent!.group).toBeUndefined();
        });

        it('should return empty string group if set to empty string', () => {
            setupAgent('gamma', { name: 'Gamma', group: '' });
            const agent = AgentManager.getAgent('gamma');
            expect(agent).not.toBeNull();
            expect(agent!.group).toBe('');
        });
    });

    describe('saveAgentConfig - group operations', () => {
        it('should save group to config.json', () => {
            setupAgent('alpha', { name: 'Alpha' });
            AgentManager.saveAgentConfig('alpha', { group: 'Campaign' });

            const writeCalls = (fs.writeFileSync as any).mock.calls;
            const configWrite = writeCalls.find((c: any[]) => c[0].endsWith('alpha/config.json'));
            expect(configWrite).toBeDefined();
            const saved = JSON.parse(configWrite[1]);
            expect(saved.group).toBe('Campaign');
            expect(saved.name).toBe('Alpha');
        });

        it('should update group on an agent that already has one', () => {
            setupAgent('alpha', { name: 'Alpha', group: 'Old Group' });
            AgentManager.saveAgentConfig('alpha', { group: 'New Group' });

            const writeCalls = (fs.writeFileSync as any).mock.calls;
            const configWrite = writeCalls.find((c: any[]) => c[0].endsWith('alpha/config.json'));
            const saved = JSON.parse(configWrite[1]);
            expect(saved.group).toBe('New Group');
        });

        it('should remove group when set to null', () => {
            setupAgent('alpha', { name: 'Alpha', group: 'Research' });
            AgentManager.saveAgentConfig('alpha', { group: null });

            const writeCalls = (fs.writeFileSync as any).mock.calls;
            const configWrite = writeCalls.find((c: any[]) => c[0].endsWith('alpha/config.json'));
            const saved = JSON.parse(configWrite[1]);
            expect(saved.group).toBeUndefined();
            expect('group' in saved).toBe(false);
        });

        it('should not affect other config fields when setting group', () => {
            setupAgent('alpha', {
                name: 'Alpha',
                provider: 'some-model',
                heartbeat: { enabled: true, schedule: '* * * * *' },
            });
            AgentManager.saveAgentConfig('alpha', { group: 'Research' });

            const writeCalls = (fs.writeFileSync as any).mock.calls;
            const configWrite = writeCalls.find((c: any[]) => c[0].endsWith('alpha/config.json'));
            const saved = JSON.parse(configWrite[1]);
            expect(saved.name).toBe('Alpha');
            expect(saved.provider).toBe('some-model');
            expect(saved.heartbeat.enabled).toBe(true);
            expect(saved.group).toBe('Research');
        });

        it('should not affect other config fields when removing group', () => {
            setupAgent('alpha', {
                name: 'Alpha',
                provider: 'some-model',
                group: 'Research',
            });
            AgentManager.saveAgentConfig('alpha', { group: null });

            const writeCalls = (fs.writeFileSync as any).mock.calls;
            const configWrite = writeCalls.find((c: any[]) => c[0].endsWith('alpha/config.json'));
            const saved = JSON.parse(configWrite[1]);
            expect(saved.name).toBe('Alpha');
            expect(saved.provider).toBe('some-model');
            expect('group' in saved).toBe(false);
        });
    });

    describe('null-key cleanup in saveAgentConfig', () => {
        it('should remove any key set to null, not just group', () => {
            setupAgent('alpha', { name: 'Alpha', provider: 'old-model', group: 'Test' });
            AgentManager.saveAgentConfig('alpha', { provider: null, group: null });

            const writeCalls = (fs.writeFileSync as any).mock.calls;
            const configWrite = writeCalls.find((c: any[]) => c[0].endsWith('alpha/config.json'));
            const saved = JSON.parse(configWrite[1]);
            expect('provider' in saved).toBe(false);
            expect('group' in saved).toBe(false);
            expect(saved.name).toBe('Alpha');
        });
    });

    describe('multiple agents with groups', () => {
        it('should return correct groups for multiple agents', () => {
            setupAgent('alpha', { name: 'Alpha', group: 'Research' });
            setupAgent('beta', { name: 'Beta', group: 'Research' });
            setupAgent('gamma', { name: 'Gamma', group: 'Campaign' });
            setupAgent('delta', { name: 'Delta' });

            const alpha = AgentManager.getAgent('alpha');
            const beta = AgentManager.getAgent('beta');
            const gamma = AgentManager.getAgent('gamma');
            const delta = AgentManager.getAgent('delta');

            expect(alpha!.group).toBe('Research');
            expect(beta!.group).toBe('Research');
            expect(gamma!.group).toBe('Campaign');
            expect(delta!.group).toBeUndefined();
        });
    });
});
