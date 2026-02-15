import { useState } from 'react'
import {
    MessageSquare,
    Cpu,
    History,
    Terminal,
    Globe,
    BrainCircuit,
    FileText,
    Wrench,
    RefreshCw,
    Monitor,
    Layout
} from 'lucide-react'
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
    lmStudio: {
        baseUrl: string;
        modelId: string;
        showReasoning: boolean;
        includeHistory: boolean;
        generateSummaries: boolean;
        systemPrompt: string;
    };
    gateway: {
        port: number;
    };
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
    activeSettingsSection: 'agents' | 'gateway' | 'general' | 'provider' | 'tools' | 'chat' | 'config';
    setActiveSettingsSection: (section: 'agents' | 'gateway' | 'general' | 'provider' | 'tools' | 'chat' | 'config') => void;
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
    agentForm: { name: string; emoji: string };
    setAgentForm: React.Dispatch<React.SetStateAction<{ name: string; emoji: string }>>;
    saveAgentConfig: () => Promise<void>;
    setViewingFile: (file: { title: string, content: string, isEditing: boolean } | null) => void;
    gatewayAddr: string;
    setGatewayAddr: (addr: string) => void;
    gatewayToken: string;
    setGatewayToken: (token: string) => void;
    initializeApp: (isSilent?: boolean) => Promise<void>;
    connectedClients: any[];
    fetchConnectedClients: () => Promise<void>;
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
    tools
}: SettingsPageProps) {

    return (
        <div className="flex-1 p-8 lg:p-12 overflow-y-auto">
            <header className="mb-10">
                <h1 className="text-4xl font-extrabold text-neutral-600 dark:text-white tracking-tight mb-2">Settings</h1>
                <p className="text-lg">Manage your gateway, providers, and agent personalities.</p>
            </header>

            <nav className="flex gap-8 border-b border-border-color mb-10 overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
                {['agents', 'gateway', 'general', 'provider', 'tools', 'chat', 'config'].map(id => (
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

                                <div className="space-y-4">
                                    <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                        Appearance
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {[
                                            { id: 'light', name: 'Light', icon: faSun },
                                            { id: 'dark', name: 'Dark', icon: faMoon },
                                            { id: 'system', name: 'System', icon: faDesktop },
                                        ].map((item) => (
                                            <Button
                                                key={item.id}
                                                themed={theme === item.id}
                                                onClick={() => setTheme(item.id as any)}
                                                className={`!p-3 flex-1 flex items-center justify-center gap-2 group ${theme !== item.id ? '!bg-bg-primary border border-border-color' : ''}`}
                                                icon={item.icon}
                                            >{item.name}</Button>
                                        ))}
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                    {activeSettingsSection === 'provider' && (
                        <form onSubmit={saveConfig} className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <Card className="space-y-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <IconBox icon={<Globe size={20} />} />
                                    <Text bold={true} size="xl">Model & Provider Settings</Text>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Input
                                        label="LM Studio Endpoint"
                                        currentText={config?.lmStudio.baseUrl || ''}
                                        onChange={(e) => setConfig(prev => prev ? { ...prev, lmStudio: { ...prev.lmStudio, baseUrl: e.target.value } } : null)}
                                        placeholder="http://localhost:1234/v1"
                                        icon={faLink}
                                        className="!mt-0"
                                    />

                                    <div className="space-y-2">
                                        <Select
                                            icon={faCube}
                                            className="!mt-0"
                                            label="Model"
                                            value={config?.lmStudio.modelId || ''}
                                            onChange={(e) => setConfig(prev => prev ? { ...prev, lmStudio: { ...prev.lmStudio, modelId: e.target.value } } : null)}
                                            options={[
                                                { value: '', label: 'Select a model...' },
                                                ...models.map(m => ({ value: m, label: m }))
                                            ]}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"><Terminal size={14} /> Global System Prompt</label>
                                    <textarea
                                        className="w-full bg-bg-primary border border-border-color rounded-xl px-5 py-4 outline-none focus:border-accent-primary transition-all text-sm h-32 custom-scrollbar resize-none"
                                        value={config?.lmStudio.systemPrompt}
                                        onChange={(e) => setConfig(prev => prev ? { ...prev, lmStudio: { ...prev.lmStudio, systemPrompt: e.target.value } } : null)}
                                        placeholder="Describe how the AI should behave globally..."
                                    />
                                </div>
                                <Button themed={true} className="w-full h-12 text-white" onClick={() => saveConfig()} icon={faSave}>Save Provider Configurations</Button>
                            </Card>
                        </form>
                    )}

                    {activeSettingsSection === 'agents' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <Card padding="p-4" className="lg:col-span-4 space-y-1 h-min max-h-[60vh] overflow-y-auto custom-scrollbar">
                                <div className="px-4 py-2 mb-2">
                                    <h3 className="text-sm font-bold uppercase">Discovered Agents</h3>
                                </div>
                                {agents.map(a => (
                                    <Button
                                        key={a.id}
                                        themed={settingsAgentId === a.id}
                                        className={`w-full flex items-center gap-3 !px-4 !py-3 ${settingsAgentId !== a.id ? '!bg-transparent hover:!bg-white/5' : ''}`}
                                        onClick={() => setSettingsAgentId(a.id)}
                                    >
                                        <span className="text-xl mr-1">{a.emoji}</span>
                                        <span className="font-semibold text-sm">{a.name}</span>
                                    </Button>
                                ))}
                            </Card>

                            <div className="lg:col-span-8 flex flex-col gap-6">
                                {activeAgentInSettings ? (
                                    <>
                                        <Card className="space-y-6">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <IconBox icon={<BrainCircuit size={20} />} />
                                                    <Text bold={true} size="xl">Personalization for {activeAgentInSettings.name}</Text>
                                                </div>
                                                <button
                                                    onClick={() => fetchAgents()}
                                                    className="p-2 hover:bg-white-trans rounded-lg transition-all group"
                                                    title="Refresh Agent Data"
                                                >
                                                    <RefreshCw size={18} className="group-active:rotate-180 transition-transform duration-500" />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <Input
                                                    label="Agent Nickname"
                                                    currentText={agentForm.name}
                                                    onChange={e => setAgentForm({ ...agentForm, name: e.target.value })}
                                                    icon={faUser}
                                                    className="md:col-span-2"
                                                    inputClassName="!mt-0"
                                                />
                                                <Input
                                                    label="Emoji Icon"
                                                    currentText={agentForm.emoji}
                                                    onChange={e => setAgentForm({ ...agentForm, emoji: e.target.value })}
                                                    icon={faSmile}
                                                    inputClassName="!mt-0 font-emoji text-center pl-0"
                                                />
                                            </div>

                                            <Input
                                                label="Filesystem Runtime Path"
                                                currentText={activeAgentInSettings.path}
                                                readOnly={true}
                                                icon={faFolder}
                                                inputClassName="!mt-0 !text-xs !font-mono"
                                            />

                                            <Button
                                                themed={true}
                                                className="w-full h-12 text-white"
                                                onClick={saveAgentConfig}
                                                icon={faSave}
                                            >
                                                Update Agent Meta Profile
                                            </Button>
                                        </Card>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <Card
                                                padding="p-5"
                                                className="group flex justify-between items-center hover:border-accent-primary hover:bg-accent-primary/5 transition-all"
                                                onClick={() => setViewingFile({ title: 'IDENTITY.md', content: activeAgentInSettings.identity, isEditing: true })}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-white-trans flex items-center justify-center group-hover:text-accent-primary group-hover:bg-accent-primary/10 transition-all">
                                                        <FileText size={24} />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold uppercase text-xs tracking-tight">IDENTITY.md</div>
                                                        <div className="text-xs">Core instructions</div>
                                                    </div>
                                                </div>
                                            </Card>

                                            <Card
                                                padding="p-5"
                                                className="group flex justify-between items-center hover:border-accent-primary hover:bg-accent-primary/5 transition-all"
                                                onClick={() => setViewingFile({ title: 'SOUL.md', content: activeAgentInSettings.soul, isEditing: true })}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-white-trans flex items-center justify-center group-hover:text-amber-400 group-hover:bg-amber-400/10 transition-all">
                                                        <BrainCircuit size={24} />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold uppercase text-xs tracking-tight">SOUL.md</div>
                                                        <div className="text-xs">Moral values</div>
                                                    </div>
                                                </div>
                                            </Card>

                                            <Card
                                                padding="p-5"
                                                className="group flex justify-between items-center hover:border-accent-primary hover:bg-accent-primary/5 transition-all"
                                                onClick={() => setViewingFile({ title: 'MEMORY.md', content: (activeAgentInSettings as any).memory || '', isEditing: true })}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-white-trans flex items-center justify-center group-hover:text-emerald-400 group-hover:bg-emerald-400/10 transition-all">
                                                        <History size={24} />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold uppercase text-xs tracking-tight">MEMORY.md</div>
                                                        <div className="text-xs">Stored facts</div>
                                                    </div>
                                                </div>
                                            </Card>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center py-20 bg-bg-card rounded-3xl border border-dashed border-border-color">
                                        <BrainCircuit size={40} className="text-border-color mb-4" />
                                        <p className="font-medium italic">Select an agent from the left to view configuration</p>
                                    </div>
                                )}
                            </div>
                        </div>
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
                                            <h3 className="text-sm font-bold text-neutral-600 dark:text-white group-hover:text-accent-primary transition-colors">Show Thought Process</h3>
                                            <p className="text-xs">Display reasoning blocks if available</p>
                                        </div>
                                        <Toggle
                                            checked={config?.lmStudio.showReasoning || false}
                                            onChange={() => setConfig(prev => prev ? { ...prev, lmStudio: { ...prev.lmStudio, showReasoning: !prev.lmStudio.showReasoning } } : null)}
                                        />
                                    </div>

                                    <div className="bg-bg-primary border border-border-color rounded-xl p-4 flex justify-between items-center group transition-all">
                                        <div className="space-y-1">
                                            <h3 className="text-sm font-bold text-neutral-600 dark:text-white flex items-center gap-2 group-hover:text-accent-primary transition-colors"><History size={14} /> Stateful Conversations</h3>
                                            <p className="text-xs">Preserve context across multiple message turns</p>
                                        </div>
                                        <Toggle
                                            checked={config?.lmStudio.includeHistory || false}
                                            onChange={() => setConfig(prev => prev ? { ...prev, lmStudio: { ...prev.lmStudio, includeHistory: !prev.lmStudio.includeHistory } } : null)}
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
                                            checked={config?.lmStudio.generateSummaries || false}
                                            onChange={() => setConfig(prev => prev ? { ...prev, lmStudio: { ...prev.lmStudio, generateSummaries: !prev.lmStudio.generateSummaries } } : null)}
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
        </div>
    )
}

