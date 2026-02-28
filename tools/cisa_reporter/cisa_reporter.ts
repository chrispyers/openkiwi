import { getBrowser } from '../browser_utils.js';


export default {
    definition: {
        name: 'cisa_reporter',
        displayName: 'CISA Reporter',
        pluginType: 'tool',
        description: 'Tool for scraping CISA bulletins for vulnerability data.',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['get_bulletins', 'parse_bulletin'],
                    description: 'Action to perform: get list of bulletins or parse a specific bulletin table.'
                },
                month: {
                    type: 'string',
                    description: 'For get_bulletins: The month and year (e.g., "February 2026").'
                },
                url: {
                    type: 'string',
                    description: 'For parse_bulletin: The URL of the specific bulletin page.'
                },
                services: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'For parse_bulletin: List of services to filter for (e.g. ["GitLab", "Jira"]). If provided, only matches will be returned.'
                }
            },
            required: ['action']
        }
    },
    handler: async ({ action, month, url, services }: { action: 'get_bulletins' | 'parse_bulletin'; month?: string; url?: string; services?: string[] }) => {
        let page: any = null;
        try {
            const browserInstance = await getBrowser();
            page = await browserInstance.newPage();
            await page.setViewport({ width: 1280, height: 800 });

            if (action === 'get_bulletins') {
                const targetMonth = month || '';

                await page.goto('https://www.cisa.gov/news-events/bulletins', { waitUntil: 'domcontentloaded' });

                await new Promise(r => setTimeout(r, 2000));

                const bulletins = await page.evaluate((targetMonth: string) => {
                    const keywords = targetMonth.split(/\s+/).filter(Boolean);

                    const bulletinsFound = Array.from(document.querySelectorAll('h3')).map(h3 => {
                        const link = h3.querySelector('a');
                        return {
                            text: (h3 as HTMLElement).innerText,
                            hasLink: !!link,
                            href: link?.href
                        };
                    });

                    return bulletinsFound
                        .filter(h => {
                            if (!h.hasLink) return false;
                            if (keywords.length === 0) return true;
                            // Ensure all keywords (e.g., "February" and "2026") are present in the title
                            return keywords.every(kw => h.text.includes(kw));
                        })
                        .map(h => ({
                            title: h.text,
                            url: h.href
                        }));
                }, targetMonth);

                return { bulletins };

            } else if (action === 'parse_bulletin') {
                if (!url) return { error: 'URL is required for parse_bulletin' };

                await page.goto(url, { waitUntil: 'load', timeout: 60000 });

                await page.waitForSelector('table', { timeout: 20000 });

                const data = await page.evaluate((filterServices: string[] | undefined) => {
                    const tables = Array.from(document.querySelectorAll('table'));
                    const vulns: any[] = [];

                    tables.forEach(table => {
                        const headers = Array.from(table.querySelectorAll('th')).map(th => th.innerText.toLowerCase());
                        const isVulnTable = headers.some(h => h.includes('vendor') || h.includes('product'));

                        if (isVulnTable) {
                            const rows = Array.from(table.querySelectorAll('tbody tr'));
                            rows.forEach(row => {
                                const cells = Array.from(row.querySelectorAll('td'));
                                if (cells.length >= 5) {
                                    const vendorProduct = cells[0]?.innerText.trim() || '';
                                    const description = cells[1]?.innerText.trim() || '';

                                    // If filterServices is provided, check if any service matches vendorProduct or description
                                    let isRelevant = true;
                                    if (filterServices && filterServices.length > 0) {
                                        isRelevant = filterServices.some(service =>
                                            vendorProduct.toLowerCase().includes(service.toLowerCase()) ||
                                            description.toLowerCase().includes(service.toLowerCase())
                                        );
                                    }

                                    if (isRelevant) {
                                        vulns.push({
                                            vendor_product: vendorProduct,
                                            description: description,
                                            published: cells[2]?.innerText.trim() || '',
                                            cvss_score: cells[3]?.innerText.trim() || '',
                                            cve_id: cells[4]?.innerText.trim() || '',
                                            patch_info: cells[5]?.innerText.trim() || ''
                                        });
                                    }
                                }
                            });
                        }
                    });

                    return vulns;
                }, services);

                return {
                    vulnerabilities: data,
                    match_count: data.length,
                    filtered_by: services
                };
            }
        } catch (error: any) {
            return { error: `CISA Tool Error: ${error.message}` };
        } finally {
            if (page) await page.close();
        }
    }
};
