import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    WAMessage,
    MessageUpsertType,
    jidNormalizedUser,
    areJidsSameUser,
    isLidUser
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import QRCode from 'qrcode';
import { logger } from './logger.js';
import { EventEmitter } from 'events';

const AUTH_DIR = path.resolve(process.cwd(), 'whatsapp_auth');

/**
 * Parses WHATSAPP_ALLOW_LIST env var into a set of normalized phone numbers.
 * Accepts comma-separated phone numbers (e.g. "+1234567890, 0987654321").
 * Returns null if the env var is empty/unset (meaning allow all).
 */
function loadAllowList(): Set<string> | null {
    const raw = process.env.WHATSAPP_ALLOW_LIST?.trim();
    if (!raw) return null;

    const numbers = raw
        .split(',')
        .map(n => n.trim().replace(/^\+/, '').replace(/[^0-9]/g, ''))
        .filter(n => n.length > 0);

    if (numbers.length === 0) return null;
    return new Set(numbers);
}

/**
 * Resolves a JID to a phone number string, handling LID JIDs via baileys' mapping.
 * Returns the bare phone digits, or null if a LID cannot be resolved.
 */
async function resolvePhoneFromJid(jid: string, sock: any): Promise<string | null> {
    if (isLidUser(jid)) {
        try {
            const phoneJid: string | undefined = await sock?.signalRepository?.lidMapping?.getPNForLID(jid);
            if (phoneJid) {
                // phoneJid looks like "447958673279:0@s.whatsapp.net"
                return phoneJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
            }
        } catch {
            // Resolution failed — caller decides what to do
        }
        return null;
    }
    return jid.split('@')[0].replace(/[^0-9]/g, '');
}

/**
 * Checks if a WhatsApp JID is permitted by the allowlist.
 * If no allowlist is configured, all JIDs are allowed.
 * LID JIDs are resolved to phone numbers via baileys' built-in mapping.
 */
async function isJidAllowed(jid: string, sock: any): Promise<boolean> {
    const allowList = loadAllowList();
    if (!allowList) return true;

    const phone = await resolvePhoneFromJid(jid, sock);
    if (!phone) return false; // Can't resolve LID — block for safety

    return allowList.has(phone);
}

export class WhatsAppManager extends EventEmitter {
    private static instance: WhatsAppManager;
    private sock: any; // Type as any for now to avoid complexity with baileys types
    private qrCode: string | null = null;
    private isConnected: boolean = false;
    private reconnectRetries: number = 0;
    private sentMessageIds = new Set<string>();

    private isInitializing: boolean = false;

    private constructor() {
        super();
        // Removed this.initialize() to make WhatsApp opt-in
    }

    public static getInstance(): WhatsAppManager {
        if (!WhatsAppManager.instance) {
            WhatsAppManager.instance = new WhatsAppManager();
        }
        return WhatsAppManager.instance;
    }

    private async initialize() {
        if (this.isInitializing) return;
        this.isInitializing = true;

        try {
            if (!fs.existsSync(AUTH_DIR)) {
                fs.mkdirSync(AUTH_DIR, { recursive: true });
            }

            const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
            const { version } = await fetchLatestBaileysVersion();

            logger.log({
                type: 'system',
                level: 'info',
                message: `Initializing WhatsApp with version ${version.join('.')}`
            });

            this.sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, undefined as any), // Use default logger
                },
                printQRInTerminal: false,
                generateHighQualityLinkPreview: true,
                // browser: ['Luna Agent Gateway', 'Chrome', '1.0.0']
            });

            this.sock.ev.on('creds.update', saveCreds);

            this.sock.ev.on('connection.update', async (update: any) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    this.qrCode = await QRCode.toDataURL(qr);
                    logger.log({
                        type: 'system',
                        level: 'info',
                        message: 'WhatsApp QR Code updated'
                    });
                    this.emit('qr', this.qrCode);
                }

                if (connection === 'close') {
                    const error = (lastDisconnect?.error as Boom)?.output?.statusCode;
                    const shouldReconnect = error !== DisconnectReason.loggedOut;

                    logger.log({
                        type: 'system',
                        level: 'warn',
                        message: `WhatsApp connection closed. Error: ${error}, Reconnecting: ${shouldReconnect}`
                    });

                    if (shouldReconnect) {
                        if (this.reconnectRetries < 5) {
                            this.reconnectRetries++;
                            logger.log({
                                type: 'system',
                                level: 'warn',
                                message: `WhatsApp reconnecting attempt ${this.reconnectRetries}...`
                            });
                            this.initialize();
                        } else {
                            logger.log({
                                type: 'system',
                                level: 'error',
                                message: `WhatsApp connection closed. Max retries reached.`
                            });
                        }
                    } else {
                        logger.log({
                            type: 'system',
                            level: 'info',
                            message: `WhatsApp logged out.`
                        });
                        this.cleanup();
                    }

                    this.isConnected = false;
                    this.emit('status', { connected: false });
                    // Only clear QR if we are truly stopping or logged out. 
                    // If we are reconnecting, we might want to keep it or wait for new one.
                    // But typically 'close' means invalid session or need new QR if not authenticated yet.
                    if (!shouldReconnect || this.reconnectRetries >= 5) {
                        this.qrCode = null;
                    }
                } else if (connection === 'open') {
                    const allowList = loadAllowList();
                    logger.log({
                        type: 'system',
                        level: 'info',
                        message: allowList
                            ? `WhatsApp connected. Allowlist active: ${allowList.size} number(s) permitted.`
                            : `WhatsApp connected. No allowlist configured — all numbers permitted.`
                    });
                    this.isConnected = true;
                    this.qrCode = null;
                    this.reconnectRetries = 0;
                    this.emit('status', { connected: true });
                }
            });

            this.sock.ev.on('messages.upsert', async (m: { messages: WAMessage[], type: MessageUpsertType }) => {
                // Determine the bot's own JID, falling back to auth state if sock.user is not yet populated
                const currentUser = this.sock.user || state.creds.me;
                const myJid = currentUser?.id ? jidNormalizedUser(currentUser.id) : null;
                // Basic check for LID if available in user object
                let myLid = (currentUser as any)?.lid ? jidNormalizedUser((currentUser as any).lid) : null;

                // If LID is not in sock.user, try to find it in creds.me (sometimes it's there)
                if (!myLid && state.creds.me?.lid) {
                    myLid = jidNormalizedUser(state.creds.me.lid);
                }

                if (m.type === 'notify') {
                    for (const msg of m.messages) {
                        const remoteJid = msg.key.remoteJid ? jidNormalizedUser(msg.key.remoteJid) : null;
                        const isFromMe = msg.key.fromMe;

                        // Check if this is a message we sent (to avoid loops)
                        // This logic needs to be before anything else to ensure we don't process our own outputs
                        if (msg.key.id && this.sentMessageIds.has(msg.key.id)) {
                            this.sentMessageIds.delete(msg.key.id);
                            continue;
                        }

                        // We process the message if:
                        // 1. It is NOT from us.
                        // 2. OR it IS from us, but the remoteJid is our own JID (Message to Self).
                        // We use areJidsSameUser to handle LID vs Phone Number JID differences
                        // Also explicitly check against myLid if available
                        const isSelfMessage = isFromMe && myJid && remoteJid && (areJidsSameUser(remoteJid, myJid) || (myLid && areJidsSameUser(remoteJid, myLid)));
                        const shouldProcess = !isFromMe || isSelfMessage;

                        if (shouldProcess) {
                            // Allowlist check: skip messages from numbers not on the list
                            if (remoteJid && !(await isJidAllowed(remoteJid, this.sock))) {
                                logger.log({
                                    type: 'system',
                                    level: 'info',
                                    message: `WhatsApp: Blocked inbound message from ${remoteJid} (not on allowlist)`
                                });
                                continue;
                            }
                            this.emit('message', msg);
                        }
                    }
                }
            });

        } catch (error) {
            logger.log({
                type: 'error',
                level: 'error',
                message: `Failed to initialize WhatsApp: ${error}`
            });
        } finally {
            this.isInitializing = false;
        }
    }

    public async connect() {
        await this.initialize();
    }

    public getStatus() {
        return {
            connected: this.isConnected,
            qrCode: this.qrCode,
            isInitializing: this.isInitializing
        };
    }

    public getUserJids() {
        if (!this.sock) return { myJid: null, myLid: null };
        const currentUser = this.sock.user;
        const myJid = currentUser?.id ? jidNormalizedUser(currentUser.id) : null;
        let myLid = (currentUser as any)?.lid ? jidNormalizedUser((currentUser as any).lid) : null;

        // Try getting from state if not in sock.user
        // NOTE: We cannot easily access 'state' here as it's local to initialize.
        // But usually sock.user is populated after connection.

        return { myJid, myLid };
    }

    public async logout() {
        try {
            if (this.sock) {
                await this.sock.logout();
            }
        } catch (err) {
            // Ignore if already logged out
        }
        this.cleanup();
    }

    private cleanup() {
        if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        }
        this.isConnected = false;
        this.qrCode = null;
    }

    public async sendMessage(to: string, text: string) {
        if (!(await isJidAllowed(to, this.sock))) {
            logger.log({
                type: 'system',
                level: 'warn',
                message: `WhatsApp: Blocked outbound message to ${to} (not on allowlist)`
            });
            return;
        }
        if (this.sock && this.isConnected) {
            const sentMsg = await this.sock.sendMessage(to, { text });
            if (sentMsg?.key?.id) {
                this.sentMessageIds.add(sentMsg.key.id);
                // Clean up after 10 seconds (fail-safe)
                setTimeout(() => {
                    if (sentMsg.key.id) this.sentMessageIds.delete(sentMsg.key.id);
                }, 10000);
            }
        } else {
            throw new Error('WhatsApp not connected');
        }
    }
}
