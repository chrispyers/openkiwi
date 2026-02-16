
import Provider from '../Provider'

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

            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 max-w-5xl">
                {/* Default Provider */}
                <Provider
                    description={config?.lmStudio.description || ''}
                    endpoint={config?.lmStudio.baseUrl || ''}
                    model={config?.lmStudio.modelId || ''}
                    models={models}
                    onDescriptionChange={(val) => setConfig(prev => prev ? { ...prev, lmStudio: { ...prev.lmStudio, description: val } } : null)}
                    onEndpointChange={(val) => setConfig(prev => prev ? { ...prev, lmStudio: { ...prev.lmStudio, baseUrl: val } } : null)}
                    onModelChange={(val) => setConfig(prev => prev ? { ...prev, lmStudio: { ...prev.lmStudio, modelId: val } } : null)}
                    onScan={async () => {
                        await saveConfig();
                        await fetchModels();
                    }}
                    onSave={async () => {
                        if (!config) return;

                        const newProvider = {
                            description: config.lmStudio.description || "",
                            endpoint: config.lmStudio.baseUrl,
                            model: config.lmStudio.modelId
                        };

                        const updatedProviders = [...(config.providers || []), newProvider];

                        const newConfig = {
                            ...config,
                            providers: updatedProviders
                        };

                        setConfig(newConfig);
                        await saveConfig(undefined, newConfig);
                    }}
                />

                {/* Saved Providers */}
                {config?.providers?.map((provider, idx) => (
                    <div key={idx} className="relative">
                        <div className="absolute -left-4 top-6 bottom-0 w-0.5 bg-border-color/50 hidden lg:block"></div>
                        <Provider
                            description={provider.description}
                            endpoint={provider.endpoint}
                            model={provider.model}
                            models={[provider.model]} // In read-only mode, we might just show the selected model or all if we knew them
                            onDescriptionChange={() => { }}
                            onEndpointChange={() => { }}
                            onModelChange={() => { }}
                            onScan={async () => { }}
                            onSave={async () => { }}
                            isEditable={false}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}
