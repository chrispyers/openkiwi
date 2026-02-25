import { WebSocket } from 'ws';

export interface ConnectedClient {
    hostname: string;
    ip: string;
    connectedAt: number;
    tools?: string[];
}

export const connectedClients = new Map<WebSocket, ConnectedClient>();
export const pendingToolCalls = new Map<string, { resolve: (val: any) => void, reject: (err: any) => void }>();
