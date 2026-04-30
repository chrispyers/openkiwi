import { useEffect, useState, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons'
import { faLink, faTrash, faPaperPlane, faDatabase, faDownload, faRoute } from '@fortawesome/free-solid-svg-icons'
import { Loader2 } from 'lucide-react'
import Page from '../Page'
import Card from '../../Card'
import SectionHeader from '../../SectionHeader'
import Text from '../../Text'
import Button from '../../Button'

function ChannelBindingsPanel({ platform, bindingsUrl, chatsUrl, idField = 'chatId' }) {
    const [bindings, setBindings] = useState([]);
    const [chats, setChats] = useState([]);
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [manualId, setManualId] = useState('');

    const authHeaders = useCallback(() => {
        const token = localStorage.getItem('gateway_token') || '';
        return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    }, []);

    const apiBase = useCallback(() => {
        return localStorage.getItem('gateway_addr') || 'http://localhost:3808';
    }, []);

    const load = useCallback(async () => {
        try {
            const [bindingsRes, chatsRes, agentsRes] = await Promise.all([
                fetch(`${apiBase()}${bindingsUrl}`, { headers: authHeaders() }),
                fetch(`${apiBase()}${chatsUrl}`, { headers: authHeaders() }),
                fetch(`${apiBase()}/api/agents`, { headers: authHeaders() }),
            ]);
            if (bindingsRes.ok) {
                const data = await bindingsRes.json();
                setBindings(data.bindings || []);
            }
            if (chatsRes.ok) {
                const data = await chatsRes.json();
                setChats(data.chats || []);
            }
            if (agentsRes.ok) {
                const data = await agentsRes.json();
                setAgents(Array.isArray(data) ? data : data.agents || []);
            }
        } catch (e) {
            console.error(`Failed to load ${platform} bindings:`, e);
        } finally {
            setLoading(false);
        }
    }, [apiBase, authHeaders, bindingsUrl, chatsUrl, platform]);

    useEffect(() => { load(); }, [load]);

    const setBinding = async (chatId, agentId) => {
        try {
            if (!agentId) {
                await fetch(`${apiBase()}${bindingsUrl}/${encodeURIComponent(chatId)}`, {
                    method: 'DELETE',
                    headers: authHeaders(),
                });
            } else {
                await fetch(`${apiBase()}${bindingsUrl}/${encodeURIComponent(chatId)}`, {
                    method: 'PUT',
                    headers: authHeaders(),
                    body: JSON.stringify({ agentId }),
                });
            }
            await load();
        } catch (e) {
            console.error(`Failed to update ${platform} binding:`, e);
        }
    };

    const addManualBinding = async (agentId) => {
        if (!manualId.trim() || !agentId) return;
        await setBinding(manualId.trim(), agentId);
        setManualId('');
    };

    if (loading) {
        return (
            <Card>
                <div className="flex items-center gap-2 text-neutral-400 py-4">
                    <Loader2 className="animate-spin" size={16} />
                    <span className="text-sm">Loading bindings...</span>
                </div>
            </Card>
        );
    }

    // Merge known chats with existing bindings to build full list
    const boundIds = new Set(bindings.map(b => b[idField] || b.chatId || b.jid));
    const unboundChats = chats.filter(c => !boundIds.has(c[idField] || c.chatId || c.jid));

    return (
        <Card>
            <div className="flex items-center gap-2 mb-4">
                <FontAwesomeIcon icon={faRoute} className="text-neutral-500" />
                <h4 className="font-semibold text-sm">Chat → Agent Routing</h4>
            </div>
            <Text block className="text-xs text-neutral-500 mb-4">
                Bind a chat to an agent so all messages route there automatically — no @mention needed.
            </Text>

            <div className="space-y-2">
                {/* Existing bindings */}
                {bindings.map(b => {
                    const id = b[idField] || b.chatId || b.jid;
                    return (
                        <div key={id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
                            <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium truncate block">
                                    {b.title || b.name || id}
                                </span>
                                <span className="text-xs text-neutral-400">{id}</span>
                            </div>
                            <select
                                className="text-sm bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded px-2 py-1"
                                value={b.agentId}
                                onChange={e => setBinding(id, e.target.value)}
                            >
                                <option value="">Default routing</option>
                                {agents.map(a => (
                                    <option key={a.id} value={a.id}>{a.name || a.id}</option>
                                ))}
                            </select>
                        </div>
                    );
                })}

                {/* Unbound known chats */}
                {unboundChats.map(c => {
                    const id = c[idField] || c.chatId || c.jid;
                    return (
                        <div key={id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 opacity-60">
                            <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium truncate block">
                                    {c.title || c.name || id}
                                </span>
                                <span className="text-xs text-neutral-400">{id}</span>
                            </div>
                            <select
                                className="text-sm bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded px-2 py-1"
                                value=""
                                onChange={e => setBinding(id, e.target.value)}
                            >
                                <option value="">Default routing</option>
                                {agents.map(a => (
                                    <option key={a.id} value={a.id}>{a.name || a.id}</option>
                                ))}
                            </select>
                        </div>
                    );
                })}

                {/* Manual entry for chats not yet seen */}
                <div className="flex items-center gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                    <input
                        type="text"
                        placeholder={`Enter ${idField === 'jid' ? 'JID' : 'Chat ID'}...`}
                        value={manualId}
                        onChange={e => setManualId(e.target.value)}
                        className="flex-1 text-sm bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded px-2 py-1"
                    />
                    <select
                        className="text-sm bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded px-2 py-1"
                        defaultValue=""
                        onChange={e => { addManualBinding(e.target.value); e.target.value = ''; }}
                    >
                        <option value="" disabled>Bind to agent...</option>
                        {agents.map(a => (
                            <option key={a.id} value={a.id}>{a.name || a.id}</option>
                        ))}
                    </select>
                </div>

                {bindings.length === 0 && unboundChats.length === 0 && (
                    <Text block className="text-xs text-neutral-400 py-2">
                        No chats discovered yet. Send a message to the bot first, or enter a Chat ID manually above.
                    </Text>
                )}
            </div>
        </Card>
    );
}

function WhatsAppIngestPanel() {
    const [cfg, setCfg] = useState(null);
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyJid, setBusyJid] = useState(null);

    const authHeaders = useCallback(() => {
        const token = localStorage.getItem('gateway_token') || '';
        return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    }, []);

    const apiBase = useCallback(() => {
        return localStorage.getItem('gateway_addr') || 'http://localhost:3808';
    }, []);

    const load = useCallback(async () => {
        try {
            const [cfgRes, chatsRes] = await Promise.all([
                fetch(`${apiBase()}/api/whatsapp/ingest/config`, { headers: authHeaders() }),
                fetch(`${apiBase()}/api/whatsapp/chats`, { headers: authHeaders() }),
            ]);
            if (cfgRes.ok) setCfg(await cfgRes.json());
            if (chatsRes.ok) {
                const data = await chatsRes.json();
                setChats(data.chats || []);
            }
        } catch (e) {
            console.error('Failed to load WhatsApp ingest data:', e);
        } finally {
            setLoading(false);
        }
    }, [apiBase, authHeaders]);

    useEffect(() => { load(); }, [load]);

    const saveConfig = async (patch) => {
        const next = { ...cfg, ...patch };
        setCfg(next);
        try {
            const res = await fetch(`${apiBase()}/api/whatsapp/ingest/config`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(patch),
            });
            if (res.ok) setCfg(await res.json());
        } catch (e) {
            console.error('Failed to save ingest config:', e);
        }
    };

    const toggleEnabled = () => saveConfig({ enabled: !cfg?.enabled });

    const toggleExclude = (jid) => {
        const excluded = cfg?.excludedChats || [];
        const next = excluded.includes(jid)
            ? excluded.filter(j => j !== jid)
            : [...excluded, jid];
        saveConfig({ excludedChats: next });
    };

    const backfill = async (jid) => {
        setBusyJid(jid);
        try {
            const res = await fetch(`${apiBase()}/api/whatsapp/ingest/backfill`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ jid, count: 100 }),
            });
            const data = await res.json();
            if (!res.ok) console.error('Backfill failed:', data);
        } catch (e) {
            console.error('Backfill error:', e);
        } finally {
            setBusyJid(null);
            setTimeout(load, 1500);
        }
    };

    if (loading) {
        return (
            <Card>
                <div className="flex items-center gap-2 text-neutral-400">
                    <Loader2 className="animate-spin" size={16} />
                    <span className="text-sm">Loading ingest config…</span>
                </div>
            </Card>
        );
    }

    if (!cfg) {
        return (
            <Card>
                <Text block>Ingest configuration unavailable. Check that the gateway is reachable.</Text>
            </Card>
        );
    }

    return (
        <>
            <SectionHeader
                icon={faDatabase}
                iconClasses="w-10 h-10 rounded-full bg-purple-500 text-white"
                title="WhatsApp Message Ingest"
            />
            <Card>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <Text bold>Passive Ingest</Text>
                            <Text block className="text-sm text-neutral-500 mt-1">
                                Store incoming WhatsApp messages in the <code>{cfg.store}</code> Qdrant collection so agents like Vox can recall them. Read-only — no agent replies on WhatsApp.
                            </Text>
                        </div>
                        <Button
                            themed={true}
                            className={cfg.enabled
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                : 'bg-neutral-300 text-neutral-700 hover:bg-neutral-400'}
                            onClick={toggleEnabled}
                        >
                            {cfg.enabled ? 'Enabled' : 'Disabled'}
                        </Button>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-neutral-200 dark:border-neutral-800">
                        <div>
                            <Text bold>Agent Replies on WhatsApp</Text>
                            <Text block className="text-sm text-neutral-500 mt-1">
                                When off, agents never respond on WhatsApp even if mentioned. Ingest is unaffected.
                            </Text>
                        </div>
                        <Button
                            themed={true}
                            className={cfg.agentRepliesEnabled
                                ? 'bg-amber-500 text-white hover:bg-amber-600'
                                : 'bg-neutral-300 text-neutral-700 hover:bg-neutral-400'}
                            onClick={() => saveConfig({ agentRepliesEnabled: !cfg.agentRepliesEnabled })}
                        >
                            {cfg.agentRepliesEnabled ? 'On' : 'Off'}
                        </Button>
                    </div>

                    <div className="mt-2">
                        <Text bold>Known Chats ({chats.length})</Text>
                        <Text block className="text-sm text-neutral-500 mt-1 mb-3">
                            Uncheck a chat to exclude it from ingestion. Click Backfill to request older history from WhatsApp.
                        </Text>
                        {chats.length === 0 ? (
                            <Text block className="text-sm text-neutral-400 italic">
                                No chats discovered yet. Once WhatsApp connects and syncs, chats will appear here.
                            </Text>
                        ) : (
                            <div className="max-h-96 overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded-lg divide-y divide-neutral-200 dark:divide-neutral-800">
                                {chats.map(chat => {
                                    const excluded = (cfg.excludedChats || []).includes(chat.jid);
                                    const included = !excluded;
                                    const label = chat.name || chat.jid.split('@')[0];
                                    return (
                                        <div key={chat.jid} className="flex items-center gap-3 px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={included}
                                                onChange={() => toggleExclude(chat.jid)}
                                                className="w-4 h-4"
                                                title={included ? 'Included — click to exclude' : 'Excluded — click to include'}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium truncate">
                                                    {label}
                                                    {chat.isGroup && <span className="ml-2 text-xs text-neutral-500">[group]</span>}
                                                </div>
                                                <div className="text-xs text-neutral-500 truncate">
                                                    {chat.jid}
                                                    {chat.messageCount ? ` · ${chat.messageCount} ingested` : ''}
                                                </div>
                                            </div>
                                            <Button
                                                themed={false}
                                                icon={faDownload}
                                                onClick={() => backfill(chat.jid)}
                                                disabled={busyJid === chat.jid}
                                                className="text-xs"
                                            >
                                                {busyJid === chat.jid ? 'Requesting…' : 'Backfill'}
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </>
    );
}

export default function Settings_Messaging({
    whatsappStatus,
    onLogoutWhatsApp,
    onConnectWhatsApp,
    telegramStatus,
    onConnectTelegram,
    onDisconnectTelegram
}) {
    return (
        <Page gridCols={1} padding={0}>
            <SectionHeader
                icon={faWhatsapp}
                iconClasses="w-10 h-10 rounded-full bg-[#25D366] text-white"
                title="WhatsApp Integration"
            />
            <Card>
                <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                    {whatsappStatus.connected ? (
                        <div className="flex flex-col items-center gap-4 text-center w-full">
                            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                <FontAwesomeIcon icon={faLink} size="2x" />
                            </div>
                            <div>
                                <h4 className="font-bold text-lg text-emerald-500">Connected</h4>
                                <p className="text-sm text-neutral-500 mt-1">
                                    Your WhatsApp account is linked and ready to receive messages.
                                </p>
                            </div>
                            <Button
                                themed={true}
                                className="bg-red-500 text-white hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-800"
                                onClick={onLogoutWhatsApp}
                                icon={faTrash}
                            >
                                Disconnect / Logout
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row gap-8 w-full items-center">
                            <div className="flex-1">
                                <Text bold={true}>
                                    Scan the QR code below with your phone to link WhatsApp.
                                </Text>
                                <Text block={true} className="mt-4">
                                    1. Open WhatsApp on your phone
                                    <br />
                                    2. Go to Settings {'>'} Linked Devices
                                    <br />
                                    3. Tap "Link a Device"
                                    <br />
                                    4. Point your phone at this screen
                                </Text>
                            </div>

                            <div className="w-64 h-64 bg-white dark:bg-neutral-900 p-4 rounded-xl flex items-center justify-center border border-neutral-200 dark:border-neutral-800">
                                {whatsappStatus.qrCode ? (
                                    <img src={whatsappStatus.qrCode} alt="WhatsApp QR Code" className="w-full h-full object-contain" />
                                ) : whatsappStatus.isInitializing ? (
                                    <div className="flex flex-col items-center gap-2 text-neutral-400">
                                        <Loader2 className="animate-spin" />
                                        <span className="text-xs">Generating QR...</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-4 text-neutral-400">
                                        <Button
                                            themed={false}
                                            onClick={onConnectWhatsApp}
                                            icon={faLink}
                                        >
                                            Generate QR Code
                                        </Button>
                                        <span className="text-xs">WhatsApp is currently inactive.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            <WhatsAppIngestPanel />

            {whatsappStatus.connected && (
                <ChannelBindingsPanel
                    platform="WhatsApp"
                    bindingsUrl="/api/whatsapp/bindings"
                    chatsUrl="/api/whatsapp/chats"
                    idField="jid"
                />
            )}

            <SectionHeader
                icon={faPaperPlane}
                iconClasses="w-10 h-10 rounded-full bg-[#0088cc] text-white"
                title="Telegram Integration"
            />
            <Card>
                <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                    {telegramStatus.connected ? (
                        <div className="flex flex-col items-center gap-4 text-center w-full">
                            <div className="w-20 h-20 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-500">
                                <FontAwesomeIcon icon={faLink} size="2x" />
                            </div>
                            <div>
                                <h4 className="font-bold text-lg text-sky-500">Connected</h4>
                                <p className="text-sm text-neutral-500 mt-1">
                                    {telegramStatus.botUsername
                                        ? <>Your Telegram bot <strong>@{telegramStatus.botUsername}</strong> is online and ready to receive messages.</>
                                        : 'Your Telegram bot is online and ready to receive messages.'}
                                </p>
                            </div>
                            <Button
                                themed={true}
                                className="bg-red-500 text-white hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-800"
                                onClick={onDisconnectTelegram}
                                icon={faTrash}
                            >
                                Disconnect
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6 w-full">
                            <div>
                                <Text bold={true}>
                                    Connect a Telegram bot to receive and respond to messages.
                                </Text>
                                <Text block={true} className="mt-4">
                                    1. Open Telegram and search for <strong>@BotFather</strong>
                                    <br />
                                    2. Send <code>/newbot</code> and follow the prompts
                                    <br />
                                    3. Copy the bot token and set it as <code>TELEGRAM_BOT_TOKEN</code> in your <code>.env</code> file
                                    <br />
                                    4. Restart the gateway, then click Connect below
                                </Text>
                            </div>

                            <div className="flex items-center gap-4">
                                {telegramStatus.isInitializing ? (
                                    <div className="flex items-center gap-2 text-neutral-400">
                                        <Loader2 className="animate-spin" size={16} />
                                        <span className="text-sm">Connecting...</span>
                                    </div>
                                ) : (
                                    <Button
                                        themed={false}
                                        onClick={onConnectTelegram}
                                        icon={faLink}
                                    >
                                        Connect Bot
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {telegramStatus.connected && (
                <ChannelBindingsPanel
                    platform="Telegram"
                    bindingsUrl="/api/telegram/bindings"
                    chatsUrl="/api/telegram/chats"
                    idField="chatId"
                />
            )}
        </Page>
    );
}
