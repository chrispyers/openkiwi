import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config-manager.js';

const router = Router();
const ENV_PATH = path.resolve(process.cwd(), '.env');

function getOAuth2Client() {
    const config = loadConfig();
    const redirectUri = `http://localhost:${config.gateway.port}/api/auth/google/callback`;
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
    );
}

function saveRefreshToken(token: string) {
    let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : '';
    if (content.includes('GOOGLE_REFRESH_TOKEN=')) {
        content = content.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${token}`);
    } else {
        if (content.length > 0 && !content.endsWith('\n')) content += '\n';
        content += `GOOGLE_REFRESH_TOKEN=${token}\n`;
    }
    fs.writeFileSync(ENV_PATH, content);
    process.env.GOOGLE_REFRESH_TOKEN = token;
}

function removeRefreshToken() {
    if (fs.existsSync(ENV_PATH)) {
        const content = fs.readFileSync(ENV_PATH, 'utf-8')
            .replace(/GOOGLE_REFRESH_TOKEN=.*\n?/, '');
        fs.writeFileSync(ENV_PATH, content);
    }
    delete process.env.GOOGLE_REFRESH_TOKEN;
}

function popupPage(type: 'success' | 'error', message = ''): string {
    const script = type === 'success'
        ? `window.opener?.postMessage({ type: 'google-oauth-success' }, '*'); window.close();`
        : `window.opener?.postMessage({ type: 'google-oauth-error', message: ${JSON.stringify(message)} }, '*'); window.close();`;
    const body = type === 'success'
        ? '<p>Authorization successful — you can close this window.</p>'
        : `<p>Authorization failed: ${message}</p>`;
    return `<!DOCTYPE html><html><head><title>Google Auth</title></head><body>${body}<script>${script}</script></body></html>`;
}

// GET /api/auth/google — redirect to Google consent screen
router.get('/', (req: Request, res: Response) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(500).send('Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
    }
    const authUrl = getOAuth2Client().generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/tasks',
            'https://mail.google.com/',
            'https://www.googleapis.com/auth/calendar',
        ],
    });
    res.redirect(authUrl);
});

// GET /api/auth/google/callback — OAuth callback (registered as PUBLIC in routes.ts)
export async function googleCallbackHandler(req: Request, res: Response) {
    const { code, error } = req.query;

    if (error) {
        return res.send(popupPage('error', String(error)));
    }
    if (!code) {
        return res.send(popupPage('error', 'Missing authorization code'));
    }

    try {
        const { tokens } = await getOAuth2Client().getToken(String(code));
        if (!tokens.refresh_token) {
            return res.send(popupPage('error', 'No refresh token received. Revoke app access at myaccount.google.com/permissions and try again.'));
        }
        saveRefreshToken(tokens.refresh_token);
        return res.send(popupPage('success'));
    } catch (err: any) {
        return res.send(popupPage('error', err.message));
    }
}

// GET /api/auth/google/status
router.get('/status', async (req: Request, res: Response) => {
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    if (!refreshToken || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.json({ connected: false });
    }
    try {
        const client = getOAuth2Client();
        client.setCredentials({ refresh_token: refreshToken });
        const { data } = await google.oauth2({ version: 'v2', auth: client }).userinfo.get();
        return res.json({ connected: true, email: data.email });
    } catch {
        return res.json({ connected: false });
    }
});

// POST /api/auth/google/disconnect
router.post('/disconnect', (req: Request, res: Response) => {
    removeRefreshToken();
    res.json({ success: true });
});

export default router;
