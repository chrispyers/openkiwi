import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import Page from './Page'
import { faHistory, faMicrochip, faWrench, faCheckCircle, faInfoCircle } from '@fortawesome/free-solid-svg-icons'
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Button from '../Button'
import Select from '../Select'
import Toggle from '../Toggle'
import Text from '../Text'
import Card from '../Card'
import Badge from '../Badge'
import TextArea from '../TextArea'
import Code from '../Code'
import {
    faPlus,
    faPlug,
    faSun,
    faMoon,
    faDesktop,
    faSave,
    faGlobe,
    faLock,
    faLink,
    faUser,
    faSmile,
    faFolder,
    faCube,
    faComments,
    faTrash,
    faBrain,
    faFileText,
    faFileCode,
    faGaugeHigh,
    faFlask,
    faPaperPlane
} from '@fortawesome/free-solid-svg-icons'
import { Loader2 } from 'lucide-react'
import Modal from '../Modal'
import MarkdownRenderer from '../MarkdownRenderer'

// Re-using types from App.tsx - ideally these should be moved to a types.ts file
interface Config {

    chat: {
        showReasoning: boolean;
        includeHistory: boolean;
        generateSummaries: boolean;
        showTokenMetrics: boolean;
    };
    system?: {
        version: string;
        latestVersion: string;
    };
    memory?: {
        useEmbeddings: boolean;
        embeddingsModel: string;
    };
    gateway: {
        port: number;
        endpoint: string;
    };
    global?: {
        systemPrompt: string;
    };
    providers: {
        description: string;
        endpoint: string;
        model: string;
    }[];
    enabledTools?: Record<string, boolean>;
}

interface Agent {
    id: string;
    name: string;
    emoji: string;
    path: string;
    identity: string;
    soul: string;
    systemPrompt: string;
}

interface ToolDefinition {
    name: string;
    displayName: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
    filename?: string;
    isRegistered?: boolean;
    hasReadme?: boolean;
}

interface SettingsPageProps {
    activeSettingsSection: 'about' | 'agents' | 'general' | 'messaging' | 'tools' | 'gateway';
    setActiveSettingsSection: (section: 'about' | 'agents' | 'general' | 'messaging' | 'tools' | 'gateway') => void;
    loading: boolean;
    theme: 'dark' | 'light' | 'system';
    setTheme: (theme: 'dark' | 'light' | 'system') => void;
    config: Config | null;
    setConfig: React.Dispatch<React.SetStateAction<Config | null>>;
    models: string[];
    saveConfig: (e?: React.FormEvent, configOverride?: Config) => Promise<void>;
    agents: Agent[];
    settingsAgentId: string;
    setSettingsAgentId: (id: string) => void;
    activeAgentInSettings?: Agent;
    fetchAgents: () => Promise<void>;
    agentForm: { name: string; emoji: string; provider?: string; heartbeat?: { enabled: boolean; schedule: string; }; collaboration?: { enabled: boolean; schedule: string; } };
    setAgentForm: React.Dispatch<React.SetStateAction<{ name: string; emoji: string; provider?: string; heartbeat?: { enabled: boolean; schedule: string; }; collaboration?: { enabled: boolean; schedule: string; } }>>;
    saveAgentConfig: () => Promise<void>;
    setViewingFile: (file: { title: string, content: string, isEditing: boolean, agentId: string } | null) => void;
    tools: ToolDefinition[];
    whatsappStatus: { connected: boolean, qrCode: string | null, isInitializing?: boolean };
    onLogoutWhatsApp: () => Promise<void>;
    onConnectWhatsApp: () => Promise<void>;
    telegramStatus: { connected: boolean, isInitializing?: boolean, botUsername?: string | null };
    onConnectTelegram: () => Promise<void>;
    onDisconnectTelegram: () => Promise<void>;
    gatewayAddr: string;
    gatewayToken: string;
    isProjectManagementEnabled: boolean;
    setIsProjectManagementEnabled: (enabled: boolean) => void;
    isAgentCollaborationEnabled: boolean;
    setIsAgentCollaborationEnabled: (enabled: boolean) => void;
    isAgentActivityEnabled: boolean;
    setIsAgentActivityEnabled: (enabled: boolean) => void;
}

export default function SettingsPage({
    activeSettingsSection,
    setActiveSettingsSection,
    loading,
    theme,
    setTheme,
    config,
    setConfig,
    models,
    saveConfig,
    agents,
    settingsAgentId,
    setSettingsAgentId,
    activeAgentInSettings,
    fetchAgents,
    agentForm,
    setAgentForm,
    saveAgentConfig,
    setViewingFile,
    tools,
    whatsappStatus,
    onLogoutWhatsApp,
    onConnectWhatsApp,
    telegramStatus,
    onConnectTelegram,
    onDisconnectTelegram,
    gatewayAddr,
    gatewayToken,
    isProjectManagementEnabled,
    setIsProjectManagementEnabled,
    isAgentCollaborationEnabled,
    setIsAgentCollaborationEnabled,
    isAgentActivityEnabled,
    setIsAgentActivityEnabled
}: SettingsPageProps) {
    const [publicConfig, setPublicConfig] = useState<any>(null);
    const [viewingReadme, setViewingReadme] = useState<{ name: string, content: string } | null>(null);
    const [loadingReadme, setLoadingReadme] = useState(false);
    const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
    const [hasChecked, setHasChecked] = useState(false);
    const [agentSubSection, setAgentSubSection] = useState<'instructions' | 'memory' | 'chat'>('instructions');
    const [aboutSubSection, setAboutSubSection] = useState<'version' | 'config'>('version');

    const handleCheckUpdate = async () => {
        setIsCheckingUpdates(true);
        setHasChecked(false);
        try {
            const res = await fetch(`${gatewayAddr.replace(/\/$/, '')}/api/system/update`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${gatewayToken}` }
            });

            if (res.ok) {
                console.log('[Update] Check request successful, fetching new config...');
                // Fetch fresh config to update UI
                const configRes = await fetch(`${gatewayAddr.replace(/\/$/, '')}/api/config`, {
                    headers: { 'Authorization': `Bearer ${gatewayToken}` }
                });
                if (configRes.ok) {
                    const newConfig = await configRes.json();
                    console.log('[Update] New config received:', newConfig.system);
                    setConfig(newConfig);
                }
            } else {
                const errText = await res.text();
                console.error('[Update] Server error:', errText);
                toast.error("Failed to check for updates");
            }
        } catch (e) {
            console.error('[Update] request failed:', e);
            toast.error("Error checking for updates");
        } finally {
            setIsCheckingUpdates(false);
            setHasChecked(true);
        }
    };

    useEffect(() => {
        if (activeSettingsSection === 'about' && aboutSubSection === 'config') {
            fetch(`${gatewayAddr.replace(/\/$/, '')}/api/config/public`, {
                headers: {
                    'Authorization': `Bearer ${gatewayToken}`
                }
            })
                .then(res => res.json())
                .then(data => setPublicConfig(data))
                .catch(err => console.error('Failed to fetch public config:', err));
        }
    }, [activeSettingsSection, aboutSubSection, gatewayAddr, gatewayToken]);

    return (
        <Page
            title="Settings"
            subtitle="Manage your gateway, providers, and agent personalities."
        >
            <nav className="flex gap-6 border-b border-border-color mb-10 overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
                {['about', 'agents', 'general', 'messaging', 'tools'].map(id => (
                    <button
                        key={id}
                        className="pb-3 relative flex items-center gap-2"
                        onClick={() => setActiveSettingsSection(id as any)}
                    >
                        <Text secondary={activeSettingsSection !== id} size="sm" bold={true} className="uppercase tracking-wide">{id}</Text>
                        {activeSettingsSection === id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary" />}
                    </button>
                ))}
            </nav>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                    <Loader2 size={40} className="animate-spin text-accent-primary" />
                    <p className="font-medium">Synchronizing configuration...</p>
                </div>
            ) : (
                <div className="max-w-5xl">

                    {/* ... other sections ... */}


                    {activeSettingsSection === 'general' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <Card className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center text-accent-primary">
                                        <FontAwesomeIcon icon={faDesktop} />
                                    </div>
                                    <div>
                                        <div><Text bold={true} size="lg">Appearance</Text></div>
                                        <Text secondary size="sm">Customize the look of OpenKIWI.</Text>
                                    </div>
                                </div>
                            </Card>

                            <Card className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center text-accent-primary">
                                        <FontAwesomeIcon icon={faFlask} />
                                    </div>
                                    <div>
                                        <div><Text bold={true} size="lg">Experimental Settings</Text></div>
                                        <Text secondary size="sm">Try out new and upcoming features. These may be unstable and/or not fully implemented.</Text>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-neutral-100 dark:bg-bg-primary rounded-2xl">
                                        <div className="space-y-1">
                                            <div><Text bold={true}>Project Management</Text></div>
                                            <Text size="sm" secondary={true}>Enable the new Projects sidebar and workspace isolation.</Text>
                                        </div>
                                        <Toggle
                                            checked={isProjectManagementEnabled}
                                            onChange={() => {
                                                const newValue = !isProjectManagementEnabled;
                                                setIsProjectManagementEnabled(newValue);
                                                localStorage.setItem('experimental_projects', newValue.toString());
                                                toast.success(`${newValue ? 'Enabled' : 'Disabled'} Project Management`);
                                            }}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-neutral-100 dark:bg-bg-primary rounded-2xl">
                                        <div className="space-y-1">
                                            <div><Text bold={true}>Agent Collaboration</Text></div>
                                            <Text size="sm" secondary={true}>Enable the "Agent Collaboration" section in agent settings.</Text>
                                        </div>
                                        <Toggle
                                            checked={isAgentCollaborationEnabled}
                                            onChange={() => {
                                                const newValue = !isAgentCollaborationEnabled;
                                                setIsAgentCollaborationEnabled(newValue);
                                                localStorage.setItem('experimental_collaboration', newValue.toString());
                                                toast.success(`${newValue ? 'Enabled' : 'Disabled'} Agent Collaboration`);
                                            }}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-neutral-100 dark:bg-bg-primary rounded-2xl">
                                        <div className="space-y-1">
                                            <div><Text bold={true}>Agent Activity</Text></div>
                                            <Text size="sm" secondary={true}>Enable the "Activity" button in the side bar.</Text>
                                        </div>
                                        <Toggle
                                            checked={isAgentActivityEnabled}
                                            onChange={() => {
                                                const newValue = !isAgentActivityEnabled;
                                                setIsAgentActivityEnabled(newValue);
                                                localStorage.setItem('experimental_activity', newValue.toString());
                                                toast.success(`${newValue ? 'Enabled' : 'Disabled'} Agent Activity`);
                                            }}
                                        />
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                    {activeSettingsSection === 'messaging' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <Card className="space-y-8">
                                <div>
                                    <Text bold={true} size="lg">
                                        <span className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white inline-flex">
                                            <Text size="2xl" className="text-white"><FontAwesomeIcon icon={faWhatsapp} /></Text>
                                        </span>
                                        <Text size="lg" bold={true} className="ml-3">WhatsApp Integration</Text>
                                    </Text>

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
                                                    <Text>
                                                        <br />
                                                        1. Open WhatsApp on your phone
                                                        <br />
                                                        2. Go to Settings {'>'} Linked Devices
                                                        <br />
                                                        3. Tap "Link a Device"
                                                        <br />
                                                        4. Point your phone at this screen
                                                    </Text>
                                                </div>

                                                <div className="w-64 h-64 bg-white dark:bg-bg-primary p-4 rounded-xl flex items-center justify-center">
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
                                </div>
                            </Card>

                            <Card className="space-y-8">
                                <div>
                                    <Text bold={true} size="lg">
                                        <span className="w-10 h-10 rounded-full bg-[#0088cc] flex items-center justify-center text-white inline-flex">
                                            <FontAwesomeIcon icon={faPaperPlane} />
                                        </span>
                                        <Text size="lg" bold={true} className="ml-3">Telegram Integration</Text>
                                    </Text>

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
                                                    <Text>
                                                        <br />
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
                                </div>
                            </Card>
                        </div>
                    )
                    }


                    {
                        activeSettingsSection === 'agents' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex gap-6 border-b border-border-color mb-8 overflow-x-auto whitespace-nowrap scrollbar-none pb-px opacity-80">
                                    {['chat', 'instructions', 'memory'].map(subId => (
                                        <button
                                            key={subId}
                                            className="pb-2 relative flex items-center gap-2 transition-all"
                                            onClick={() => setAgentSubSection(subId as any)}
                                        >
                                            <Text secondary={agentSubSection !== subId} size="xs" bold={true} className="uppercase tracking-widest">{subId}</Text>
                                            {agentSubSection === subId && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary" />}
                                        </button>
                                    ))}
                                </div>

                                {agentSubSection === 'instructions' && (
                                    <form onSubmit={saveConfig} className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <Card className="space-y-6">
                                            <TextArea
                                                label="Global System Prompt"
                                                currentText={config?.global?.systemPrompt || ''}
                                                onChange={(e) => setConfig(prev => prev ? { ...prev, global: { ...(prev.global || {}), systemPrompt: e.target.value } } : null)}
                                                placeholder=""
                                                rows={12}
                                            />
                                            <Button themed={true} className="w-full h-12 text-white" onClick={() => saveConfig()} icon={faSave}>Save System Prompt</Button>
                                        </Card>
                                    </form>
                                )}

                                {agentSubSection === 'memory' && (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <Card className="space-y-8">
                                            <div className="space-y-6">
                                                <div className="bg-white dark:bg-bg-primary rounded-xl p-4 group transition-all space-y-4">
                                                    <div className="flex justify-between items-center">
                                                        <div className="space-y-1">
                                                            <Text bold={true} className="flex items-center gap-2">
                                                                <FontAwesomeIcon icon={faBrain} />Enable Vector Embeddings</Text>
                                                            <Text size="sm" secondary={true} className="block">
                                                                Enhance memory recall using semantic vector search. When disabled, keyword search is used.
                                                            </Text>
                                                        </div>
                                                        <Toggle
                                                            checked={config?.memory?.useEmbeddings || false}
                                                            onChange={() => {
                                                                if (!config) return;
                                                                const newConfig = {
                                                                    ...config,
                                                                    memory: {
                                                                        ...(config.memory || { embeddingsModel: "" }),
                                                                        useEmbeddings: !config.memory?.useEmbeddings
                                                                    }
                                                                };
                                                                setConfig(newConfig);
                                                                saveConfig(undefined, newConfig).then(() => {
                                                                    toast.success(`${newConfig.memory?.useEmbeddings ? 'Enabled' : 'Disabled'} vector embeddings`);
                                                                });
                                                            }}
                                                        />
                                                    </div>

                                                    {config?.memory?.useEmbeddings && (
                                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">

                                                            {/* <div className="mx-auto w-1/2 pt-4 border-t border-border-color animate-in fade-in slide-in-from-top-2 duration-300" /> */}
                                                            <div className="space-y-4">
                                                                <Select
                                                                    label="Embedding Provider"
                                                                    icon={faMicrochip}
                                                                    width="w-full"
                                                                    options={(config?.providers || []).map(p => ({
                                                                        value: p.description || p.model,
                                                                        label: p.description || p.model
                                                                    }))}
                                                                    value={config?.memory?.embeddingsModel || ""}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        if (!config) return;
                                                                        const newConfig = {
                                                                            ...config,
                                                                            memory: {
                                                                                ...(config.memory || { useEmbeddings: true }),
                                                                                embeddingsModel: val
                                                                            }
                                                                        };
                                                                        setConfig(newConfig);
                                                                        saveConfig(undefined, newConfig).then(() => {
                                                                            toast.success(`Embedding provider set to ${val}`);
                                                                        });
                                                                    }}
                                                                />
                                                                <Text size="sm" secondary={true}>
                                                                    Select the provider to use for generating embeddings. Must support OpenAI-compatible <code>/embeddings</code> endpoint.
                                                                </Text>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </Card>
                                    </div>
                                )}

                                {agentSubSection === 'chat' && (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <Card className="space-y-8">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="bg-white dark:bg-bg-primary rounded-xl p-4 flex justify-between items-center group transition-all">
                                                    <div className="space-y-1">
                                                        <Text bold={true} className="flex items-center gap-2">
                                                            <FontAwesomeIcon icon={faBrain} />
                                                            Show Thought Process
                                                        </Text>
                                                        <Text size="sm" secondary={true}>Display reasoning blocks if available</Text>
                                                    </div>
                                                    <Toggle
                                                        checked={config?.chat.showReasoning || false}
                                                        onChange={() => {
                                                            if (!config) return;
                                                            const newConfig = { ...config, chat: { ...config.chat, showReasoning: !config.chat.showReasoning } };
                                                            setConfig(newConfig);
                                                            saveConfig(undefined, newConfig).then(() => {
                                                                toast.success(`${newConfig.chat.showReasoning ? 'Enabled' : 'Disabled'} thought process display`);
                                                            });
                                                        }}
                                                    />
                                                </div>

                                                <div className="bg-white dark:bg-bg-primary rounded-xl p-4 flex justify-between items-center group transition-all">
                                                    <div className="space-y-1">
                                                        <Text bold={true} className="flex items-center gap-2">
                                                            <FontAwesomeIcon icon={faHistory} />
                                                            Stateful Conversations
                                                        </Text>
                                                        <Text size="sm" secondary={true}>Preserve context across multiple message turns</Text>
                                                    </div>
                                                    <Toggle
                                                        checked={config?.chat.includeHistory || false}
                                                        onChange={() => {
                                                            if (!config) return;
                                                            const newConfig = { ...config, chat: { ...config.chat, includeHistory: !config.chat.includeHistory } };
                                                            setConfig(newConfig);
                                                            saveConfig(undefined, newConfig).then(() => {
                                                                toast.success(`${newConfig.chat.includeHistory ? 'Enabled' : 'Disabled'} stateful conversations`);
                                                            });
                                                        }}
                                                    />
                                                </div>

                                                <div className="bg-white dark:bg-bg-primary rounded-xl p-4 flex justify-between items-center group transition-all">
                                                    <div className="space-y-1">
                                                        <Text bold={true} className="flex items-center gap-2">
                                                            <FontAwesomeIcon icon={faFileText} />
                                                            Generate Chat Summaries
                                                        </Text>
                                                        <Text size="sm" secondary={true}>Summarize long conversations for better context retention</Text>
                                                    </div>
                                                    <Toggle
                                                        checked={config?.chat.generateSummaries || false}
                                                        onChange={() => {
                                                            if (!config) return;
                                                            const newConfig = { ...config, chat: { ...config.chat, generateSummaries: !config.chat.generateSummaries } };
                                                            setConfig(newConfig);
                                                            saveConfig(undefined, newConfig).then(() => {
                                                                toast.success(`${newConfig.chat.generateSummaries ? 'Enabled' : 'Disabled'} chat summaries`);
                                                            });
                                                        }}
                                                    />
                                                </div>

                                                <div className="bg-white dark:bg-bg-primary rounded-xl p-4 flex justify-between items-center group transition-all">
                                                    <div className="space-y-1">
                                                        <Text bold={true} className="flex items-center gap-2">
                                                            <FontAwesomeIcon icon={faGaugeHigh} />Show Token Statistics</Text>
                                                        <Text size="sm" secondary={true}>Display generation speed (TPS) and token counts on AI messages</Text>
                                                    </div>
                                                    <Toggle
                                                        checked={config?.chat.showTokenMetrics || false}
                                                        onChange={() => {
                                                            if (!config) return;
                                                            const newConfig = { ...config, chat: { ...config.chat, showTokenMetrics: !config.chat.showTokenMetrics } };
                                                            setConfig(newConfig);
                                                            saveConfig(undefined, newConfig).then(() => {
                                                                toast.success(`${newConfig.chat.showTokenMetrics ? 'Enabled' : 'Disabled'} token statistics`);
                                                            });
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </Card>
                                    </div>
                                )}
                            </div>
                        )
                    }



                    {
                        activeSettingsSection === 'tools' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <Card className="space-y-6">
                                    <div className="flex items-center gap-2">
                                        <Text>
                                            <FontAwesomeIcon icon={faWrench} />
                                        </Text>
                                        <Text bold={true} size="lg">Available Skills & Tools</Text>
                                    </div>

                                    <Text secondary={true} size="sm">
                                        These are the capabilities currently discovered by the Gateway. Agents can autonomously choose use these tools to interact with your environment.
                                    </Text>

                                    <div className="space-y-3 text-left">
                                        {tools.map(tool => (
                                            <div key={tool.name} className="p-4 bg-white dark:bg-bg-primary rounded-2xl space-y-0 group transition-all relative">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        <Text bold={true} size="lg" className="truncate">{tool.displayName || tool.name}</Text>
                                                        <Badge className="shrink-0">Plugin</Badge>
                                                    </div>

                                                    <div className="flex-1 flex justify-center">
                                                        {tool.hasReadme && tool.filename && (
                                                            <Button
                                                                size="sm"
                                                                icon={faInfoCircle}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setLoadingReadme(true);
                                                                    fetch(`${gatewayAddr.replace(/\/$/, '')}/api/tools/readme?path=${encodeURIComponent(tool.filename!)}`, {
                                                                        headers: {
                                                                            'Authorization': `Bearer ${gatewayToken}`
                                                                        }
                                                                    })
                                                                        .then(res => res.json())
                                                                        .then(data => {
                                                                            if (data.content) {
                                                                                const toolDir = tool.filename!.split(/[\/\\]/).slice(0, -1).join('/');
                                                                                const processedContent = data.content.replace(/!\[(.*?)\]\((?!http|https|\/)(.*?)\)/g, (match: string, alt: string, imagePath: string) => {
                                                                                    const fullImagePath = toolDir ? `${toolDir}/${imagePath}` : imagePath;
                                                                                    return `![${alt}](/api/tools/files?path=${encodeURIComponent(fullImagePath)})`;
                                                                                });
                                                                                setViewingReadme({ name: tool.name, content: processedContent });
                                                                            } else {
                                                                                toast.error("Failed to load README content");
                                                                            }
                                                                        })
                                                                        .catch(err => {
                                                                            console.error(err);
                                                                            toast.error("Error fetching README");
                                                                        })
                                                                        .finally(() => setLoadingReadme(false));
                                                                }}
                                                                disabled={loadingReadme}
                                                            >
                                                                Read Documentation
                                                            </Button>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center shrink-0">
                                                        <Toggle
                                                            checked={tool.filename ? (config?.enabledTools?.[tool.filename] ?? false) : true}
                                                            onChange={() => {
                                                                if (!tool.filename || !config) return;
                                                                const filename = tool.filename;
                                                                const enabledStatus = config.enabledTools?.[filename] ?? false;

                                                                const newConfig: Config = {
                                                                    ...config,
                                                                    enabledTools: {
                                                                        ...(config.enabledTools || {}),
                                                                        [filename]: !enabledStatus
                                                                    }
                                                                };

                                                                setConfig(newConfig);
                                                                saveConfig(undefined, newConfig).then(() => {
                                                                    toast.success(`${!enabledStatus ? 'Enabled' : 'Disabled'} ${tool.name}`);
                                                                }).catch(err => {
                                                                    toast.error(`Failed to update ${tool.name}`);
                                                                    console.error(err);
                                                                });
                                                            }}
                                                            disabled={!tool.filename}
                                                            title={!tool.filename ? "This is a core system function and cannot be deactivated." : undefined}
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <Text size="sm" secondary={true}>{tool.description}</Text>
                                                </div>

                                                <div className="pt-4 flex items-center gap-3">
                                                    <Text className="uppercase shrink-0" size="xs" bold={true}>Parameters</Text>
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.keys(tool.parameters.properties).map(prop => (
                                                            <Badge key={prop} className="font-mono py-0 text-[10px]">
                                                                {prop}
                                                                {tool.parameters.required?.includes(prop) && <span className="text-red-500 ml-0.5">*</span>}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </div>
                        )
                    }


                    {
                        activeSettingsSection === 'about' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex gap-6 border-b border-border-color mb-8 overflow-x-auto whitespace-nowrap scrollbar-none pb-px opacity-80">
                                    {['version', 'config'].map(subId => (
                                        <button
                                            key={subId}
                                            className="pb-2 relative flex items-center gap-2 transition-all"
                                            onClick={() => setAboutSubSection(subId as any)}
                                        >
                                            <Text secondary={aboutSubSection !== subId} size="xs" bold={true} className="uppercase tracking-widest">{subId}</Text>
                                            {aboutSubSection === subId && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary" />}
                                        </button>
                                    ))}
                                </div>

                                {aboutSubSection === 'version' && (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <Card className="space-y-8">
                                            <div className="flex flex-col items-center justify-center py-10 gap-6 text-center">
                                                {/* <div className="w-24 h-24 rounded-3xl bg-accent-primary flex items-center justify-center shadow-lg shadow-accent-primary/20">
                                        <FontAwesomeIcon icon={faBrain} className="text-white text-4xl" />
                                    </div> */}

                                                <div className="space-y-2">
                                                    <Text size="3xl" bold={true}>OpenKIWI</Text>
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Text secondary={true}>Version {config?.system?.version || 'Unknown'}</Text>
                                                        <Badge className="uppercase">beta</Badge>
                                                    </div>
                                                </div>

                                                <div className="w-full max-w-md pt-6 border-t border-border-color">
                                                    <Button
                                                        themed={true}
                                                        className="w-full h-12 text-lg"
                                                        onClick={handleCheckUpdate}
                                                        disabled={isCheckingUpdates}
                                                        icon={isCheckingUpdates ? undefined : faInfoCircle}
                                                    >
                                                        {isCheckingUpdates ? (
                                                            <div className="flex items-center gap-2">
                                                                <Loader2 size={20} className="animate-spin" />
                                                                Checking for update...
                                                            </div>
                                                        ) : "Check for Updates"}
                                                    </Button>
                                                </div>

                                                {hasChecked && config?.system && (
                                                    <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                        {config.system.version === config.system.latestVersion ? (
                                                            <div className="flex items-center bg-emerald-500/20 p-2 rounded-xl">
                                                                <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-500 dark:text-emerald-400 mr-2" />
                                                                <Text className="text-emerald-500 dark:text-emerald-400" bold={true}>You are running the latest version</Text>
                                                            </div>
                                                        ) : config?.system?.latestVersion && config?.system?.version && config.system.latestVersion > config.system.version ? (
                                                            <div className="flex items-center bg-amber-500/20 p-2 rounded-xl">
                                                                <FontAwesomeIcon icon={faCheckCircle} className="text-amber-500 dark:text-amber-400 mr-2" />
                                                                <Text className="text-amber-500 dark:text-amber-400" bold={true}>Update Available: {config.system.latestVersion}</Text>
                                                            </div>
                                                        ) : config.system.latestVersion ? (
                                                            <div className="flex items-center bg-neutral-500/20 p-2 rounded-xl">
                                                                <Text bold={true}>
                                                                    <FontAwesomeIcon icon={faInfoCircle} className="mr-2" />
                                                                    Latest Version: {config.system.latestVersion}
                                                                </Text>
                                                            </div>
                                                        ) : (
                                                            <div className="text-neutral-500 text-sm italic">
                                                                Check finished but no remote version was found.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {config?.system?.latestVersion && config?.system?.version && config.system.latestVersion > config.system.version && (
                                                    <div className="text-left animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                        <div className="space-y-6 p-2 rounded-2xl">
                                                            <Text bold={true} size="xl">Upgrade Steps</Text>

                                                            <section className="space-y-3">
                                                                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                                                                    <span className="mr-2 w-6 h-6 rounded-full bg-neutral-700 dark:bg-white text-white dark:text-neutral-800 flex items-center justify-center text-xs">1</span>
                                                                    <Text size="lg" bold={true}>Stop services</Text>
                                                                </h3>
                                                                <Text><Badge>cd</Badge> to the directory where you have the <Badge>docker-compose.yml</Badge> file</Text>
                                                                <MarkdownRenderer content={"```bash\ndocker compose down\n```"} />
                                                                <Text>Or <Badge>CTRL + C</Badge> in the terminal where the services are running</Text>
                                                            </section>

                                                            <section className="space-y-3">
                                                                <h3 className="text-lg font-bold flex items-center gap-2">
                                                                    <span className="mr-2 w-6 h-6 rounded-full bg-neutral-700 dark:bg-white text-white dark:text-neutral-800 flex items-center justify-center text-xs">2</span>
                                                                    <Text size="lg" bold={true}>Update your local copy</Text>
                                                                </h3>
                                                                <MarkdownRenderer content={"```bash\rgit pull\r\n```"} />
                                                            </section>

                                                            <section className="space-y-3">
                                                                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                                                                    <span className="mr-2 w-6 h-6 rounded-full bg-neutral-700 dark:bg-white text-white dark:text-neutral-800 flex items-center justify-center text-xs">3</span>
                                                                    <Text size="lg" bold={true}>Restart the services</Text>
                                                                </h3>
                                                                <Text>To run services in foreground use:</Text>
                                                                <MarkdownRenderer content={"```bash\ndocker compose up --build\n```"} />
                                                                <Text>To run services in background use:</Text>
                                                                <MarkdownRenderer content={"```bash\ndocker compose up --detach --build\n```"} />
                                                            </section>

                                                            <section className="space-y-3">
                                                                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                                                                    <span className="mr-2 w-6 h-6 rounded-full bg-neutral-700 dark:bg-white text-white dark:text-neutral-800 flex items-center justify-center text-xs">4</span>
                                                                    <Text size="lg" bold={true}>Reload the UI</Text>
                                                                </h3>
                                                                <Text>Refresh your browser tab once the gateway is back online to see the latest changes.</Text>
                                                                <p className="text-center text-4xl">🎉</p>
                                                            </section>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    </div>
                                )}

                                {aboutSubSection === 'config' && (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <Card>
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2">
                                                    <Text bold={true} size="lg">config/config.json</Text>
                                                </div>

                                                <Text secondary={true} size="sm">
                                                    Raw configuration file contents. Changes made through the UI are saved to this file.
                                                </Text>
                                                <br />
                                                <Text size="sm" secondary={true}>
                                                    Editing this file manually is not recommended.
                                                </Text>

                                                <pre className="bg-white dark:bg-bg-primary rounded-xl p-6 overflow-x-auto text-sm font-mono leading-relaxed">
                                                    <Text size="sm">
                                                        <code>{JSON.stringify(publicConfig || config, null, 2)}</code>
                                                    </Text>
                                                </pre>
                                            </div>
                                        </Card>
                                    </div>
                                )}
                            </div>
                        )
                    }

                    {
                        viewingReadme && (
                            <Modal
                                isOpen={!!viewingReadme}
                                onClose={() => setViewingReadme(null)}
                                title={`${viewingReadme.name} Documentation`}
                            >
                                <div className="max-h-[70vh] overflow-y-auto p-10 bg-neutral-100 dark:bg-neutral-800 rounded-2xl m-4">
                                    <MarkdownRenderer content={viewingReadme.content} />
                                </div>
                            </Modal>
                        )
                    }
                </div >
            )}
        </Page >
    );
}
