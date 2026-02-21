import { WebSocket } from 'ws';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * HOST WORKER SCRIPT
 * Run this on your Mac host (outside Docker) to give your agents superpowers.
 * Usage: npx tsx worker.ts
 */

import { loadConfig } from './src/config-manager.js';

const config = loadConfig();

const GATEWAY_URL = `ws://localhost:${config.gateway.port}/ws?token=${config.gateway.secretToken}&hostname=Mac-Host-Worker`;
const ws = new WebSocket(GATEWAY_URL);

const tools = [
    {
        name: 'run_host_command',
        description: 'Execute a terminal command directly on the host Mac. Use this for npx, git, brew, etc.',
        parameters: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'The full shell command to run.' },
                cwd: { type: 'string', description: 'The directory to run the command in (optional).' }
            },
            required: ['command']
        }
    },
    {
        name: 'open_browser',
        description: 'Open a URL in the default host browser (Chrome/Firefox/Safari).',
        parameters: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'The URL to open.' }
            },
            required: ['url']
        }
    }
];

ws.on('open', () => {
    console.log('✅ Connected to Gateway as Host Worker');
    ws.send(JSON.stringify({
        type: 'register_tools',
        tools: tools
    }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());

    if (msg.type === 'call_tool') {
        const { id, name, args } = msg;
        console.log(`🛠️ Executing remote tool: ${name}`, args);

        if (name === 'run_host_command') {
            exec(args.command, { cwd: args.cwd }, (error, stdout, stderr) => {
                ws.send(JSON.stringify({
                    type: 'tool_result',
                    id: id,
                    result: {
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        exitCode: error ? error.code : 0
                    }
                }));
            });
        }

        if (name === 'open_browser') {
            const command = process.platform === 'darwin' ? `open "${args.url}"` : `xdg-open "${args.url}"`;
            exec(command, (error) => {
                ws.send(JSON.stringify({
                    type: 'tool_result',
                    id: id,
                    result: error ? { error: error.message } : { success: true, message: `Opened ${args.url}` }
                }));
            });
        }
    }
});

ws.on('error', (err) => {
    console.error('❌ WebSocket Error:', err.message);
});

ws.on('close', () => {
    console.warn('⚠️ Connection to Gateway closed. Retrying in 5s...');
    setTimeout(() => {
        // Simple reconnect logic would go here
        process.exit(1);
    }, 5000);
});
