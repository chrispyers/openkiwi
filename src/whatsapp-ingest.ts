import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { WAMessage, jidNormalizedUser } from '@whiskeysockets/baileys';
import { QdrantClient } from '@qdrant/js-client-rest';
import { WhatsAppManager } from './whatsapp-manager.js';
import { loadConfig, saveConfig } from './config-manager.js';
import { createEmbedding } from './llm-provider.js';
import { logger } from './logger.js';
import { getMessageText } from './WhatsApp.js';

// ── Chat registry ─────────────────────────────────────────────────────────────
// Lightweight local cache so the UI can list chats + labels without re-scanning.

interface ChatRecord {
    jid: string;
    name?: string;
    isGroup: boolean;
    lastTimestamp?: number;
    messageCount?: number;
}

const CHATS_PATH = path.resolve(process.cwd(), 'config', 'whatsapp-chats.json');
const chatRegistry = new Map<string, ChatRecord>();
let chatsDirty = false;

function loadChats() {
    try {
        if (fs.existsSync(CHATS_PATH)) {
            const data = JSON.parse(fs.readFileSync(CHATS_PATH, 'utf-8'));
            for (const rec of data) chatRegistry.set(rec.jid, rec);
        }
    } catch (e) {
        logger.log({ type: 'system', level: 'warn', message: `whatsapp-ingest: failed to load chat registry: ${e}` });
    }
}

function persistChats() {
    if (!chatsDirty) return;
    try {
        fs.mkdirSync(path.dirname(CHATS_PATH), { recursive: true });
        fs.writeFileSync(CHATS_PATH, JSON.stringify([...chatRegistry.values()], null, 2));
        chatsDirty = false;
    } catch (e) {
        logger.log({ type: 'system', level: 'warn', message: `whatsapp-ingest: failed to persist chat registry: ${e}` });
    }
}

function upsertChat(jid: string, patch: Partial<ChatRecord>) {
    const norm = jidNormalizedUser(jid);
    const isGroup = norm.endsWith('@g.us');
    const existing = chatRegistry.get(norm) || { jid: norm, isGroup };
    const merged: ChatRecord = { ...existing, ...patch, jid: norm, isGroup };
    chatRegistry.set(norm, merged);
    chatsDirty = true;
}

export function listChats(): ChatRecord[] {
    return [...chatRegistry.values()].sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
}

// ── Config helpers ────────────────────────────────────────────────────────────

interface IngestConfig {
    enabled: boolean;
    store: string;
    excludedChats: string[];
    agentRepliesEnabled: boolean;
}

export function getIngestConfig(): IngestConfig {
    const cfg = loadConfig() as any;
    const raw = cfg.tools?.whatsapp_ingest || {};
    return {
        enabled: raw.enabled !== false,
        store: raw.store || 'whatsapp_messages',
        excludedChats: Array.isArray(raw.excludedChats) ? raw.excludedChats : [],
        agentRepliesEnabled: raw.agentRepliesEnabled === true,
    };
}

export function updateIngestConfig(patch: Partial<IngestConfig>): IngestConfig {
    const cfg = loadConfig() as any;
    cfg.tools = cfg.tools || {};
    const current = cfg.tools.whatsapp_ingest || { enabled: true, store: 'whatsapp_messages', excludedChats: [], agentRepliesEnabled: false };
    const next = { ...current, ...patch };
    cfg.tools.whatsapp_ingest = next;
    saveConfig(cfg);
    return next;
}

function isExcluded(jid: string, excluded: string[]): boolean {
    const norm = jidNormalizedUser(jid);
    return excluded.some(e => jidNormalizedUser(e) === norm);
}

// ── Qdrant wiring ─────────────────────────────────────────────────────────────

function resolveStore(storeName: string) {
    const cfg = loadConfig() as any;
    const stores = cfg.tools?.qdrant?.stores;
    const store = stores?.[storeName];
    if (!store?.url) return null;
    if (!store.apiKey && cfg.tools?.qdrant?.apiKey) store.apiKey = cfg.tools.qdrant.apiKey;
    if (!store.apiKey && process.env.QDRANT_API_KEY) store.apiKey = process.env.QDRANT_API_KEY;
    return store;
}

function resolveEmbeddingProvider() {
    const cfg = loadConfig() as any;
    const modelName = cfg.memory?.embeddingsModel;
    if (!modelName) return null;
    const providers = cfg.providers || [];
    const p = providers.find((x: any) => x.description === modelName) ?? providers.find((x: any) => x.model === modelName);
    if (!p) return null;
    return { baseUrl: p.endpoint, modelId: p.model, apiKey: p.apiKey };
}

let collectionReady = false;
let cachedClient: QdrantClient | null = null;
let cachedClientKey: string | null = null;

function getClient(storeConfig: any): QdrantClient {
    const key = `${storeConfig.url}|${storeConfig.apiKey || ''}`;
    if (cachedClient && cachedClientKey === key) return cachedClient;
    cachedClient = new QdrantClient({ url: storeConfig.url, apiKey: storeConfig.apiKey, checkCompatibility: false });
    cachedClientKey = key;
    collectionReady = false;
    return cachedClient;
}

async function ensureCollection(client: QdrantClient, storeConfig: any) {
    if (collectionReady) return;
    try {
        await client.getCollection(storeConfig.collection);
    } catch {
        const dims = storeConfig.dimensions || 192;
        await client.createCollection(storeConfig.collection, {
            vectors: { size: dims, distance: 'Cosine' },
        });
        logger.log({ type: 'system', level: 'info', message: `whatsapp-ingest: created Qdrant collection ${storeConfig.collection}` });
    }
    collectionReady = true;
}

// Deterministic UUID (v4-ish format) from a stable string → prevents dupes.
function idFromMessageId(messageId: string): string {
    const hex = crypto.createHash('md5').update(messageId).digest('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// ── Ingest pipeline ──────────────────────────────────────────────────────────

interface IngestItem {
    msg: WAMessage;
    text: string;
    remoteJid: string;
    senderJid: string;
    senderName?: string;
    timestamp: number;
    isGroup: boolean;
}

const queue: IngestItem[] = [];
let draining = false;

function extractItem(msg: WAMessage): IngestItem | null {
    const text = getMessageText(msg);
    if (!text) return null;
    const remoteJid = msg.key.remoteJid ? jidNormalizedUser(msg.key.remoteJid) : null;
    if (!remoteJid) return null;
    const isGroup = remoteJid.endsWith('@g.us');
    const senderJid = isGroup
        ? (msg.key.participant ? jidNormalizedUser(msg.key.participant) : remoteJid)
        : remoteJid;
    const timestamp = typeof msg.messageTimestamp === 'number'
        ? msg.messageTimestamp
        : Number(msg.messageTimestamp || Math.floor(Date.now() / 1000));
    return {
        msg,
        text,
        remoteJid,
        senderJid,
        senderName: msg.pushName || undefined,
        timestamp,
        isGroup,
    };
}

async function drain() {
    if (draining) return;
    draining = true;
    try {
        while (queue.length > 0) {
            const cfg = getIngestConfig();
            if (!cfg.enabled) { queue.length = 0; break; }

            const storeConfig = resolveStore(cfg.store);
            if (!storeConfig) {
                logger.log({ type: 'system', level: 'warn', message: `whatsapp-ingest: store "${cfg.store}" not configured; dropping ${queue.length} queued messages` });
                queue.length = 0;
                break;
            }
            const embeddingProvider = resolveEmbeddingProvider();
            if (!embeddingProvider) {
                logger.log({ type: 'system', level: 'warn', message: 'whatsapp-ingest: no embedding provider configured; dropping queued messages' });
                queue.length = 0;
                break;
            }

            const client = getClient(storeConfig);
            await ensureCollection(client, storeConfig);

            // Batch up to 16 at a time
            const batch = queue.splice(0, 16).filter(item => !isExcluded(item.remoteJid, cfg.excludedChats));
            if (batch.length === 0) continue;

            const points: any[] = [];
            for (const item of batch) {
                try {
                    const embeddings = await createEmbedding(embeddingProvider, item.text);
                    let vector = embeddings[0];
                    if (!vector?.length) continue;
                    if (storeConfig.dimensions && vector.length > storeConfig.dimensions) {
                        vector = vector.slice(0, storeConfig.dimensions);
                    }
                    const messageId = item.msg.key.id;
                    if (!messageId) continue;

                    const chat = chatRegistry.get(item.remoteJid);
                    points.push({
                        id: idFromMessageId(messageId),
                        vector,
                        payload: {
                            text: item.text,
                            message_id: messageId,
                            chat_jid: item.remoteJid,
                            chat_name: chat?.name,
                            is_group: item.isGroup,
                            sender_jid: item.senderJid,
                            sender_name: item.senderName,
                            timestamp: item.timestamp,
                            from_me: !!item.msg.key.fromMe,
                        },
                    });

                    // Update chat registry
                    upsertChat(item.remoteJid, {
                        lastTimestamp: item.timestamp,
                        messageCount: (chat?.messageCount || 0) + 1,
                    });
                } catch (e: any) {
                    logger.log({ type: 'system', level: 'warn', message: `whatsapp-ingest: embed failed for message: ${e.message}` });
                }
            }

            if (points.length > 0) {
                try {
                    await client.upsert(storeConfig.collection, { wait: false, points });
                } catch (e: any) {
                    logger.log({ type: 'system', level: 'error', message: `whatsapp-ingest: upsert failed: ${e.message}` });
                }
            }
            persistChats();
        }
    } finally {
        draining = false;
    }
}

function enqueue(msg: WAMessage) {
    const item = extractItem(msg);
    if (!item) return;
    queue.push(item);
    // fire-and-forget drain
    drain().catch(e => logger.log({ type: 'system', level: 'error', message: `whatsapp-ingest: drain error: ${e}` }));
}

// ── Backfill ──────────────────────────────────────────────────────────────────

export async function backfillChat(jid: string, count: number = 50): Promise<{ requested: number } | { error: string }> {
    const sock = WhatsAppManager.getInstance().getSocket();
    if (!sock) return { error: 'WhatsApp not connected' };
    const norm = jidNormalizedUser(jid);
    const chat = chatRegistry.get(norm);
    // Baileys needs an "oldest known" message key+timestamp to paginate backwards.
    // If we have no prior messages for this chat, we still try with null placeholders — Baileys will fetch from latest.
    try {
        if (typeof sock.fetchMessageHistory === 'function') {
            // Baileys signature: fetchMessageHistory(count, oldestMsgKey, oldestMsgTimestamp)
            const oldestKey = null;
            const oldestTs = chat?.lastTimestamp || Math.floor(Date.now() / 1000);
            await sock.fetchMessageHistory(count, oldestKey, oldestTs);
            return { requested: count };
        }
        return { error: 'Baileys fetchMessageHistory not available in this version' };
    } catch (e: any) {
        return { error: e.message || String(e) };
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initWhatsAppIngest() {
    loadChats();
    const mgr = WhatsAppManager.getInstance();

    mgr.on('message-raw', (msg: WAMessage) => {
        try {
            const cfg = getIngestConfig();
            if (!cfg.enabled) return;
            enqueue(msg);
        } catch (e: any) {
            logger.log({ type: 'system', level: 'warn', message: `whatsapp-ingest: listener error: ${e.message}` });
        }
    });

    mgr.on('history', (payload: any) => {
        try {
            const cfg = getIngestConfig();
            if (!cfg.enabled) return;

            if (Array.isArray(payload?.chats)) {
                for (const c of payload.chats) {
                    if (c?.id) upsertChat(c.id, { name: c.name || c.subject });
                }
            }
            if (Array.isArray(payload?.contacts)) {
                for (const c of payload.contacts) {
                    if (c?.id) upsertChat(c.id, { name: c.name || c.notify || c.verifiedName });
                }
            }
            if (Array.isArray(payload?.messages)) {
                logger.log({ type: 'system', level: 'info', message: `whatsapp-ingest: history sync received ${payload.messages.length} messages` });
                for (const m of payload.messages) enqueue(m);
            }
            persistChats();
        } catch (e: any) {
            logger.log({ type: 'system', level: 'warn', message: `whatsapp-ingest: history handler error: ${e.message}` });
        }
    });

    mgr.on('chat-update', (chat: any) => {
        if (!chat?.id) return;
        upsertChat(chat.id, { name: chat.name || chat.subject });
    });

    mgr.on('contact-update', (contact: any) => {
        if (!contact?.id) return;
        upsertChat(contact.id, { name: contact.name || contact.notify || contact.verifiedName });
    });

    logger.log({ type: 'system', level: 'info', message: 'whatsapp-ingest: initialized' });
}
