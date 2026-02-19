
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { faPlus, faKey, faCube, faSave } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Provider from '../Provider'
import Button from '../Button'
import Modal from '../Modal'
import Card from '../Card'
import Select from '../Select'
import Page from './Page'
import ModelsTable from '../ModelsTable'



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
    }[];
}


interface ModelsPageProps {
    config: Config | null;
    setConfig: React.Dispatch<React.SetStateAction<Config | null>>;
    models: string[];
    saveConfig: (e?: React.FormEvent, configOverride?: Config) => Promise<void>;
    fetchModels: (isSilent?: boolean, configOverride?: { endpoint: string, apiKey?: string }) => Promise<boolean | void>;
}

export default function ModelsPage({
    config,
    setConfig,
    models,
    saveConfig,
    fetchModels
}: ModelsPageProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newProvider, setNewProvider] = useState({ description: '', endpoint: '', model: '' });
    const [selectedProviderType, setSelectedProviderType] = useState<string | null>(null);
    const [newGeminiProvider, setNewGeminiProvider] = useState({ apiKey: '', model: '' });
    const [newOpenAIProvider, setNewOpenAIProvider] = useState({ apiKey: '', model: '', description: '' });

    // Editing State
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<{ description: string; model: string; endpoint: string; apiKey?: string }>({ description: '', model: '', endpoint: '' });
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
            setNewGeminiProvider({ apiKey: '', model: '' });
            setNewOpenAIProvider({ apiKey: '', model: '', description: '' });
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
            apiKey: provider.apiKey
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
        };

        const newConfig = { ...config, providers: updatedProviders };
        setConfig(newConfig);
        await saveConfig(undefined, newConfig);
        toast.success("Provider updated");
        setIsEditModalOpen(false);
    };

    const handleScanInEdit = async () => {
        if (!editForm.endpoint) return;
        await fetchModels(false, { endpoint: editForm.endpoint, apiKey: editForm.apiKey });
    };

    return (
        <Page
            title="Models"
            subtitle="Configure your AI models."
            headerAction={
                <Button
                    themed={true}
                    className="text-white px-4 py-2 h-10"
                    icon={faPlus}
                    onClick={() => setIsModalOpen(true)}
                >
                    Add Model
                </Button>
            }
        >

            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 max-w-6xl">
                <ModelsTable
                    providers={config?.providers || []}
                    onRowClick={handleRowClick}
                />
            </div>

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
                            className={`h-12 flex-1 min-w-[140px] text-lg font-bold border-2 transition-all ${selectedProviderType === 'lm-studio' ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-border-color bg-bg-card hover:bg-bg-primary text-neutral-500'}`}
                            onClick={() => setSelectedProviderType('lm-studio')}
                        >
                            LM Studio
                        </Button>
                        <Button
                            className={`h-12 flex-1 min-w-[140px] text-lg font-bold border-2 transition-all ${selectedProviderType === 'google-gemini' ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-border-color bg-bg-card hover:bg-bg-primary text-neutral-500'}`}
                            onClick={() => setSelectedProviderType('google-gemini')}
                        >
                            Google Gemini
                        </Button>
                        <Button
                            className={`h-12 flex-1 min-w-[140px] text-lg font-bold border-2 transition-all ${selectedProviderType === 'openai' ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-border-color bg-bg-card hover:bg-bg-primary text-neutral-500'}`}
                            onClick={() => setSelectedProviderType('openai')}
                        >
                            OpenAI
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
                                    // Scan with the endpoint provided in the inputs
                                    await fetchModels(false, { endpoint: newProvider.endpoint, apiKey: '' });
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

                    {selectedProviderType === 'google-gemini' && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                            <Card className="space-y-6">

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                            <FontAwesomeIcon icon={faKey} size="sm" /> API Key
                                        </label>
                                        <input
                                            type="password"
                                            className="w-full bg-bg-primary border border-border-color rounded-xl px-5 py-3 outline-none focus:border-accent-primary transition-all text-sm"
                                            value={newGeminiProvider.apiKey}
                                            onChange={(e) => setNewGeminiProvider(prev => ({ ...prev, apiKey: e.target.value }))}
                                            placeholder="Enter your Google Gemini API key..."
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                                <FontAwesomeIcon icon={faCube} size="sm" /> Model
                                            </label>
                                            <button
                                                onClick={() => {
                                                    if (!newGeminiProvider.apiKey) {
                                                        toast.error("Please enter an API Key first");
                                                        return;
                                                    }
                                                    fetchModels(false, {
                                                        endpoint: 'https://generativelanguage.googleapis.com/v1beta',
                                                        apiKey: newGeminiProvider.apiKey
                                                    });
                                                }}
                                                className="text-xs text-accent-primary hover:underline font-bold"
                                            >
                                                Scan Available
                                            </button>
                                        </div>
                                        <Select
                                            icon={faCube}
                                            className="!mt-0"
                                            label=""
                                            value={newGeminiProvider.model}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewGeminiProvider(prev => ({ ...prev, model: e.target.value }))}
                                            options={[
                                                { value: '', label: 'Select a model...' },
                                                ...geminiModels.map(m => ({ value: m, label: m })),
                                                // Include scanned models if they aren't already in the list
                                                ...models.filter(m => !geminiModels.includes(m)).map(m => ({ value: m, label: m }))
                                            ]}
                                        />
                                    </div>
                                </div>

                                <Button
                                    themed={true}
                                    className="w-full h-12 text-white"
                                    onClick={async () => {
                                        if (!config) return;

                                        const providerToAdd = {
                                            description: `Google Gemini - ${newGeminiProvider.model}`,
                                            endpoint: 'https://generativelanguage.googleapis.com/v1beta',
                                            model: newGeminiProvider.model,
                                            apiKey: newGeminiProvider.apiKey
                                        };

                                        const updatedProviders = [...(config.providers || []), providerToAdd];

                                        const newConfig = {
                                            ...config,
                                            providers: updatedProviders
                                        };

                                        setConfig(newConfig);
                                        await saveConfig(undefined, newConfig);
                                        toast.success("Successfully saved Google Gemini provider");
                                        setIsModalOpen(false);
                                        setNewGeminiProvider({ apiKey: '', model: '' });
                                    }}
                                    icon={faSave}
                                >
                                    Save Provider Configurations
                                </Button>
                            </Card>
                        </div>
                    )}
                    {selectedProviderType === 'openai' && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                            <Card className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                        Optional Description
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full bg-bg-primary border border-border-color rounded-xl px-5 py-3 outline-none focus:border-accent-primary transition-all text-sm"
                                        value={newOpenAIProvider.description}
                                        onChange={(e) => setNewOpenAIProvider(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="e.g. My OpenAI Account (defaults to OpenAI - ModelName)"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                            <FontAwesomeIcon icon={faKey} size="sm" /> API Key
                                        </label>
                                        <input
                                            type="password"
                                            className="w-full bg-bg-primary border border-border-color rounded-xl px-5 py-3 outline-none focus:border-accent-primary transition-all text-sm"
                                            value={newOpenAIProvider.apiKey}
                                            onChange={(e) => setNewOpenAIProvider(prev => ({ ...prev, apiKey: e.target.value }))}
                                            placeholder="sk-..."
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                                <FontAwesomeIcon icon={faCube} size="sm" /> Model
                                            </label>
                                            <button
                                                onClick={() => {
                                                    if (!newOpenAIProvider.apiKey) {
                                                        toast.error("Please enter an API Key first");
                                                        return;
                                                    }
                                                    fetchModels(false, {
                                                        endpoint: 'https://api.openai.com/v1',
                                                        apiKey: newOpenAIProvider.apiKey
                                                    });
                                                }}
                                                className="text-xs text-accent-primary hover:underline font-bold"
                                            >
                                                Scan Available
                                            </button>
                                        </div>
                                        <Select
                                            icon={faCube}
                                            className="!mt-0"
                                            label=""
                                            value={newOpenAIProvider.model}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewOpenAIProvider(prev => ({ ...prev, model: e.target.value }))}
                                            options={[
                                                { value: '', label: 'Select a model...' },
                                                ...models.map(m => ({ value: m, label: m }))
                                            ]}
                                        />
                                    </div>
                                </div>

                                <Button
                                    themed={true}
                                    className="w-full h-12 text-white"
                                    onClick={async () => {
                                        if (!config || !newOpenAIProvider.apiKey || !newOpenAIProvider.model) {
                                            toast.error("Please provide at least an API Key and select a Model");
                                            return;
                                        }

                                        const description = newOpenAIProvider.description.trim() || `OpenAI - ${newOpenAIProvider.model}`;

                                        const providerToAdd = {
                                            description: description,
                                            endpoint: 'https://api.openai.com/v1',
                                            model: newOpenAIProvider.model,
                                            apiKey: newOpenAIProvider.apiKey
                                        };

                                        const updatedProviders = [...(config.providers || []), providerToAdd];

                                        const newConfig = {
                                            ...config,
                                            providers: updatedProviders
                                        };

                                        setConfig(newConfig);
                                        await saveConfig(undefined, newConfig);
                                        toast.success("Successfully saved OpenAI provider");
                                        setIsModalOpen(false);
                                        setNewOpenAIProvider({ apiKey: '', model: '', description: '' });
                                    }}
                                    icon={faSave}
                                >
                                    Save Provider Configurations
                                </Button>
                            </Card>
                        </div>
                    )}
                </div>
            </Modal>
        </Page >
    )
}
