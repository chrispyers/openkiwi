import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}

export interface Tool {
    definition: ToolDefinition;
    handler: (args: any) => Promise<any>;
}

const TOOLS_DIR = path.resolve(process.cwd(), 'tools');

export class ToolManager {
    private static tools: Map<string, Tool> = new Map();

    static async discoverTools(): Promise<void> {
        if (!fs.existsSync(TOOLS_DIR)) {
            fs.mkdirSync(TOOLS_DIR, { recursive: true });
        }

        const files = fs.readdirSync(TOOLS_DIR).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

        for (const file of files) {
            try {
                // Dynamic import for external plugins
                const fullPath = path.join(TOOLS_DIR, file);
                const toolModule = await import(`file://${fullPath}`); // Use file:// for ESM absolute paths
                if (toolModule.default && toolModule.default.definition && toolModule.default.handler) {
                    this.registerTool(toolModule.default);
                    console.log(`[ToolManager] Loaded external tool: ${toolModule.default.definition.name}`);
                } else {
                    console.warn(`[ToolManager] File ${file} is not a valid tool (missing default export or definition/handler)`);
                }
            } catch (error: any) {
                console.error(`[ToolManager] Failed to load external tool ${file}:`, error.message);
            }
        }

        // Register built-in tools for the demo
        this.registerBuiltInTools();
    }

    private static registerBuiltInTools() {
        // Register built-in tools
        import('./tools/memory_tools.js').then(module => {
            this.registerTool(module.memory_search);
            this.registerTool(module.memory_get);
        }).catch(err => console.error('Failed to load memory tools', err));
    }

    static registerTool(tool: any) {
        if (!tool || !tool.definition || !tool.definition.name) {
            console.error('Invalid tool registration attempt', tool);
            return;
        }
        this.tools.set(tool.definition.name, tool);
    }

    static unregisterTool(name: string) {
        this.tools.delete(name);
        console.log(`[ToolManager] Unregistered tool: ${name}`);
    }

    static getToolDefinitions(): ToolDefinition[] {
        return Array.from(this.tools.values()).map(t => t.definition);
    }

    static async callTool(name: string, args: any, context?: any): Promise<any> {
        const tool = this.tools.get(name);
        if (!tool) throw new Error(`Tool ${name} not found`);
        console.log(`Executing tool: ${name}`, args, context ? `(Context: ${JSON.stringify(context)})` : '');
        return await tool.handler({ ...args, _context: context });
    }
}
