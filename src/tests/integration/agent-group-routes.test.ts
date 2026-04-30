import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock dependencies before importing
vi.mock('../../agent-manager.js', () => {
    const agents: Record<string, any> = {};
    return {
        AgentManager: {
            listAgents: vi.fn(() => Object.keys(agents)),
            getAgent: vi.fn((id: string) => agents[id] || null),
            createAgent: vi.fn((name: string) => {
                const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                agents[id] = { id, name, group: undefined, systemPrompt: '', identity: '', soul: '', memory: '', heartbeatInstructions: '', rules: '' };
                return agents[id];
            }),
            saveAgentConfig: vi.fn((id: string, config: any) => {
                if (agents[id]) {
                    // Simulate null-key removal
                    for (const [key, val] of Object.entries(config)) {
                        if (val === null) {
                            delete agents[id][key];
                        } else {
                            agents[id][key] = val;
                        }
                    }
                }
            }),
            deleteAgent: vi.fn((id: string) => { delete agents[id]; }),
            _agents: agents,
            _reset: () => { for (const key in agents) delete agents[key]; },
        },
    };
});

vi.mock('../../heartbeat-manager.js', () => ({
    HeartbeatManager: {
        refreshAgent: vi.fn(),
    },
}));

vi.mock('../../config-manager.js', () => ({
    loadConfig: vi.fn(() => ({
        gateway: { secretToken: 'test-token' },
        heartbeat: { allowManualTrigger: false },
    })),
}));

vi.mock('../../security.js', () => ({
    signMarkdown: vi.fn((s: string) => s),
}));

import agentRoutes from '../../routes/agents.js';
import { AgentManager } from '../../agent-manager.js';

const app = express();
app.use(express.json());
app.use('/api/agents', agentRoutes);

const mockAgents = (AgentManager as any)._agents;
const resetAgents = (AgentManager as any)._reset;

function seedAgent(id: string, overrides: Record<string, any> = {}) {
    mockAgents[id] = {
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        systemPrompt: '',
        identity: '',
        soul: '',
        memory: '',
        heartbeatInstructions: '',
        rules: '',
        ...overrides,
    };
}

describe('Agent Group - API Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetAgents();
    });

    describe('GET /api/agents', () => {
        it('should return agents with their group field', async () => {
            seedAgent('alpha', { group: 'Research' });
            seedAgent('beta', { group: 'Campaign' });
            seedAgent('gamma', {});

            const res = await request(app).get('/api/agents');
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(3);

            const alpha = res.body.find((a: any) => a.id === 'alpha');
            const beta = res.body.find((a: any) => a.id === 'beta');
            const gamma = res.body.find((a: any) => a.id === 'gamma');

            expect(alpha.group).toBe('Research');
            expect(beta.group).toBe('Campaign');
            expect(gamma.group).toBeUndefined();
        });

        it('should return empty array when no agents exist', async () => {
            const res = await request(app).get('/api/agents');
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });
    });

    describe('POST /api/agents/:id/config - group operations', () => {
        it('should save group via config endpoint', async () => {
            seedAgent('alpha', {});
            const res = await request(app)
                .post('/api/agents/alpha/config')
                .send({ group: 'Research' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(AgentManager.saveAgentConfig).toHaveBeenCalledWith('alpha', { group: 'Research' });
        });

        it('should remove group by sending null', async () => {
            seedAgent('alpha', { group: 'Research' });
            const res = await request(app)
                .post('/api/agents/alpha/config')
                .send({ group: null });

            expect(res.status).toBe(200);
            expect(AgentManager.saveAgentConfig).toHaveBeenCalledWith('alpha', { group: null });
        });

        it('should update group without affecting other fields', async () => {
            seedAgent('alpha', { name: 'Alpha', provider: 'model-1' });
            const res = await request(app)
                .post('/api/agents/alpha/config')
                .send({ group: 'Campaign' });

            expect(res.status).toBe(200);
            // saveAgentConfig should only receive the group field
            expect(AgentManager.saveAgentConfig).toHaveBeenCalledWith('alpha', { group: 'Campaign' });
        });
    });

    describe('group field preserved through lifecycle', () => {
        it('should preserve group after other config changes', async () => {
            seedAgent('alpha', { group: 'Research' });

            // Update name but not group
            await request(app)
                .post('/api/agents/alpha/config')
                .send({ name: 'Alpha Renamed' });

            // The mock simulates the merge - group should still exist
            expect(mockAgents['alpha'].group).toBe('Research');
            expect(mockAgents['alpha'].name).toBe('Alpha Renamed');
        });

        it('should handle group removal then re-assignment', async () => {
            seedAgent('alpha', { group: 'Research' });

            // Remove group
            await request(app)
                .post('/api/agents/alpha/config')
                .send({ group: null });
            expect(mockAgents['alpha'].group).toBeUndefined();

            // Re-assign group
            await request(app)
                .post('/api/agents/alpha/config')
                .send({ group: 'Campaign' });
            expect(mockAgents['alpha'].group).toBe('Campaign');
        });
    });
});
