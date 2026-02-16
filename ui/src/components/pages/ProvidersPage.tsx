import { faAlignLeft, faCube, faLink, faSave } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Globe, RefreshCw } from 'lucide-react'
import Button from '../Button'
import Select from '../Select'
import Text from '../Text'
import Card from '../Card'
import IconBox from '../IconBox'

interface Config {
    lmStudio: {
        baseUrl: string;
        modelId: string;
        description?: string;
    };
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

interface ProvidersPageProps {
    config: Config | null;
    setConfig: React.Dispatch<React.SetStateAction<Config | null>>;
    models: string[];
    saveConfig: (e?: React.FormEvent, configOverride?: Config) => Promise<void>;
    fetchModels: () => Promise<boolean | void>;
}

export default function ProvidersPage({
    config,
    setConfig,
    models,
    saveConfig,
    fetchModels
}: ProvidersPageProps) {
    return (
        <div className="flex-1 p-8 lg:p-12 overflow-y-auto">
            <header className="mb-10">
                <h1 className="text-4xl font-extrabold text-neutral-600 dark:text-white tracking-tight mb-2">Providers</h1>
                <p className="text-lg">Configure your AI model providers and endpoints.</p>
            </header>

            <form onSubmit={saveConfig} className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 max-w-5xl">
                <Card className="space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <IconBox icon={<Globe size={20} />} />
                        <Text bold={true} size="xl">Model & Provider Settings</Text>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            <FontAwesomeIcon icon={faAlignLeft} size="sm" /> Description
                        </label>
                        <input
                            type="text"
                            className="w-full bg-bg-primary border border-border-color rounded-xl px-5 py-3 outline-none focus:border-accent-primary transition-all text-sm"
                            value={config?.lmStudio.description || ''}
                            onChange={(e) => setConfig(prev => prev ? { ...prev, lmStudio: { ...prev.lmStudio, description: e.target.value } } : null)}
                            placeholder="A short description for this provider..."
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                <FontAwesomeIcon icon={faLink} size="sm" /> Endpoint
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className="flex-1 bg-bg-primary border border-border-color rounded-xl px-5 py-3 outline-none focus:border-accent-primary transition-all text-sm"
                                    value={config?.lmStudio.baseUrl || ''}
                                    onChange={(e) => setConfig(prev => prev ? { ...prev, lmStudio: { ...prev.lmStudio, baseUrl: e.target.value } } : null)}
                                    placeholder="http://localhost:1234/v1"
                                />
                                <Button
                                    themed={true}
                                    className="px-6 text-white whitespace-nowrap flex items-center justify-center shrink-0"
                                    onClick={async () => {
                                        // Save the config first to ensure the new endpoint is used
                                        await saveConfig();
                                        // Then fetch models
                                        await fetchModels();
                                    }}
                                >
                                    <RefreshCw size={16} className="mr-2" />
                                    Scan
                                </Button>
                            </div>
                        </div>

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


                    <Button themed={true} className="w-full h-12 text-white" onClick={async (e) => {
                        e.preventDefault();
                        if (!config) return;

                        const newProvider = {
                            description: config.lmStudio.description || "",
                            endpoint: config.lmStudio.baseUrl,
                            model: config.lmStudio.modelId
                        };

                        // Append new provider to the list
                        const updatedProviders = [...(config.providers || []), newProvider];

                        const newConfig = {
                            ...config,
                            providers: updatedProviders
                        };

                        // Update local state and save to backend
                        setConfig(newConfig);
                        await saveConfig(undefined, newConfig);
                    }} icon={faSave}>Save Provider Configurations</Button>
                </Card>
            </form>
        </div>
    )
}
