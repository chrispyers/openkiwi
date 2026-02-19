import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    WAMessage,
    MessageUpsertType,
    jidNormalizedUser,
    areJidsSameUser
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import QRCode from 'qrcode';
import { logger } from './logger.js';
import { EventEmitter } from 'events';

const AUTH_DIR = path.resolve(process.cwd(), 'whatsapp_auth');

export class WhatsAppManager extends EventEmitter {
    private static instance: WhatsAppManager;
    private sock: any; // Type as any for now to avoid complexity with baileys types
    private qrCode: string | null = null;
    private isConnected: boolean = false;
    private reconnectRetries: number = 0;
    private sentMessageIds = new Set<string>();

    private constructor() {
        super();
        this.initialize();
    }

    public static getInstance(): WhatsAppManager {
        if (!WhatsAppManager.instance) {
            WhatsAppManager.instance = new WhatsAppManager();
        }
        return WhatsAppManager.instance;
    }

    private async initialize() {
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
                    this.qrCode = null;
                    this.emit('status', { connected: false });
                } else if (connection === 'open') {
                    logger.log({
                        type: 'system',
                        level: 'info',
                        message: `WhatsApp connected.`
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
        }
    }

    public getStatus() {
        return {
            connected: this.isConnected,
            qrCode: this.qrCode
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
        this.initialize(); // Restart to get new QR
    }

    private cleanup() {
        if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        }
        this.isConnected = false;
        this.qrCode = null;
    }

    public async sendMessage(to: string, text: string) {
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
