
export interface Message {
    role: 'user' | 'assistant' | 'reasoning' | 'system' | 'tool';
    content: string;
    timestamp?: number;
    isError?: boolean;
    isWarning?: boolean;
    isEphemeral?: boolean;
    name?: string; // used for tool
    tool_calls?: {
        id?: string;
        type?: string;
        name?: string;
        displayName?: string;
        pluginType?: string;
        arguments?: string;
        function?: { name: string; arguments: string }
    }[];
    stats?: {
        tps?: number;
        tokens?: number;
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
    };
}

export interface Agent {
    id: string;
    name: string;
    avatar?: string;
    path: string;
    identity?: string;
    soul?: string;
    persona?: string;
    memory?: string;
    rules: string;
    heartbeatInstructions?: string;
    heartbeat?: {
        enabled: boolean;
        schedule: string;
        allowManualTrigger?: boolean;
    };
    systemPrompt: string;
    provider?: string;
    isDefault?: boolean;
}

export interface AgentState {
    status: 'idle' | 'chatting' | 'working' | string;
    details?: string;
    since: number;
}

export interface Session {
    id: string;
    agentId: string;
    title: string;
    summary?: string;
    messages: Message[];
    updatedAt: number;
}

export interface Model {
    id: string;
    object?: string;
    created?: number;
    owned_by?: string;
    capabilities?: {
        vision?: boolean;
        trained_for_tool_use?: boolean;
        reasoning?: boolean;
    };
    display_name?: string;
    displayName?: string; // Google Gemini camelCase
    description?: string;
    thinking?: boolean; // Google Gemini
    key?: string; // LM Studio
    type?: string; // LM Studio
    publisher?: string; // LM Studio
    architecture?: string; // LM Studio
    quantization?: {
        name: string;
        bits_per_weight: number;
    };
    size_bytes?: number;
    params_string?: string;
    max_context_length?: number;
    format?: string;
}

export interface Config {
    chat: {
        showReasoning: boolean;
        includeHistory: boolean;
        generateSummaries: boolean;
        showTokenMetrics: boolean;
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
        };
        max_context_length?: number;
    }[];
    memory?: {
        useEmbeddings: boolean;
        embeddingsModel: string;
    };
    system?: {
        version: string;
        latestVersion: string;
    };
    heartbeat?: {
        allowManualTrigger?: boolean;
    };
    enabledTools?: Record<string, boolean>;
    connections?: {
        git: {
            id: string;
            label: string;
            baseUrl: string;
            pat?: string;
            verified?: boolean;
            verifiedUsername?: string;
        }[];
        anthropic?: {
            id: string;
            label: string;
            apiKey: string;
            verified?: boolean;
        }[];
        lmstudio?: {
            id: string;
            label: string;
            endpoint: string;
        }[];
        lemonade?: {
            id: string;
            label: string;
            endpoint: string;
        }[];
        google?: {
            id: string;
            label: string;
            apiKey: string;
            verified?: boolean;
        }[];
        openai?: {
            id: string;
            label: string;
            apiKey: string;
            verified?: boolean;
        }[];
        ollama?: {
            id: string;
            label: string;
            endpoint: string;
        }[];
        openrouter?: {
            id: string;
            label: string;
            apiKey: string;
            verified?: boolean;
        }[];
    };
}

export interface Workflow {
    id: string;
    name: string;
    description: string;
    created_at: number;
}

export interface WorkflowState {
    id: string;
    workflow_id: string;
    name: string;
    order_index: number;
    assigned_agent_id: string | null;
    instructions?: string | null;
}


