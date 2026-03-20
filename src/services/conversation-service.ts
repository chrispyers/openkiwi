import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { runAgentLoop } from '../agent-loop.js';
import { AgentManager, HeartbeatChannel } from '../agent-manager.js';
import { loadConfig } from '../config-manager.js';
import { createEmbedding } from '../llm-provider.js';
import { ToolManager } from '../tool-manager.js';
import { broadcastMessage, connectedClients } from '../state.js';
import { logger } from '../logger.js';
import { TelegramManager } from '../telegram-manager.js';
import { WhatsAppManager } from '../whatsapp-manager.js';

// ── Campaign Agent Auto-Creation ────────────────────────────────────────────

interface IntroduceCharacter {
    name: string;
    agentId: string;
    class?: string;
    race?: string;
    level?: number;
    background?: string;
    traits?: string[];
    stats?: Record<string, number>;
    inventory?: string[];
}

const AGENTS_DIR = path.resolve(process.cwd(), 'agents');

function ensureCampaignAgent(intro: IntroduceCharacter): string {
    const suffix = intro.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const agentId = `campaign-${suffix}`;
    const agentDir = path.join(AGENTS_DIR, agentId);

    if (AgentManager.getAgent(agentId)) return agentId;

    fs.mkdirSync(agentDir, { recursive: true });

    let persona = `# ${intro.name}\n\nYou are **${intro.name}**`;
    if (intro.race) persona += `, a ${intro.race}`;
    if (intro.class) persona += ` ${intro.class}`;
    persona += `.\n`;
    if (intro.background) persona += `\n## Background\n${intro.background}\n`;
    if (intro.traits?.length) persona += `\n## Personality\n${intro.traits.map(t => `- ${t}`).join('\n')}\n`;
    persona += `\nSpeak and act as ${intro.name} would. Use first person. You live in this world — it is real to you.\n`;

    fs.writeFileSync(path.join(agentDir, 'PERSONA.md'), persona, 'utf-8');
    fs.writeFileSync(path.join(agentDir, 'RULES.md'), '- Stay in character at all times.\n- React to the world naturally.\n- Keep responses vivid but concise (2-4 paragraphs).', 'utf-8');
    fs.writeFileSync(path.join(agentDir, 'MEMORY.md'), '', 'utf-8');
    fs.writeFileSync(path.join(agentDir, 'config.json'), JSON.stringify({ name: intro.name }, null, 2), 'utf-8');

    logger.log({ type: 'system', level: 'info', message: `Auto-created campaign agent: ${agentId} for ${intro.name}` });
    return agentId;
}

// ── Data Model ──────────────────────────────────────────────────────────────

export interface ConversationConfig {
    id: string;
    title: string;
    format: 'debate' | 'discussion' | 'roleplay' | 'podcast' | 'freeform';
    topic: string;
    participants: ParticipantConfig[];
    orchestrator: OrchestratorConfig;
    settings: ConversationSettings;
    createdAt: number;
    updatedAt: number;
}

export interface ParticipantConfig {
    agentId: string;
    role?: string;
    stance?: string;
    characterNotes?: string;
}

export interface OrchestratorConfig {
    type: 'agent' | 'system';
    agentId?: string;
    selectionStrategy: 'orchestrator' | 'round-robin' | 'random';
    rules?: string;
    closingStrategy: 'max-rounds' | 'orchestrator-decides';
}

export interface CampaignPersistence {
    repo: string;                              // e.g. "username/campaign-name"
    branch?: string;                           // default: "main"
    saveEveryNRounds: number;                  // auto-save interval (e.g. 3)
    createIfMissing?: boolean;                 // create private repo if it doesn't exist (default: true)
}

export interface ConversationSettings {
    maxRounds: number;
    contextWindowBudget?: number;
    deliverTo?: HeartbeatChannel[];
    enableTools?: boolean;
    enableMemory?: boolean;
    memoryCollection?: string;
    initialWorldState?: Record<string, any>;   // Starting world state for RPG campaigns
    campaignPersistence?: CampaignPersistence; // Auto-save campaign to GitHub
}

export interface ConversationState {
    id: string;
    status: 'pending' | 'active' | 'closing' | 'complete' | 'error' | 'cancelled';
    currentRound: number;
    transcript: TranscriptEntry[];
    worldState?: Record<string, any>;
    error?: string;
    startedAt?: number;
    completedAt?: number;
}

export interface TranscriptEntry {
    round: number;
    speaker: string;
    speakerName: string;
    role?: string;
    content: string;
    thinking?: string;
    timestamp: number;
    metadata?: {
        action?: string;
        check?: {                          // Requested by orchestrator
            type: string;                  // e.g. "Strength", "Perception", "Attack"
            dc: number;                    // Difficulty class
            modifier?: number;             // Bonus/penalty to the roll
        };
        diceRoll?: number;                 // Actual roll result (system-generated)
        total?: number;                    // diceRoll + modifier
        success?: boolean;                 // total >= dc
        outcome?: string;                  // Orchestrator's narration of the result
        worldStateUpdate?: Record<string, any>;
    };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const CONVERSATIONS_DIR = path.resolve(process.cwd(), 'workspace', 'conversations');

function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function configPath(id: string) { return path.join(CONVERSATIONS_DIR, id, 'config.json'); }
function statePath(id: string) { return path.join(CONVERSATIONS_DIR, id, 'state.json'); }
function transcriptPath(id: string) { return path.join(CONVERSATIONS_DIR, id, 'transcript.md'); }
function episodeLogPath(id: string) { return path.join(CONVERSATIONS_DIR, id, 'episode.log'); }

function appendEpisodeLog(id: string, text: string) {
    const logFile = episodeLogPath(id);
    ensureDir(path.dirname(logFile));
    fs.appendFileSync(logFile, text + '\n', 'utf-8');
}

function formatTimestamp(ts: number): string {
    return new Date(ts).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

function readJSON<T>(filePath: string): T | null {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return null; }
}

function writeJSON(filePath: string, data: any) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ── Qdrant Memory (dual backend: MCP tool or direct client) ─────────────────

function hasMcpBackend(): boolean {
    const defs = ToolManager.getToolDefinitions();
    return defs.some(d => d.name === 'qdrant_mcp');
}

function resolveEmbeddingProvider(): { baseUrl: string; modelId: string; apiKey?: string } | null {
    const config = loadConfig();
    const embeddingsModel = config.memory?.embeddingsModel;
    if (!embeddingsModel) return null;

    const providers = config.providers || [];
    const providerConfig = providers.find((p: any) => p.description === embeddingsModel)
        || providers.find((p: any) => p.model === embeddingsModel);
    if (!providerConfig) return null;

    return { baseUrl: providerConfig.endpoint, modelId: providerConfig.model, apiKey: providerConfig.apiKey };
}

function resolveQdrantConfig(collection: string): { url: string; apiKey?: string; collection: string; dimensions?: number } | null {
    const config = loadConfig();
    const qdrantConfig = config.tools?.qdrant;
    if (!qdrantConfig) return null;

    const stores = qdrantConfig.stores || {};
    if (stores[collection]) return stores[collection];

    const firstStore = Object.values(stores)[0] as any;
    if (firstStore?.url) {
        return { url: firstStore.url, apiKey: firstStore.apiKey || qdrantConfig.apiKey, collection, dimensions: firstStore.dimensions };
    }
    if (qdrantConfig.url) {
        return { url: qdrantConfig.url, apiKey: qdrantConfig.apiKey, collection, dimensions: qdrantConfig.dimensions };
    }
    return null;
}

// ── MCP backend ──

async function embedAndStoreMcp(entry: TranscriptEntry, conversationId: string, collection: string): Promise<void> {
    const text = `[${entry.speakerName}${entry.role ? ` (${entry.role})` : ''}]: ${entry.content}`;
    const result = await ToolManager.callTool('qdrant_mcp', {
        action: 'store',
        collection,
        points: [{
            document: text,
            payload: {
                conversationId,
                round: entry.round,
                speaker: entry.speaker,
                speakerName: entry.speakerName,
                role: entry.role || '',
                content: entry.content,
                timestamp: entry.timestamp
            }
        }]
    });
    if (result?.error) {
        logger.log({ type: 'error', level: 'error', message: '[Conversation] MCP store failed', data: result.error });
    }
}

async function recallFromMemoryMcp(conversationId: string, collection: string, query: string, limit: number = 5): Promise<string[]> {
    try {
        const result = await ToolManager.callTool('qdrant_mcp', {
            action: 'search',
            collection,
            query,
            limit,
            filter: {
                must: [{ key: 'conversationId', match: { value: conversationId } }]
            }
        });
        if (result?.error) return [];
        // Handle both direct results array and wrapped results
        const items = result?.results || result?.result || [];
        if (Array.isArray(items)) {
            return items.map((r: any) => {
                const p = r.payload || r;
                return `[${p.speakerName || 'Unknown'}${p.role ? ` (${p.role})` : ''}]: ${p.content || p.document || ''}`;
            });
        }
        return [];
    } catch {
        return [];
    }
}

// ── Direct client backend ──

async function embedAndStoreDirect(entry: TranscriptEntry, conversationId: string, collection: string): Promise<void> {
    const embeddingProvider = resolveEmbeddingProvider();
    if (!embeddingProvider) {
        logger.log({ type: 'system', level: 'warn', message: '[Conversation] No embedding provider configured, skipping memory storage' });
        return;
    }

    const qdrantConfig = resolveQdrantConfig(collection);
    if (!qdrantConfig) {
        logger.log({ type: 'system', level: 'warn', message: '[Conversation] No Qdrant config found, skipping memory storage' });
        return;
    }

    try {
        const { QdrantClient } = await import('@qdrant/js-client-rest');
        const client = new QdrantClient({ url: qdrantConfig.url, apiKey: qdrantConfig.apiKey, checkCompatibility: false });

        try {
            await client.getCollection(collection);
        } catch {
            const embeddings = await createEmbedding(embeddingProvider, 'test');
            const dims = qdrantConfig.dimensions || embeddings[0]?.length || 1536;
            await client.createCollection(collection, { vectors: { size: dims, distance: 'Cosine' } });
            logger.log({ type: 'system', level: 'info', message: `[Conversation] Created Qdrant collection: ${collection} (${dims} dims)` });
        }

        const text = `[${entry.speakerName}${entry.role ? ` (${entry.role})` : ''}]: ${entry.content}`;
        const embeddings = await createEmbedding(embeddingProvider, text);
        let vector = embeddings[0];
        if (!vector || vector.length === 0) return;

        if (qdrantConfig.dimensions && vector.length > qdrantConfig.dimensions) {
            vector = vector.slice(0, qdrantConfig.dimensions);
        }

        await client.upsert(collection, {
            wait: true,
            points: [{
                id: randomUUID(),
                vector,
                payload: {
                    conversationId,
                    round: entry.round,
                    speaker: entry.speaker,
                    speakerName: entry.speakerName,
                    role: entry.role || '',
                    content: entry.content,
                    timestamp: entry.timestamp
                }
            }]
        });
    } catch (err) {
        logger.log({ type: 'error', level: 'error', message: '[Conversation] Failed to store entry in Qdrant', data: String(err) });
    }
}

async function recallFromMemoryDirect(conversationId: string, collection: string, query: string, limit: number = 5): Promise<string[]> {
    const embeddingProvider = resolveEmbeddingProvider();
    if (!embeddingProvider) return [];

    const qdrantConfig = resolveQdrantConfig(collection);
    if (!qdrantConfig) return [];

    try {
        const { QdrantClient } = await import('@qdrant/js-client-rest');
        const client = new QdrantClient({ url: qdrantConfig.url, apiKey: qdrantConfig.apiKey, checkCompatibility: false });

        const embeddings = await createEmbedding(embeddingProvider, query);
        let vector = embeddings[0];
        if (!vector || vector.length === 0) return [];

        if (qdrantConfig.dimensions && vector.length > qdrantConfig.dimensions) {
            vector = vector.slice(0, qdrantConfig.dimensions);
        }

        const results = await client.search(collection, {
            vector,
            limit,
            filter: {
                must: [{ key: 'conversationId', match: { value: conversationId } }]
            }
        });

        return results.map((r: any) => {
            const p = r.payload;
            return `[${p.speakerName}${p.role ? ` (${p.role})` : ''}]: ${p.content}`;
        });
    } catch {
        return [];
    }
}

// ── Unified dispatchers ──

async function embedAndStore(entry: TranscriptEntry, conversationId: string, collection: string): Promise<void> {
    if (hasMcpBackend()) {
        return embedAndStoreMcp(entry, conversationId, collection);
    }
    return embedAndStoreDirect(entry, conversationId, collection);
}

async function recallFromMemory(conversationId: string, collection: string, query: string, limit: number = 5): Promise<string[]> {
    if (hasMcpBackend()) {
        return recallFromMemoryMcp(conversationId, collection, query, limit);
    }
    return recallFromMemoryDirect(conversationId, collection, query, limit);
}

// ── Channel Delivery ────────────────────────────────────────────────────────

async function deliverToChannels(conversationId: string, channels: HeartbeatChannel[], content: string): Promise<void> {
    for (const channel of channels) {
        try {
            switch (channel.type) {
                case 'telegram': {
                    const tg = TelegramManager.getInstance();
                    if (tg.getStatus().connected) {
                        await tg.sendMessage(channel.chatId, content);
                        logger.log({ type: 'system', level: 'info', message: `[Conversation] Delivered to Telegram chat ${channel.chatId}` });
                    }
                    break;
                }
                case 'whatsapp': {
                    const wa = WhatsAppManager.getInstance();
                    if (wa.getStatus().connected) {
                        await wa.sendMessage(channel.jid, content);
                        logger.log({ type: 'system', level: 'info', message: `[Conversation] Delivered to WhatsApp ${channel.jid}` });
                    }
                    break;
                }
                case 'websocket': {
                    const payload = JSON.stringify({ type: 'conversation_transcript', conversationId, content });
                    for (const [ws] of connectedClients) {
                        try { ws.send(payload); } catch { /* disconnected */ }
                    }
                    break;
                }
            }
        } catch (err) {
            logger.log({ type: 'error', level: 'error', message: `[Conversation] Failed to deliver to ${channel.type}`, data: String(err) });
        }
    }
}

// ── Campaign Persistence (GitHub) ────────────────────────────────────────────

async function ghApi(...args: string[]): Promise<any> {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const exec = promisify(execFile);
    const { stdout } = await exec('gh', ['api', ...args], { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(stdout);
}

async function ghCli(...args: string[]): Promise<string> {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const exec = promisify(execFile);
    const { stdout } = await exec('gh', args, { timeout: 30_000 });
    return stdout.trim();
}

async function ensureGitHubRepo(repo: string): Promise<void> {
    try {
        await ghApi(`/repos/${repo}`);
    } catch {
        // Repo doesn't exist — create it as private
        const [owner, name] = repo.split('/');
        try {
            // Try creating under an org
            await ghApi('/orgs/' + owner + '/repos', '-X', 'POST',
                '-f', `name=${name}`, '-f', 'private=true',
                '-f', 'description=Campaign save data (auto-generated by OpenKiwi)',
                '-f', 'auto_init=true');
        } catch {
            // Fall back to user repo
            await ghApi('/user/repos', '-X', 'POST',
                '-f', `name=${name}`, '-f', 'private=true',
                '-f', 'description=Campaign save data (auto-generated by OpenKiwi)',
                '-f', 'auto_init=true');
        }
        logger.log({ type: 'system', level: 'info', message: `[Campaign] Created private repo: ${repo}` });
        // Small delay to let GitHub initialize the repo
        await new Promise(r => setTimeout(r, 2000));
    }
}

async function pushFileToGitHub(
    repo: string,
    filePath: string,
    content: string,
    message: string,
    branch: string = 'main'
): Promise<void> {
    const encodedContent = Buffer.from(content).toString('base64');
    const apiPath = `/repos/${repo}/contents/${filePath}`;

    // Check if file exists to get SHA for update
    let sha: string | undefined;
    try {
        const existing = await ghApi(apiPath, '-X', 'GET', '--jq', '.sha');
        if (existing && typeof existing === 'string') sha = existing;
    } catch {
        // File doesn't exist yet, that's fine for create
    }

    // If ghApi returned the full object instead of just sha
    if (sha && typeof sha === 'object') {
        sha = (sha as any).sha;
    }

    const args = [apiPath, '-X', 'PUT',
        '-f', `message=${message}`,
        '-f', `content=${encodedContent}`,
        '-f', `branch=${branch}`
    ];
    if (sha) args.push('-f', `sha=${sha}`);

    await ghApi(...args);
}

async function saveCampaignToGitHub(
    config: ConversationConfig,
    state: ConversationState,
    persistence: CampaignPersistence,
    reason: string
): Promise<void> {
    if (!process.env.GH_TOKEN) {
        logger.log({ type: 'system', level: 'warn', message: '[Campaign] GH_TOKEN not set, skipping GitHub save' });
        return;
    }

    const repo = persistence.repo;
    const branch = persistence.branch || 'main';

    try {
        if (persistence.createIfMissing !== false) {
            await ensureGitHubRepo(repo);
        }

        const prefix = `campaigns/${config.id}`;
        const commitMsg = `[OpenKiwi] ${reason} — round ${state.currentRound}/${config.settings.maxRounds}`;

        // Save config, state, and transcript in parallel
        const transcript = generateTranscriptMarkdown(config, state);

        await Promise.all([
            pushFileToGitHub(repo, `${prefix}/config.json`, JSON.stringify(config, null, 2), commitMsg, branch),
            pushFileToGitHub(repo, `${prefix}/state.json`, JSON.stringify(state, null, 2), commitMsg, branch),
            pushFileToGitHub(repo, `${prefix}/transcript.md`, transcript, commitMsg, branch),
            state.worldState
                ? pushFileToGitHub(repo, `${prefix}/world-state.json`, JSON.stringify(state.worldState, null, 2), commitMsg, branch)
                : Promise.resolve()
        ]);

        logger.log({ type: 'system', level: 'info', message: `[Campaign] Saved to ${repo} (${reason})` });

        broadcastMessage({
            type: 'conversation_saved',
            conversationId: config.id,
            repo,
            reason,
            round: state.currentRound
        });
    } catch (err) {
        logger.log({ type: 'error', level: 'error', message: `[Campaign] GitHub save failed`, data: String(err) });
    }
}

async function loadFileFromGitHub(repo: string, filePath: string, branch: string = 'main'): Promise<string | null> {
    if (!process.env.GH_TOKEN) return null;
    try {
        const result = await ghApi(`/repos/${repo}/contents/${filePath}`, '-X', 'GET', '-H', 'Accept: application/vnd.github.raw+json');
        // ghApi parses JSON, but raw content comes as a string when using raw accept header
        // If it came back as an object with content field, decode base64
        if (result && typeof result === 'object' && result.content) {
            return Buffer.from(result.content, 'base64').toString('utf-8');
        }
        if (typeof result === 'string') return result;
        return JSON.stringify(result);
    } catch {
        return null;
    }
}

async function loadCampaignFromGitHub(
    conversationId: string,
    persistence: CampaignPersistence
): Promise<{ config: ConversationConfig; state: ConversationState } | null> {
    const repo = persistence.repo;
    const branch = persistence.branch || 'main';
    const prefix = `campaigns/${conversationId}`;

    try {
        const [configRaw, stateRaw] = await Promise.all([
            loadFileFromGitHub(repo, `${prefix}/config.json`, branch),
            loadFileFromGitHub(repo, `${prefix}/state.json`, branch),
        ]);

        if (!configRaw || !stateRaw) return null;

        const config = JSON.parse(configRaw) as ConversationConfig;
        const state = JSON.parse(stateRaw) as ConversationState;

        logger.log({
            type: 'system', level: 'info',
            message: `[Campaign] Loaded state from GitHub: ${repo} (round ${state.currentRound})`,
        });

        return { config, state };
    } catch (err) {
        logger.log({ type: 'error', level: 'warn', message: '[Campaign] Failed to load from GitHub', data: String(err) });
        return null;
    }
}

// ── ConversationService (CRUD) ──────────────────────────────────────────────

export class ConversationService {
    static list(): ConversationConfig[] {
        ensureDir(CONVERSATIONS_DIR);
        const dirs = fs.readdirSync(CONVERSATIONS_DIR, { withFileTypes: true })
            .filter(d => d.isDirectory());
        const configs: ConversationConfig[] = [];
        for (const d of dirs) {
            const cfg = readJSON<ConversationConfig>(configPath(d.name));
            if (cfg) configs.push(cfg);
        }
        return configs.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    static get(id: string): { config: ConversationConfig; state: ConversationState } | null {
        const config = readJSON<ConversationConfig>(configPath(id));
        if (!config) return null;
        const state = readJSON<ConversationState>(statePath(id)) || createInitialState(id);
        return { config, state };
    }

    static create(input: Omit<ConversationConfig, 'id' | 'createdAt' | 'updatedAt'>): ConversationConfig {
        const id = randomUUID();
        const now = Date.now();
        const config: ConversationConfig = { ...input, id, createdAt: now, updatedAt: now };

        // Validate participants exist
        for (const p of config.participants) {
            if (!AgentManager.getAgent(p.agentId)) {
                throw new Error(`Agent not found: ${p.agentId}`);
            }
        }
        if (config.orchestrator.type === 'agent' && config.orchestrator.agentId) {
            if (!AgentManager.getAgent(config.orchestrator.agentId)) {
                throw new Error(`Orchestrator agent not found: ${config.orchestrator.agentId}`);
            }
        }

        writeJSON(configPath(id), config);
        writeJSON(statePath(id), createInitialState(id, config.settings.initialWorldState));
        return config;
    }

    static delete(id: string): boolean {
        const dir = path.join(CONVERSATIONS_DIR, id);
        if (!fs.existsSync(dir)) return false;
        ConversationExecutor.cancel(id);
        fs.rmSync(dir, { recursive: true, force: true });
        return true;
    }

    static getTranscript(id: string): TranscriptEntry[] {
        const state = readJSON<ConversationState>(statePath(id));
        return state?.transcript || [];
    }

    static getTranscriptMarkdown(id: string): string | null {
        const mdPath = transcriptPath(id);
        if (fs.existsSync(mdPath)) return fs.readFileSync(mdPath, 'utf-8');
        const data = this.get(id);
        if (!data) return null;
        return generateTranscriptMarkdown(data.config, data.state);
    }

    /**
     * Restore a campaign from GitHub into local state.
     * If the conversation already exists locally, updates it only if the GitHub state is ahead.
     */
    static async restore(persistence: CampaignPersistence, conversationId: string): Promise<{ config: ConversationConfig; state: ConversationState } | null> {
        const remote = await loadCampaignFromGitHub(conversationId, persistence);
        if (!remote) return null;

        const local = this.get(conversationId);

        // Use remote if local doesn't exist or remote is further along
        if (!local || remote.state.currentRound > local.state.currentRound) {
            // Reset status so campaign can be resumed
            if (remote.state.status === 'complete' || remote.state.status === 'error' || remote.state.status === 'cancelled') {
                remote.state.status = 'pending';
                remote.state.completedAt = undefined;
                remote.state.error = undefined;
            }

            writeJSON(configPath(conversationId), remote.config);
            writeJSON(statePath(conversationId), remote.state);

            logger.log({
                type: 'system', level: 'info',
                message: `[Campaign] Restored from GitHub: round ${remote.state.currentRound}`,
                data: { conversationId, repo: persistence.repo }
            });

            return remote;
        }

        return local;
    }
}

// ── ConversationExecutor (the loop) ─────────────────────────────────────────

const runningConversations = new Map<string, AbortController>();

function createInitialState(id: string, worldState?: Record<string, any>): ConversationState {
    return { id, status: 'pending', currentRound: 0, transcript: [], worldState };
}

function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (
            source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
            result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])
        ) {
            result[key] = deepMerge(result[key], source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

// ── Retry with delay ────────────────────────────────────────────────────────

async function retryWithDelay<T>(
    fn: () => Promise<T>,
    { retries = 3, delayMs = 5000, label = 'LLM call' }: { retries?: number; delayMs?: number; label?: string } = {}
): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            const isRetryable = err?.message?.includes('400') || err?.message?.includes('429')
                || err?.message?.includes('503') || err?.message?.includes('insufficient')
                || err?.message?.includes('Failed to load model') || err?.message?.includes('overload');
            if (!isRetryable || attempt === retries) throw err;
            logger.log({
                type: 'system', level: 'warn',
                message: `[Conversation] ${label} failed (attempt ${attempt}/${retries}), retrying in ${delayMs / 1000}s: ${err.message?.substring(0, 120)}`
            });
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    throw new Error('Unreachable');
}

function stripThinkTags(text: string): { content: string; thinking: string } {
    let thinking = '';
    // First handle complete <think>...</think> blocks
    let content = text.replace(/<think>([\s\S]*?)<\/think>/g, (_match, t) => {
        thinking += t.trim() + '\n';
        return '';
    });
    // Handle unclosed <think> tags (model forgot to close or was truncated)
    const unclosedIdx = content.indexOf('<think>');
    if (unclosedIdx !== -1) {
        thinking += content.substring(unclosedIdx + 7).trim();
        content = content.substring(0, unclosedIdx);
    }
    return { content: content.trim(), thinking: thinking.trim() };
}

// ── Dice Rolling ────────────────────────────────────────────────────────────

function rollDice(sides: number = 20): number {
    return Math.floor(Math.random() * sides) + 1;
}

interface DiceCheck {
    type: string;       // e.g. "Strength", "Stealth", "Attack"
    dc: number;         // Difficulty class
    modifier?: number;  // Bonus/penalty
}

interface DiceResult {
    check: DiceCheck;
    diceRoll: number;
    total: number;
    success: boolean;
}

function performCheck(check: DiceCheck): DiceResult {
    const roll = rollDice(20);
    const modifier = check.modifier || 0;
    const total = roll + modifier;
    return {
        check,
        diceRoll: roll,
        total,
        success: total >= check.dc
    };
}

function formatDiceResult(result: DiceResult): string {
    const modStr = result.check.modifier
        ? (result.check.modifier >= 0 ? ` + ${result.check.modifier}` : ` - ${Math.abs(result.check.modifier)}`)
        : '';
    const verdict = result.diceRoll === 20 ? 'CRITICAL SUCCESS'
        : result.diceRoll === 1 ? 'CRITICAL FAILURE'
        : result.success ? 'SUCCESS' : 'FAILURE';
    return `[${result.check.type} check: rolled d20 = ${result.diceRoll}${modStr}, total ${result.total} vs DC ${result.check.dc} → ${verdict}]`;
}

function resolveLlmConfig(agent: any) {
    const currentConfig = loadConfig();
    const providerName = agent.provider;
    let providerConfig = currentConfig.providers.find(
        (p: any) => p.model === providerName || p.description === providerName
    );
    if (!providerConfig && currentConfig.providers.length > 0) {
        providerConfig = currentConfig.providers[0];
    }
    if (!providerConfig) throw new Error(`No LLM provider configured for agent ${agent.id}`);
    return {
        baseUrl: providerConfig.endpoint,
        modelId: providerConfig.model,
        apiKey: providerConfig.apiKey,
        supportsTools: !!providerConfig?.capabilities?.trained_for_tool_use
    };
}

function buildConversationOverlay(config: ConversationConfig, participant: ParticipantConfig, memoryRecall?: string[]): string {
    const otherParticipants = config.participants
        .filter(p => p.agentId !== participant.agentId)
        .map(p => {
            const agent = AgentManager.getAgent(p.agentId);
            const name = agent?.name || p.agentId;
            return p.role ? `${name} (${p.role})` : name;
        })
        .join(', ');

    let overlay = `\n\n# CONVERSATION CONTEXT\nYou are participating in a ${config.format}: "${config.title}"\nTopic: ${config.topic}`;
    if (participant.role) overlay += `\nYour role: ${participant.role}`;
    if (participant.stance) overlay += `\nYour stance: ${participant.stance}`;
    if (participant.characterNotes) overlay += `\n${participant.characterNotes}`;
    overlay += `\n\nOther participants: ${otherParticipants}`;
    if (config.orchestrator.rules) overlay += `\n\nRules: ${config.orchestrator.rules}`;

    if (memoryRecall && memoryRecall.length > 0) {
        overlay += `\n\n## Previously in this conversation...\n${memoryRecall.join('\n')}`;
    }

    overlay += `\n\nGuidelines:\n- Stay in character\n- Address others by name\n- Respond to what was said, not generics\n- Keep responses to 2-4 paragraphs`;
    return overlay;
}

function buildWorldStateBlock(worldState?: Record<string, any>): string {
    if (!worldState || Object.keys(worldState).length === 0) return '';
    return `\n\n## Current World State\n\`\`\`json\n${JSON.stringify(worldState, null, 2)}\n\`\`\``;
}

async function buildMessagesForAgent(
    config: ConversationConfig,
    state: ConversationState,
    participant: ParticipantConfig,
    direction?: string
): Promise<any[]> {
    const agent = AgentManager.getAgent(participant.agentId);
    if (!agent) throw new Error(`Agent not found: ${participant.agentId}`);

    // Semantic recall from Qdrant if memory is enabled
    let memoryRecall: string[] | undefined;
    if (config.settings.enableMemory) {
        const collection = config.settings.memoryCollection || 'conversations';
        // Use topic + last entry as query for relevance
        const lastContent = state.transcript.length > 0
            ? state.transcript[state.transcript.length - 1].content.substring(0, 200)
            : config.topic;
        memoryRecall = await recallFromMemory(config.id, collection, lastContent, 5);
    }

    const systemPrompt = agent.systemPrompt
        + buildConversationOverlay(config, participant, memoryRecall)
        + buildWorldStateBlock(state.worldState);

    const messages: any[] = [{ role: 'system', content: systemPrompt }];

    // Add transcript as user messages with speaker labels
    const budget = config.settings.contextWindowBudget;
    let entries = state.transcript;
    if (budget && budget > 0) {
        let charCount = 0;
        const trimmed: TranscriptEntry[] = [];
        for (let i = entries.length - 1; i >= 0; i--) {
            charCount += entries[i].content.length + 50;
            if (charCount > budget * 4) break;
            trimmed.unshift(entries[i]);
        }
        entries = trimmed;
    }

    for (const entry of entries) {
        const label = entry.role ? `[${entry.speakerName} (${entry.role})]` : `[${entry.speakerName}]`;
        messages.push({ role: 'user', content: `${label}: ${entry.content}` });
    }

    // Turn prompt
    let turnPrompt = "It's your turn to speak.";
    if (direction) turnPrompt += ` ${direction}`;
    messages.push({ role: 'user', content: turnPrompt });

    return messages;
}

function selectNextSpeakerRoundRobin(
    participants: ParticipantConfig[],
    currentRound: number
): ParticipantConfig {
    return participants[currentRound % participants.length];
}

function selectNextSpeakerRandom(
    participants: ParticipantConfig[],
    lastSpeaker?: string
): ParticipantConfig {
    const eligible = participants.filter(p => p.agentId !== lastSpeaker);
    const pool = eligible.length > 0 ? eligible : participants;
    return pool[Math.floor(Math.random() * pool.length)];
}

interface CharacterEvent {
    type: 'death' | 'retire';
    characterId: string;
    description: string;
}

interface OrchestratorDecision {
    nextSpeaker: string;
    direction?: string;
    shouldEnd: boolean;
    worldStateUpdate?: Record<string, any>;
    action?: string;
    check?: DiceCheck;                     // Orchestrator requests a check; system rolls
    outcome?: string;                      // Narrated outcome (orchestrator fills after seeing roll in direction)
    killCharacter?: { characterId: string; description: string };
    introduceCharacter?: IntroduceCharacter;
    updateCharacter?: { characterId: string; updates: Record<string, any> };
    updateCharacters?: Array<{ characterId: string; updates: Record<string, any> }>;
    thinking?: string;                     // GM's internal reasoning (from <think> tags)
}

async function askOrchestrator(
    config: ConversationConfig,
    state: ConversationState,
    abortSignal?: AbortSignal
): Promise<OrchestratorDecision> {
    const orchestratorId = config.orchestrator.agentId;
    if (!orchestratorId) throw new Error('Orchestrator agent ID required for orchestrator selection');

    const agent = AgentManager.getAgent(orchestratorId);
    if (!agent) throw new Error(`Orchestrator agent not found: ${orchestratorId}`);

    const llmConfig = resolveLlmConfig(agent);

    const participantList = config.participants.map(p => {
        const a = AgentManager.getAgent(p.agentId);
        return `- ${p.agentId} (${a?.name || p.agentId}${p.role ? ', role: ' + p.role : ''})`;
    }).join('\n');

    const recentTranscript = state.transcript.slice(-10).map(e =>
        `[${e.speakerName}]: ${e.content.substring(0, 200)}${e.content.length > 200 ? '...' : ''}`
    ).join('\n');

    const isRPG = config.format === 'roleplay';

    let orchestratorSystemPrompt = agent.systemPrompt + `\n\n# ORCHESTRATOR ROLE\nYou are moderating a ${config.format}: "${config.title}"\nTopic: ${config.topic}\n${config.orchestrator.rules ? 'Rules: ' + config.orchestrator.rules + '\n' : ''}\nParticipants:\n${participantList}\n\nCurrent round: ${state.currentRound + 1} of ${config.settings.maxRounds}`;

    if (isRPG && state.worldState) {
        orchestratorSystemPrompt += `\n\n## Current World State\n\`\`\`json\n${JSON.stringify(state.worldState, null, 2)}\n\`\`\``;
    }

    let responseFormat: string;
    if (isRPG) {
        responseFormat = `Respond with ONLY valid JSON:
{
  "nextSpeaker": "agentId",
  "direction": "what happens or what the character should respond to",
  "shouldEnd": false,
  "action": "description of game action",
  "check": { "type": "Dexterity", "dc": 15, "modifier": 2 },
  "outcome": "narration of what happens",
  "worldStateUpdate": { "key": "value" },
  "killCharacter": { "characterId": "uuid", "description": "how they died" },
  "introduceCharacter": { "name": "...", "agentId": "...", "class": "...", "race": "...", "level": 1, "background": "...", "traits": [], "stats": {}, "inventory": [] },
  "updateCharacters": [{ "characterId": "uuid", "updates": { "wounds": 1, "conditions": ["poisoned"], "inventory": ["..."], "xp": 10 } }]
}
Notes:
- "action": describe what the PREVIOUS speaker attempted (omit if no action)
- "check": request a dice check. The SYSTEM rolls d20 and determines success/failure:
  - "type": ability/skill tested (Strength, Stealth, Perception, Attack, Charisma, etc.)
  - "dc": difficulty class (10=easy, 15=moderate, 20=hard, 25=very hard)
  - "modifier": optional bonus/penalty from character stats
  - Omit "check" entirely if no roll is needed
- "outcome": narrate what happens (if check requested, the system appends roll result to direction)
- "worldStateUpdate": partial deep merge into world state (omit if no changes)
- "direction": what the next speaker faces. Dice results are prepended automatically
- "killCharacter": kill a character (the system removes them from the active roster). Include characterId from the world state
- "introduceCharacter": bring in a new character for an agent (usually to replace a dead one). The agentId should match an agent who lost their character
- "updateCharacters": array of character sheet updates. Use to track wounds, conditions, inventory changes, XP, equipment, relationships. Keep sheets current — they persist across episodes
- "shouldEnd": set to true to end the episode at a natural break point
- Omit any field you don't need this turn`;
    } else {
        responseFormat = `Respond with ONLY valid JSON: {"nextSpeaker": "agentId", "direction": "", "shouldEnd": false}`;
    }

    const messages: any[] = [
        { role: 'system', content: orchestratorSystemPrompt },
        { role: 'user', content: `Recent conversation:\n${recentTranscript || '(No conversation yet — this is the opening.)'}\n\nBased on the conversation so far, decide:\n1. Who should speak next?\n2. What direction or question for them? (optional)\n3. Should the conversation end?\n\n${responseFormat}` }
    ];

    const result = await retryWithDelay(
        () => runAgentLoop({
            agentId: orchestratorId,
            sessionId: `conversation-${config.id}-orchestrator`,
            llmConfig,
            messages,
            maxLoops: 1,
            abortSignal
        }),
        { label: 'Orchestrator' }
    );

    try {
        const { thinking: gmThinking } = stripThinkTags(result.finalResponse);
        const jsonMatch = result.finalResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found');
        const parsed = JSON.parse(jsonMatch[0]);
        return {
            nextSpeaker: parsed.nextSpeaker,
            direction: parsed.direction || undefined,
            shouldEnd: !!parsed.shouldEnd,
            worldStateUpdate: parsed.worldStateUpdate || undefined,
            action: parsed.action || undefined,
            check: parsed.check || undefined,
            outcome: parsed.outcome || undefined,
            killCharacter: parsed.killCharacter || undefined,
            introduceCharacter: parsed.introduceCharacter || undefined,
            updateCharacter: parsed.updateCharacter || undefined,
            updateCharacters: parsed.updateCharacters || undefined,
            thinking: gmThinking || undefined
        };
    } catch {
        logger.log({
            type: 'error', level: 'warn',
            message: `Orchestrator returned unparseable response, falling back to round-robin`,
            data: { response: result.finalResponse.substring(0, 500) }
        });
        const next = selectNextSpeakerRoundRobin(config.participants, state.currentRound);
        return { nextSpeaker: next.agentId, direction: undefined, shouldEnd: false };
    }
}

function generateTranscriptMarkdown(config: ConversationConfig, state: ConversationState): string {
    let md = `# ${config.title}\n\n`;
    md += `**Format:** ${config.format}  \n`;
    md += `**Topic:** ${config.topic}  \n`;
    md += `**Participants:** ${config.participants.map(p => {
        const agent = AgentManager.getAgent(p.agentId);
        const name = agent?.name || p.agentId;
        return p.role ? `${name} (${p.role})` : name;
    }).join(', ')}  \n`;
    if (config.orchestrator.rules) md += `**Rules:** ${config.orchestrator.rules}  \n`;
    md += `**Date:** ${new Date(config.createdAt).toISOString().split('T')[0]}  \n`;
    md += `**Rounds:** ${state.currentRound}  \n\n`;
    md += `---\n\n`;

    for (const entry of state.transcript) {
        const speaker = entry.role
            ? `**${entry.speakerName}** *(${entry.role})*`
            : `**${entry.speakerName}**`;
        md += `### ${speaker}\n\n`;
        md += `${entry.content}\n\n`;

        // RPG metadata
        if (entry.metadata) {
            const m = entry.metadata;
            if (m.action || m.diceRoll != null || m.check) {
                const parts: string[] = [];
                if (m.action) parts.push(`*Action: ${m.action}*`);
                if (m.check && m.diceRoll != null) {
                    const modStr = m.check.modifier
                        ? (m.check.modifier >= 0 ? `+${m.check.modifier}` : `${m.check.modifier}`)
                        : '';
                    const verdict = m.diceRoll === 20 ? 'CRITICAL SUCCESS'
                        : m.diceRoll === 1 ? 'CRITICAL FAILURE'
                        : m.success ? 'SUCCESS' : 'FAILURE';
                    parts.push(`*${m.check.type} check: d20=${m.diceRoll}${modStr} → ${m.total} vs DC ${m.check.dc} — **${verdict}***`);
                } else if (m.diceRoll != null) {
                    parts.push(`*Roll: ${m.diceRoll}*`);
                }
                if (m.outcome) parts.push(`*${m.outcome}*`);
                md += `> ${parts.join(' | ')}\n\n`;
            }
        }
    }

    if (state.status === 'complete') {
        md += `---\n\n*Conversation completed after ${state.currentRound} rounds.*\n`;
    }

    // Append world state summary for RPG
    if (state.worldState && Object.keys(state.worldState).length > 0) {
        md += `\n---\n\n### Final World State\n\n\`\`\`json\n${JSON.stringify(state.worldState, null, 2)}\n\`\`\`\n`;
    }

    return md;
}

export class ConversationExecutor {
    static isRunning(id: string): boolean {
        return runningConversations.has(id);
    }

    static cancel(id: string): boolean {
        const controller = runningConversations.get(id);
        if (!controller) return false;
        controller.abort();
        return true;
    }

    static async run(id: string): Promise<void> {
        if (runningConversations.has(id)) {
            throw new Error('Conversation is already running');
        }

        let data = ConversationService.get(id);
        if (!data) throw new Error('Conversation not found');

        // Auto-restore from GitHub if campaign persistence is configured
        const persistence = data.config.settings.campaignPersistence;
        if (persistence) {
            const restored = await ConversationService.restore(persistence, id);
            if (restored) {
                data = { config: restored.config, state: restored.state };
            }
        }

        const { config } = data;
        let state = data.state;

        if (state.status === 'complete') {
            throw new Error('Conversation is already complete');
        }

        const abortController = new AbortController();
        runningConversations.set(id, abortController);

        try {
            state.status = 'active';
            state.startedAt = state.startedAt || Date.now();
            writeJSON(statePath(id), state);

            broadcastMessage({ type: 'conversation_started', conversationId: id, config });
            logger.log({ type: 'system', level: 'info', message: `Conversation started: ${config.title}`, data: { id } });

            // Episode log header
            appendEpisodeLog(id, `${'='.repeat(80)}\n${config.title}\nStarted: ${formatTimestamp(Date.now())}\nParticipants: ${config.participants.map(p => p.role || p.agentId).join(', ')}\nMax Rounds: ${config.settings.maxRounds}\n${'='.repeat(80)}\n`);

            while (state.currentRound < config.settings.maxRounds && state.status === 'active') {
                if (abortController.signal.aborted) {
                    state.status = 'cancelled';
                    break;
                }

                // Determine next speaker
                let nextParticipant: ParticipantConfig;
                let direction: string | undefined;
                let turnMetadata: TranscriptEntry['metadata'] | undefined;

                const strategy = config.orchestrator.selectionStrategy;
                if (strategy === 'round-robin') {
                    nextParticipant = selectNextSpeakerRoundRobin(config.participants, state.currentRound);
                } else if (strategy === 'random') {
                    const lastSpeaker = state.transcript.length > 0
                        ? state.transcript[state.transcript.length - 1].speaker
                        : undefined;
                    nextParticipant = selectNextSpeakerRandom(config.participants, lastSpeaker);
                } else {
                    // orchestrator strategy
                    const decision = await askOrchestrator(config, state, abortController.signal);

                    // Log orchestrator decision
                    const gmLogParts = [`\n${'─'.repeat(60)}\n[GM — Round ${state.currentRound + 1}] ${formatTimestamp(Date.now())}`];
                    if (decision.thinking) gmLogParts.push(`\n  💭 GM Internal:\n${decision.thinking.split('\n').map(l => '    ' + l).join('\n')}`);
                    gmLogParts.push(`\n  → Next speaker: ${decision.nextSpeaker}`);
                    if (decision.direction) gmLogParts.push(`  → Direction: ${decision.direction}`);
                    if (decision.action) gmLogParts.push(`  → Action: ${decision.action}`);
                    if (decision.shouldEnd) gmLogParts.push(`  → Episode ending`);
                    appendEpisodeLog(id, gmLogParts.join('\n'));

                    if (decision.shouldEnd) {
                        state.status = 'closing';
                        break;
                    }
                    nextParticipant = config.participants.find(p => p.agentId === decision.nextSpeaker)
                        || selectNextSpeakerRoundRobin(config.participants, state.currentRound);
                    direction = decision.direction;

                    // Phase 3: Apply world state update from orchestrator
                    if (decision.worldStateUpdate) {
                        state.worldState = deepMerge(state.worldState || {}, decision.worldStateUpdate);
                    }

                    // Phase 3: Dice rolls — system performs the check
                    if (decision.check && decision.check.type && decision.check.dc) {
                        const diceResult = performCheck(decision.check);
                        const rollText = formatDiceResult(diceResult);

                        // Prepend the roll result to the direction so the next speaker sees it
                        direction = `${rollText}\n${decision.outcome || ''}\n${direction || ''}`.trim();

                        turnMetadata = {
                            action: decision.action,
                            check: decision.check,
                            diceRoll: diceResult.diceRoll,
                            total: diceResult.total,
                            success: diceResult.success,
                            outcome: decision.outcome,
                            worldStateUpdate: decision.worldStateUpdate
                        };

                        appendEpisodeLog(id, `  🎲 ${rollText}`);

                        broadcastMessage({
                            type: 'conversation_dice_roll',
                            conversationId: id,
                            round: state.currentRound,
                            ...diceResult,
                            action: decision.action
                        });
                    } else if (decision.action) {
                        turnMetadata = { action: decision.action, outcome: decision.outcome };
                    }

                    // Process character events
                    if (decision.killCharacter) {
                        const { characterId, description } = decision.killCharacter;
                        // Record the event in world state for campaign-service to pick up
                        const events = state.worldState?._campaign?.characterEvents || [];
                        events.push({ type: 'death', characterId, description });
                        state.worldState = deepMerge(state.worldState || {}, {
                            _campaign: { characterEvents: events }
                        });
                        // Remove from active participants for the rest of this episode
                        config.participants = config.participants.filter(p => {
                            const charList = state.worldState?._campaign?.activeCharacters || [];
                            const deadChar = charList.find((c: any) => c.id === characterId);
                            return !(deadChar && p.agentId === deadChar.agentId && p.role === deadChar.name);
                        });
                        // Add death narration to direction
                        direction = `${description}\n\n${direction || ''}`.trim();

                        broadcastMessage({
                            type: 'conversation_character_died',
                            conversationId: id,
                            characterId,
                            description
                        });

                        appendEpisodeLog(id, `  ☠️ CHARACTER DEATH: ${description}`);
                        logger.log({ type: 'system', level: 'info', message: `Character killed in conversation`, data: { conversationId: id, characterId, description } });
                    }

                    if (decision.introduceCharacter) {
                        const intro = decision.introduceCharacter;

                        // Auto-create agent if the specified one doesn't exist
                        let agentId = intro.agentId;
                        if (!AgentManager.getAgent(agentId)) {
                            agentId = ensureCampaignAgent(intro);
                        }

                        const alreadyParticipating = config.participants.some(p => p.agentId === agentId);
                        if (!alreadyParticipating && AgentManager.getAgent(agentId)) {
                            const charNotes = [
                                `You are playing ${intro.name}`,
                                intro.race ? `, a ${intro.race}` : '',
                                intro.class ? ` ${intro.class}` : '',
                                intro.level ? ` (Level ${intro.level})` : '',
                                '.',
                                intro.background ? `\nBackground: ${intro.background}` : '',
                                intro.traits?.length ? `\nTraits: ${intro.traits.join(', ')}` : '',
                            ].join('');

                            config.participants.push({
                                agentId,
                                role: intro.name,
                                characterNotes: charNotes
                            });

                            // Record in world state for campaign-service
                            const chars = state.worldState?._campaign?.activeCharacters || [];
                            chars.push({
                                id: randomUUID(),
                                name: intro.name,
                                agentId,
                                class: intro.class,
                                race: intro.race,
                                level: intro.level,
                                stats: intro.stats,
                                inventory: intro.inventory
                            });
                            state.worldState = deepMerge(state.worldState || {}, {
                                _campaign: { activeCharacters: chars, newCharacters: [intro] }
                            });

                            broadcastMessage({
                                type: 'conversation_character_introduced',
                                conversationId: id,
                                character: intro
                            });

                            logger.log({ type: 'system', level: 'info', message: `New character introduced: ${intro.name}`, data: { conversationId: id, character: intro } });
                        }
                    }

                    // Handle character sheet updates
                    const charUpdates = decision.updateCharacters
                        || (decision.updateCharacter ? [decision.updateCharacter] : []);
                    for (const upd of charUpdates) {
                        if (upd.characterId && upd.updates) {
                            // Record in world state for campaign-service to process
                            const events = state.worldState?._campaign?.characterUpdates || [];
                            events.push(upd);
                            state.worldState = deepMerge(state.worldState || {}, {
                                _campaign: { characterUpdates: events }
                            });
                            logger.log({ type: 'system', level: 'info', message: `Character sheet updated`, data: { conversationId: id, characterId: upd.characterId, updates: upd.updates } });
                        }
                    }
                }

                const agent = AgentManager.getAgent(nextParticipant.agentId);
                if (!agent) {
                    logger.log({ type: 'error', level: 'error', message: `Agent not found: ${nextParticipant.agentId}` });
                    state.status = 'error';
                    state.error = `Agent not found: ${nextParticipant.agentId}`;
                    break;
                }

                // Build messages and call agent
                const llmConfig = resolveLlmConfig(agent);
                const messages = await buildMessagesForAgent(config, state, nextParticipant, direction);
                const maxLoops = config.settings.enableTools ? 5 : 1;

                AgentManager.setAgentState(nextParticipant.agentId, 'working', `Conversation: ${config.title}`);

                try {
                    const result = await retryWithDelay(
                        () => runAgentLoop({
                            agentId: nextParticipant.agentId,
                            sessionId: `conversation-${id}`,
                            llmConfig,
                            messages,
                            maxLoops,
                            agentToolsConfig: agent.tools,
                            abortSignal: abortController.signal
                        }),
                        { label: `Character turn: ${agent.name}` }
                    );

                    const { content, thinking } = stripThinkTags(result.finalResponse);

                    const entry: TranscriptEntry = {
                        round: state.currentRound,
                        speaker: nextParticipant.agentId,
                        speakerName: agent.name,
                        role: nextParticipant.role,
                        content,
                        thinking: thinking || undefined,
                        timestamp: Date.now(),
                        metadata: turnMetadata
                    };

                    state.transcript.push(entry);
                    state.currentRound++;

                    // Log character turn + inner monologue
                    const charLogParts = [`\n[${entry.speakerName}${entry.role ? ' — ' + entry.role : ''}] (Round ${state.currentRound}/${config.settings.maxRounds})`];
                    if (thinking) charLogParts.push(`\n  💭 Inner monologue:\n${thinking.split('\n').map(l => '    ' + l).join('\n')}`);
                    charLogParts.push(`\n${content}\n`);
                    if (turnMetadata?.diceRoll) charLogParts.push(`  [Dice: d20=${turnMetadata.diceRoll}, total=${turnMetadata.total}, ${turnMetadata.success ? 'SUCCESS' : 'FAILURE'}]`);
                    appendEpisodeLog(id, charLogParts.join('\n'));

                    // Checkpoint state
                    writeJSON(statePath(id), state);

                    // Phase 2: Store in Qdrant if memory enabled
                    if (config.settings.enableMemory) {
                        const collection = config.settings.memoryCollection || 'conversations';
                        embedAndStore(entry, config.id, collection).catch(() => {});
                    }

                    // Campaign persistence: auto-save to GitHub every N rounds
                    const persistence = config.settings.campaignPersistence;
                    if (persistence && state.currentRound % persistence.saveEveryNRounds === 0) {
                        saveCampaignToGitHub(config, state, persistence, `Auto-save`).catch(() => {});
                    }

                    broadcastMessage({
                        type: 'conversation_turn',
                        conversationId: id,
                        entry,
                        round: state.currentRound,
                        maxRounds: config.settings.maxRounds
                    });

                    // Deliver each turn to configured channels (Telegram, etc.)
                    if (config.settings.deliverTo && config.settings.deliverTo.length > 0) {
                        const turnLabel = `**[${entry.speakerName}${entry.role ? ' — ' + entry.role : ''}]** (Round ${state.currentRound}/${config.settings.maxRounds})`;
                        const turnMsg = `${turnLabel}\n\n${entry.content}`;
                        deliverToChannels(id, config.settings.deliverTo, turnMsg).catch(() => {});
                    }

                    logger.log({
                        type: 'system', level: 'info',
                        agentId: nextParticipant.agentId,
                        message: `Conversation turn ${state.currentRound}: ${agent.name}`,
                        data: { conversationId: id, contentLength: content.length }
                    });
                } catch (err) {
                    if (abortController.signal.aborted) {
                        state.status = 'cancelled';
                        break;
                    }
                    throw err;
                } finally {
                    AgentManager.setAgentState(nextParticipant.agentId, 'idle');
                }
            }

            // Finalize
            if (state.status === 'active' || state.status === 'closing') {
                state.status = 'complete';
            }
            state.completedAt = Date.now();
            writeJSON(statePath(id), state);

            appendEpisodeLog(id, `\n${'='.repeat(80)}\nEpisode ${state.status}. Rounds: ${state.currentRound}/${config.settings.maxRounds}\nCompleted: ${formatTimestamp(state.completedAt)}\n${'='.repeat(80)}`);

            // Generate transcript markdown
            const md = generateTranscriptMarkdown(config, state);
            ensureDir(path.dirname(transcriptPath(id)));
            fs.writeFileSync(transcriptPath(id), md);

            broadcastMessage({
                type: 'conversation_complete',
                conversationId: id,
                status: state.status,
                rounds: state.currentRound
            });

            logger.log({
                type: 'system', level: 'info',
                message: `Conversation ${state.status}: ${config.title}`,
                data: { id, rounds: state.currentRound, status: state.status }
            });

            // Phase 2: Deliver transcript to channels
            if (config.settings.deliverTo && config.settings.deliverTo.length > 0 && state.status === 'complete') {
                deliverToChannels(config.id, config.settings.deliverTo, md).catch(err => {
                    logger.log({ type: 'error', level: 'error', message: '[Conversation] Channel delivery failed', data: String(err) });
                });
            }

            // Campaign persistence: final save to GitHub
            if (config.settings.campaignPersistence) {
                const reason = state.status === 'complete' ? 'Campaign complete' : `Campaign ${state.status}`;
                saveCampaignToGitHub(config, state, config.settings.campaignPersistence, reason).catch(err => {
                    logger.log({ type: 'error', level: 'error', message: '[Campaign] Final GitHub save failed', data: String(err) });
                });
            }

        } catch (err) {
            state.status = 'error';
            state.error = String(err);
            state.completedAt = Date.now();
            writeJSON(statePath(id), state);

            broadcastMessage({
                type: 'conversation_error',
                conversationId: id,
                error: String(err)
            });

            logger.log({
                type: 'error', level: 'error',
                message: `Conversation error: ${config.title}`,
                data: { id, error: String(err) }
            });
        } finally {
            runningConversations.delete(id);
        }
    }
}
