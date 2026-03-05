import { useState } from 'react'
import { toast } from 'sonner'
import Page from '../Page'
import Button from '../../Button'
import Toggle from '../../Toggle'
import Text from '../../Text'
import Card from '../../Card'
import { Loader2 } from 'lucide-react'
import Modal from '../../Modal'
import MarkdownRenderer from '../../MarkdownRenderer'
import SectionHeader from '../../SectionHeader'
import Settings_Version from './Settings_Version'
import Settings_Config from './Settings_Config'
import Settings_Chat from './Settings_Chat'
import Settings_Agents from './Settings_Agents'
import Settings_General from './Settings_General'
import Settings_Messaging from './Settings_Messaging'
import Settings_Tools from './Settings_Tools'

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
    path: string;
    identity?: string;
    soul?: string;
    systemPrompt?: string;
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
    activeSettingsSection: 'version' | 'config' | 'chat' | 'agents' | 'general' | 'messaging' | 'tools' | 'gateway';
    setActiveSettingsSection: (section: 'version' | 'config' | 'chat' | 'agents' | 'general' | 'messaging' | 'tools' | 'gateway') => void;
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
    agentForm: { name: string; provider?: string; heartbeat?: { enabled: boolean; schedule: string; }; collaboration?: { enabled: boolean; schedule: string; } };
    setAgentForm: React.Dispatch<React.SetStateAction<{ name: string; provider?: string; heartbeat?: { enabled: boolean; schedule: string; }; collaboration?: { enabled: boolean; schedule: string; } }>>;
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
    const [viewingReadme, setViewingReadme] = useState<{ name: string, content: string } | null>(null);
    const [loadingReadme, setLoadingReadme] = useState(false);


    return (
        <Page
            title="Settings"
            subtitle="Manage your gateway, providers, and agent personalities."
        >
            <nav className="mb-3 flex gap-6 border-b border-divider overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
                {['agents', 'chat', 'config', 'general', 'messaging', 'tools', 'version'].map(id => (
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
                        <Settings_General
                            isProjectManagementEnabled={isProjectManagementEnabled}
                            setIsProjectManagementEnabled={setIsProjectManagementEnabled}
                            isAgentCollaborationEnabled={isAgentCollaborationEnabled}
                            setIsAgentCollaborationEnabled={setIsAgentCollaborationEnabled}
                            isAgentActivityEnabled={isAgentActivityEnabled}
                            setIsAgentActivityEnabled={setIsAgentActivityEnabled}
                            theme={theme}
                            setTheme={setTheme}
                        />
                    )}

                    {activeSettingsSection === 'messaging' && (
                        <Settings_Messaging
                            whatsappStatus={whatsappStatus}
                            onLogoutWhatsApp={onLogoutWhatsApp}
                            onConnectWhatsApp={onConnectWhatsApp}
                            telegramStatus={telegramStatus}
                            onConnectTelegram={onConnectTelegram}
                            onDisconnectTelegram={onDisconnectTelegram}
                        />
                    )}


                    {
                        activeSettingsSection === 'agents' && (
                            <Settings_Agents
                                config={config}
                                setConfig={setConfig}
                                saveConfig={saveConfig}
                            />
                        )
                    }


                    {activeSettingsSection === 'tools' && (
                        <Settings_Tools
                            tools={tools}
                            config={config}
                            setConfig={setConfig}
                            saveConfig={saveConfig}
                            gatewayAddr={gatewayAddr}
                            gatewayToken={gatewayToken}
                            loadingReadme={loadingReadme}
                            setLoadingReadme={setLoadingReadme}
                            setViewingReadme={setViewingReadme}
                        />
                    )}


                    {activeSettingsSection === 'version' && (
                        <Settings_Version
                            config={config}
                            setConfig={setConfig}
                            gatewayAddr={gatewayAddr}
                            gatewayToken={gatewayToken}
                        />
                    )}

                    {activeSettingsSection === 'chat' && (
                        <Settings_Chat
                            config={config}
                            setConfig={setConfig}
                            saveConfig={saveConfig}
                        />
                    )}


                    {activeSettingsSection === 'config' && (
                        <Settings_Config
                            config={config}
                            gatewayAddr={gatewayAddr}
                            gatewayToken={gatewayToken}
                        />
                    )}

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
