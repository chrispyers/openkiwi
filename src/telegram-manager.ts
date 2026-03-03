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

            // Register command handlers
            this.bot.command('agents', async (ctx) => {
                const userId = ctx.from.id;
                const username = ctx.from.username;
                if (!isUserAllowed(userId, username)) return;

                this.emit('command', {
                    command: 'agents',
                    chatId: String(ctx.chat.id),
                    userId: String(userId),
                    username: username || undefined
                });
            });

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

    /**
     * Converts Markdown formatting to Telegram-compatible HTML.
     * Handles code blocks, inline code, bold, italic, strikethrough,
     * links, headings, blockquotes, and horizontal rules.
     */
    private markdownToTelegramHtml(text: string): string {
        // Escape HTML entities first (but we'll unescape inside code blocks later)
        const escapeHtml = (s: string) => s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Extract fenced code blocks before processing to protect their content
        const codeBlocks: string[] = [];
        let processed = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
            const idx = codeBlocks.length;
            const escapedCode = escapeHtml(code.replace(/\n$/, ''));
            codeBlocks.push(lang
                ? `<pre><code class="language-${escapeHtml(lang)}">${escapedCode}</code></pre>`
                : `<pre>${escapedCode}</pre>`);
            return `\x00CODEBLOCK${idx}\x00`;
        });

        // Extract inline code
        const inlineCode: string[] = [];
        processed = processed.replace(/`([^`]+)`/g, (_match, code) => {
            const idx = inlineCode.length;
            inlineCode.push(`<code>${escapeHtml(code)}</code>`);
            return `\x00INLINE${idx}\x00`;
        });

        // Now escape HTML in the remaining text
        processed = escapeHtml(processed);

        // Convert markdown links [text](url) → <a href="url">text</a>
        processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

        // Remove image syntax ![alt](url) → alt
        processed = processed.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

        // Headings → bold text
        processed = processed.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');

        // Bold + italic (***text*** or ___text___)
        processed = processed.replace(/\*{3}(.+?)\*{3}/g, '<b><i>$1</i></b>');
        processed = processed.replace(/_{3}(.+?)_{3}/g, '<b><i>$1</i></b>');

        // Bold (**text** or __text__)
        processed = processed.replace(/\*{2}(.+?)\*{2}/g, '<b>$1</b>');
        processed = processed.replace(/_{2}(.+?)_{2}/g, '<b>$1</b>');

        // Italic (*text* or _text_) — avoid matching mid-word underscores
        processed = processed.replace(/(?<!\w)\*(.+?)\*(?!\w)/g, '<i>$1</i>');
        processed = processed.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<i>$1</i>');

        // Strikethrough ~~text~~
        processed = processed.replace(/~~(.+?)~~/g, '<s>$1</s>');

        // Blockquotes > text → <blockquote>text</blockquote>
        processed = processed.replace(/^&gt;\s?(.*)$/gm, '<blockquote>$1</blockquote>');
        // Merge consecutive blockquote tags
        processed = processed.replace(/<\/blockquote>\n<blockquote>/g, '\n');

        // Horizontal rules → empty line
        processed = processed.replace(/^[-*_]{3,}\s*$/gm, '');

        // Restore code blocks and inline code
        processed = processed.replace(/\x00CODEBLOCK(\d+)\x00/g, (_match, idx) => codeBlocks[parseInt(idx)]);
        processed = processed.replace(/\x00INLINE(\d+)\x00/g, (_match, idx) => inlineCode[parseInt(idx)]);

        // Clean up extra blank lines
        processed = processed.replace(/\n{3,}/g, '\n\n');

        return processed.trim();
    }

    public async sendMessage(chatId: string, text: string) {
        if (!this.bot || !this.isConnected) {
            throw new Error('Telegram bot not connected');
        }

        const html = this.markdownToTelegramHtml(text);

        // Telegram has a 4096 character limit per message
        const MAX_LENGTH = 4096;
        if (html.length <= MAX_LENGTH) {
            await this.bot.telegram.sendMessage(chatId, html, { parse_mode: 'HTML' });
        } else {
            // Chunk the message at line breaks where possible
            let remaining = html;
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
                await this.bot.telegram.sendMessage(chatId, chunk, { parse_mode: 'HTML' });
            }
        }
    }
}
