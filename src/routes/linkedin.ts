import { Router, Request, Response } from 'express';
import { loadConfig } from '../config-manager.js';
import { LinkedInManager } from '../linkedin-manager.js';

const router = Router();

function popupPage(type: 'success' | 'error', message = ''): string {
    if (type === 'success') {
        return `<!DOCTYPE html><html><head><title>LinkedIn Auth</title></head><body>
            <p>LinkedIn authorization successful — you can close this window.</p>
            <script>window.opener?.postMessage({ type: 'linkedin-oauth-success' }, '*'); window.close();</script>
        </body></html>`;
    }
    // Error pages stay open so the user can read them
    const safeMsg = message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<!DOCTYPE html><html><head><title>LinkedIn Auth — Error</title>
        <style>body{font-family:system-ui;max-width:520px;margin:40px auto;padding:0 20px}
        pre{background:#f5f5f5;padding:12px;border-radius:6px;white-space:pre-wrap;word-break:break-all;font-size:13px}</style>
    </head><body>
        <h3>LinkedIn authorisation failed</h3>
        <pre>${safeMsg}</pre>
        <p><button onclick="window.close()">Close</button></p>
        <script>window.opener?.postMessage({ type: 'linkedin-oauth-error', message: ${JSON.stringify(message)} }, '*');</script>
    </body></html>`;
}

// GET /api/auth/linkedin — redirect to LinkedIn consent screen
router.get('/', (req: Request, res: Response) => {
    if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
        return res.status(500).send('LinkedIn OAuth not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env');
    }

    const config = loadConfig();
    const redirectUri = `http://localhost:${config.gateway.port}/api/auth/linkedin/callback`;
    const authUrl = LinkedInManager.getInstance().getAuthUrl(redirectUri);
    res.redirect(authUrl);
});

// GET /api/auth/linkedin/callback — OAuth callback (registered as PUBLIC in routes.ts)
export async function linkedinCallbackHandler(req: Request, res: Response) {
    const { code, error, error_description } = req.query;

    console.log('[LinkedIn] OAuth callback received:', { code: code ? '(present)' : '(missing)', error, error_description, query: Object.keys(req.query) });

    if (error) {
        const msg = `${error}: ${error_description || 'No description provided'}`;
        console.error('[LinkedIn] OAuth error from LinkedIn:', msg);
        return res.send(popupPage('error', msg));
    }
    if (!code) {
        return res.send(popupPage('error', 'Missing authorization code from LinkedIn'));
    }

    try {
        const config = loadConfig();
        const redirectUri = `http://localhost:${config.gateway.port}/api/auth/linkedin/callback`;
        await LinkedInManager.getInstance().handleCallback(String(code), redirectUri);
        return res.send(popupPage('success'));
    } catch (err: any) {
        console.error('[LinkedIn] OAuth callback error:', err.message);
        return res.send(popupPage('error', err.message));
    }
}

// GET /api/auth/linkedin/status
router.get('/status', (req: Request, res: Response) => {
    res.json(LinkedInManager.getInstance().getStatus());
});

// POST /api/auth/linkedin/disconnect
router.post('/disconnect', (req: Request, res: Response) => {
    LinkedInManager.getInstance().disconnect();
    res.json({ success: true });
});

export default router;
