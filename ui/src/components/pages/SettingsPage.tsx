import { toast } from 'sonner'
import Page from './Page'
import { faHistory, faMicrochip, faWrench } from '@fortawesome/free-solid-svg-icons'
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
    faFileCode
} from '@fortawesome/free-solid-svg-icons'
import { Loader2 } from 'lucide-react'

// Re-using types from App.tsx - ideally these should be moved to a types.ts file
interface Config {

    chat: {
        showReasoning: boolean;
        includeHistory: boolean;
        generateSummaries: boolean;
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
    saveConfig: (e?: React.FormEvent) => Promise<void>;
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
    whatsappStatus: { connected: boolean, qrCode: string | null };
    onLogoutWhatsApp: () => Promise<void>;
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
    onLogoutWhatsApp
}: SettingsPageProps) {

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
                                <div className="bg-bg-primary">
                                    <Text bold={true} size="lg">
                                        <span className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white">
                                            <FontAwesomeIcon icon={faComments} />
                                        </span>
                                        WhatsApp Integration
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
                                                    <Text>
                                                        Scan the QR code below with your phone to link WhatsApp.
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

                                                <div className="w-64 h-64 bg-white p-4 rounded-xl flex items-center justify-center border border-border-color shadow-sm">
                                                    {whatsappStatus.qrCode ? (
                                                        <img src={whatsappStatus.qrCode} alt="WhatsApp QR Code" className="w-full h-full object-contain" />
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2 text-neutral-400">
                                                            <Loader2 className="animate-spin" />
                                                            <span className="text-xs">Generating QR...</span>
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

                                    <div className="bg-bg-primary border border-border-color rounded-xl p-4 group transition-all space-y-4">
                                        <div className="flex justify-between items-center">
                                            <div className="space-y-1">
                                                <Text bold={true} className="flex items-center gap-2">
                                                    <FontAwesomeIcon icon={faBrain} />
                                                    Enable Vector Embeddings
                                                </Text>
                                                <Text size="sm" secondary={true} className="block">
                                                    Enhance memory recall using semantic vector search. When disabled, keyword search is used.
                                                </Text>
                                            </div>
                                            <Toggle
                                                checked={config?.memory?.useEmbeddings || false}
                                                onChange={() => setConfig(prev => prev ? {
                                                    ...prev,
                                                    memory: {
                                                        ...(prev.memory || { embeddingsModel: "" }),
                                                        useEmbeddings: !prev.memory?.useEmbeddings
                                                    }
                                                } : null)}
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
                                                            setConfig(prev => prev ? {
                                                                ...prev,
                                                                memory: {
                                                                    ...(prev.memory || { useEmbeddings: true }),
                                                                    embeddingsModel: val
                                                                }
                                                            } : null);
                                                        }}
                                                    />
                                                    <Text size="sm" secondary={true}>
                                                        Select the provider to use for generating embeddings. Must support OpenAI-compatible <code>/embeddings</code> endpoint.
                                                    </Text>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <Button themed={true} className="w-full h-12 text-white" onClick={async () => {
                                        await saveConfig();
                                        toast.success("Memory preferences saved");
                                    }} icon={faSave}>Save Settings</Button>
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
                                <Button themed={true} className="w-full h-12 text-white" onClick={() => saveConfig()} icon={faSave}>Save Agent Configurations</Button>
                            </Card>
                        </form>
                    )}



                    {activeSettingsSection === 'tools' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <Card className="space-y-6">
                                <div className="flex items-center gap-3">
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
                                        <div key={tool.name} className="p-6 bg-bg-primary border border-border-color rounded-2xl space-y-3 group hover:border-accent-primary/50 transition-all">
                                            <div className="flex justify-between items-start">
                                                <Text bold={true} size="lg">{tool.name}</Text>
                                                <Badge>Plugin</Badge>
                                            </div>
                                            <Text size="sm" secondary={true}>{tool.description}</Text>
                                            <div className="pt-2">
                                                <Text className="uppercase" size="xs" bold={true}>Parameters</Text>
                                                <div className="flex flex-wrap gap-2">
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
                                    <div className="border border-border-color rounded-xl p-4 flex justify-between items-center group transition-all">
                                        <div className="space-y-1">
                                            <Text bold={true} className="flex items-center gap-2">
                                                <FontAwesomeIcon icon={faBrain} />
                                                Show Thought Process
                                            </Text>
                                            <Text size="sm" secondary={true}>Display reasoning blocks if available</Text>
                                        </div>
                                        <Toggle
                                            checked={config?.chat.showReasoning || false}
                                            onChange={() => setConfig(prev => prev ? { ...prev, chat: { ...prev.chat, showReasoning: !prev.chat.showReasoning } } : null)}
                                        />
                                    </div>

                                    <div className="bg-bg-primary border border-border-color rounded-xl p-4 flex justify-between items-center group transition-all">
                                        <div className="space-y-1">
                                            <Text bold={true} className="flex items-center gap-2">
                                                <FontAwesomeIcon icon={faHistory} />
                                                Stateful Conversations
                                            </Text>
                                            <Text size="sm" secondary={true}>Preserve context across multiple message turns</Text>
                                        </div>
                                        <Toggle
                                            checked={config?.chat.includeHistory || false}
                                            onChange={() => setConfig(prev => prev ? { ...prev, chat: { ...prev.chat, includeHistory: !prev.chat.includeHistory } } : null)}
                                        />
                                    </div>

                                    <div className="bg-bg-primary border border-border-color rounded-xl p-4 flex justify-between items-center group transition-all">
                                        <div className="space-y-1">
                                            <Text bold={true} className="flex items-center gap-2">
                                                <FontAwesomeIcon icon={faFileText} />
                                                Generate Chat Summaries
                                            </Text>
                                            <Text size="sm" secondary={true}>Summarize long conversations for better context retention</Text>
                                        </div>
                                        <Toggle
                                            checked={config?.chat.generateSummaries || false}
                                            onChange={() => setConfig(prev => prev ? { ...prev, chat: { ...prev.chat, generateSummaries: !prev.chat.generateSummaries } } : null)}
                                        />
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-border-color">
                                    <Button
                                        themed={true}
                                        className="w-full h-12 text-white"
                                        onClick={(e) => saveConfig(e)}
                                        icon={faSave}
                                    >
                                        Save Chat Configurations
                                    </Button>
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
                                    <pre className="bg-bg-primary border border-border-color rounded-xl p-6 overflow-x-auto text-sm font-mono leading-relaxed">
                                        <Text size="sm">
                                            <code>{JSON.stringify(config, null, 2)}</code>
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
