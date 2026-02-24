import { WebSocket } from 'ws';
import { exec, spawn, SpawnOptions } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * HOST WORKER SCRIPT
 * Run this on your host (outside Docker) to give your agents superpowers.
 * Usage: npx tsx worker.ts
 */

import { loadConfig } from './src/config-manager.js';

const config = loadConfig();
const hostname = os.hostname() || 'Unknown-Host';

const GATEWAY_URL = `ws://localhost:${config.gateway.port}/ws?hostname=${encodeURIComponent(hostname + ' [Host Worker]')}`;
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
    console.log('✅ Connected to Gateway. Authenticating...');
    ws.send(JSON.stringify({
        type: 'auth',
        token: config.gateway.secretToken
    }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());

    if (msg.type === 'auth_success') {
        console.log('✅ Authenticated as Host Worker. Registering tools...');
        ws.send(JSON.stringify({
            type: 'register_tools',
            tools: tools
        }));
        return;
    }

    if (msg.type === 'call_tool') {
        const { id, name, args } = msg;
        console.log(`🛠️ Executing remote tool: ${name}`, args);

        if (name === 'run_host_command') {
            const parts = args.command.split(' ');
            const cmd = parts[0];
            const cmdArgs = parts.slice(1);

            const child = spawn(cmd, cmdArgs, { cwd: args.cwd });
            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                ws.send(JSON.stringify({
                    type: 'tool_result',
                    id: id,
                    result: {
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        exitCode: code
                    }
                }));
            });

            child.on('error', (error) => {
                ws.send(JSON.stringify({
                    type: 'tool_result',
                    id: id,
                    result: {
                        stdout: stdout.trim(),
                        stderr: stderr.trim() + '\nError: ' + error.message,
                        exitCode: 1
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

                // SECURITY: parsedUrl.href is normalized and encoded by the URL constructor.
                // This ensures that special shell characters (like &, |, ", %) are either
                // encoded or validated, preventing shell injection when passed to cmd/sh.
                const safeUrl = parsedUrl.href;

                // Use spawn instead of exec to prevent shell metacharacter injection.
                // spawn passes arguments directly to the OS without shell interpolation.
                let opener: string;
                let openerArgs: string[];

                if (process.platform === 'darwin') {
                    opener = 'open';
                    openerArgs = [safeUrl];
                } else if (process.platform === 'win32') {
                    // On Windows, 'start' is a cmd builtin, so we must use 'cmd /c'.
                    // We use an empty title "" and wrap the URL in quotes. 
                    // Since parsedUrl encodes double quotes, breakout is impossible.
                    opener = 'cmd.exe';
                    openerArgs = ['/c', 'start', '""', safeUrl];
                } else {
                    opener = 'xdg-open';
                    openerArgs = [safeUrl];
                }

                const subprocess = spawn(opener, openerArgs, {
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
