
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { faPlus, faKey, faCube, faSave, faRefresh, faAlignLeft, faPencil, faTag, faLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Provider from '../Provider'
import Button from '../Button'
import Modal from '../Modal'
import Card from '../Card'
import Text from '../Text'
import Page from './Page'
import ModelsTable from '../ModelsTable'
import Input from '../Input'
import { Model, Config, Agent } from '../../types'
import GoogleIcon from '../../img/google.png'
import OpenAIIcon from '../../img/openai.svg.png'
import AnthropicIcon from '../../img/anthropic.png'
import LMStudioIcon from '../../img/lmstudio.png'
import OpenRouterIcon from '../../img/openrouter.png'
import OllamaIcon from '../../img/ollama.png'
import LemonadeIcon from '../../img/lemonade.png'
import SectionHeader from '../SectionHeader'
import Row from '../Row'
import Column from '../Column'
import Code from '../Code'
import Select from '../Select'
import SegmentedControl from '../SegmentedControl'

interface ModelsPageProps {
    config: Config | null;
    setConfig: React.Dispatch<React.SetStateAction<Config | null>>;
    models: string[];
    saveConfig: (e?: React.FormEvent, configOverride?: Config) => Promise<void>;
    fetchModels: (isSilent?: boolean, configOverride?: { endpoint: string, apiKey?: string }, skipSetState?: boolean) => Promise<boolean | string[] | Model[] | void>;
    agents: Agent[];
}

const ProviderButton = ({ isSelected, onClick, icon, alt, className = "" }: { isSelected: boolean; onClick: () => void; icon: any; alt: string; className?: string }) => (
    <Button
        className={`h-16 flex-1 min-w-[60px] text-lg font-bold border-2 transition-all ${isSelected ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-divider bg-card hover:bg-surface text-neutral-500'}`}
        onClick={onClick}
    >
        <img src={icon} alt={alt} className={`h-8 ${className}`} />
    </Button>
);

export default function ModelsPage({
    config,
    setConfig,
    models,
    saveConfig,
    fetchModels,
    agents
}: ModelsPageProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newProvider, setNewProvider] = useState<{ description: string; endpoint: string; model: string; capabilities?: { vision?: boolean; reasoning?: boolean; trained_for_tool_use?: boolean }; max_context_length?: number }>({ description: '', endpoint: '', model: '' });
    const [selectedProviderType, setSelectedProviderType] = useState<string | null>(null);
    const [newGeminiProvider, setNewGeminiProvider] = useState({ apiKey: '', model: '', description: '', capabilities: {} as any });
    const [newOpenAIProvider, setNewOpenAIProvider] = useState({ apiKey: '', model: '', description: '', capabilities: {} as any });
    const [newAnthropicProvider, setNewAnthropicProvider] = useState({ apiKey: '', model: '', description: '', capabilities: {} as any });
    const [anthropicAuthMode, setAnthropicAuthMode] = useState<'api_key' | 'connection'>('connection');
    const [selectedAnthropicConnectionId, setSelectedAnthropicConnectionId] = useState('');
    const [googleAuthMode, setGoogleAuthMode] = useState<'connection' | 'api_key'>('connection');
    const [selectedGoogleConnectionId, setSelectedGoogleConnectionId] = useState('');
    const [openAIAuthMode, setOpenAIAuthMode] = useState<'connection' | 'api_key'>('connection');
    const [selectedOpenAIConnectionId, setSelectedOpenAIConnectionId] = useState('');
    const [ollamaAuthMode, setOllamaAuthMode] = useState<'connection' | 'endpoint'>('connection');
    const [selectedOllamaConnectionId, setSelectedOllamaConnectionId] = useState('');
    const [openRouterAuthMode, setOpenRouterAuthMode] = useState<'connection' | 'api_key'>('connection');
    const [selectedOpenRouterConnectionId, setSelectedOpenRouterConnectionId] = useState('');
    const [lmStudioAuthMode, setLmStudioAuthMode] = useState<'connection' | 'endpoint'>('connection');
    const [selectedLMStudioConnectionId, setSelectedLMStudioConnectionId] = useState('');
    const [lemonadeAuthMode, setLemonadeAuthMode] = useState<'connection' | 'endpoint'>('connection');
    const [selectedLemonadeConnectionId, setSelectedLemonadeConnectionId] = useState('');
    const [newOpenRouterProvider, setNewOpenRouterProvider] = useState({ apiKey: '', description: '' });
    const [newLemonadeProvider, setNewLemonadeProvider] = useState({ endpoint: 'http://localhost:8000', model: '', description: '', capabilities: {} as any });
    const [newOllamaProvider, setNewOllamaProvider] = useState({ endpoint: 'http://localhost:11434', model: '', description: '', capabilities: {} as any });
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
            setNewOpenRouterProvider({ apiKey: '', description: '' });
            setNewLemonadeProvider({ endpoint: 'http://localhost:8000', model: '', description: '', capabilities: {} });
            setNewOllamaProvider({ endpoint: 'http://localhost:11434', model: '', description: '', capabilities: {} });
            setLmStudioAuthMode('connection');
            setSelectedLMStudioConnectionId('');
            setLemonadeAuthMode('connection');
            setSelectedLemonadeConnectionId('');
            setGoogleAuthMode('connection');
            setSelectedGoogleConnectionId('');
            setOpenAIAuthMode('connection');
            setSelectedOpenAIConnectionId('');
            setOllamaAuthMode('connection');
            setSelectedOllamaConnectionId('');
            setOpenRouterAuthMode('connection');
            setSelectedOpenRouterConnectionId('');
            setScannedModels([]);
        }
    }, [isModalOpen]);

    useEffect(() => {
        setScannedModels([]);
        if (selectedProviderType === 'lm-studio') {
            setLmStudioAuthMode((config?.connections?.lmstudio?.length ?? 0) > 0 ? 'connection' : 'endpoint');
        }
        if (selectedProviderType === 'lemonade') {
            setLemonadeAuthMode((config?.connections?.lemonade?.length ?? 0) > 0 ? 'connection' : 'endpoint');
        }
        if (selectedProviderType === 'google-gemini') {
            setGoogleAuthMode((config?.connections?.google?.length ?? 0) > 0 ? 'connection' : 'api_key');
        }
        if (selectedProviderType === 'openai') {
            setOpenAIAuthMode((config?.connections?.openai?.length ?? 0) > 0 ? 'connection' : 'api_key');
        }
        if (selectedProviderType === 'ollama') {
            setOllamaAuthMode((config?.connections?.ollama?.length ?? 0) > 0 ? 'connection' : 'endpoint');
        }
        if (selectedProviderType === 'openrouter') {
            setOpenRouterAuthMode((config?.connections?.openrouter?.length ?? 0) > 0 ? 'connection' : 'api_key');
        }
    }, [selectedProviderType]);

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
        toast.success("Model updated");
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



    const handleGeminiScan = async () => {
        const apiKey = resolvedGoogleAPIKey();
        if (!apiKey) {
            toast.error(googleAuthMode === 'connection' ? "Please select a connection first" : "Please enter an API Key first");
            return;
        }
        const result = await fetchModels(false, {
            endpoint: 'https://generativelanguage.googleapis.com/v1beta',
            apiKey
        }, true);
        if (Array.isArray(result)) {
            const models = result.map(m => typeof m === 'string' ? { id: m, object: 'model' } as Model : m);
            setScannedModels(models);
        }
    };

    const handleGeminiSave = async () => {
        const apiKey = resolvedGoogleAPIKey();
        if (!config || !apiKey || !newGeminiProvider.model) {
            toast.error(googleAuthMode === 'connection' ? "Please select a connection and a model" : "Please provide at least an API Key and select a Model");
            return;
        }

        const providerToAdd = {
            description: newGeminiProvider.description.trim() || `Google Gemini - ${newGeminiProvider.model}`,
            endpoint: 'https://generativelanguage.googleapis.com/v1beta',
            model: newGeminiProvider.model,
            apiKey,
            capabilities: newGeminiProvider.capabilities
        };

        const updatedProviders = [...(config.providers || []), providerToAdd];
        const newConfig = { ...config, providers: updatedProviders };
        setConfig(newConfig);
        await saveConfig(undefined, newConfig);
        toast.success("Successfully saved Google Gemini provider");
        setIsModalOpen(false);
        setNewGeminiProvider({ apiKey: '', model: '', description: '', capabilities: {} });
        setSelectedGoogleConnectionId('');
    };

    const handleOpenAIScan = async () => {
        const apiKey = resolvedOpenAIAPIKey();
        if (!apiKey) {
            toast.error(openAIAuthMode === 'connection' ? "Please select a connection first" : "Please enter an API Key first");
            return;
        }
        const result = await fetchModels(false, {
            endpoint: 'https://api.openai.com/v1',
            apiKey
        }, true);
        if (Array.isArray(result)) {
            const models = result.map(m => typeof m === 'string' ? { id: m, object: 'model' } as Model : m);
            setScannedModels(models);
        }
    };

    const handleOpenAISave = async () => {
        const apiKey = resolvedOpenAIAPIKey();
        if (!config || !apiKey || !newOpenAIProvider.model) {
            toast.error(openAIAuthMode === 'connection' ? "Please select a connection and a model" : "Please provide at least an API Key and select a Model");
            return;
        }

        const description = newOpenAIProvider.description.trim() || `OpenAI - ${newOpenAIProvider.model}`;

        const providerToAdd = {
            description: description,
            endpoint: 'https://api.openai.com/v1',
            model: newOpenAIProvider.model,
            apiKey,
            capabilities: newOpenAIProvider.capabilities
        };

        const updatedProviders = [...(config.providers || []), providerToAdd];
        const newConfig = { ...config, providers: updatedProviders };
        setConfig(newConfig);
        await saveConfig(undefined, newConfig);
        toast.success("Successfully saved OpenAI provider");
        setIsModalOpen(false);
        setNewOpenAIProvider({ apiKey: '', model: '', description: '', capabilities: {} });
        setSelectedOpenAIConnectionId('');
    };

    const anthropicConnections = config?.connections?.anthropic ?? [];
    const hasAnthropicConnections = anthropicConnections.length > 0;
    const resolvedAnthropicKey = () => {
        if (anthropicAuthMode === 'connection') {
            return anthropicConnections.find(c => c.id === selectedAnthropicConnectionId)?.apiKey ?? '';
        }
        return newAnthropicProvider.apiKey;
    };

    const lmStudioConnections = config?.connections?.lmstudio ?? [];
    const hasLMStudioConnections = lmStudioConnections.length > 0;
    const resolvedLMStudioEndpoint = () => {
        if (lmStudioAuthMode === 'connection') {
            return lmStudioConnections.find(c => c.id === selectedLMStudioConnectionId)?.endpoint ?? '';
        }
        return newProvider.endpoint;
    };

    const lemonadeConnections = config?.connections?.lemonade ?? [];
    const hasLemonadeConnections = lemonadeConnections.length > 0;
    const resolvedLemonadeEndpoint = () => {
        if (lemonadeAuthMode === 'connection') {
            return lemonadeConnections.find(c => c.id === selectedLemonadeConnectionId)?.endpoint ?? '';
        }
        return newLemonadeProvider.endpoint;
    };

    const googleConnections = config?.connections?.google ?? [];
    const hasGoogleConnections = googleConnections.length > 0;
    const resolvedGoogleAPIKey = () => {
        if (googleAuthMode === 'connection') {
            return googleConnections.find(c => c.id === selectedGoogleConnectionId)?.apiKey ?? '';
        }
        return newGeminiProvider.apiKey;
    };

    const openAIAPIConnections = config?.connections?.openai ?? [];
    const hasOpenAIAPIConnections = openAIAPIConnections.length > 0;
    const resolvedOpenAIAPIKey = () => {
        if (openAIAuthMode === 'connection') {
            return openAIAPIConnections.find(c => c.id === selectedOpenAIConnectionId)?.apiKey ?? '';
        }
        return newOpenAIProvider.apiKey;
    };

    const ollamaConnections = config?.connections?.ollama ?? [];
    const hasOllamaConnections = ollamaConnections.length > 0;
    const resolvedOllamaEndpoint = () => {
        if (ollamaAuthMode === 'connection') {
            return ollamaConnections.find(c => c.id === selectedOllamaConnectionId)?.endpoint ?? '';
        }
        return newOllamaProvider.endpoint;
    };

    const openRouterConnections = config?.connections?.openrouter ?? [];
    const hasOpenRouterConnections = openRouterConnections.length > 0;
    const resolvedOpenRouterAPIKey = () => {
        if (openRouterAuthMode === 'connection') {
            return openRouterConnections.find(c => c.id === selectedOpenRouterConnectionId)?.apiKey ?? '';
        }
        return newOpenRouterProvider.apiKey;
    };

    const handleAnthropicScan = async () => {
        const apiKey = resolvedAnthropicKey();
        if (!apiKey) {
            toast.error(anthropicAuthMode === 'connection' ? "Please select a connection first" : "Please enter an API Key first");
            return;
        }
        const result = await fetchModels(false, {
            endpoint: 'https://api.anthropic.com/v1',
            apiKey
        }, true);
        if (Array.isArray(result)) {
            const models = result.map(m => typeof m === 'string' ? { id: m, object: 'model' } as Model : m);
            setScannedModels(models);
        }
    };

    const handleAnthropicSave = async () => {
        const apiKey = resolvedAnthropicKey();
        if (!config || !apiKey || !newAnthropicProvider.model) {
            toast.error(anthropicAuthMode === 'connection' ? "Please select a connection and a model" : "Please provide at least an API Key and select a Model");
            return;
        }

        const providerToAdd = {
            description: newAnthropicProvider.description.trim() || `Anthropic - ${newAnthropicProvider.model}`,
            endpoint: 'https://api.anthropic.com/v1',
            model: newAnthropicProvider.model,
            apiKey,
            capabilities: newAnthropicProvider.capabilities
        };

        const updatedProviders = [...(config.providers || []), providerToAdd];
        const newConfig = { ...config, providers: updatedProviders };
        setConfig(newConfig);
        await saveConfig(undefined, newConfig);
        toast.success("Successfully saved Anthropic provider");
        setIsModalOpen(false);
        setNewAnthropicProvider({ apiKey: '', model: '', description: '', capabilities: {} });
        setSelectedAnthropicConnectionId('');
    };

    const handleOpenRouterSave = async () => {
        const apiKey = resolvedOpenRouterAPIKey();
        if (!config || !apiKey) {
            toast.error(openRouterAuthMode === 'connection' ? "Please select a connection first" : "Please provide an API Key");
            return;
        }

        const providerToAdd = {
            description: newOpenRouterProvider.description.trim() || `OpenRouter`,
            endpoint: 'https://openrouter.ai/api/v1',
            model: 'openrouter/auto', // Default placeholder
            apiKey,
            capabilities: { vision: true, reasoning: true, trained_for_tool_use: true } // Assume full capabilities for OpenRouter gateway
        };

        const updatedProviders = [...(config.providers || []), providerToAdd];
        const newConfig = { ...config, providers: updatedProviders };
        setConfig(newConfig);
        await saveConfig(undefined, newConfig);
        toast.success("Successfully saved OpenRouter provider");
        setIsModalOpen(false);
        setNewOpenRouterProvider({ apiKey: '', description: '' });
        setSelectedOpenRouterConnectionId('');
    };

    const handleLemonadeScan = async () => {
        const endpoint = resolvedLemonadeEndpoint();
        if (!endpoint) {
            toast.error(lemonadeAuthMode === 'connection' ? 'Please select a connection first' : 'Please enter an endpoint first');
            return;
        }
        const result = await fetchModels(false, {
            endpoint,
            apiKey: ''
        }, true);
        if (Array.isArray(result)) {
            const models = result.map(m => typeof m === 'string' ? { id: m, object: 'model' } as Model : m);
            setScannedModels(models);
        }
    };

    const handleLemonadeSave = async () => {
        const endpoint = resolvedLemonadeEndpoint();
        if (!config || !endpoint) {
            toast.error(lemonadeAuthMode === 'connection' ? 'Please select a connection first' : 'Please enter an endpoint first');
            return;
        }
        if (!newLemonadeProvider.model) {
            toast.error("Please select a Model first");
            return;
        }

        const providerToAdd = {
            description: newLemonadeProvider.description.trim() || `Lemonade - ${newLemonadeProvider.model}`,
            endpoint,
            model: newLemonadeProvider.model,
            capabilities: newLemonadeProvider.capabilities,
            max_context_length: newLemonadeProvider.max_context_length
        };

        const updatedProviders = [...(config.providers || []), providerToAdd];
        const newConfig = { ...config, providers: updatedProviders };
        setConfig(newConfig);
        await saveConfig(undefined, newConfig);
        toast.success("Successfully saved Lemonade provider");
        setIsModalOpen(false);
        setNewLemonadeProvider({ endpoint: 'http://localhost:8000', model: '', description: '', capabilities: {} });
        setSelectedLemonadeConnectionId('');
    };

    const handleOllamaScan = async () => {
        const endpoint = resolvedOllamaEndpoint();
        if (!endpoint) {
            toast.error(ollamaAuthMode === 'connection' ? 'Please select a connection first' : 'Please enter an endpoint first');
            return;
        }
        const result = await fetchModels(false, {
            endpoint,
            apiKey: ''
        }, true);
        if (Array.isArray(result)) {
            const models = result.map(m => typeof m === 'string' ? { id: m, object: 'model' } as Model : m);
            setScannedModels(models);
        }
    };

    const handleOllamaSave = async () => {
        const endpoint = resolvedOllamaEndpoint();
        if (!config || !endpoint) {
            toast.error(ollamaAuthMode === 'connection' ? 'Please select a connection first' : 'Please enter an endpoint first');
            return;
        }
        if (!newOllamaProvider.model) {
            toast.error("Please select a Model first");
            return;
        }

        const providerToAdd = {
            description: newOllamaProvider.description.trim() || `Ollama - ${newOllamaProvider.model}`,
            endpoint,
            model: newOllamaProvider.model,
            capabilities: newOllamaProvider.capabilities,
            max_context_length: newOllamaProvider.max_context_length
        };

        const updatedProviders = [...(config.providers || []), providerToAdd];
        const newConfig = { ...config, providers: updatedProviders };
        setConfig(newConfig);
        await saveConfig(undefined, newConfig);
        toast.success("Successfully saved Ollama provider");
        setIsModalOpen(false);
        setNewOllamaProvider({ endpoint: 'http://localhost:11434', model: '', description: '', capabilities: {} });
        setSelectedOllamaConnectionId('');
    };

    const augmentedProviders = config?.providers.map((p, i) => ({ ...p, originalIndex: i })) || [];
    const lemonadeConnEndpoints = new Set((config?.connections?.lemonade ?? []).map(c => c.endpoint));
    const lmStudioConnEndpoints = new Set((config?.connections?.lmstudio ?? []).map(c => c.endpoint));
    const ollamaConnEndpoints = new Set((config?.connections?.ollama ?? []).map(c => c.endpoint));
    const anthropicModels = augmentedProviders.filter(p => p.endpoint.includes('anthropic.com'));
    const googleModels = augmentedProviders.filter(p => p.endpoint.includes('googleapis.com'));
    const lemonadeModels = augmentedProviders.filter(p => p.endpoint.includes(':8000') || p.description.toLowerCase().includes('lemonade') || lemonadeConnEndpoints.has(p.endpoint));
    const ollamaModels = augmentedProviders.filter(p => p.endpoint.includes(':11434') || p.description.toLowerCase().includes('ollama') || ollamaConnEndpoints.has(p.endpoint));
    const lmStudioModels = augmentedProviders.filter(p => p.endpoint.includes(':1234') || lmStudioConnEndpoints.has(p.endpoint));
    const openAIModels = augmentedProviders.filter(p => p.endpoint.includes('api.openai.com'));
    const openRouterModels = augmentedProviders.filter(p => p.endpoint.includes('openrouter.ai'));
    const otherModels = augmentedProviders.filter(p =>
        !p.endpoint.includes('anthropic.com') &&
        !p.endpoint.includes('googleapis.com') &&
        !p.endpoint.includes(':8000') &&
        !p.description.toLowerCase().includes('lemonade') &&
        !lemonadeConnEndpoints.has(p.endpoint) &&
        !p.endpoint.includes(':11434') &&
        !p.description.toLowerCase().includes('ollama') &&
        !ollamaConnEndpoints.has(p.endpoint) &&
        !p.endpoint.includes(':1234') &&
        !lmStudioConnEndpoints.has(p.endpoint) &&
        !p.endpoint.includes('api.openai.com') &&
        !p.endpoint.includes('openrouter.ai')
    );

    return (
        <Page
            title="Models"
            subtitle="Configure your AI models."
            headerAction={
                <Button themed={true} icon={faPlus} onClick={() => setIsModalOpen(true)}>Add Model</Button>
            }
        >
            <>
                {augmentedProviders.length === 0 ? (
                    <ModelsTable providers={[]} onRowClick={() => { }} agents={agents} />
                ) : (
                    <>
                        {anthropicModels.length > 0 && (
                            <>
                                <SectionHeader title="Anthropic" icon={AnthropicIcon} />
                                <Card>
                                    <ModelsTable
                                        providers={anthropicModels}
                                        onRowClick={(i) => handleRowClick(anthropicModels[i].originalIndex)}
                                        onDelete={(i) => handleDeleteProvider(anthropicModels[i].originalIndex)}
                                        agents={agents}
                                    />
                                </Card>
                            </>
                        )}

                        {googleModels.length > 0 && (
                            <>
                                <SectionHeader title="Google" icon={GoogleIcon} />
                                <Card>
                                    <ModelsTable
                                        providers={googleModels}
                                        onRowClick={(i) => handleRowClick(googleModels[i].originalIndex)}
                                        onDelete={(i) => handleDeleteProvider(googleModels[i].originalIndex)}
                                        agents={agents}
                                    />
                                </Card>
                            </>
                        )}

                        {lemonadeModels.length > 0 && (
                            <>
                                <SectionHeader title="Lemonade" icon={LemonadeIcon} />
                                <Card>
                                    <ModelsTable
                                        providers={lemonadeModels}
                                        onRowClick={(i) => handleRowClick(lemonadeModels[i].originalIndex)}
                                        onDelete={(i) => handleDeleteProvider(lemonadeModels[i].originalIndex)}
                                        agents={agents}
                                    />
                                </Card>
                            </>
                        )}

                        {ollamaModels.length > 0 && (
                            <>
                                <SectionHeader title="Ollama" icon={OllamaIcon} />
                                <Card>
                                    <ModelsTable
                                        providers={ollamaModels}
                                        onRowClick={(i) => handleRowClick(ollamaModels[i].originalIndex)}
                                        onDelete={(i) => handleDeleteProvider(ollamaModels[i].originalIndex)}
                                        agents={agents}
                                    />
                                </Card>
                            </>
                        )}

                        {lmStudioModels.length > 0 && (
                            <>
                                <SectionHeader title="LM Studio" icon={LMStudioIcon} />
                                <Card>
                                    <ModelsTable
                                        providers={lmStudioModels}
                                        onRowClick={(i) => handleRowClick(lmStudioModels[i].originalIndex)}
                                        onDelete={(i) => handleDeleteProvider(lmStudioModels[i].originalIndex)}
                                        agents={agents}
                                    />
                                </Card>
                            </>
                        )}

                        {openAIModels.length > 0 && (
                            <>
                                <SectionHeader title="OpenAI" icon={OpenAIIcon} />
                                <Card>
                                    <ModelsTable
                                        providers={openAIModels}
                                        onRowClick={(i) => handleRowClick(openAIModels[i].originalIndex)}
                                        onDelete={(i) => handleDeleteProvider(openAIModels[i].originalIndex)}
                                        agents={agents}
                                    />
                                </Card>
                            </>
                        )}

                        {openRouterModels.length > 0 && (
                            <>
                                <SectionHeader title="OpenRouter" icon={OpenRouterIcon} />
                                <Card>
                                    <Row>
                                        <Column grow={true}>
                                            <Text bold={true}>OpenRouter is active</Text>
                                            <Text size="sm" secondary={true}>You can now use OpenRouter models with your agents.</Text>
                                        </Column>
                                        <Column>
                                            <Button size="sm" themed={false} className="!text-rose-500 hover:!bg-rose-500/10" onClick={() => handleDeleteProvider(openRouterModels[0].originalIndex)}>Remove</Button>
                                        </Column>
                                    </Row>
                                    {/* <div className="flex items-center gap-4">
                                        <img src={OpenRouterIcon} className="h-7 dark:invert" alt="OpenRouter" />
                                        <div>
                                            <div></div>
                                            <div></div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                    </div> */}
                                </Card>
                            </>
                        )}

                        {/* {otherModels.length > 0 && (
                            <>
                                <h3 className="text-lg font-semibold px-1">Other</h3>
                                <ModelsTable
                                    providers={otherModels}
                                    onRowClick={(i) => handleRowClick(otherModels[i].originalIndex)}
                                    onDelete={(i) => handleDeleteProvider(otherModels[i].originalIndex)}
                                    agents={agents}
                                />
                            </>
                        )} */}
                    </>
                )}
            </>

            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Edit Model"
            >
                <Page>
                    {/* <SectionHeader title="Model Name" icon={faTag} /> */}
                    <Column>
                        <Text>Model Name</Text>
                        <Text bold={true}><Code>{editForm.model}</Code></Text>
                    </Column>
                    <Input
                        label="Description"
                        icon={faTag}
                        currentText={editForm.description}
                        onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter a description for this model"
                    />
                    <Button
                        themed={true}
                        onClick={handleUpdateProvider}
                        icon={faSave}
                    >Update Model</Button>
                </Page>
            </Modal>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Add New Model"
                className="max-w-2xl"
            >
                {/* PROVIDER BUTTONS */}
                <div className="p-6">
                    <div className="flex gap-4 justify-center mb-6 overflow-x-auto">
                        <ProviderButton
                            isSelected={selectedProviderType === 'anthropic'}
                            onClick={() => setSelectedProviderType('anthropic')}
                            icon={AnthropicIcon}
                            alt="Anthropic"
                            className="dark:invert"
                        />
                        <ProviderButton
                            isSelected={selectedProviderType === 'google-gemini'}
                            onClick={() => setSelectedProviderType('google-gemini')}
                            icon={GoogleIcon}
                            alt="Google Gemini"
                        />
                        <ProviderButton
                            isSelected={selectedProviderType === 'lemonade'}
                            onClick={() => setSelectedProviderType('lemonade')}
                            icon={LemonadeIcon}
                            alt="Lemonade"
                        />
                        <ProviderButton
                            isSelected={selectedProviderType === 'lm-studio'}
                            onClick={() => setSelectedProviderType('lm-studio')}
                            icon={LMStudioIcon}
                            alt="LM Studio"
                        />
                        <ProviderButton
                            isSelected={selectedProviderType === 'ollama'}
                            onClick={() => setSelectedProviderType('ollama')}
                            icon={OllamaIcon}
                            alt="Ollama"
                            className="dark:invert"
                        />
                        <ProviderButton
                            isSelected={selectedProviderType === 'openai'}
                            onClick={() => setSelectedProviderType('openai')}
                            icon={OpenAIIcon}
                            alt="OpenAI"
                            className="dark:invert"
                        />
                        <ProviderButton
                            isSelected={selectedProviderType === 'openrouter'}
                            onClick={() => setSelectedProviderType('openrouter')}
                            icon={OpenRouterIcon}
                            alt="OpenRouter"
                            className="dark:invert"
                        />
                    </div>

                    {selectedProviderType === 'anthropic' && (
                        <Provider
                            name="Anthropic"
                            inputLabel={anthropicAuthMode === 'connection' ? "CONNECTION" : "API KEY"}
                            inputIcon={faKey}
                            inputPlaceholder="sk-ant-..."
                            description={newAnthropicProvider.description}
                            endpoint={anthropicAuthMode === 'api_key' ? newAnthropicProvider.apiKey : ''}
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
                            credentialSlot={hasAnthropicConnections ? (
                                <div className="flex flex-col gap-2 w-full">
                                    <SegmentedControl
                                        options={[
                                            { value: 'connection', label: 'Saved Connection' },
                                            { value: 'api_key', label: 'API Key' },
                                        ]}
                                        value={anthropicAuthMode}
                                        onChange={(val: 'api_key' | 'connection') => setAnthropicAuthMode(val)}
                                    />
                                    {anthropicAuthMode === 'connection' ? (
                                        <Select
                                            label="CONNECTION"
                                            icon={faLink}
                                            options={[
                                                { value: '', label: 'Select a connection…' },
                                                ...anthropicConnections.map(c => ({ value: c.id, label: c.label }))
                                            ]}
                                            value={selectedAnthropicConnectionId}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedAnthropicConnectionId(e.target.value)}
                                        />
                                    ) : (
                                        <Input
                                            label="API KEY"
                                            icon={faKey}
                                            currentText={newAnthropicProvider.apiKey}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAnthropicProvider(prev => ({ ...prev, apiKey: e.target.value }))}
                                            placeholder="sk-ant-..."
                                            clearText={() => setNewAnthropicProvider(prev => ({ ...prev, apiKey: '' }))}
                                        />
                                    )}
                                </div>
                            ) : undefined}
                            footer={
                                <div className="text-center">
                                    <Text size="sm" secondary={true}>
                                        Don't have an API key? Get one at <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">console.anthropic.com</a>
                                    </Text>
                                </div>
                            }
                        />
                    )}

                    {selectedProviderType === 'lm-studio' && (
                        <Provider
                            name="LM Studio"
                            description={newProvider.description}
                            endpoint={lmStudioAuthMode === 'endpoint' ? newProvider.endpoint : ''}
                            model={newProvider.model}
                            models={scannedModels}
                            onDescriptionChange={(val) => setNewProvider(prev => ({ ...prev, description: val }))}
                            onEndpointChange={(val) => setNewProvider(prev => ({ ...prev, endpoint: val }))}
                            onModelChange={(val) => {
                                const selectedModel = scannedModels.find(m => m.id === val);
                                const capabilities = selectedModel ? detectCapabilities(selectedModel) : {};
                                setNewProvider(prev => ({ ...prev, model: val, description: val, capabilities, max_context_length: selectedModel?.max_context_length }));
                            }}
                            onScan={async () => {
                                const endpoint = resolvedLMStudioEndpoint();
                                if (!endpoint) {
                                    toast.error(lmStudioAuthMode === 'connection' ? 'Please select a connection first' : 'Please enter an endpoint first');
                                    return;
                                }
                                const result = await fetchModels(false, { endpoint, apiKey: '' }, true);
                                if (Array.isArray(result)) {
                                    const models = result.map(m => typeof m === 'string' ? { id: m, object: 'model' } as Model : m);
                                    setScannedModels(models);
                                }
                            }}
                            credentialSlot={(
                                <div className="flex flex-col gap-2 w-full">
                                    <SegmentedControl
                                        options={[
                                            { value: 'connection', label: 'Saved Connection' },
                                            { value: 'endpoint', label: 'Endpoint' },
                                        ]}
                                        value={lmStudioAuthMode}
                                        onChange={(val: 'connection' | 'endpoint') => setLmStudioAuthMode(val)}
                                    />
                                    {lmStudioAuthMode === 'connection' ? (
                                        hasLMStudioConnections ? (
                                            <Select
                                                label="CONNECTION"
                                                icon={faLink}
                                                options={[
                                                    { value: '', label: 'Select a connection…' },
                                                    ...lmStudioConnections.map(c => ({ value: c.id, label: c.label }))
                                                ]}
                                                value={selectedLMStudioConnectionId}
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedLMStudioConnectionId(e.target.value)}
                                            />
                                        ) : (
                                            <Text size="sm" secondary={true}>
                                                No saved connections. Add one in <span className="font-semibold">Settings → Connections</span>.
                                            </Text>
                                        )
                                    ) : (
                                        <Input
                                            label="ENDPOINT"
                                            icon={faLink}
                                            currentText={newProvider.endpoint}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProvider(prev => ({ ...prev, endpoint: e.target.value }))}
                                            placeholder="http://localhost:1234"
                                            clearText={() => setNewProvider(prev => ({ ...prev, endpoint: '' }))}
                                        />
                                    )}
                                </div>
                            )}
                            onSave={async () => {
                                if (!config) return;

                                const endpoint = resolvedLMStudioEndpoint();
                                if (!endpoint) {
                                    toast.error(lmStudioAuthMode === 'connection' ? 'Please select a connection first' : 'Please enter an endpoint first');
                                    return;
                                }

                                const providerToAdd = {
                                    description: newProvider.description,
                                    endpoint,
                                    model: newProvider.model,
                                    capabilities: newProvider.capabilities,
                                    max_context_length: newProvider.max_context_length
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
                                setSelectedLMStudioConnectionId('');
                            }}
                            footer={
                                <div className="text-center">
                                    <Text size="sm" secondary={true}>
                                        Download LM Studio from <a href="https://lmstudio.ai/download" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">lmstudio.ai/download</a>
                                    </Text>
                                </div>
                            }
                        />
                    )}

                    {selectedProviderType === 'google-gemini' && (
                        <Provider
                            name="Google"
                            inputLabel="API KEY"
                            inputIcon={faKey}
                            inputPlaceholder="AIza..."
                            description={newGeminiProvider.description}
                            endpoint={googleAuthMode === 'api_key' ? newGeminiProvider.apiKey : ''}
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
                            credentialSlot={hasGoogleConnections ? (
                                <div className="flex flex-col gap-2 w-full">
                                    <SegmentedControl
                                        options={[
                                            { value: 'connection', label: 'Saved Connection' },
                                            { value: 'api_key', label: 'API Key' },
                                        ]}
                                        value={googleAuthMode}
                                        onChange={(val: 'connection' | 'api_key') => setGoogleAuthMode(val)}
                                    />
                                    {googleAuthMode === 'connection' ? (
                                        <Select
                                            label="CONNECTION"
                                            icon={faLink}
                                            options={[
                                                { value: '', label: 'Select a connection…' },
                                                ...googleConnections.map(c => ({ value: c.id, label: c.label }))
                                            ]}
                                            value={selectedGoogleConnectionId}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedGoogleConnectionId(e.target.value)}
                                        />
                                    ) : (
                                        <Input
                                            label="API KEY"
                                            icon={faKey}
                                            currentText={newGeminiProvider.apiKey}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewGeminiProvider(prev => ({ ...prev, apiKey: e.target.value }))}
                                            placeholder="AIza..."
                                            clearText={() => setNewGeminiProvider(prev => ({ ...prev, apiKey: '' }))}
                                        />
                                    )}
                                </div>
                            ) : undefined}
                            footer={
                                <div className="text-center">
                                    <Text size="sm" secondary={true}>
                                        Don't have an API key? Get one at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">aistudio.google.com</a>
                                    </Text>
                                </div>
                            }
                        />
                    )}

                    {selectedProviderType === 'lemonade' && (
                        <Provider
                            name="Lemonade"
                            description={newLemonadeProvider.description}
                            endpoint={lemonadeAuthMode === 'endpoint' ? newLemonadeProvider.endpoint : ''}
                            model={newLemonadeProvider.model}
                            models={scannedModels}
                            onDescriptionChange={(val) => setNewLemonadeProvider(prev => ({ ...prev, description: val }))}
                            onEndpointChange={(val) => setNewLemonadeProvider(prev => ({ ...prev, endpoint: val }))}
                            onModelChange={(val) => {
                                const selectedModel = scannedModels.find(m => m.id === val);
                                const capabilities = selectedModel ? detectCapabilities(selectedModel) : {};
                                setNewLemonadeProvider(prev => ({ ...prev, model: val, description: val, capabilities, max_context_length: selectedModel?.max_context_length }));
                            }}
                            onScan={handleLemonadeScan}
                            onSave={handleLemonadeSave}
                            inputPlaceholder="http://localhost:8000"
                            credentialSlot={(
                                <div className="flex flex-col gap-2 w-full">
                                    <SegmentedControl
                                        options={[
                                            { value: 'connection', label: 'Saved Connection' },
                                            { value: 'endpoint', label: 'Endpoint' },
                                        ]}
                                        value={lemonadeAuthMode}
                                        onChange={(val: 'connection' | 'endpoint') => setLemonadeAuthMode(val)}
                                    />
                                    {lemonadeAuthMode === 'connection' ? (
                                        hasLemonadeConnections ? (
                                            <Select
                                                label="CONNECTION"
                                                icon={faLink}
                                                options={[
                                                    { value: '', label: 'Select a connection…' },
                                                    ...lemonadeConnections.map(c => ({ value: c.id, label: c.label }))
                                                ]}
                                                value={selectedLemonadeConnectionId}
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedLemonadeConnectionId(e.target.value)}
                                            />
                                        ) : (
                                            <Text size="sm" secondary={true}>
                                                No saved connections. Add one in <span className="font-semibold">Settings → Connections</span>.
                                            </Text>
                                        )
                                    ) : (
                                        <Input
                                            label="ENDPOINT"
                                            icon={faLink}
                                            currentText={newLemonadeProvider.endpoint}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewLemonadeProvider(prev => ({ ...prev, endpoint: e.target.value }))}
                                            placeholder="http://localhost:8000"
                                            clearText={() => setNewLemonadeProvider(prev => ({ ...prev, endpoint: '' }))}
                                        />
                                    )}
                                </div>
                            )}
                            footer={
                                <div className="text-center">
                                    <Text size="sm" secondary={true}>
                                        Download Lemonade from <a href="https://lemonade-server.ai/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">lemonade-server.ai</a>
                                    </Text>
                                </div>
                            }
                        />
                    )}
                    {selectedProviderType === 'ollama' && (
                        <Provider
                            name="Ollama"
                            description={newOllamaProvider.description}
                            endpoint={ollamaAuthMode === 'endpoint' ? newOllamaProvider.endpoint : ''}
                            model={newOllamaProvider.model}
                            models={scannedModels}
                            onDescriptionChange={(val) => setNewOllamaProvider(prev => ({ ...prev, description: val }))}
                            onEndpointChange={(val) => setNewOllamaProvider(prev => ({ ...prev, endpoint: val }))}
                            onModelChange={(val) => {
                                const selectedModel = scannedModels.find(m => m.id === val);
                                const capabilities = selectedModel ? detectCapabilities(selectedModel) : {};
                                setNewOllamaProvider(prev => ({ ...prev, model: val, description: val, capabilities, max_context_length: selectedModel?.max_context_length }));
                            }}
                            onScan={handleOllamaScan}
                            onSave={handleOllamaSave}
                            inputPlaceholder="http://localhost:11434"
                            credentialSlot={(
                                <div className="flex flex-col gap-2 w-full">
                                    <SegmentedControl
                                        options={[
                                            { value: 'connection', label: 'Saved Connection' },
                                            { value: 'endpoint', label: 'Endpoint' },
                                        ]}
                                        value={ollamaAuthMode}
                                        onChange={(val: 'connection' | 'endpoint') => setOllamaAuthMode(val)}
                                    />
                                    {ollamaAuthMode === 'connection' ? (
                                        hasOllamaConnections ? (
                                            <Select
                                                label="CONNECTION"
                                                icon={faLink}
                                                options={[
                                                    { value: '', label: 'Select a connection…' },
                                                    ...ollamaConnections.map(c => ({ value: c.id, label: c.label }))
                                                ]}
                                                value={selectedOllamaConnectionId}
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedOllamaConnectionId(e.target.value)}
                                            />
                                        ) : (
                                            <Text size="sm" secondary={true}>
                                                No saved connections. Add one in <span className="font-semibold">Settings → Connections</span>.
                                            </Text>
                                        )
                                    ) : (
                                        <Input
                                            label="ENDPOINT"
                                            icon={faLink}
                                            currentText={newOllamaProvider.endpoint}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOllamaProvider(prev => ({ ...prev, endpoint: e.target.value }))}
                                            placeholder="http://localhost:11434"
                                            clearText={() => setNewOllamaProvider(prev => ({ ...prev, endpoint: '' }))}
                                        />
                                    )}
                                </div>
                            )}
                            footer={
                                <div className="text-center">
                                    <Text size="sm" secondary={true}>
                                        Download Ollama from <a href="https://ollama.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">ollama.com</a>
                                    </Text>
                                </div>
                            }
                        />
                    )}
                    {selectedProviderType === 'openai' && (
                        <Provider
                            name="OpenAI"
                            inputLabel="API KEY"
                            inputIcon={faKey}
                            inputPlaceholder="sk-..."
                            description={newOpenAIProvider.description}
                            endpoint={openAIAuthMode === 'api_key' ? newOpenAIProvider.apiKey : ''}
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
                            credentialSlot={hasOpenAIAPIConnections ? (
                                <div className="flex flex-col gap-2 w-full">
                                    <SegmentedControl
                                        options={[
                                            { value: 'connection', label: 'Saved Connection' },
                                            { value: 'api_key', label: 'API Key' },
                                        ]}
                                        value={openAIAuthMode}
                                        onChange={(val: 'connection' | 'api_key') => setOpenAIAuthMode(val)}
                                    />
                                    {openAIAuthMode === 'connection' ? (
                                        <Select
                                            label="CONNECTION"
                                            icon={faLink}
                                            options={[
                                                { value: '', label: 'Select a connection…' },
                                                ...openAIAPIConnections.map(c => ({ value: c.id, label: c.label }))
                                            ]}
                                            value={selectedOpenAIConnectionId}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedOpenAIConnectionId(e.target.value)}
                                        />
                                    ) : (
                                        <Input
                                            label="API KEY"
                                            icon={faKey}
                                            currentText={newOpenAIProvider.apiKey}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOpenAIProvider(prev => ({ ...prev, apiKey: e.target.value }))}
                                            placeholder="sk-..."
                                            clearText={() => setNewOpenAIProvider(prev => ({ ...prev, apiKey: '' }))}
                                        />
                                    )}
                                </div>
                            ) : undefined}
                            footer={
                                <div className="text-center">
                                    <Text size="sm" secondary={true}>
                                        Don't have an API key? Get one at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">platform.openai.com</a>
                                    </Text>
                                </div>
                            }
                        />
                    )}
                    {selectedProviderType === 'openrouter' && (
                        <Page padding={0}>
                            <Text bold={true} size="xl">OpenRouter</Text>
                            <div className="flex flex-col gap-2">
                                {hasOpenRouterConnections ? (
                                    <>
                                        <SegmentedControl
                                            options={[
                                                { value: 'connection', label: 'Saved Connection' },
                                                { value: 'api_key', label: 'API Key' },
                                            ]}
                                            value={openRouterAuthMode}
                                            onChange={(val: 'connection' | 'api_key') => setOpenRouterAuthMode(val)}
                                        />
                                        {openRouterAuthMode === 'connection' ? (
                                            <Select
                                                label="CONNECTION"
                                                icon={faLink}
                                                options={[
                                                    { value: '', label: 'Select a connection…' },
                                                    ...openRouterConnections.map(c => ({ value: c.id, label: c.label }))
                                                ]}
                                                value={selectedOpenRouterConnectionId}
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedOpenRouterConnectionId(e.target.value)}
                                            />
                                        ) : (
                                            <Input
                                                label="API KEY"
                                                icon={faKey}
                                                currentText={newOpenRouterProvider.apiKey}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOpenRouterProvider(prev => ({ ...prev, apiKey: e.target.value }))}
                                                placeholder="sk-or-v1-..."
                                                clearText={() => setNewOpenRouterProvider(prev => ({ ...prev, apiKey: '' }))}
                                            />
                                        )}
                                    </>
                                ) : (
                                    <Input
                                        label="API KEY"
                                        icon={faKey}
                                        currentText={newOpenRouterProvider.apiKey}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOpenRouterProvider(prev => ({ ...prev, apiKey: e.target.value }))}
                                        placeholder="sk-or-v1-..."
                                        clearText={() => setNewOpenRouterProvider(prev => ({ ...prev, apiKey: '' }))}
                                    />
                                )}
                                <Input
                                    label="(optional) Description"
                                    icon={faTag}
                                    currentText={newOpenRouterProvider.description}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOpenRouterProvider(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="My OpenRouter account"
                                    clearText={() => setNewOpenRouterProvider(prev => ({ ...prev, description: '' }))}
                                />
                            </div>
                            <Button
                                themed={true}
                                onClick={handleOpenRouterSave}
                                icon={faSave}
                            >
                                Save OpenRouter Configuration
                            </Button>
                            <div className="text-center pt-2 border-t border-divider border-dashed">
                                <Text size="sm" secondary={true}>
                                    Don't have an API key? Get one at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">openrouter.ai/keys</a>
                                </Text>
                            </div>
                        </Page>
                    )}
                </div>
            </Modal >
        </Page >
    )
}
