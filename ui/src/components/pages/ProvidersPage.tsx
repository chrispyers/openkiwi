
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import Provider from '../Provider'
import Button from '../Button'
import Modal from '../Modal'
import Page from './Page'


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

interface ProvidersPageProps {
    config: Config | null;
    setConfig: React.Dispatch<React.SetStateAction<Config | null>>;
    models: string[];
    saveConfig: (e?: React.FormEvent, configOverride?: Config) => Promise<void>;
    fetchModels: (isSilent?: boolean) => Promise<boolean | void>;
}

export default function ProvidersPage({
    config,
    setConfig,
    models,
    saveConfig,
    fetchModels
}: ProvidersPageProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newProvider, setNewProvider] = useState({ description: '', endpoint: '', model: '' });
    const [selectedProviderType, setSelectedProviderType] = useState<string | null>(null);

    useEffect(() => {
        if (!isModalOpen) {
            setSelectedProviderType(null);
            setNewProvider({ description: '', endpoint: '', model: '' });
        }
    }, [isModalOpen]);

    return (
        <Page
            title="Providers"
            subtitle="Configure your AI model providers and endpoints."
            headerAction={
                <Button
                    themed={true}
                    className="text-white px-4 py-2 h-10"
                    icon={faPlus}
                    onClick={() => setIsModalOpen(true)}
                >
                    Add Provider
                </Button>
            }
        >

            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 max-w-5xl">
                {/* Saved Providers */}
                {config?.providers?.map((provider, idx) => (
                    <div key={idx} className="relative">
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

                {config?.providers.length === 0 && (
                    <div className="text-center py-20 opacity-50">
                        <p>No providers configured yet. Click "Add Provider" to get started.</p>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Add New Provider"
                className="max-w-2xl"
            >
                <div className="p-6">
                    <div className="flex gap-4 justify-center mb-6">
                        <Button
                            className={`h-12 flex-1 text-lg font-bold border-2 transition-all ${selectedProviderType === 'lm-studio' ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-border-color bg-bg-card hover:bg-bg-primary text-neutral-500'}`}
                            onClick={() => setSelectedProviderType('lm-studio')}
                        >
                            LM Studio
                        </Button>
                        <Button
                            className={`h-12 flex-1 text-lg font-bold border-2 border-border-color bg-bg-card hover:bg-bg-primary text-neutral-500`}
                            onClick={() => toast.info('Google Gemini support coming soon')}
                        >
                            Google Gemini
                        </Button>
                    </div>

                    {selectedProviderType === 'lm-studio' && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                            <Provider
                                description={newProvider.description}
                                endpoint={newProvider.endpoint}
                                model={newProvider.model}
                                models={models}
                                onDescriptionChange={(val) => setNewProvider(prev => ({ ...prev, description: val }))}
                                onEndpointChange={(val) => setNewProvider(prev => ({ ...prev, endpoint: val }))}
                                onModelChange={(val) => setNewProvider(prev => ({ ...prev, model: val }))}
                                onScan={async () => {
                                    // See comments in previous version about scanning limitations in this modal context
                                    await fetchModels();
                                }}
                                onSave={async () => {
                                    if (!config) return;

                                    const providerToAdd = {
                                        description: newProvider.description,
                                        endpoint: newProvider.endpoint,
                                        model: newProvider.model
                                    };

                                    const updatedProviders = [...(config.providers || []), providerToAdd];

                                    const newConfig = {
                                        ...config,
                                        providers: updatedProviders
                                    };

                                    setConfig(newConfig);
                                    await saveConfig(undefined, newConfig);
                                    toast.success("Successfully saved provider");
                                    setIsModalOpen(false);
                                    setNewProvider({ description: '', endpoint: '', model: '' });
                                }}
                            />
                        </div>
                    )}
                </div>
            </Modal>
        </Page >
    )
}
