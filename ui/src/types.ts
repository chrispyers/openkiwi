
export interface Message {
    role: 'user' | 'assistant' | 'reasoning' | 'system';
    content: string;
    timestamp?: number;
}

export interface Agent {
    id: string;
    name: string;
    emoji: string;
    path: string;
    identity: string;
    soul: string;
    heartbeatInstructions?: string;
    heartbeat?: {
        enabled: boolean;
        schedule: string;
    };
    systemPrompt: string;
    provider?: string;
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
