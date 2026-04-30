import { spawn, ChildProcess } from 'node:child_process';
import { loadConfig } from './config-manager.js';
import { ToolManager } from './tool-manager.js';

/**
 * MCP Client Manager
 *
 * Manages connections to MCP (Model Context Protocol) servers.
 * Each server runs as a child process communicating via JSON-RPC 2.0 over stdio.
 */

interface MCPServerConnection {
    name: string;
    command: string;
    args: string[];
    process: ChildProcess | null;
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    error?: string;
    tools: MCPToolInfo[];
    capabilities?: any;
}

interface MCPToolInfo {
    name: string;
    description: string;
    inputSchema: any;
}

interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: number;
    method: string;
    params?: any;
}

interface JsonRpcNotification {
    jsonrpc: '2.0';
    method: string;
    params?: any;
}

interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: number;
    result?: any;
    error?: { code: number; message: string; data?: any };
}

export class MCPClientManager {
    private static connections: Map<string, MCPServerConnection> = new Map();
    private static requestId = 0;
    private static pendingRequests: Map<number, { resolve: (value: any) => void; reject: (reason: any) => void }> = new Map();
    private static buffers: Map<string, string> = new Map();

    /**
     * Connect to all MCP servers defined in config and register their tools.
     */
    static async connectAll(): Promise<void> {
        const config = loadConfig();
        const mcpServers = config.mcpServers || {};

        // Disconnect any servers that were removed from config
        for (const [name] of this.connections) {
            if (!mcpServers[name]) {
                await this.disconnect(name);
            }
        }

        // Connect to each configured server
        const connectPromises: Promise<void>[] = [];
        for (const [name, serverConfig] of Object.entries(mcpServers)) {
            const existing = this.connections.get(name);
            if (existing && existing.status === 'connected') {
                continue; // Already connected
            }
            connectPromises.push(this.connect(name, serverConfig.command, serverConfig.args || []));
        }

        await Promise.allSettled(connectPromises);
    }

    /**
     * Connect to a single MCP server, perform handshake, discover tools, and register them.
     */
    static async connect(name: string, command: string, args: string[]): Promise<void> {
        // Clean up any existing connection
        await this.disconnect(name);

        const connection: MCPServerConnection = {
            name,
            command,
            args,
            process: null,
            status: 'connecting',
            tools: [],
        };
        this.connections.set(name, connection);
        this.buffers.set(name, '');

        try {
            // Spawn the MCP server process
            const child = spawn(command, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env },
            });

            connection.process = child;

            // Handle stderr (logging only)
            child.stderr?.on('data', (data: Buffer) => {
                const msg = data.toString().trim();
                if (msg) {
                    console.log(`[MCP:${name}:stderr] ${msg}`);
                }
            });

            // Handle stdout — accumulate and parse JSON-RPC messages
            child.stdout?.on('data', (data: Buffer) => {
                const buf = (this.buffers.get(name) || '') + data.toString();
                this.buffers.set(name, buf);
                this.processBuffer(name);
            });

            // Handle process exit
            child.on('close', (code) => {
                console.log(`[MCP:${name}] Process exited with code ${code}`);
                connection.status = 'disconnected';
                connection.process = null;
                // Unregister tools from this server
                this.unregisterToolsForServer(name);
            });

            child.on('error', (err) => {
                console.error(`[MCP:${name}] Process error:`, err.message);
                connection.status = 'error';
                connection.error = err.message;
                this.unregisterToolsForServer(name);
            });

            // Wait for process to be ready
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('MCP server process failed to start')), 10000);
                child.on('spawn', () => { clearTimeout(timeout); resolve(); });
                child.on('error', (err) => { clearTimeout(timeout); reject(err); });
            });

            // Step 1: Initialize
            const initResult = await this.sendRequest(name, 'initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: {
                    name: 'openkiwi',
                    version: '1.0.0',
                },
            });

            connection.capabilities = initResult?.capabilities;
            console.log(`[MCP:${name}] Initialized. Server capabilities:`, JSON.stringify(initResult?.capabilities || {}));

            // Step 2: Send initialized notification
            this.sendNotification(name, 'notifications/initialized', {});

            // Step 3: Discover tools
            const toolsResult = await this.sendRequest(name, 'tools/list', {});
            const tools: MCPToolInfo[] = (toolsResult?.tools || []).map((t: any) => ({
                name: t.name,
                description: t.description || '',
                inputSchema: t.inputSchema || { type: 'object', properties: {} },
            }));

            connection.tools = tools;
            connection.status = 'connected';

            // Step 4: Register each tool with ToolManager
            for (const tool of tools) {
                this.registerMCPTool(name, tool);
            }

            console.log(`[MCP:${name}] Connected. Discovered ${tools.length} tool(s): ${tools.map(t => t.name).join(', ')}`);

        } catch (err: any) {
            console.error(`[MCP:${name}] Failed to connect:`, err.message);
            connection.status = 'error';
            connection.error = err.message;
            // Kill process if still running
            if (connection.process && !connection.process.killed) {
                connection.process.kill();
            }
            connection.process = null;
        }
    }

    /**
     * Register an MCP tool with the ToolManager so agents can use it.
     */
    private static registerMCPTool(serverName: string, tool: MCPToolInfo): void {
        const toolName = `mcp_${serverName}_${tool.name}`;

        ToolManager.registerTool({
            definition: {
                name: toolName,
                displayName: `${tool.name} (MCP: ${serverName})`,
                description: tool.description,
                pluginType: 'mcp',
                parameters: tool.inputSchema || { type: 'object', properties: {} },
            },
            handler: async (args: any) => {
                // Strip _context before sending to MCP server
                const { _context, ...toolArgs } = args;
                return await MCPClientManager.callTool(serverName, tool.name, toolArgs);
            },
        });

        console.log(`[MCP:${serverName}] Registered tool: ${toolName}`);
    }

    /**
     * Unregister all tools belonging to a specific MCP server.
     */
    private static unregisterToolsForServer(serverName: string): void {
        const connection = this.connections.get(serverName);
        if (!connection) return;

        for (const tool of connection.tools) {
            const toolName = `mcp_${serverName}_${tool.name}`;
            ToolManager.unregisterTool(toolName);
        }
    }

    /**
     * Call a tool on an MCP server.
     */
    static async callTool(serverName: string, toolName: string, args: any): Promise<any> {
        const connection = this.connections.get(serverName);
        if (!connection || connection.status !== 'connected') {
            throw new Error(`MCP server '${serverName}' is not connected`);
        }

        const result = await this.sendRequest(serverName, 'tools/call', {
            name: toolName,
            arguments: args,
        });

        if (result?.isError) {
            const errorText = result.content?.map((c: any) => c.text).join('\n') || 'Unknown MCP tool error';
            throw new Error(errorText);
        }

        // MCP returns content as an array of content blocks — extract text
        if (result?.content && Array.isArray(result.content)) {
            const texts = result.content
                .filter((c: any) => c.type === 'text')
                .map((c: any) => c.text);
            if (texts.length === 1) return { result: texts[0] };
            if (texts.length > 1) return { result: texts.join('\n') };

            // Return raw content if no text blocks
            return { result: result.content };
        }

        return { result };
    }

    /**
     * Send a JSON-RPC request and wait for a response.
     */
    private static sendRequest(serverName: string, method: string, params: any): Promise<any> {
        const connection = this.connections.get(serverName);
        if (!connection?.process?.stdin) {
            return Promise.reject(new Error(`MCP server '${serverName}' has no active process`));
        }

        const id = ++this.requestId;
        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            id,
            method,
            params,
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`MCP request '${method}' to '${serverName}' timed out after 30s`));
            }, 30000);

            this.pendingRequests.set(id, {
                resolve: (value) => { clearTimeout(timeout); resolve(value); },
                reject: (reason) => { clearTimeout(timeout); reject(reason); },
            });

            const message = JSON.stringify(request) + '\n';
            connection.process!.stdin!.write(message);
        });
    }

    /**
     * Send a JSON-RPC notification (no response expected).
     */
    private static sendNotification(serverName: string, method: string, params: any): void {
        const connection = this.connections.get(serverName);
        if (!connection?.process?.stdin) return;

        const notification: JsonRpcNotification = {
            jsonrpc: '2.0',
            method,
            params,
        };

        const message = JSON.stringify(notification) + '\n';
        connection.process.stdin.write(message);
    }

    /**
     * Process buffered stdout data, extracting complete JSON-RPC messages.
     */
    private static processBuffer(serverName: string): void {
        let buf = this.buffers.get(serverName) || '';

        // Try to parse line-delimited JSON messages
        while (true) {
            const newlineIdx = buf.indexOf('\n');
            if (newlineIdx === -1) break;

            const line = buf.substring(0, newlineIdx).trim();
            buf = buf.substring(newlineIdx + 1);

            if (!line) continue;

            try {
                const msg = JSON.parse(line) as JsonRpcResponse;
                if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
                    const pending = this.pendingRequests.get(msg.id)!;
                    this.pendingRequests.delete(msg.id);
                    if (msg.error) {
                        pending.reject(new Error(`MCP error: ${msg.error.message} (code: ${msg.error.code})`));
                    } else {
                        pending.resolve(msg.result);
                    }
                }
            } catch {
                // Not valid JSON — could be a log line, skip
            }
        }

        this.buffers.set(serverName, buf);
    }

    /**
     * Disconnect from a specific MCP server.
     */
    static async disconnect(name: string): Promise<void> {
        const connection = this.connections.get(name);
        if (!connection) return;

        this.unregisterToolsForServer(name);

        if (connection.process && !connection.process.killed) {
            connection.process.kill();
        }

        connection.process = null;
        connection.status = 'disconnected';
        connection.tools = [];
        this.connections.delete(name);
        this.buffers.delete(name);

        console.log(`[MCP:${name}] Disconnected`);
    }

    /**
     * Disconnect all MCP servers.
     */
    static async disconnectAll(): Promise<void> {
        for (const [name] of this.connections) {
            await this.disconnect(name);
        }
    }

    /**
     * Get status of all MCP server connections.
     */
    static getStatus(): Array<{
        name: string;
        command: string;
        args: string[];
        status: string;
        error?: string;
        tools: string[];
    }> {
        return Array.from(this.connections.values()).map(conn => ({
            name: conn.name,
            command: conn.command,
            args: conn.args,
            status: conn.status,
            error: conn.error,
            tools: conn.tools.map(t => t.name),
        }));
    }
}
