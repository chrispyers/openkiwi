import path from 'path';
import fs from 'fs';
import dns from 'dns';
import { getBrowser } from '../lib/browser_utils.js';

// Helper to check for blocked IP addresses
function isBannedIP(ip: string): boolean {
    if (ip === '::1') return true;
    if (ip.startsWith('127.')) return true;
    if (ip.startsWith('10.')) return true;
    if (ip.startsWith('192.168.')) return true;
    if (ip.startsWith('169.254.')) return true;
    if (ip.startsWith('0.')) return true;
    const parts = ip.split('.');
    if (parts.length === 4) {
        if (parts[0] === '172') {
            const second = parseInt(parts[1], 10);
            if (second >= 16 && second <= 31) return true;
        }
    }
    return false;
}

// Helper to ensure screenshots directory exists
const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}


export default {
    definition: {
        name: 'chromium',
        displayName: 'Chromium',
        pluginType: 'tool',
        description: 'Perform web searches, image searches, or browse specific URLs. Returns text content, a screenshot URL, and for "search_images", a list of image_results. You MUST display the screenshot in your response using Markdown image syntax (e.g. ![Screenshot](url)).',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['search', 'browse', 'search_images'],
                    description: 'The action to perform: "search" for a general web search, "browse" to visit a specific URL, or "search_images" to find images.'
                },
                input: {
                    type: 'string',
                    description: 'The search query (if action="search" or "search_images") or the URL (if action="browse").'
                }
            },
            required: ['action', 'input']
        }
    },
    handler: async ({ action, input }: { action: 'search' | 'browse' | 'search_images'; input: string }) => {
        let page: any = null;

        try {
            const browserInstance = await getBrowser();
            page = await browserInstance.newPage();

            // Set a normal viewport size
            await page.setViewport({ width: 1280, height: 800 });

            // Randomize User Agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            let urlToVisit = input;

            if (action === 'search') {
                // Use DuckDuckGo
                const q = encodeURIComponent(input);
                urlToVisit = `https://duckduckgo.com/?q=${q}&t=h_&ia=web`;
            } else if (action === 'search_images') {
                // Use DuckDuckGo Images
                const q = encodeURIComponent(input);
                urlToVisit = `https://duckduckgo.com/?q=${q}&t=h_&iax=images&ia=images`;
            } else {
                // Ensure protocol
                if (!urlToVisit.startsWith('http')) {
                    urlToVisit = `https://${urlToVisit}`;
                }
            }

            // Set realistic headers
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'upgrade-insecure-requests': '1',
            });

            // Bypass basic bot detection
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
                // @ts-ignore
                window.chrome = { runtime: {} };
                // @ts-ignore
                navigator.languages = ['en-US', 'en'];
            });

            try {
                const parsedUrl = new URL(urlToVisit);
                if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                    throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`);
                }
                const lookupInfo = await dns.promises.lookup(parsedUrl.hostname);
                if (isBannedIP(lookupInfo.address)) {
                    throw new Error(`Access to IP ${lookupInfo.address} is restricted.`);
                }
            } catch (validationError: any) {
                console.error(`[Chromium] URL Validation Failed: ${validationError.message}`);
                return { error: `URL Validation Failed: ${validationError.message}` };
            }

            console.log(`[Chromium] Visiting: ${urlToVisit}`);

            // Navigate with a more robust strategy
            const response = await page.goto(urlToVisit, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            // Allow extra time for scripts to run
            await new Promise(r => setTimeout(r, 2000));

            // Attempt to dismiss common consent banners
            await page.evaluate(() => {
                const selectors = [
                    'button[id*="consent"]', 'button[class*="consent"]',
                    'button[id*="cookie"]', 'button[class*="cookie"]',
                    'button[id*="accept"]', 'button[class*="accept"]',
                    '[aria-label*="Accept"]', '[title*="Accept"]',
                    '.ot-sdk-container button', '#onetrust-accept-btn-handler'
                ];
                for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const el of Array.from(elements)) {
                        if ((el as HTMLElement).innerText?.toLowerCase().includes('accept') ||
                            (el as HTMLElement).innerText?.toLowerCase().includes('agree') ||
                            (el as HTMLElement).innerText?.toLowerCase().includes('allow')) {
                            (el as HTMLElement).click();
                        }
                    }
                }
            });

            // Best-effort wait for network to settle
            try {
                await page.waitForNetworkIdle({ timeout: 4000 });
            } catch (e) {
                console.log(`[Chromium] Network didn't settle within 4s, proceeding.`);
            }

            if (!response) {
                throw new Error('Navigation failed: No response received');
            }

            if (!response.ok()) {
                console.warn(`[Chromium] Page responded with status ${response.status()}`);
            }

            // Take Screenshot
            const filename = `screenshot-${Date.now()}.png`;
            const screenshotPath = path.join(SCREENSHOTS_DIR, filename);
            await page.screenshot({ path: screenshotPath, fullPage: false });

            // Extract text content - focusing on main content if possible
            const textContent = await page.evaluate(() => {
                // Remove noise
                const noise = document.querySelectorAll('script, style, noscript, svg, img, iframe, nav, footer, aside');
                noise.forEach(s => s.remove());

                // Try to find the main content first
                const main = document.querySelector('main, article, #content, .content, .main-content');
                const root = (main || document.body) as HTMLElement;

                return root.innerText.trim().substring(0, 5000);
            });

            let searchResults = [];
            let imageResults = [];

            if (action === 'search') {
                searchResults = await page.evaluate(() => {
                    const articles = Array.from(document.querySelectorAll('article, .result'));
                    return articles.slice(0, 5).map((art: any) => {
                        const title = art.querySelector('h2 a, .result__title a')?.innerText || '';
                        const snippet = art.querySelector('[data-result="snippet"], .result__snippet')?.innerText || '';
                        const link = art.querySelector('h2 a, .result__title a')?.href || '';
                        return { title, snippet, link };
                    }).filter((r: any) => r.title);
                });
            } else if (action === 'search_images') {
                // Strategy: Click on a search result and extract the actual image from that page
                try {
                    // Wait for results to load
                    await page.waitForSelector('a', { timeout: 5000 });
                    await new Promise(r => setTimeout(r, 2000));

                    // Find all links that look like image result pages
                    const resultLinks = await page.evaluate(() => {
                        const links = Array.from(document.querySelectorAll('a'));
                        return links
                            .map(a => a.href)
                            .filter(href =>
                                href &&
                                href.startsWith('http') &&
                                !href.includes('duckduckgo.com') &&
                                (href.includes('pixabay') || href.includes('unsplash') || href.includes('pexels') || href.includes('flickr'))
                            )
                            .slice(0, 5);
                    });

                    console.log(`[Chromium] Found ${resultLinks.length} potential image source pages`);

                    if (resultLinks.length > 0) {
                        // Pick a random result
                        const targetUrl = resultLinks[Math.floor(Math.random() * resultLinks.length)];
                        console.log(`[Chromium] Navigating to ${targetUrl}`);

                        // Navigate to the result page
                        await page.goto(targetUrl, {
                            waitUntil: 'networkidle2',
                            timeout: 15000
                        });

                        await new Promise(r => setTimeout(r, 1500));

                        // Extract large images from this page
                        imageResults = await page.evaluate(() => {
                            const images = Array.from(document.querySelectorAll('img'));
                            return images
                                .map((img: any) => ({
                                    url: img.src,
                                    width: img.naturalWidth || img.width || 0,
                                    height: img.naturalHeight || img.height || 0,
                                    alt: img.alt || 'Image'
                                }))
                                .filter(img =>
                                    img.url &&
                                    img.url.startsWith('http') &&
                                    img.width >= 200 &&
                                    img.height >= 200 &&
                                    !img.url.includes('logo') &&
                                    !img.url.includes('icon')
                                )
                                .sort((a, b) => (b.width * b.height) - (a.width * a.height))
                                .slice(0, 3)
                                .map(img => ({
                                    title: img.alt,
                                    url: img.url
                                }));
                        });

                        console.log(`[Chromium] Extracted ${imageResults.length} images from result page`);
                    }
                } catch (e: any) {
                    console.error(`[Chromium] Error extracting images: ${e.message}`);
                }

                // Fallback to screenshot if still no images
                if (imageResults.length === 0) {
                    const screenshotUrl = `/screenshots/${filename}`;
                    imageResults.push({
                        title: 'Screenshot of Search Results',
                        url: screenshotUrl
                    });
                }
                console.log(`[Chromium] Found ${imageResults.length} images for search_images`);
            }

            const screenshotUrl = `/screenshots/${filename}`;
            const pageTitle = await page.title();

            const result: any = {
                title: pageTitle,
                url: urlToVisit,
                screenshot_url: screenshotUrl,
                content_snippet: textContent
            };

            if (searchResults && searchResults.length > 0) {
                result.search_results = searchResults;
            }
            if (imageResults && imageResults.length > 0) {
                result.image_results = imageResults;
            }

            return result;

        } catch (error: any) {
            console.error('[Chromium] Error during execution:', error);
            return { error: `Browser error: ${error.message}` };
        } finally {
            if (page) {
                try {
                    await page.close();
                } catch (e: any) {
                    if (!e.message.includes('No target with given id found')) {
                        console.error('[Chromium] Error closing page:', e);
                    }
                }
            }
        }
    }
};
