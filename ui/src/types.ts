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
