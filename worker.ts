import { WebSocket } from 'ws';
import { exec, spawn } from 'child_process';
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
            try {
                // Validate the URL: ensure it's a valid URL and uses HTTPS protocol
                const parsedUrl = new URL(args.url);
                if (parsedUrl.protocol !== 'https:') {
                    throw new Error('Forbidden protocol. Only https: is allowed.');
                }

                // Use spawn instead of exec to prevent shell metacharacter injection.
                // spawn passes arguments directly to the OS without shell interpolation.
                const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
                const subprocess = spawn(opener, [args.url], {
                    detached: true,
                    stdio: 'ignore'
                });

                // Allow the parent process to exit independently of the child browser process
                subprocess.unref();

                ws.send(JSON.stringify({
                    type: 'tool_result',
                    id: id,
                    result: { success: true, message: `Opened ${args.url}` }
                }));
            } catch (error) {
                ws.send(JSON.stringify({
                    type: 'tool_result',
                    id: id,
                    result: { error: error instanceof Error ? error.message : 'Invalid URL' }
                }));
            }
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
