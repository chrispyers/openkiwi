import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

// Helper to ensure screenshots directory exists
const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Global browser instance
let browser: any = null;

async function getBrowser() {
    // Check if existing browser is still valid
    if (browser) {
        if (browser.isConnected()) {
            return browser;
        }
        // If disconnected, clear it and restart
        console.log('[Browser] Browser disconnected, relaunching...');
        try {
            await browser.close();
        } catch (e) { /* ignore */ }
        browser = null;
    }

    const options: any = {
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // critical for docker
            '--disable-gpu',
            '--no-zygote',
            '--single-process', // helps in low resource containers
            '--window-size=1280,800'
        ]
    };

    // If running in docker, use the installed chromium
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    try {
        console.log('[Browser] Launching new browser instance...');
        browser = await puppeteer.launch(options);
        return browser;
    } catch (error) {
        console.error('[Browser] Failed to launch browser:', error);
        throw new Error('Browser launch failed');
    }
}

export default {
    definition: {
        name: 'web_browser',
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

            console.log(`[Browser] Visiting: ${urlToVisit}`);

            // Navigate with increased timeout and better wait condition
            const response = await page.goto(urlToVisit, {
                waitUntil: ['domcontentloaded', 'networkidle2'],
                timeout: 30000
            });

            if (!response) {
                throw new Error('Navigation failed: No response received');
            }

            if (!response.ok()) {
                console.warn(`[Browser] Page responded with status ${response.status()}`);
            }

            // specific waits
            try {
                if (action === 'search') {
                    await page.waitForSelector('#react-layout, #links, .result', { timeout: 5000 });
                } else if (action === 'search_images') {
                    // Wait for any image to load
                    try {
                        await page.waitForSelector('img', { timeout: 5000 });
                        // Scroll extensively to trigger lazy loading
                        for (let i = 0; i < 5; i++) {
                            await page.evaluate(() => window.scrollBy(0, 500));
                            await new Promise(r => setTimeout(r, 200));
                        }
                        await new Promise(r => setTimeout(r, 1000));
                    } catch (e) {
                        // ignore
                    }
                }
            } catch (e) {
                // Ignore timeout waiting for specific selector
            }

            // Take Screenshot
            const filename = `screenshot-${Date.now()}.png`;
            const screenshotPath = path.join(SCREENSHOTS_DIR, filename);
            await page.screenshot({ path: screenshotPath, fullPage: false });

            // Extract text content
            const textContent = await page.evaluate(() => {
                const scripts = document.querySelectorAll('script, style, noscript, svg, img');
                scripts.forEach(s => s.remove());
                return document.body.innerText.trim().substring(0, 4000);
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

                    console.log(`[Browser] Found ${resultLinks.length} potential image source pages`);

                    if (resultLinks.length > 0) {
                        // Pick a random result
                        const targetUrl = resultLinks[Math.floor(Math.random() * resultLinks.length)];
                        console.log(`[Browser] Navigating to ${targetUrl}`);

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

                        console.log(`[Browser] Extracted ${imageResults.length} images from result page`);
                    }
                } catch (e: any) {
                    console.error(`[Browser] Error extracting images: ${e.message}`);
                }

                // Fallback to screenshot if still no images
                if (imageResults.length === 0) {
                    const screenshotUrl = `/screenshots/${filename}`;
                    imageResults.push({
                        title: 'Screenshot of Search Results',
                        url: screenshotUrl
                    });
                }
                console.log(`[Browser] Found ${imageResults.length} images for search_images`);
            }

            const screenshotUrl = `/screenshots/${filename}`;
            const pageTitle = await page.title();

            // Normally close page in finally block

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
            console.error('[Browser] Error during execution:', error);
            return { error: `Browser error: ${error.message}` };
        } finally {
            if (page) {
                try {
                    await page.close();
                } catch (e: any) {
                    // Start of the error that user reported
                    if (!e.message.includes('No target with given id found')) {
                        console.error('[Browser] Error closing page:', e);
                    }
                }
            }
        }
    }
};
