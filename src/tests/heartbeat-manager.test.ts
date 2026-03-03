import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock fns (declared before vi.mock, referenced in hoisted factories) ---

// node-cron
const mockCronValidate = vi.fn();
const mockCronSchedule = vi.fn();
vi.mock('node-cron', () => ({
    default: {
        validate: (...args: any[]) => mockCronValidate(...args),
        schedule: (...args: any[]) => mockCronSchedule(...args),
    }
}));

// node:fs
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
vi.mock('node:fs', () => ({
    default: {
        existsSync: (...args: any[]) => mockExistsSync(...args),
        readFileSync: (...args: any[]) => mockReadFileSync(...args),
    }
}));

// agent-manager
const mockGetAgent = vi.fn();
const mockListAgents = vi.fn();
const mockSetAgentState = vi.fn();
vi.mock('../agent-manager.js', () => ({
    AgentManager: {
        getAgent: (...args: any[]) => mockGetAgent(...args),
        listAgents: () => mockListAgents(),
        setAgentState: (...args: any[]) => mockSetAgentState(...args),
    }
}));

// config-manager
const mockLoadConfig = vi.fn();
vi.mock('../config-manager.js', () => ({
    loadConfig: () => mockLoadConfig(),
}));

// llm-provider (imported by heartbeat-manager but not used directly in channel delivery)
vi.mock('../llm-provider.js', () => ({
    streamChatCompletion: vi.fn(),
}));

// tool-manager
vi.mock('../tool-manager.js', () => ({
    ToolManager: {},
}));

// logger
const mockLoggerLog = vi.fn();
vi.mock('../logger.js', () => ({
    logger: { log: (...args: any[]) => mockLoggerLog(...args) },
}));

// agent-loop
const mockRunAgentLoop = vi.fn();
vi.mock('../agent-loop.js', () => ({
    runAgentLoop: (...args: any[]) => mockRunAgentLoop(...args),
}));

// session-manager
const mockGetSession = vi.fn();
const mockSaveSession = vi.fn();
vi.mock('../session-manager.js', () => ({
    SessionManager: {
        getSession: (...args: any[]) => mockGetSession(...args),
        saveSession: (...args: any[]) => mockSaveSession(...args),
    }
}));

// telegram-manager
const mockTgGetStatus = vi.fn();
const mockTgSendMessage = vi.fn();
vi.mock('../telegram-manager.js', () => ({
    TelegramManager: {
        getInstance: () => ({
            getStatus: () => mockTgGetStatus(),
            sendMessage: (...args: any[]) => mockTgSendMessage(...args),
        }),
    }
}));

// whatsapp-manager
const mockWaGetStatus = vi.fn();
const mockWaSendMessage = vi.fn();
vi.mock('../whatsapp-manager.js', () => ({
    WhatsAppManager: {
        getInstance: () => ({
            getStatus: () => mockWaGetStatus(),
            sendMessage: (...args: any[]) => mockWaSendMessage(...args),
        }),
    }
}));

// routes (connectedClients) — needs vi.hoisted because Map is not a vi.fn()
const { mockConnectedClients } = vi.hoisted(() => ({
    mockConnectedClients: new Map<any, any>(),
}));
vi.mock('../routes.js', () => ({
    connectedClients: mockConnectedClients,
}));

// --- Import after mocks ---
import { HeartbeatManager } from '../heartbeat-manager.js';

// --- Helpers ---

function makeAgent(overrides: any = {}) {
    return {
        id: 'test-agent',
        name: 'Test Agent',
        emoji: '',
        path: '/agents/test-agent',
        identity: '',
        soul: '',
        memory: '',
        rules: '',
        heartbeatInstructions: 'Check in with user',
        systemPrompt: 'You are a test agent.',
        provider: 'test-provider',
        heartbeat: {
            enabled: true,
            schedule: '0 8 * * *',
            channels: [],
        },
        tools: {},
        ...overrides,
    };
}

function defaultConfig() {
    return {
        providers: [
            {
                description: 'test-provider',
                endpoint: 'http://localhost:1234',
                model: 'test-provider',
                apiKey: 'test-key',
            },
        ],
        chat: { showReasoning: false },
    };
}

/** Invoke the private static executeHeartbeat directly. */
function executeHeartbeat(agentId: string): Promise<void> {
    return (HeartbeatManager as any).executeHeartbeat(agentId);
}

describe('HeartbeatManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockConnectedClients.clear();

        // Clear internal static state
        (HeartbeatManager as any).executingAgents.clear();
        (HeartbeatManager as any).jobs.clear();

        // Default mock behaviour
        mockLoadConfig.mockReturnValue(defaultConfig());
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue('Check in with user');
        mockRunAgentLoop.mockResolvedValue({ finalResponse: 'Good morning! How are you?' });
        mockGetSession.mockReturnValue(null);
        mockTgGetStatus.mockReturnValue({ connected: true });
        mockTgSendMessage.mockResolvedValue(undefined);
        mockWaGetStatus.mockReturnValue({ connected: true });
        mockWaSendMessage.mockResolvedValue(undefined);
    });

    // ---------------------------------------------------------------
    // Telegram channel delivery
    // ---------------------------------------------------------------
    describe('Telegram delivery', () => {
        it('should send message and save session when Telegram is connected', async () => {
            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [{ type: 'telegram', chatId: '123456789' }],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            expect(mockTgSendMessage).toHaveBeenCalledWith('123456789', 'Good morning! How are you?');
            expect(mockSaveSession).toHaveBeenCalled();
        });

        it('should use session ID format tg-{chatId}_{agentId}', async () => {
            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [{ type: 'telegram', chatId: '999' }],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            const savedSession = mockSaveSession.mock.calls[0][0];
            expect(savedSession.id).toBe('tg-999_test-agent');
        });

        it('should skip delivery when Telegram is not connected', async () => {
            mockTgGetStatus.mockReturnValue({ connected: false });
            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [{ type: 'telegram', chatId: '123456789' }],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            expect(mockTgSendMessage).not.toHaveBeenCalled();
            expect(mockLoggerLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    level: 'warn',
                    message: expect.stringContaining('Telegram not connected'),
                })
            );
        });

        it('should not save session when Telegram is not connected', async () => {
            mockTgGetStatus.mockReturnValue({ connected: false });
            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [{ type: 'telegram', chatId: '123456789' }],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            expect(mockSaveSession).not.toHaveBeenCalled();
        });
    });

    // ---------------------------------------------------------------
    // WhatsApp channel delivery
    // ---------------------------------------------------------------
    describe('WhatsApp delivery', () => {
        it('should send message and save session when WhatsApp is connected', async () => {
            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [{ type: 'whatsapp', jid: '123456789@s.whatsapp.net' }],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            expect(mockWaSendMessage).toHaveBeenCalledWith(
                '123456789@s.whatsapp.net',
                'Good morning! How are you?'
            );
            expect(mockSaveSession).toHaveBeenCalled();
        });

        it('should sanitize JID in session ID (wa-{sanitizedJid}-{agentId})', async () => {
            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [{ type: 'whatsapp', jid: '123456789@s.whatsapp.net' }],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            const savedSession = mockSaveSession.mock.calls[0][0];
            expect(savedSession.id).toBe('wa-123456789_s_whatsapp_net-test-agent');
        });

        it('should skip delivery when WhatsApp is not connected', async () => {
            mockWaGetStatus.mockReturnValue({ connected: false });
            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [{ type: 'whatsapp', jid: '123456789@s.whatsapp.net' }],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            expect(mockWaSendMessage).not.toHaveBeenCalled();
            expect(mockLoggerLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    level: 'warn',
                    message: expect.stringContaining('WhatsApp not connected'),
                })
            );
        });
    });

    // ---------------------------------------------------------------
    // WebSocket channel delivery
    // ---------------------------------------------------------------
    describe('WebSocket delivery', () => {
        it('should broadcast to all connected WebSocket clients', async () => {
            const mockSend1 = vi.fn();
            const mockSend2 = vi.fn();
            mockConnectedClients.set({ send: mockSend1 }, { hostname: 'a', ip: '1', connectedAt: 0 });
            mockConnectedClients.set({ send: mockSend2 }, { hostname: 'b', ip: '2', connectedAt: 0 });

            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [{ type: 'websocket' }],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            expect(mockSend1).toHaveBeenCalledTimes(1);
            expect(mockSend2).toHaveBeenCalledTimes(1);

            const payload = JSON.parse(mockSend1.mock.calls[0][0]);
            expect(payload.type).toBe('heartbeat_message');
            expect(payload.agentId).toBe('test-agent');
            expect(payload.content).toBe('Good morning! How are you?');
            expect(payload.sessionId).toMatch(/^heartbeat-test-agent-\d+$/);
        });

        it('should use session ID format heartbeat-{agentId}-{timestamp}', async () => {
            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [{ type: 'websocket' }],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            const savedSession = mockSaveSession.mock.calls[0][0];
            expect(savedSession.id).toMatch(/^heartbeat-test-agent-\d+$/);
        });

        it('should handle zero connected clients without error', async () => {
            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [{ type: 'websocket' }],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            // Session still saved even with no clients
            expect(mockSaveSession).toHaveBeenCalled();
            expect(mockLoggerLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('0 WebSocket client(s)'),
                })
            );
        });

        it('should tolerate a client whose send() throws', async () => {
            const badSend = vi.fn().mockImplementation(() => { throw new Error('disconnected'); });
            const goodSend = vi.fn();
            mockConnectedClients.set({ send: badSend }, { hostname: 'a', ip: '1', connectedAt: 0 });
            mockConnectedClients.set({ send: goodSend }, { hostname: 'b', ip: '2', connectedAt: 0 });

            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [{ type: 'websocket' }],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            // Good client still receives the message
            expect(goodSend).toHaveBeenCalledTimes(1);
        });
    });

    // ---------------------------------------------------------------
    // Multiple channels
    // ---------------------------------------------------------------
    describe('multiple channels', () => {
        it('should deliver to all configured channels', async () => {
            const mockWsSend = vi.fn();
            mockConnectedClients.set({ send: mockWsSend }, { hostname: 'a', ip: '1', connectedAt: 0 });

            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [
                        { type: 'telegram', chatId: '111' },
                        { type: 'whatsapp', jid: '222@s.whatsapp.net' },
                        { type: 'websocket' },
                    ],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            expect(mockTgSendMessage).toHaveBeenCalled();
            expect(mockWaSendMessage).toHaveBeenCalled();
            expect(mockWsSend).toHaveBeenCalled();
            // One session saved per channel
            expect(mockSaveSession).toHaveBeenCalledTimes(3);
        });

        it('should continue to other channels when one fails', async () => {
            mockTgSendMessage.mockRejectedValue(new Error('Telegram API down'));

            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [
                        { type: 'telegram', chatId: '111' },
                        { type: 'whatsapp', jid: '222@s.whatsapp.net' },
                    ],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            // Telegram failed but WhatsApp still delivered
            expect(mockWaSendMessage).toHaveBeenCalledWith(
                '222@s.whatsapp.net',
                'Good morning! How are you?'
            );
            // Error logged for the failed channel
            expect(mockLoggerLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    level: 'error',
                    message: expect.stringContaining('Failed to deliver to telegram'),
                })
            );
        });
    });

    // ---------------------------------------------------------------
    // Session management
    // ---------------------------------------------------------------
    describe('session management', () => {
        it('should create a new session with correct structure', async () => {
            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [{ type: 'telegram', chatId: '555' }],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            const savedSession = mockSaveSession.mock.calls[0][0];
            expect(savedSession.id).toBe('tg-555_test-agent');
            expect(savedSession.agentId).toBe('test-agent');
            expect(savedSession.title).toBe('Scheduled check-in');
            expect(savedSession.messages).toHaveLength(2);
            expect(savedSession.messages[0].role).toBe('user');
            expect(savedSession.messages[0].content).toBe('[Scheduled check-in]');
            expect(savedSession.messages[1].role).toBe('assistant');
            expect(savedSession.messages[1].content).toBe('Good morning! How are you?');
        });

        it('should append to an existing session', async () => {
            const existingSession = {
                id: 'tg-555_test-agent',
                agentId: 'test-agent',
                title: 'Scheduled check-in',
                messages: [
                    { role: 'user', content: '[Scheduled check-in]', timestamp: 1000 },
                    { role: 'assistant', content: 'Previous response', timestamp: 1001 },
                    { role: 'user', content: 'User reply', timestamp: 2000 },
                    { role: 'assistant', content: 'Agent follow-up', timestamp: 2001 },
                ],
                updatedAt: 2001,
            };
            mockGetSession.mockReturnValue(existingSession);

            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [{ type: 'telegram', chatId: '555' }],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            const savedSession = mockSaveSession.mock.calls[0][0];
            // Original 4 messages + 2 new (user check-in + assistant response)
            expect(savedSession.messages).toHaveLength(6);
            expect(savedSession.messages[4].role).toBe('user');
            expect(savedSession.messages[4].content).toBe('[Scheduled check-in]');
            expect(savedSession.messages[5].role).toBe('assistant');
            expect(savedSession.messages[5].content).toBe('Good morning! How are you?');
        });

        it('should store raw content (with think tags) in session', async () => {
            const rawResponse = '<think>Let me think about this...</think>Good morning!';
            mockRunAgentLoop.mockResolvedValue({ finalResponse: rawResponse });

            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [{ type: 'telegram', chatId: '555' }],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            // Session should store raw content (with think tags)
            const savedSession = mockSaveSession.mock.calls[0][0];
            expect(savedSession.messages[1].content).toBe(rawResponse);
        });

        it('should send clean content (think tags stripped) to channel', async () => {
            const rawResponse = '<think>Let me think about this...</think>Good morning!';
            mockRunAgentLoop.mockResolvedValue({ finalResponse: rawResponse });

            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [{ type: 'telegram', chatId: '555' }],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            // Channel should receive clean content (think tags stripped)
            expect(mockTgSendMessage).toHaveBeenCalledWith('555', 'Good morning!');
        });
    });

    // ---------------------------------------------------------------
    // Backward compatibility
    // ---------------------------------------------------------------
    describe('backward compatibility', () => {
        it('should not deliver when no channels are configured', async () => {
            const agent = makeAgent({
                heartbeat: { enabled: true, schedule: '0 8 * * *' },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            // Agent loop still runs
            expect(mockRunAgentLoop).toHaveBeenCalled();
            // But no channel delivery
            expect(mockTgSendMessage).not.toHaveBeenCalled();
            expect(mockWaSendMessage).not.toHaveBeenCalled();
            expect(mockSaveSession).not.toHaveBeenCalled();
        });

        it('should not deliver when channels array is empty', async () => {
            const agent = makeAgent({
                heartbeat: { enabled: true, schedule: '0 8 * * *', channels: [] },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            expect(mockRunAgentLoop).toHaveBeenCalled();
            expect(mockTgSendMessage).not.toHaveBeenCalled();
            expect(mockWaSendMessage).not.toHaveBeenCalled();
            expect(mockSaveSession).not.toHaveBeenCalled();
        });

        it('should skip delivery when agent loop returns empty response', async () => {
            mockRunAgentLoop.mockResolvedValue({ finalResponse: '' });

            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [{ type: 'telegram', chatId: '111' }],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            expect(mockTgSendMessage).not.toHaveBeenCalled();
            expect(mockSaveSession).not.toHaveBeenCalled();
        });

        it('should skip delivery when response is only think tags', async () => {
            mockRunAgentLoop.mockResolvedValue({ finalResponse: '<think>internal reasoning only</think>' });

            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [{ type: 'telegram', chatId: '111' }],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            // contentToLog will be empty after think tag stripping
            expect(mockTgSendMessage).not.toHaveBeenCalled();
            expect(mockSaveSession).not.toHaveBeenCalled();
        });
    });

    // ---------------------------------------------------------------
    // Error handling
    // ---------------------------------------------------------------
    describe('error handling', () => {
        it('should not crash when agent is not found', async () => {
            mockGetAgent.mockReturnValue(null);

            await expect(executeHeartbeat('nonexistent')).resolves.toBeUndefined();
        });

        it('should not crash when HEARTBEAT.md does not exist', async () => {
            mockGetAgent.mockReturnValue(makeAgent());
            mockExistsSync.mockReturnValue(false);

            await expect(executeHeartbeat('test-agent')).resolves.toBeUndefined();
            expect(mockRunAgentLoop).not.toHaveBeenCalled();
        });

        it('should not crash when HEARTBEAT.md is empty', async () => {
            mockGetAgent.mockReturnValue(makeAgent());
            mockReadFileSync.mockReturnValue('   ');

            await expect(executeHeartbeat('test-agent')).resolves.toBeUndefined();
            expect(mockRunAgentLoop).not.toHaveBeenCalled();
        });

        it('should prevent concurrent execution for the same agent', async () => {
            // Simulate a long-running agent loop
            let resolveLoop!: (v: any) => void;
            mockRunAgentLoop.mockReturnValue(new Promise(r => { resolveLoop = r; }));

            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [{ type: 'telegram', chatId: '111' }],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            // Start first execution (it will hang on the agent loop)
            const first = executeHeartbeat('test-agent');

            // Second call should be skipped
            await executeHeartbeat('test-agent');

            // Only one agent loop invocation
            expect(mockRunAgentLoop).toHaveBeenCalledTimes(1);

            // Resolve the first call to clean up
            resolveLoop({ finalResponse: 'done' });
            await first;
        });

        it('should clean up executingAgents even if agent loop throws', async () => {
            mockRunAgentLoop.mockRejectedValue(new Error('LLM provider error'));
            mockGetAgent.mockReturnValue(makeAgent());

            await executeHeartbeat('test-agent');

            // Agent should be removed from executingAgents so next heartbeat can run
            expect((HeartbeatManager as any).executingAgents.has('test-agent')).toBe(false);
        });

        it('should log unknown channel types', async () => {
            const agent = makeAgent({
                heartbeat: {
                    enabled: true,
                    schedule: '0 8 * * *',
                    channels: [{ type: 'carrier-pigeon' }],
                },
            });
            mockGetAgent.mockReturnValue(agent);

            await executeHeartbeat('test-agent');

            expect(mockLoggerLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    level: 'warn',
                    message: expect.stringContaining('Unknown channel type'),
                })
            );
        });
    });

    // ---------------------------------------------------------------
    // Scheduling (start / refreshAgent)
    // ---------------------------------------------------------------
    describe('scheduling', () => {
        beforeEach(() => {
            mockCronValidate.mockReturnValue(true);
            mockCronSchedule.mockReturnValue({ stop: vi.fn() });
        });

        it('should schedule heartbeats for agents with enabled heartbeat', async () => {
            mockListAgents.mockReturnValue(['agent-a', 'agent-b']);
            mockGetAgent
                .mockReturnValueOnce(makeAgent({
                    id: 'agent-a',
                    name: 'Agent A',
                    heartbeat: { enabled: true, schedule: '0 8 * * *' },
                }))
                .mockReturnValueOnce(makeAgent({
                    id: 'agent-b',
                    name: 'Agent B',
                    heartbeat: { enabled: false, schedule: '0 9 * * *' },
                }));

            await HeartbeatManager.start();

            // Only agent-a should be scheduled (agent-b is disabled)
            expect(mockCronSchedule).toHaveBeenCalledTimes(1);
            expect(mockCronSchedule).toHaveBeenCalledWith('0 8 * * *', expect.any(Function));
        });

        it('should reject invalid cron expressions', async () => {
            mockCronValidate.mockReturnValue(false);
            mockListAgents.mockReturnValue(['agent-a']);
            mockGetAgent.mockReturnValue(makeAgent({
                id: 'agent-a',
                heartbeat: { enabled: true, schedule: 'invalid-cron' },
            }));

            await HeartbeatManager.start();

            expect(mockCronSchedule).not.toHaveBeenCalled();
        });

        it('refreshAgent should stop existing job and reschedule', () => {
            const stopFn = vi.fn();
            (HeartbeatManager as any).jobs.set('agent-a', { stop: stopFn });

            mockGetAgent.mockReturnValue(makeAgent({
                id: 'agent-a',
                heartbeat: { enabled: true, schedule: '30 9 * * *' },
            }));

            HeartbeatManager.refreshAgent('agent-a');

            expect(stopFn).toHaveBeenCalled();
            expect(mockCronSchedule).toHaveBeenCalledWith('30 9 * * *', expect.any(Function));
        });
    });
});
