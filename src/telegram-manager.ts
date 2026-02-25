import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { logger } from './logger.js';
import { EventEmitter } from 'events';

/**
 * Parses TELEGRAM_ALLOW_LIST env var into a set of user IDs and/or usernames.
 * Accepts comma-separated numeric IDs or @usernames (e.g. "123456789, @johndoe").
 * Returns null if the env var is empty/unset (meaning allow all).
 */
function loadAllowList(): { ids: Set<string>; usernames: Set<string> } | null {
    const raw = process.env.TELEGRAM_ALLOW_LIST?.trim();
    if (!raw) return null;

    const ids = new Set<string>();
    const usernames = new Set<string>();

    raw.split(',')
        .map(entry => entry.trim())
        .filter(entry => entry.length > 0)
        .forEach(entry => {
            if (entry.startsWith('@')) {
                usernames.add(entry.substring(1).toLowerCase());
            } else {
                // Treat as numeric user ID
                const digits = entry.replace(/[^0-9]/g, '');
                if (digits.length > 0) ids.add(digits);
            }
        });

    if (ids.size === 0 && usernames.size === 0) return null;
    return { ids, usernames };
}

/**
 * Checks if a Telegram user is permitted by the allowlist.
 * If no allowlist is configured, all users are allowed.
 */
function isUserAllowed(userId: number, username?: string): boolean {
    const allowList = loadAllowList();
    if (!allowList) return true;

    if (allowList.ids.has(String(userId))) return true;
    if (username && allowList.usernames.has(username.toLowerCase())) return true;

    return false;
}

export class TelegramManager extends EventEmitter {
    private static instance: TelegramManager;
    private bot: Telegraf | null = null;
    private isConnected: boolean = false;
    private isInitializing: boolean = false;
    private botUsername: string | null = null;

    private constructor() {
        super();
    }

    public static getInstance(): TelegramManager {
        if (!TelegramManager.instance) {
            TelegramManager.instance = new TelegramManager();
        }
        return TelegramManager.instance;
    }

    private async initialize() {
        if (this.isInitializing) return;
        this.isInitializing = true;

        try {
            const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
            if (!token) {
                logger.log({
                    type: 'system',
                    level: 'warn',
                    message: 'Telegram: No TELEGRAM_BOT_TOKEN configured. Skipping initialization.'
                });
                return;
            }

            this.bot = new Telegraf(token);

            // Register text message handler
            this.bot.on(message('text'), async (ctx) => {
                const userId = ctx.from.id;
                const username = ctx.from.username;
                const chatId = ctx.chat.id;
                const text = ctx.message.text;
                const messageId = ctx.message.message_id;

                // Allowlist check
                if (!isUserAllowed(userId, username)) {
                    logger.log({
                        type: 'system',
                        level: 'info',
                        message: `Telegram: Blocked message from user ${userId} (@${username || 'unknown'}) — not on allowlist`
                    });
                    return;
                }

                this.emit('message', {
                    chatId: String(chatId),
                    userId: String(userId),
                    username: username || undefined,
                    text,
                    messageId
                });
            });

            // Get bot info and mark as connected before launching polling,
            // since launch() starts delivering messages immediately
            const botInfo = await this.bot.telegram.getMe();
            this.botUsername = botInfo.username || null;
            this.isConnected = true;

            // Launch the bot (starts long-polling)
            await this.bot.launch();

            const allowList = loadAllowList();
            logger.log({
                type: 'system',
                level: 'info',
                message: allowList
                    ? `Telegram bot @${this.botUsername} connected. Allowlist active: ${allowList.ids.size} ID(s) + ${allowList.usernames.size} username(s) permitted.`
                    : `Telegram bot @${this.botUsername} connected. No allowlist configured — all users permitted.`
            });

            this.emit('status', { connected: true });

            // Graceful shutdown
            const stopHandler = () => {
                this.bot?.stop();
            };
            process.once('SIGINT', stopHandler);
            process.once('SIGTERM', stopHandler);

        } catch (error) {
            logger.log({
                type: 'error',
                level: 'error',
                message: `Failed to initialize Telegram bot: ${error}`
            });
            this.isConnected = false;
            this.emit('status', { connected: false });
        } finally {
            this.isInitializing = false;
        }
    }

    public async connect() {
        await this.initialize();
    }

    public async disconnect() {
        try {
            if (this.bot) {
                this.bot.stop();
                this.bot = null;
            }
        } catch (err) {
            // Ignore if already stopped
        }
        this.isConnected = false;
        this.botUsername = null;
        this.emit('status', { connected: false });
    }

    public getStatus() {
        return {
            connected: this.isConnected,
            isInitializing: this.isInitializing,
            botUsername: this.botUsername
        };
    }

    public async sendMessage(chatId: string, text: string) {
        if (!this.bot || !this.isConnected) {
            throw new Error('Telegram bot not connected');
        }

        // Telegram has a 4096 character limit per message
        const MAX_LENGTH = 4096;
        if (text.length <= MAX_LENGTH) {
            await this.bot.telegram.sendMessage(chatId, text);
        } else {
            // Chunk the message at line breaks where possible
            let remaining = text;
            while (remaining.length > 0) {
                let chunk: string;
                if (remaining.length <= MAX_LENGTH) {
                    chunk = remaining;
                    remaining = '';
                } else {
                    // Find a good break point (last newline before limit)
                    let breakPoint = remaining.lastIndexOf('\n', MAX_LENGTH);
                    if (breakPoint <= 0) breakPoint = MAX_LENGTH;
                    chunk = remaining.substring(0, breakPoint);
                    remaining = remaining.substring(breakPoint).trimStart();
                }
                await this.bot.telegram.sendMessage(chatId, chunk);
            }
        }
    }
}
