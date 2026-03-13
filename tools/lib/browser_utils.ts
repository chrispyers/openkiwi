import puppeteer from 'puppeteer';

let browser: any = null;

export async function getBrowser() {
    if (browser && browser.isConnected()) return browser;

    const options: any = {
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            '--single-process',
            '--window-size=1280,800'
        ]
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    try {
        console.log('[Browser] Launching shared browser instance...');
        browser = await puppeteer.launch(options);
        return browser;
    } catch (error) {
        console.error('[Browser] Failed to launch browser:', error);
        throw new Error('Browser launch failed');
    }
}
