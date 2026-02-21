
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { faPlus, faKey, faCube, faSave, faRefresh, faAlignLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Provider from '../Provider'
import Button from '../Button'
import Modal from '../Modal'
import Card from '../Card'
import Text from '../Text'
import Select from '../Select'
import Page from './Page'
import ModelsTable from '../ModelsTable'
import { Model } from '../../types'
import GoogleIcon from '../../img/google.png'
import OpenAIIcon from '../../img/openai.svg.png'
import AnthropicIcon from '../../img/anthropic.png'



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
        apiKey?: string;
        capabilities?: {
            vision?: boolean;
            reasoning?: boolean;
            trained_for_tool_use?: boolean;
        }
    }[];
}


interface ModelsPageProps {
    config: Config | null;
    setConfig: React.Dispatch<React.SetStateAction<Config | null>>;
    models: string[];
    saveConfig: (e?: React.FormEvent, configOverride?: Config) => Promise<void>;
    fetchModels: (isSilent?: boolean, configOverride?: { endpoint: string, apiKey?: string }, skipSetState?: boolean) => Promise<boolean | string[] | Model[] | void>;

}

export default function ModelsPage({
    config,
    setConfig,
    models,
    saveConfig,
    fetchModels
}: ModelsPageProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newProvider, setNewProvider] = useState<{ description: string; endpoint: string; model: string; capabilities?: { vision?: boolean; reasoning?: boolean; trained_for_tool_use?: boolean } }>({ description: '', endpoint: '', model: '' });
    const [selectedProviderType, setSelectedProviderType] = useState<string | null>(null);
    const [newGeminiProvider, setNewGeminiProvider] = useState({ apiKey: '', model: '', description: '', capabilities: {} as any });
    const [newOpenAIProvider, setNewOpenAIProvider] = useState({ apiKey: '', model: '', description: '', capabilities: {} as any });
    const [newAnthropicProvider, setNewAnthropicProvider] = useState({ apiKey: '', model: '', description: '', capabilities: {} as any });
    const [scannedModels, setScannedModels] = useState<Model[]>([]);

    // Editing State
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<{ description: string; model: string; endpoint: string; apiKey?: string; capabilities?: { vision?: boolean; reasoning?: boolean; trained_for_tool_use?: boolean } }>({ description: '', model: '', endpoint: '' });
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Available Gemini models (hardcoded defaults + dynamic)
    const geminiModels = [
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite-preview-02-05',
        'gemini-2.0-pro-exp-02-05',
        'gemini-2.0-flash-thinking-exp-01-21',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
    ];

    useEffect(() => {
        if (!isModalOpen) {
            setSelectedProviderType(null);
            setNewProvider({ description: '', endpoint: '', model: '' });
            setNewGeminiProvider({ apiKey: '', model: '', description: '', capabilities: {} });
            setNewOpenAIProvider({ apiKey: '', model: '', description: '', capabilities: {} });
            setNewAnthropicProvider({ apiKey: '', model: '', description: '', capabilities: {} });
            setScannedModels([]);
        }
    }, [isModalOpen]);

    const handleRowClick = (idx: number) => {
        if (!config || !config.providers[idx]) return;
        const provider = config.providers[idx];
        setEditingIndex(idx);
        setEditForm({
            description: provider.description,
            model: provider.model,
            endpoint: provider.endpoint,
            apiKey: provider.apiKey,
            capabilities: provider.capabilities
        });
        setIsEditModalOpen(true);
    };

    const handleUpdateProvider = async () => {
        if (!config || editingIndex === null) return;

        const updatedProviders = [...config.providers];
        updatedProviders[editingIndex] = {
            ...updatedProviders[editingIndex],
            description: editForm.description,
            model: editForm.model,
            // Preserve capabilities if not explicitly edited (logic could be expanded if we allowed editing capabilities)
            capabilities: updatedProviders[editingIndex].capabilities
        };

        const newConfig = { ...config, providers: updatedProviders };
        setConfig(newConfig);
        await saveConfig(undefined, newConfig);
        toast.success("Provider updated");
        setIsEditModalOpen(false);
    };

    const handleDeleteProvider = async (originalIndex: number) => {
        if (!config) return;
        const updatedProviders = [...config.providers];
        updatedProviders.splice(originalIndex, 1);
        const newConfig = { ...config, providers: updatedProviders };
        setConfig(newConfig);
        await saveConfig(undefined, newConfig);
        toast.success("Model deleted");
    };

    const detectCapabilities = (model: Model) => {
        const modelId = (model.id || "").toLowerCase();
        const displayName = (model.displayName || model.display_name || "").toLowerCase();
        const description = (model.description || "").toLowerCase();

        const isReasoning = model.capabilities?.reasoning ||
            model.thinking === true ||
            modelId.includes("deepseek-r1") ||
            modelId.includes("o1") ||
            modelId.includes("reasoning") ||
            modelId.includes("thinking") ||
            modelId.includes("claude-3-7") ||
            displayName.includes("deepseek-r1") ||
            displayName.includes("o1") ||
            displayName.includes("reasoning") ||
            displayName.includes("thinking") ||
            displayName.includes("claude-3.7");

        const isVision = model.capabilities?.vision ||
            modelId.includes("vision") ||
            modelId.includes("flash") ||
            modelId.includes("pro") ||
            modelId.includes("claude-3") ||
            displayName.includes("vision") ||
            displayName.includes("flash") ||
            displayName.includes("pro") ||
            displayName.includes("claude-3");

        const isTool = model.capabilities?.trained_for_tool_use ||
            modelId.includes("tool") ||
            modelId.includes("flash") ||
            modelId.includes("pro") ||
            modelId.includes("claude-3") ||
            displayName.includes("tool") ||
            displayName.includes("flash") ||
            displayName.includes("pro") ||
            description.includes("tool") ||
            description.includes("claude-3");

        return {
            reasoning: isReasoning || false,
            vision: isVision || false,
            trained_for_tool_use: isTool || false
        };
    };

    const handleScanInEdit = async () => {
        if (!editForm.endpoint) return;
        await fetchModels(false, { endpoint: editForm.endpoint, apiKey: editForm.apiKey });
    };

    const handleGeminiScan = async () => {
        if (!newGeminiProvider.apiKey) {
            toast.error("Please enter an API Key first");
            return;
        }
        const result = await fetchModels(false, {
            endpoint: 'https://generativelanguage.googleapis.com/v1beta',
            apiKey: newGeminiProvider.apiKey
        }, true);
        if (Array.isArray(result)) {
            const models = result.map(m => typeof m === 'string' ? { id: m, object: 'model' } as Model : m);
            setScannedModels(models);
        }
    };

    const handleGeminiSave = async () => {
        if (!config || !newGeminiProvider.apiKey || !newGeminiProvider.model) {
            toast.error("Please provide at least an API Key and select a Model");
            return;
        }

        const providerToAdd = {
            description: newGeminiProvider.description.trim() || `Google Gemini - ${newGeminiProvider.model}`,
            endpoint: 'https://generativelanguage.googleapis.com/v1beta',
            model: newGeminiProvider.model,
            apiKey: newGeminiProvider.apiKey,
            capabilities: newGeminiProvider.capabilities
        };

        const updatedProviders = [...(config.providers || []), providerToAdd];
        const newConfig = { ...config, providers: updatedProviders };
        setConfig(newConfig);
        await saveConfig(undefined, newConfig);
        toast.success("Successfully saved Google Gemini provider");
        setIsModalOpen(false);
        setNewGeminiProvider({ apiKey: '', model: '', description: '', capabilities: {} });
    };

    const handleOpenAIScan = async () => {
        if (!newOpenAIProvider.apiKey) {
            toast.error("Please enter an API Key first");
            return;
        }
        const result = await fetchModels(false, {
            endpoint: 'https://api.openai.com/v1',
            apiKey: newOpenAIProvider.apiKey
        }, true);
        if (Array.isArray(result)) {
            const models = result.map(m => typeof m === 'string' ? { id: m, object: 'model' } as Model : m);
            setScannedModels(models);
        }
    };

    const handleOpenAISave = async () => {
        if (!config || !newOpenAIProvider.apiKey || !newOpenAIProvider.model) {
            toast.error("Please provide at least an API Key and select a Model");
            return;
        }

        const description = newOpenAIProvider.description.trim() || `OpenAI - ${newOpenAIProvider.model}`;

        const providerToAdd = {
            description: description,
            endpoint: 'https://api.openai.com/v1',
            model: newOpenAIProvider.model,
            apiKey: newOpenAIProvider.apiKey,
            capabilities: newOpenAIProvider.capabilities
        };

        const updatedProviders = [...(config.providers || []), providerToAdd];
        const newConfig = { ...config, providers: updatedProviders };
        setConfig(newConfig);
        await saveConfig(undefined, newConfig);
        toast.success("Successfully saved OpenAI provider");
        setIsModalOpen(false);
        setNewOpenAIProvider({ apiKey: '', model: '', description: '', capabilities: {} });
    };

    const handleAnthropicScan = async () => {
        if (!newAnthropicProvider.apiKey) {
            toast.error("Please enter an API Key first");
            return;
        }
        const result = await fetchModels(false, {
            endpoint: 'https://api.anthropic.com/v1',
            apiKey: newAnthropicProvider.apiKey
        }, true);
        if (Array.isArray(result)) {
            const models = result.map(m => typeof m === 'string' ? { id: m, object: 'model' } as Model : m);
            setScannedModels(models);
        }
    };

    const handleAnthropicSave = async () => {
        if (!config || !newAnthropicProvider.apiKey || !newAnthropicProvider.model) {
            toast.error("Please provide at least an API Key and select a Model");
            return;
        }

        const description = newAnthropicProvider.description.trim() || `Anthropic - ${newAnthropicProvider.model}`;

        const providerToAdd = {
            description: description,
            endpoint: 'https://api.anthropic.com/v1',
            model: newAnthropicProvider.model,
            apiKey: newAnthropicProvider.apiKey,
            capabilities: newAnthropicProvider.capabilities
        };

        const updatedProviders = [...(config.providers || []), providerToAdd];
        const newConfig = { ...config, providers: updatedProviders };
        setConfig(newConfig);
        await saveConfig(undefined, newConfig);
        toast.success("Successfully saved Anthropic provider");
        setIsModalOpen(false);
        setNewAnthropicProvider({ apiKey: '', model: '', description: '', capabilities: {} });
    };

    const augmentedProviders = config?.providers.map((p, i) => ({ ...p, originalIndex: i })) || [];
    const anthropicModels = augmentedProviders.filter(p => p.endpoint.includes('anthropic.com'));
    const googleModels = augmentedProviders.filter(p => p.endpoint.includes('googleapis.com'));
    const lmStudioModels = augmentedProviders.filter(p => p.endpoint.includes(':1234'));
    const openAIModels = augmentedProviders.filter(p => p.endpoint.includes('api.openai.com'));
    const otherModels = augmentedProviders.filter(p =>
        !p.endpoint.includes('anthropic.com') &&
        !p.endpoint.includes('googleapis.com') &&
        !p.endpoint.includes(':1234') &&
        !p.endpoint.includes('api.openai.com')
    );

    return (
        <Page
            title="Models"
            subtitle="Configure your AI models."
            headerAction={
                <Button themed={true} icon={faPlus} onClick={() => setIsModalOpen(true)}>Add Model</Button>
            }
        >
            <Card>
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 max-w-6xl">
                    {augmentedProviders.length === 0 ? (
                        <ModelsTable providers={[]} onRowClick={() => { }} />
                    ) : (
                        <div className="space-y-12">
                            {anthropicModels.length > 0 && (
                                <div className="space-y-4">
                                    <Text size="lg" bold={true}>Anthropic</Text>
                                    <ModelsTable
                                        providers={anthropicModels}
                                        onRowClick={(i) => handleRowClick(anthropicModels[i].originalIndex)}
                                        onDelete={(i) => handleDeleteProvider(anthropicModels[i].originalIndex)}
                                    />
                                </div>
                            )}

                            {googleModels.length > 0 && (
                                <div className="space-y-4">
                                    <Text size="lg" bold={true}>Google</Text>
                                    <ModelsTable
                                        providers={googleModels}
                                        onRowClick={(i) => handleRowClick(googleModels[i].originalIndex)}
                                        onDelete={(i) => handleDeleteProvider(googleModels[i].originalIndex)}
                                    />
                                </div>
                            )}

                            {lmStudioModels.length > 0 && (
                                <div className="space-y-4">
                                    <Text size="lg" bold={true}>LM Studio</Text>
                                    <ModelsTable
                                        providers={lmStudioModels}
                                        onRowClick={(i) => handleRowClick(lmStudioModels[i].originalIndex)}
                                        onDelete={(i) => handleDeleteProvider(lmStudioModels[i].originalIndex)}
                                    />
                                </div>
                            )}

                            {openAIModels.length > 0 && (
                                <div className="space-y-4">
                                    <Text size="lg" bold={true}>OpenAI</Text>
                                    <ModelsTable
                                        providers={openAIModels}
                                        onRowClick={(i) => handleRowClick(openAIModels[i].originalIndex)}
                                        onDelete={(i) => handleDeleteProvider(openAIModels[i].originalIndex)}
                                    />
                                </div>
                            )}

                            {otherModels.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold px-1">Other</h3>
                                    <ModelsTable
                                        providers={otherModels}
                                        onRowClick={(i) => handleRowClick(otherModels[i].originalIndex)}
                                        onDelete={(i) => handleDeleteProvider(otherModels[i].originalIndex)}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </Card>
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Edit Provider"
                className="max-w-xl"
            >
                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider block">Description</label>
                        <input
                            type="text"
                            className="w-full bg-bg-primary border border-border-color rounded-xl px-5 py-3 outline-none focus:border-accent-primary transition-all text-sm"
                            value={editForm.description}
                            onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-bold uppercase tracking-wider block">Model</label>
                            <button
                                onClick={handleScanInEdit}
                                className="text-xs text-accent-primary hover:underline font-bold"
                            >
                                Scan Available
                            </button>
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                list="available-models"
                                className="w-full bg-bg-primary border border-border-color rounded-xl px-5 py-3 outline-none focus:border-accent-primary transition-all text-sm"
                                value={editForm.model}
                                onChange={(e) => setEditForm(prev => ({ ...prev, model: e.target.value }))}
                                placeholder="Enter or select a model"
                            />
                            <datalist id="available-models">
                                {models.map(m => (
                                    <option key={m} value={m} />
                                ))}
                                {geminiModels.map(m => (
                                    <option key={`gemini-${m}`} value={m} />
                                ))}
                            </datalist>
                        </div>
                    </div>

                    <div className="pt-2">
                        <Button
                            themed={true}
                            className="w-full h-12 text-white"
                            onClick={handleUpdateProvider}
                            icon={faSave}
                        >
                            Update Provider
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Add New Model"
                className="max-w-2xl"
            >
                <div className="p-6">
                    <div className="flex gap-4 justify-center mb-6 overflow-x-auto">
                        <Button
                            className={`h-12 flex-1 min-w-[140px] text-lg font-bold border-2 transition-all ${selectedProviderType === 'anthropic' ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-border-color bg-bg-card hover:bg-bg-primary text-neutral-500'}`}
                            onClick={() => setSelectedProviderType('anthropic')}
                        >
                            <img src={AnthropicIcon} alt="Anthropic" className="h-6 dark:invert" />
                        </Button>
                        <Button
                            className={`h-12 flex-1 min-w-[140px] text-lg font-bold border-2 transition-all ${selectedProviderType === 'lm-studio' ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-border-color bg-bg-card hover:bg-bg-primary text-neutral-500'}`}
                            onClick={() => setSelectedProviderType('lm-studio')}
                        >
                            LM Studio
                        </Button>
                        <Button
                            className={`h-12 flex-1 min-w-[140px] text-lg font-bold border-2 transition-all ${selectedProviderType === 'google-gemini' ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-border-color bg-bg-card hover:bg-bg-primary text-neutral-500'}`}
                            onClick={() => setSelectedProviderType('google-gemini')}
                        >
                            <img src={GoogleIcon} alt="Google Gemini" className="h-6" />
                        </Button>
                        <Button
                            className={`h-12 flex-1 min-w-[140px] text-lg font-bold border-2 transition-all ${selectedProviderType === 'openai' ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-border-color bg-bg-card hover:bg-bg-primary text-neutral-500'}`}
                            onClick={() => setSelectedProviderType('openai')}
                        >
                            <img src={OpenAIIcon} alt="OpenAI" className="h-6 dark:invert" />
                        </Button>
                    </div>

                    {selectedProviderType === 'anthropic' && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                            <Provider
                                inputLabel="API KEY"
                                inputIcon={faKey}
                                inputPlaceholder="ant-api-..."
                                description={newAnthropicProvider.description}
                                endpoint={newAnthropicProvider.apiKey}
                                model={newAnthropicProvider.model}
                                models={scannedModels}
                                onDescriptionChange={(val) => setNewAnthropicProvider(prev => ({ ...prev, description: val }))}
                                onEndpointChange={(val) => setNewAnthropicProvider(prev => ({ ...prev, apiKey: val }))}
                                onModelChange={(val) => {
                                    const selectedModel = scannedModels.find(m => m.id === val);
                                    const capabilities = selectedModel ? detectCapabilities(selectedModel) : {};
                                    setNewAnthropicProvider(prev => ({ ...prev, model: val, description: val, capabilities }));
                                }}
                                onScan={handleAnthropicScan}
                                onSave={handleAnthropicSave}
                                footer={
                                    <div className="text-center">
                                        <Text size="sm" secondary={true}>
                                            Don't have an API key? Get one at <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline font-bold">console.anthropic.com</a>
                                        </Text>
                                    </div>
                                }
                            />
                        </div>
                    )}

                    {selectedProviderType === 'lm-studio' && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                            <Provider
                                description={newProvider.description}
                                endpoint={newProvider.endpoint}
                                model={newProvider.model}
                                models={scannedModels}
                                onDescriptionChange={(val) => setNewProvider(prev => ({ ...prev, description: val }))}
                                onEndpointChange={(val) => setNewProvider(prev => ({ ...prev, endpoint: val }))}
                                onModelChange={(val) => {
                                    const selectedModel = scannedModels.find(m => m.id === val);
                                    const capabilities = selectedModel ? detectCapabilities(selectedModel) : {};
                                    setNewProvider(prev => ({ ...prev, model: val, description: val, capabilities }));
                                }}
                                onScan={async () => {
                                    // Scan with the endpoint provided in the inputs
                                    const result = await fetchModels(false, { endpoint: newProvider.endpoint, apiKey: '' }, true);
                                    if (Array.isArray(result)) {
                                        // result can be string[] or Model[].
                                        // If it's objects, use them. If strings, map to dummy objects.
                                        const models = result.map(m => typeof m === 'string' ? { id: m, object: 'model' } as Model : m);
                                        setScannedModels(models);
                                    }
                                }}
                                onSave={async () => {
                                    if (!config) return;

                                    const providerToAdd = {
                                        description: newProvider.description,
                                        endpoint: newProvider.endpoint,
                                        model: newProvider.model,
                                        capabilities: newProvider.capabilities
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

                    {selectedProviderType === 'google-gemini' && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                            <Provider
                                inputLabel="API KEY"
                                inputIcon={faKey}
                                inputPlaceholder="Enter your Google Gemini API key"
                                description={newGeminiProvider.description}
                                endpoint={newGeminiProvider.apiKey}
                                model={newGeminiProvider.model}
                                models={scannedModels}
                                onDescriptionChange={(val) => setNewGeminiProvider(prev => ({ ...prev, description: val }))}
                                onEndpointChange={(val) => setNewGeminiProvider(prev => ({ ...prev, apiKey: val }))}
                                onModelChange={(val) => {
                                    const selectedModel = scannedModels.find(m => m.id === val);
                                    const capabilities = selectedModel ? detectCapabilities(selectedModel) : {};
                                    setNewGeminiProvider(prev => ({ ...prev, model: val, description: val, capabilities }));
                                }}
                                onScan={handleGeminiScan}
                                onSave={handleGeminiSave}
                                footer={
                                    <div className="text-center">
                                        <Text size="sm" secondary={true}>
                                            Don't have an API key? Get one at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline font-bold">aistudio.google.com</a>
                                        </Text>
                                    </div>
                                }
                            />
                        </div>
                    )}
                    {selectedProviderType === 'openai' && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                            <Provider
                                inputLabel="API KEY"
                                inputIcon={faKey}
                                inputPlaceholder="sk-..."
                                description={newOpenAIProvider.description}
                                endpoint={newOpenAIProvider.apiKey}
                                model={newOpenAIProvider.model}
                                models={scannedModels}
                                onDescriptionChange={(val) => setNewOpenAIProvider(prev => ({ ...prev, description: val }))}
                                onEndpointChange={(val) => setNewOpenAIProvider(prev => ({ ...prev, apiKey: val }))}
                                onModelChange={(val) => {
                                    const selectedModel = scannedModels.find(m => m.id === val);
                                    const capabilities = selectedModel ? detectCapabilities(selectedModel) : {};
                                    setNewOpenAIProvider(prev => ({ ...prev, model: val, description: val, capabilities }));
                                }}
                                onScan={handleOpenAIScan}
                                onSave={handleOpenAISave}
                                footer={
                                    <div className="text-center">
                                        <Text size="sm" secondary={true}>
                                            Don't have an API key? Get one at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline font-bold">platform.openai.com</a>
                                        </Text>
                                    </div>
                                }
                            />
                        </div>
                    )}
                </div>
            </Modal>
        </Page >
    )
}
