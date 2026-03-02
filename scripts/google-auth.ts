import { google } from 'googleapis';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ENV_PATH = path.resolve(process.cwd(), '.env');

// Load .env file into process.env
if (fs.existsSync(ENV_PATH)) {
    const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
    console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
    console.error('1. Create an OAuth 2.0 Client ID (Desktop app) at console.cloud.google.com');
    console.error('2. Add http://localhost:3456/callback as an authorized redirect URI');
    console.error('3. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
    process.exit(1);
}

const REDIRECT_URI = 'http://localhost:3456/callback';
const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/tasks'],
});

const server = http.createServer(async (req, res) => {
    if (!req.url?.startsWith('/callback')) {
        res.writeHead(404);
        res.end('Not found');
        return;
    }

    const url = new URL(req.url, `http://localhost:3456`);
    const code = url.searchParams.get('code');

    if (!code) {
        res.writeHead(400);
        res.end('Missing authorization code');
        return;
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        const refreshToken = tokens.refresh_token;

        if (!refreshToken) {
            res.writeHead(500);
            res.end('No refresh token received. Try revoking access at myaccount.google.com/permissions and re-running.');
            server.close();
            process.exit(1);
            return;
        }

        // Update .env file
        let envContent = '';
        if (fs.existsSync(ENV_PATH)) {
            envContent = fs.readFileSync(ENV_PATH, 'utf-8');
        }

        if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
            envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${refreshToken}`);
        } else {
            if (envContent.length > 0 && !envContent.endsWith('\n')) {
                envContent += '\n';
            }
            envContent += `GOOGLE_REFRESH_TOKEN=${refreshToken}\n`;
        }

        fs.writeFileSync(ENV_PATH, envContent);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization successful!</h1><p>You can close this tab. Refresh token has been saved to .env</p>');

        console.log('\nRefresh token saved to .env');
        console.log('You can now enable google_tasks.ts in your agent config.');

        server.close();
        process.exit(0);
    } catch (err: any) {
        res.writeHead(500);
        res.end(`Token exchange failed: ${err.message}`);
        server.close();
        process.exit(1);
    }
});

server.listen(3456, () => {
    console.log('Opening browser for Google authorization...');
    console.log(`If the browser doesn't open, visit:\n${authUrl}\n`);

    const platform = process.platform;
    try {
        if (platform === 'darwin') {
            execSync(`open "${authUrl}"`);
        } else if (platform === 'win32') {
            execSync(`start "${authUrl}"`);
        } else {
            execSync(`xdg-open "${authUrl}"`);
        }
    } catch {
        // Browser open failed — URL is already printed above
    }
});
