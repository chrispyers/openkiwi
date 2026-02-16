import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

// Helper to ensure screenshots directory exists
const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

let browser: any = null;

async function getBrowser() {
    if (browser) return browser;

    const options: any = {
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // critical for docker
            '--disable-gpu'
        ]
    };

    // If running in docker, use the installed chromium
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    try {
        browser = await puppeteer.launch(options);
        return browser;
    } catch (error) {
        console.error('Failed to launch browser:', error);
        throw new Error('Browser launch failed');
    }
}

export default {
    definition: {
        name: 'web_browser',
        description: 'Perform web searches or browse specific URLs. Returns text content and a screenshot URL. You MUST display the screenshot in your response using Markdown image syntax (e.g. ![Screenshot](url)).',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['search', 'browse'],
                    description: 'The action to perform: "search" for a general web search, or "browse" to visit a specific URL.'
                },
                input: {
                    type: 'string',
                    description: 'The search query (if action="search") or the URL (if action="browse").'
                }
            },
            required: ['action', 'input']
        }
    },
    handler: async ({ action, input }: { action: 'search' | 'browse'; input: string }) => {
        const browser = await getBrowser();
        const page = await browser.newPage();

        // Set a normal viewport size
        await page.setViewport({ width: 1280, height: 800 });

        // Randomize User Agent slightly
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        try {
            let urlToVisit = input;

            if (action === 'search') {
                // Use DuckDuckGo
                // We use html version for speed/simplicity sometimes, but standard version gives better results for visual screenshot
                const q = encodeURIComponent(input);
                urlToVisit = `https://duckduckgo.com/?q=${q}&t=h_&ia=web`;
            } else {
                // Ensure protocol
                if (!urlToVisit.startsWith('http')) {
                    urlToVisit = `https://${urlToVisit}`;
                }
            }

            console.log(`[Browser] Visiting: ${urlToVisit}`);

            // Navigate
            // Wait until network is idle specifically to load dynamic content
            await page.goto(urlToVisit, { waitUntil: 'networkidle2', timeout: 30000 });

            // If it's a search, maybe we wait a bit more for results to pop in?
            if (action === 'search') {
                try {
                    // Wait for results container
                    await page.waitForSelector('#react-layout', { timeout: 5000 });
                } catch (e) {
                    // Ignore
                }
            }

            // Take Screenshot
            const filename = `screenshot-${Date.now()}.png`;
            const screenshotPath = path.join(SCREENSHOTS_DIR, filename);
            await page.screenshot({ path: screenshotPath, fullPage: false });

            // Extract text content (simple)
            // We get the body text
            const textContent = await page.evaluate(() => {
                // Helper to remove script/style
                const scripts = document.querySelectorAll('script, style, noscript');
                scripts.forEach(s => s.remove());
                return document.body.innerText.trim().substring(0, 4000); // Limit context
            });

            // If search, try to get specific results structure for better summaries
            let searchResults = [];
            if (action === 'search') {
                searchResults = await page.evaluate(() => {
                    const articles = Array.from(document.querySelectorAll('article')); // DuckDuckGo structure changes often, but let's try
                    return articles.slice(0, 5).map((art: any) => {
                        const title = art.querySelector('h2 a')?.innerText || '';
                        const snippet = art.querySelector('[data-result="snippet"]')?.innerText || '';
                        const link = art.querySelector('h2 a')?.href || '';
                        return { title, snippet, link };
                    }).filter((r: any) => r.title);
                });
            }

            // Construct Response
            // We return a markdown formatted string with the image and text
            // The image URL assumes the gateway is serving /screenshots
            // We need to know the gateway base URL. But simpler is just relative path if the UI supports it?
            // The UI is on port 3000, Gateway 3808.
            // We will return a full URL if we can, but we don't know the host address.
            // We'll return a relative path `/api/screenshots/filename`?
            // Wait, in `src/index.ts` we served `/screenshots`.

            // Since the UI fetches from Gateway, if the markdown has `![Image](/screenshots/filename.png)`, 
            // the UI will interpret it relative to the UI domain (http://localhost:3000). 
            // So we need to point to the Gateway URL.
            // But the agent doesn't know the Gateway URL.
            // However, the proxy setup might route `/api` to gateway?
            // Let's check `nginx.conf` or how UI connects.
            // The UI connects to `gatewayAddr` stored in localStorage.
            // This is tricky.
            // The agent produces text. The UI renders markdown.
            // If the agent says `![Screenshot](http://localhost:3808/screenshots/foo.png)`, it works locally.
            // If in production/docker, users might access via IP.

            // Idea: Return the filename. Let the UI handle it? No application logic in UI for this.
            // Better: Return a markdown image with a placeholder or relative path, and hope.
            // OR: We try to guess or use a standard convention.
            // Let's just return `screenshot_url: "/screenshots/${filename}"` in the structured data, 
            // and let the agent formulate the text response.
            // The Tool result is JSON.
            // The agent (LLM) will see the JSON and formulate a response using the `screenshot_url`.
            // The LLM will likely output: "Here is the search result: ![Screenshot](/screenshots/foo.png)".
            // If the UI is rendering this markdown, `src="/screenshots/foo.png"` will be requested from the UI server (localhost:3000).
            // We need to proxy `/screenshots` in the UI dev server or nginx to the gateway.

            // Let's check `ui/vite.config.ts` or `ui/nginx.conf`.

            const screenshotUrl = `/screenshots/${filename}`;

            await page.close();

            const response: any = {
                title: await page.title(),
                url: urlToVisit,
                screenshot_url: screenshotUrl, // Agent should use this
                content_snippet: textContent
            };

            if (searchResults && searchResults.length > 0) {
                response.search_results = searchResults;
            }

            return response;

        } catch (error: any) {
            await page.close();
            // Maybe browser too if it crashed?
            return { error: `Browser error: ${error.message}` };
        }
    }
};
