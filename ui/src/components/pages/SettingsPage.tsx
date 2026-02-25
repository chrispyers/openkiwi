import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import Page from './Page'
import { faHistory, faMicrochip, faWrench } from '@fortawesome/free-solid-svg-icons'
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
    faGaugeHigh
} from '@fortawesome/free-solid-svg-icons'
import { Loader2 } from 'lucide-react'

// Re-using types from App.tsx - ideally these should be moved to a types.ts file
interface Config {

    chat: {
        showReasoning: boolean;
        includeHistory: boolean;
        generateSummaries: boolean;
        showTokenMetrics: boolean;
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
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
    filename?: string;
    isRegistered?: boolean;
}

interface SettingsPageProps {
    activeSettingsSection: 'agents' | 'general' | 'tools' | 'chat' | 'config' | 'messaging';
    setActiveSettingsSection: (section: 'agents' | 'general' | 'tools' | 'chat' | 'config' | 'messaging') => void;
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
    agentForm: { name: string; emoji: string; provider?: string; heartbeat?: { enabled: boolean; schedule: string; } };
    setAgentForm: React.Dispatch<React.SetStateAction<{ name: string; emoji: string; provider?: string; heartbeat?: { enabled: boolean; schedule: string; } }>>;
    saveAgentConfig: () => Promise<void>;
    setViewingFile: (file: { title: string, content: string, isEditing: boolean, agentId: string } | null) => void;
    tools: ToolDefinition[];
    whatsappStatus: { connected: boolean, qrCode: string | null, isInitializing?: boolean };
    onLogoutWhatsApp: () => Promise<void>;
    onConnectWhatsApp: () => Promise<void>;
    gatewayAddr: string;
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
    gatewayAddr
}: SettingsPageProps) {
    const [publicConfig, setPublicConfig] = useState<any>(null);

    useEffect(() => {
        if (activeSettingsSection === 'config') {
            fetch(`${gatewayAddr.replace(/\/$/, '')}/api/config/public`)
                .then(res => res.json())
                .then(data => setPublicConfig(data))
                .catch(err => console.error('Failed to fetch public config:', err));
        }
    }, [activeSettingsSection, gatewayAddr]);

    return (
        <Page
            title="Settings"
            subtitle="Manage your gateway, providers, and agent personalities."
        >
            <nav className="flex gap-6 border-b border-border-color mb-10 overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
                {['agents', 'general', 'tools', 'chat', 'messaging', 'config'].map(id => (
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

            {/* <nav className="flex gap-2 mb-10 overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
                {['agents', 'general', 'tools', 'chat', 'messaging', 'config'].map(id => (
                    <Button
                        size="sm"
                        key={id}
                        className={`uppercase`}
                        onClick={() => setActiveSettingsSection(id as any)}
                        themed={activeSettingsSection === id ? true : false}
                    >{id}</Button>
                ))}
            </nav> */}

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                    <Loader2 size={40} className="animate-spin text-accent-primary" />
                    <p className="font-medium">Synchronizing configuration...</p>
                </div>
            ) : (
                <div className="max-w-5xl">
                    {activeSettingsSection === 'general' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            {/* ... General Section Content ... */}
                        </div>
                    )}

                    {/* ... other sections ... */}

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
                        </div>
                    )}

                    {activeSettingsSection === 'general' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
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
                                            <div className="pt-4 border-t border-border-color animate-in fade-in slide-in-from-top-2 duration-300">
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

                    {activeSettingsSection === 'agents' && (
                        <form onSubmit={saveConfig} className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
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



                    {activeSettingsSection === 'tools' && (
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

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 text-left">
                                    {tools.map(tool => (
                                        <div key={tool.name} className="p-6 bg-white dark:bg-bg-primary rounded-2xl space-y-3 group hover:border-accent-primary/50 transition-all relative">
                                            <div className="flex justify-between items-start pr-12">
                                                <div className="flex items-center gap-2">
                                                    <Text bold={true} size="lg">{tool.name}</Text>
                                                    <Badge>Plugin</Badge>
                                                </div>
                                                <div className="absolute top-5 right-0">
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
                                                        title={!tool.filename ? "This is a core system skill that is always enabled and cannot be deactivated." : undefined}
                                                    />
                                                </div>
                                            </div>
                                            <div className="pt-0">
                                                <Text size="sm" secondary={true}>{tool.description}</Text>
                                            </div>
                                            <div className="pt-0">
                                                <Text className="uppercase" size="xs" bold={true}>Parameters</Text>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {Object.keys(tool.parameters.properties).map(prop => (
                                                        <Badge key={prop} className="font-mono">
                                                            {prop}
                                                            {tool.parameters.required?.includes(prop) && <span className="text-red-500 ml-1">*</span>}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    )}

                    {activeSettingsSection === 'chat' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
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

                    {activeSettingsSection === 'config' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <Card className="space-y-8">
                                <div className="flex items-center gap-3">
                                    <Text size="2xl">
                                        <FontAwesomeIcon icon={faFileCode} />
                                        <Text bold={true} size="xl" className="ml-2">config.json</Text>
                                    </Text>
                                </div>
                                <div className="space-y-4">
                                    <Text>
                                        Raw configuration file contents. Changes made through the UI are saved to this file.
                                    </Text>
                                    <pre className="bg-white dark:bg-bg-primary border border-border-color rounded-xl p-6 overflow-x-auto text-sm font-mono leading-relaxed">
                                        <Text size="sm">
                                            <code>{JSON.stringify(publicConfig || config, null, 2)}</code>
                                        </Text>
                                    </pre>
                                </div>
                            </Card>
                        </div>
                    )}
                </div>
            )}

        </Page >
    )
}
