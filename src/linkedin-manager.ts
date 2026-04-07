import fs from 'node:fs';
import path from 'node:path';

const TOKENS_PATH = path.resolve(process.cwd(), 'config', 'linkedin-tokens.json');
const LINKEDIN_API_BASE = 'https://api.linkedin.com';
const LINKEDIN_VERSION = '202504';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry
const MIN_REQUEST_INTERVAL_MS = 500;

interface LinkedInTokens {
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: number;
    personUrn?: string;
    profileName?: string;
}

export class LinkedInManager {
    private static instance: LinkedInManager;
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private tokenExpiresAt: number = 0;
    private personUrn: string | null = null;
    private profileName: string | null = null;
    private lastRequestTime: number = 0;

    private constructor() {
        this.loadTokens();
    }

    public static getInstance(): LinkedInManager {
        if (!LinkedInManager.instance) {
            LinkedInManager.instance = new LinkedInManager();
        }
        return LinkedInManager.instance;
    }

    // ── Token Management ─────────────────────────────────────────────────────

    private loadTokens(): void {
        // Try token file first (persisted via config/ volume), fall back to env vars for migration
        if (fs.existsSync(TOKENS_PATH)) {
            try {
                const data: LinkedInTokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));
                this.accessToken = data.accessToken || null;
                this.refreshToken = data.refreshToken || null;
                this.tokenExpiresAt = data.tokenExpiresAt || 0;
                this.personUrn = data.personUrn || null;
                this.profileName = data.profileName || null;
                return;
            } catch (err: any) {
                console.warn('[LinkedIn] Failed to read token file:', err.message);
            }
        }
        // Fallback: env vars (for backwards compatibility / migration)
        this.accessToken = process.env.LINKEDIN_ACCESS_TOKEN || null;
        this.refreshToken = process.env.LINKEDIN_REFRESH_TOKEN || null;
        this.tokenExpiresAt = parseInt(process.env.LINKEDIN_TOKEN_EXPIRES_AT || '0', 10);
        this.personUrn = process.env.LINKEDIN_PERSON_URN || null;
        this.profileName = process.env.LINKEDIN_PROFILE_NAME || null;
    }

    private persistTokens(): void {
        const data: LinkedInTokens = {
            accessToken: this.accessToken || undefined,
            refreshToken: this.refreshToken || undefined,
            tokenExpiresAt: this.tokenExpiresAt || undefined,
            personUrn: this.personUrn || undefined,
            profileName: this.profileName || undefined,
        };
        try {
            fs.writeFileSync(TOKENS_PATH, JSON.stringify(data, null, 2));
        } catch (err: any) {
            console.error('[LinkedIn] Failed to write token file:', err.message);
        }
    }

    private clearTokenFile(): void {
        try {
            if (fs.existsSync(TOKENS_PATH)) fs.unlinkSync(TOKENS_PATH);
        } catch (err: any) {
            console.warn('[LinkedIn] Failed to remove token file:', err.message);
        }
    }

    private saveTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.tokenExpiresAt = Date.now() + expiresIn * 1000;
        this.persistTokens();
    }

    private async ensureValidToken(): Promise<string> {
        if (!this.accessToken) {
            throw new Error('LinkedIn not connected. Please authenticate via Settings > Connections.');
        }
        if (Date.now() > this.tokenExpiresAt - TOKEN_REFRESH_BUFFER_MS) {
            await this.refreshAccessToken();
        }
        return this.accessToken!;
    }

    private async refreshAccessToken(): Promise<void> {
        if (!this.refreshToken) {
            throw new Error('No LinkedIn refresh token available. Please re-authenticate.');
        }

        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: this.refreshToken,
            client_id: process.env.LINKEDIN_CLIENT_ID || '',
            client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
        });

        const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`LinkedIn token refresh failed (${res.status}): ${text}`);
        }

        const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number };
        this.saveTokens(
            data.access_token,
            data.refresh_token || this.refreshToken,
            data.expires_in
        );
        console.log('[LinkedIn] Access token refreshed successfully');
    }

    // ── OAuth Flow ───────────────────────────────────────────────────────────

    public getAuthUrl(redirectUri: string): string {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: process.env.LINKEDIN_CLIENT_ID || '',
            redirect_uri: redirectUri,
            scope: process.env.LINKEDIN_SCOPES || 'openid profile email w_member_social',
            state: Math.random().toString(36).slice(2),
        });
        return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    }

    public async handleCallback(code: string, redirectUri: string): Promise<void> {
        // Exchange authorization code for tokens
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: process.env.LINKEDIN_CLIENT_ID || '',
            client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
        });

        const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });

        if (!tokenRes.ok) {
            const text = await tokenRes.text();
            throw new Error(`Token exchange failed (${tokenRes.status}): ${text}`);
        }

        const tokenData = await tokenRes.json() as {
            access_token: string;
            refresh_token?: string;
            expires_in: number;
        };

        this.saveTokens(
            tokenData.access_token,
            tokenData.refresh_token || '',
            tokenData.expires_in
        );

        // Fetch profile via OpenID Connect userinfo (requires openid + profile scopes)
        let personId: string | null = null;
        let name: string | null = null;

        const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                'LinkedIn-Version': LINKEDIN_VERSION,
            },
        });
        if (profileRes.ok) {
            const profile = await profileRes.json() as { sub?: string; name?: string; email?: string };
            personId = profile.sub || null;
            name = profile.name || null;
            console.log(`[LinkedIn] Profile fetched: ${name} (${profile.email || 'no email'})`);
        } else {
            const errText = await profileRes.text();
            console.error(`[LinkedIn] Profile fetch failed (${profileRes.status}): ${errText}`);
        }

        if (personId) {
            this.personUrn = `urn:li:person:${personId}`;
        }
        if (name) {
            this.profileName = name;
        }
        // Persist all tokens + profile info
        this.persistTokens();

        if (!this.personUrn) {
            console.error('[LinkedIn] Could not determine person URN. Set LINKEDIN_PERSON_URN in config/linkedin-tokens.json');
        }

        console.log(`[LinkedIn] Connected as ${this.profileName || this.personUrn}`);
    }

    public disconnect(): void {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiresAt = 0;
        this.personUrn = null;
        this.profileName = null;
        this.clearTokenFile();
        console.log('[LinkedIn] Disconnected');
    }

    public getStatus(): { connected: boolean; name?: string } {
        return {
            connected: !!this.accessToken && !!this.personUrn,
            name: this.profileName || undefined,
        };
    }

    // ── API Request ──────────────────────────────────────────────────────────

    private async apiRequest(method: string, url: string, body?: any, retried = false): Promise<any> {
        const token = await this.ensureValidToken();

        // Throttle requests
        const now = Date.now();
        const elapsed = now - this.lastRequestTime;
        if (elapsed < MIN_REQUEST_INTERVAL_MS) {
            await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
        }
        this.lastRequestTime = Date.now();

        const headers: Record<string, string> = {
            Authorization: `Bearer ${token}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': LINKEDIN_VERSION,
        };
        if (body) {
            headers['Content-Type'] = 'application/json';
        }

        const res = await fetch(`${LINKEDIN_API_BASE}${url}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        // Handle 401 — try refresh once
        if (res.status === 401 && !retried) {
            console.log('[LinkedIn] Got 401, attempting token refresh...');
            await this.refreshAccessToken();
            return this.apiRequest(method, url, body, true);
        }

        // Handle rate limiting
        if (res.status === 429) {
            const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10);
            if (!retried) {
                console.log(`[LinkedIn] Rate limited, waiting ${retryAfter}s...`);
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                return this.apiRequest(method, url, body, true);
            }
            throw new Error(`LinkedIn API rate limited. Try again in ${retryAfter} seconds.`);
        }

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`LinkedIn API error (${res.status} ${method} ${url}): ${text}`);
        }

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return res.json();
        }
        return res.text();
    }

    // ── Posts ─────────────────────────────────────────────────────────────────

    public async createPost(text: string, opts?: { imageUrl?: string; linkUrl?: string }): Promise<{ postUrn: string; url?: string }> {
        if (!this.personUrn) {
            throw new Error('LinkedIn person URN not set. Please re-authenticate.');
        }

        if (text.length > 3000) {
            throw new Error(`Post text exceeds LinkedIn's 3000-character limit (${text.length} chars).`);
        }

        const postBody: any = {
            author: this.personUrn,
            lifecycleState: 'PUBLISHED',
            visibility: 'PUBLIC',
            commentary: text,
            distribution: {
                feedDistribution: 'MAIN_FEED',
                targetEntities: [],
                thirdPartyDistributionChannels: [],
            },
        };

        // Link attachment
        if (opts?.linkUrl) {
            postBody.content = {
                article: {
                    source: opts.linkUrl,
                    title: '', // LinkedIn will auto-populate from Open Graph
                },
            };
        }

        // Image attachment (two-step upload)
        if (opts?.imageUrl) {
            try {
                const imageUrn = await this.uploadImage(opts.imageUrl);
                postBody.content = {
                    media: {
                        id: imageUrn,
                    },
                };
            } catch (err: any) {
                console.error('[LinkedIn] Image upload failed, posting without image:', err.message);
            }
        }

        const result = await this.apiRequest('POST', '/rest/posts', postBody);
        // LinkedIn returns the post URN in the x-restli-id header or response
        const postUrn = result?.id || result?.['x-restli-id'] || '';

        return {
            postUrn,
            url: postUrn ? `https://www.linkedin.com/feed/update/${postUrn}` : undefined,
        };
    }

    private async uploadImage(imageUrl: string): Promise<string> {
        if (!this.personUrn) throw new Error('Not authenticated');

        // Step 1: Initialize upload
        const initResult = await this.apiRequest('POST', '/rest/images?action=initializeUpload', {
            initializeUploadRequest: {
                owner: this.personUrn,
            },
        });

        const uploadUrl = initResult?.value?.uploadUrl;
        const imageUrn = initResult?.value?.image;
        if (!uploadUrl || !imageUrn) {
            throw new Error('Failed to initialize LinkedIn image upload');
        }

        // Step 2: Download source image
        const imageRes = await fetch(imageUrl);
        if (!imageRes.ok) throw new Error(`Failed to fetch image from ${imageUrl}`);
        const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

        // Step 3: Upload to LinkedIn
        const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/octet-stream',
                Authorization: `Bearer ${this.accessToken}`,
            },
            body: imageBuffer,
        });

        if (!uploadRes.ok) {
            throw new Error(`Image upload to LinkedIn failed (${uploadRes.status})`);
        }

        return imageUrn;
    }

}
