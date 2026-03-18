import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config-manager.js';

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
    displayName?: string;
    pluginType?: string;
    configKey?: string;
    filename?: string;
    hasReadme?: boolean;
    requiresApproval?: boolean;
}

export interface ToolFile {
    filename: string;
    hasReadme: boolean;
}

export interface Tool {
    definition: ToolDefinition;
    handler: (args: any) => Promise<any>;
}

const TOOLS_DIR = path.resolve(process.cwd(), 'tools');

export class ToolManager {
    private static tools: Map<string, Tool> = new Map();

    static async discoverTools(): Promise<void> {
        this.tools.clear();
        if (!fs.existsSync(TOOLS_DIR)) {
            fs.mkdirSync(TOOLS_DIR, { recursive: true });
        }

        const files = this.getAvailableToolFiles();
        const config = (await import('./config-manager.js')).loadConfig();
        const enabledTools = config.enabledTools || {};

        for (const toolFile of files) {
            const file = toolFile.filename;
            const isCoreTool = file.startsWith(`core${path.sep}`) || file.startsWith('core/');
            if (!isCoreTool && !enabledTools[file]) {
                console.log(`[ToolManager] Skipping disabled tool file: ${file}`);
                continue;
            }
            try {
                // Dynamic import for external plugins
                const fullPath = path.join(TOOLS_DIR, file);
                const toolModule = await import(`file://${fullPath}`); // Use file:// for ESM absolute paths
                if (toolModule.default && toolModule.default.definition && toolModule.default.handler) {
                    toolModule.default.definition.filename = file;

                    // Check for a per-file README ({name}.README.md) first, then a directory README.md
                    const toolDir = path.dirname(fullPath);
                    const baseName = path.basename(file).replace(/\.(ts|js)$/, '');
                    toolModule.default.definition.hasReadme = toolDir !== TOOLS_DIR && (
                        fs.existsSync(path.join(toolDir, `${baseName}.README.md`)) ||
                        fs.existsSync(path.join(toolDir, 'README.md'))
                    );

                    this.registerTool(toolModule.default);
                    console.log(`[ToolManager] Loaded external tool: ${toolModule.default.definition.name} (${file})`);
                } else {
                    console.warn(`[ToolManager] File ${file} is not a valid tool (missing default export or definition/handler)`);
                }
            } catch (error: any) {
                console.error(`[ToolManager] Failed to load external tool ${file}:`, error.message);
            }
        }

        // Register built-in tools for the demo
        await this.registerBuiltInTools();
    }

    private static async registerBuiltInTools() {
        // Register built-in tools
        try {
            const module = await import('./tools/memory_tools.js');
            this.registerTool(module.memory_search);
            this.registerTool(module.memory_get);
            this.registerTool(module.save_to_memory);
        } catch (err) {
            console.error('Failed to load memory tools', err);
        }

        try {
            const module = await import('./tools/collaboration_tools.js');
            this.registerTool(module.execute_workflow);
            this.registerTool(module.list_workflows);
        } catch (err) {
            console.error('Failed to load collaboration tools', err);
        }

        try {
            const module = await import('./tools/skill_tools.js');
            this.registerTool(module.activate_skill);
        } catch (err) {
            console.error('Failed to load skill tools', err);
        }
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
        return Array.from(this.tools.values()).map(t => {
            if (t.definition.requiresApproval && !t.definition.description.includes('(Requires Approval)')) {
                return {
                    ...t.definition,
                    description: `${t.definition.description} (Requires Approval)`
                };
            }
            return t.definition;
        });
    }

    static getAvailableToolFiles(): ToolFile[] {
        if (!fs.existsSync(TOOLS_DIR)) return [];

        const files: ToolFile[] = [];

        function scanDir(dir: string, relativePath: string = '') {
            const items = fs.readdirSync(dir, { withFileTypes: true });

            for (const item of items) {
                const itemRelativePath = path.join(relativePath, item.name);
                const itemFullPath = path.join(dir, item.name);

                if (item.isDirectory()) {
                    if (item.name === 'lib') continue;
                    scanDir(itemFullPath, itemRelativePath);
                } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.js')) && !item.name.includes('.test.')) {
                    // Check for a per-file README ({name}.README.md) first, then a directory README.md
                    const toolDir = path.dirname(itemFullPath);
                    const baseName = item.name.replace(/\.(ts|js)$/, '');
                    const hasReadme = toolDir !== TOOLS_DIR && (
                        fs.existsSync(path.join(toolDir, `${baseName}.README.md`)) ||
                        fs.existsSync(path.join(toolDir, 'README.md'))
                    );
                    files.push({
                        filename: itemRelativePath,
                        hasReadme
                    });
                }
            }
        }

        scanDir(TOOLS_DIR);
        return files;
    }

    static getToolReadme(filename: string): string | null {
        const fullPath = path.resolve(TOOLS_DIR, filename);
        if (!fullPath.startsWith(TOOLS_DIR + path.sep)) {
            return null;
        }
        const toolDir = path.dirname(fullPath);
        if (toolDir === TOOLS_DIR) return null;

        // Prefer a per-file README ({name}.README.md) over a shared directory README.md
        const baseName = path.basename(fullPath).replace(/\.(ts|js)$/, '');
        const fileReadme = path.join(toolDir, `${baseName}.README.md`);
        if (fs.existsSync(fileReadme)) return fs.readFileSync(fileReadme, 'utf-8');

        const dirReadme = path.join(toolDir, 'README.md');
        if (fs.existsSync(dirReadme)) return fs.readFileSync(dirReadme, 'utf-8');

        return null;
    }

    static async callTool(name: string, args: any, context?: any): Promise<any> {
        // Normalize tool name: strip whitespace and trailing non-word characters (e.g. ellipsis '…' appended by some models)
        const normalizedName = name.trim().replace(/[\s\W]+$/, '');
        const tool = this.tools.get(normalizedName);
        if (!tool) {
            const available = Array.from(this.tools.keys()).join(', ');
            throw new Error(`Tool '${name}' not found. Available tools are: ${available}. Please use one of the available tools. Do NOT use file names or arbitrary actions as tool names.`);
        }
        console.log(`Executing tool: ${normalizedName}`, args, context ? `(Context: ${JSON.stringify(context)})` : '');
        const config = loadConfig();
        const enrichedContext = { ...context, connections: config.connections ?? { git: [] } };
        return await tool.handler({ ...args, _context: enrichedContext });
    }
}
