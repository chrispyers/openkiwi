import puppeteer from 'puppeteer';
import fs from 'node:fs';
import os from 'node:os';

function findChromeExecutable() {
    const platform = os.platform();
    let paths = [];

    if (platform === 'darwin') {
        paths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
        ];
    } else if (platform === 'win32') {
        paths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
        ];
    } else {
        paths = [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium'
        ];
    }

    for (const p of paths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return undefined; // Let puppeteer use the bundled Chromium if nothing else is found
}

export default {
    definition: {
        name: 'chatgpt_auth',
        displayName: 'ChatGPT Authenticator',
        pluginType: 'tool',
        description: 'Opens a browser window for the user to log into ChatGPT. Captures the session token (JWT) needed for the ChatGPT importer tool. Requires user interaction.',
        parameters: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    handler: async () => {
        let browser: any = null;
        try {
            console.log('[chatgpt_auth] Launching visible browser for authentication...');

            const executablePath = findChromeExecutable();
            if (executablePath) {
                console.log(`[chatgpt_auth] Using real browser executable at: ${executablePath}`);
            } else {
                console.log('[chatgpt_auth] Real browser not found, falling back to bundled Chromium.');
            }

            // Launch with settings meant to decrease bot detection
            browser = await puppeteer.launch({
                headless: false,
                executablePath: executablePath,
                defaultViewport: null,
                ignoreDefaultArgs: ['--enable-automation'], // Crucial for avoiding Google Auth block
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--window-size=1280,800',
                    '--disable-blink-features=AutomationControlled'
                ]
            });

            const page = await browser.newPage();

            // Bypass webdriver checks slightly
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
            });

            // Promise that resolves when we intercept the JWT
            const tokenPromise = new Promise<string>((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('Authentication timed out after 5 minutes.'));
                }, 5 * 60 * 1000);

                page.on('request', (request: any) => {
                    const url = request.url();
                    if (url.includes('chatgpt.com/backend-api/')) {
                        const headers = request.headers();
                        const authHeader = headers['authorization'] || headers['Authorization'];
                        if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
                            const token = authHeader.substring(7).trim();

                            if (token.startsWith('eyJ')) {
                                clearTimeout(timeoutId);
                                resolve(token);
                            }
                        }
                    }
                });
            });

            console.log('[chatgpt_auth] Navigating to https://chatgpt.com ...');
            await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded' });

            console.log('[chatgpt_auth] Waiting for user to log in and intercepting session token...');

            const token = await tokenPromise;

            console.log('[chatgpt_auth] Successfully intercepted session token!');

            await new Promise(r => setTimeout(r, 1500));

            return {
                success: true,
                message: 'Successfully authenticated.',
                token: token
            };

        } catch (error: any) {
            console.error('[chatgpt_auth] Error during authentication:', error);
            return { error: `Authentication failed: ${error.message}` };
        } finally {
            if (browser) {
                try {
                    await browser.close();
                } catch (e) {
                    console.error('[chatgpt_auth] Error closing browser:', e);
                }
            }
        }
    }
};
