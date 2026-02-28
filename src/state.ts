import { WebSocket } from 'ws';

export interface ConnectedClient {
    hostname: string;
    ip: string;
    connectedAt: number;
    tools?: string[];
}

export const connectedClients = new Map<WebSocket, ConnectedClient>();
export const pendingToolCalls = new Map<string, { resolve: (val: any) => void, reject: (err: any) => void }>();

export function broadcastMessage(message: any) {
    const data = JSON.stringify(message);
    for (const ws of connectedClients.keys()) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    }
}
