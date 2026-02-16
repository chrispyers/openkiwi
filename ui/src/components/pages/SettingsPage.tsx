import { useState } from 'react'
import {
    MessageSquare,
    Cpu,
    History,
    Terminal,
    Globe,
    Brain,
    BrainCircuit,
    FileText,
    Wrench,
    RefreshCw,
    Monitor,
    Layout
} from 'lucide-react'
import Page from './Page'
import { useTheme } from '../../contexts/ThemeContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Button from '../Button'
import Input from '../Input'
import Select from '../Select'
import Toggle from '../Toggle'
import Text from '../Text'
import Card from '../Card'
import IconBox from '../IconBox'
import Badge from '../Badge'
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
    faCube
} from '@fortawesome/free-solid-svg-icons'
import { Loader2 } from 'lucide-react'

// Re-using types from App.tsx - ideally these should be moved to a types.ts file
interface Config {

    chat: {
        showReasoning: boolean;
        includeHistory: boolean;
        generateSummaries: boolean;
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
    activeSettingsSection: 'agents' | 'gateway' | 'general' | 'tools' | 'chat' | 'config';
    setActiveSettingsSection: (section: 'agents' | 'gateway' | 'general' | 'tools' | 'chat' | 'config') => void;
    isGatewayConnected: boolean;
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
    agentForm: { name: string; emoji: string; provider?: string };
    setAgentForm: React.Dispatch<React.SetStateAction<{ name: string; emoji: string; provider?: string }>>;
    saveAgentConfig: () => Promise<void>;
    setViewingFile: (file: { title: string, content: string, isEditing: boolean, agentId: string } | null) => void;
    gatewayAddr: string;
    setGatewayAddr: (addr: string) => void;
    gatewayToken: string;
    setGatewayToken: (token: string) => void;
    initializeApp: (isSilent?: boolean) => Promise<void>;
    connectedClients: any[];
    fetchConnectedClients: () => Promise<void>;
    fetchModels: () => Promise<boolean | void>;
    tools: ToolDefinition[];
}

export default function SettingsPage({
    activeSettingsSection,
    setActiveSettingsSection,
    isGatewayConnected,
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
    gatewayAddr,
    setGatewayAddr,
    gatewayToken,
    setGatewayToken,
    initializeApp,
    connectedClients,
    fetchConnectedClients,
    fetchModels,
    tools
}: SettingsPageProps) {

    return (
        <Page
            title="Settings"
            subtitle="Manage your gateway, providers, and agent personalities."
        >
            <nav className="flex gap-8 border-b border-border-color mb-10 overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
                {['agents', 'gateway', 'general', 'tools', 'chat', 'config'].map(id => (
                    <button
                        key={id}
                        className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all duration-300 relative flex items-center gap-2 ${activeSettingsSection === id ? 'text-accent-primary' : ' hover:text-neutral-600 dark:text-white'}`}
                        onClick={() => setActiveSettingsSection(id as any)}
                    >
                        {id === 'gateway' && (
                            <span className={`w-2 h-2 rounded-full ${isGatewayConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} />
                        )}
                        {id}
                        {activeSettingsSection === id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary shadow-[0_0_10px_rgba(99,102,241,0.5)]" />}
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
                    {activeSettingsSection === 'general' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <Card className="space-y-8">
                                <div className="flex items-center gap-3">
                                    <IconBox icon={<Layout size={20} />} />
                                    <Text bold={true} size="xl">General Settings</Text>
                                </div>


                            </Card>
                        </div>
                    )}

                    {activeSettingsSection === 'agents' && (
                        <form onSubmit={saveConfig} className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <Card className="space-y-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <IconBox icon={<BrainCircuit size={20} />} />
                                    <Text bold={true} size="xl">Agent Configuration</Text>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"><Terminal size={14} /> Global System Prompt</label>
                                    <textarea
                                        className="w-full bg-bg-primary border border-border-color rounded-xl px-5 py-4 outline-none focus:border-accent-primary transition-all text-sm h-32 custom-scrollbar resize-none"
                                        value={config?.global?.systemPrompt || ''}
                                        onChange={(e) => setConfig(prev => prev ? { ...prev, global: { ...(prev.global || {}), systemPrompt: e.target.value } } : null)}
                                        placeholder="Describe how the AI should behave globally..."
                                    />
                                </div>
                                <Button themed={true} className="w-full h-12 text-white" onClick={() => saveConfig()} icon={faSave}>Save Agent Configurations</Button>
                            </Card>
                        </form>
                    )}

                    {activeSettingsSection === 'gateway' && (
                        <form onSubmit={saveConfig} className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <Card className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <IconBox icon={<Cpu size={20} />} />
                                    <h2 className="text-xl font-bold">Platform Gateway</h2>
                                </div>

                                <div className="pt-4">
                                    <div className="w-full space-y-6">
                                        <label className="text-md font-bold uppercase tracking-wider flex items-center gap-2">
                                            <FontAwesomeIcon icon={faGlobe} /> Connection & Networking
                                        </label>
                                        <div className="space-y-6">
                                            <p className="text-md leading-relaxed">
                                                Specify the address of your gateway. For local development, use <code className="text-accent-primary">http://localhost:3808</code>.
                                            </p>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <Input
                                                    label="Endpoint"
                                                    currentText={gatewayAddr}
                                                    onChange={e => setGatewayAddr(e.target.value)}
                                                    placeholder="http://localhost:3808"
                                                    icon={faGlobe}
                                                    clearText={() => setGatewayAddr('')}
                                                    className="!mt-0"
                                                />
                                                <Input
                                                    label="Token"
                                                    currentText={gatewayToken}
                                                    onChange={e => setGatewayToken(e.target.value)}
                                                    placeholder="Secret Token"
                                                    icon={faLock}
                                                    clearText={() => setGatewayToken('')}
                                                    className="!mt-0"
                                                />
                                            </div>


                                            <p className="text-xs text-neutral-500 dark:text-neutral-400 italic">
                                                Changes to endpoint or token will only take effect after clicking "Connect to Gateway"
                                            </p>

                                            <Button
                                                themed={true}
                                                onClick={() => initializeApp()}
                                                disabled={!gatewayAddr || !gatewayToken}
                                                className="w-full h-12 text-white"
                                                icon={faPlug}
                                            >
                                                Connect to Gateway
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-8 border-t border-border-color space-y-6">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                            <FontAwesomeIcon icon={faDesktop} /> Connected Computers ({connectedClients.length})
                                        </label>
                                        <button
                                            onClick={(e) => { e.preventDefault(); fetchConnectedClients(); }}
                                            className="text-xs font-bold uppercase tracking-widest text-accent-primary hover:text-accent-primary/80 flex items-center gap-1 transition-colors"
                                        >
                                            <RefreshCw size={10} /> Refresh List
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        {connectedClients.length === 0 ? (
                                            <div className="p-8 bg-bg-primary/50 border border-dashed border-border-color rounded-2xl text-center">
                                                <p className="text-xs italic">No other computers currently connected to this gateway.</p>
                                            </div>
                                        ) : (
                                            connectedClients.map((client, idx) => (
                                                <div key={idx} className="bg-bg-primary border border-border-color rounded-2xl p-4 flex items-center justify-between group hover:border-accent-primary/50 transition-all">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-white-trans flex items-center justify-center group-hover:text-accent-primary group-hover:bg-accent-primary/10 transition-all">
                                                            <Monitor size={20} />
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="font-bold text-sm">{client.hostname}</div>
                                                            <div className="text-xs font-mono flex items-center gap-2">
                                                                <Globe size={10} /> {client.ip}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs font-bold uppercase tracking-tighter text-neutral-600 dark:text-white/40 mb-1">Connected Since</div>
                                                        <div className="text-xs font-medium">
                                                            {new Date(client.connectedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </Card>
                        </form>
                    )}

                    {activeSettingsSection === 'tools' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <Card className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <IconBox icon={<Wrench size={20} />} />
                                    <h2 className="text-xl font-bold">Available Skills & Tools</h2>
                                </div>

                                <p className="text-sm leading-relaxed max-w-2xl text-left">
                                    These are the capabilities currently discovered by the Gateway. Agents can autonomously choose use these tools to interact with your environment.
                                </p>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 text-left">
                                    {tools.map(tool => (
                                        <div key={tool.name} className="p-6 bg-bg-primary border border-border-color rounded-2xl space-y-3 group hover:border-accent-primary/50 transition-all">
                                            <div className="flex justify-between items-start">
                                                <h3 className="font-bold group-hover:text-accent-primary transition-colors">{tool.name}</h3>
                                                <Badge>Plugin</Badge>
                                            </div>
                                            <p className="text-sm leading-relaxed line-clamp-2">{tool.description}</p>
                                            <div className="pt-2">
                                                <div className="text-xs font-bold uppercase tracking-tighter text-neutral-600 dark:text-white/40 mb-2">Parameters</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.keys(tool.parameters.properties).map(prop => (
                                                        <Badge key={prop} variant="accent" className="font-mono">
                                                            {prop}
                                                            {tool.parameters.required?.includes(prop) && <span className="text-rose-500 ml-0.5">*</span>}
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
                                <div className="flex items-center gap-3">
                                    <IconBox icon={<MessageSquare size={20} />} />
                                    <Text bold={true} size="xl">Chat Settings</Text>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-bg-primary border border-border-color rounded-xl p-4 flex justify-between items-center group transition-all">
                                        <div className="space-y-1">
                                            <h3 className="text-sm font-bold text-neutral-600 dark:text-white flex items-center gap-2 group-hover:text-accent-primary transition-colors">
                                                <Brain size={14} /> Show Thought Process
                                            </h3>
                                            <p className="text-xs">Display reasoning blocks if available</p>
                                        </div>
                                        <Toggle
                                            checked={config?.chat.showReasoning || false}
                                            onChange={() => setConfig(prev => prev ? { ...prev, chat: { ...prev.chat, showReasoning: !prev.chat.showReasoning } } : null)}
                                        />
                                    </div>

                                    <div className="bg-bg-primary border border-border-color rounded-xl p-4 flex justify-between items-center group transition-all">
                                        <div className="space-y-1">
                                            <h3 className="text-sm font-bold text-neutral-600 dark:text-white flex items-center gap-2 group-hover:text-accent-primary transition-colors"><History size={14} /> Stateful Conversations</h3>
                                            <p className="text-xs">Preserve context across multiple message turns</p>
                                        </div>
                                        <Toggle
                                            checked={config?.chat.includeHistory || false}
                                            onChange={() => setConfig(prev => prev ? { ...prev, chat: { ...prev.chat, includeHistory: !prev.chat.includeHistory } } : null)}
                                        />
                                    </div>

                                    <div className="bg-bg-primary border border-border-color rounded-xl p-4 flex justify-between items-center group transition-all">
                                        <div className="space-y-1">
                                            <h3 className="text-sm font-bold text-neutral-600 dark:text-white flex items-center gap-2 group-hover:text-accent-primary transition-colors">
                                                <FileText size={14} /> Generate Chat Summaries
                                            </h3>
                                            <p className="text-xs">Summarize long conversations for better context retention</p>
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
                                    <IconBox icon={<FileText size={20} />} />
                                    <Text bold={true} size="xl">config.json</Text>
                                </div>
                                <div className="space-y-4">
                                    <p className="text-sm">
                                        Raw configuration file contents. Changes made through the UI are saved to this file.
                                    </p>
                                    <pre className="bg-bg-primary border border-border-color rounded-xl p-6 overflow-x-auto text-sm font-mono leading-relaxed">
                                        <code>{JSON.stringify(config, null, 2)}</code>
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
