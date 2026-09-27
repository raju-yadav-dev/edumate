const cheerio = require("cheerio");
const RobotsManager = require("./RobotsManager");
const SitemapCrawler = require("./SitemapCrawler");
const QueueManager = require("./QueueManager");
const ContentCleaner = require("./ContentCleaner");

class WebsiteCrawler {
    constructor({ startUrl, maxPages, maxDepth = 3, delayMs = 50, maxConcurrency = null }) {
        this.startUrl = startUrl;
        this.maxPages = maxPages;
        this.maxDepth = maxDepth;
        this.delayMs = Math.max(0, Number(delayMs) || 0);

        const configuredConcurrency = Number(maxConcurrency ?? process.env.CRAWLER_CONCURRENCY ?? 5);
        this.maxConcurrency = Math.max(1, Math.min(20, Number.isFinite(configuredConcurrency) ? configuredConcurrency : 5));

        this.robotsManager = new RobotsManager();
        this.sitemapCrawler = new SitemapCrawler();
        this.queueManager = new QueueManager(maxPages, maxDepth);
        this.pendingPages = [];
        this.pendingPageWorkerActive = false;
        this.pendingPageCallback = null;
        this.domainLastRequestAt = new Map();
    }

    async crawl(callbacks = {}) {
        const { onPage, onProgress, onDocument } = callbacks;

        await this.robotsManager.parse(this.startUrl);

        let sitemapLinks = [];
        if (this.robotsManager.sitemaps.length > 0) {
            sitemapLinks = await this.sitemapCrawler.fetchSitemapUrls(this.robotsManager.sitemaps, this.startUrl);
        }

        this.queueManager.enqueue(this.startUrl, 0, this.startUrl);
        sitemapLinks.forEach((link) => this.queueManager.enqueue(link, 1, this.startUrl));

        console.log(`[WebsiteCrawler] Crawl queue bootstrapped with ${this.queueManager.queue.length} targets.`);

        const activeTasks = [];
        while ((this.queueManager.queue.length > 0 || activeTasks.length > 0) && this.queueManager.crawledUrlsList.length < this.maxPages) {
            while (activeTasks.length < this.maxConcurrency && this.queueManager.queue.length > 0) {
                const nextItem = this.queueManager.dequeue();
                if (!nextItem) break;

                const task = this.processRequest(nextItem, { onProgress })
                    .then(() => true)
                    .catch((error) => {
                        console.error(`[WebsiteCrawler] Crawl request failed for ${nextItem.url}:`, error?.message || error);
                        this.queueManager.markFailed(nextItem.url, error?.message || String(error));
                        return false;
                    })
                    .finally(() => {
                        const index = activeTasks.indexOf(task);
                        if (index >= 0) {
                            activeTasks.splice(index, 1);
                        }
                    });

                activeTasks.push(task);
            }

            if (activeTasks.length === 0) break;
            await Promise.race(activeTasks);
        }

        if (this.pendingPages.length > 0 && onPage) {
            console.log(`[WebsiteCrawler] Processing ${this.pendingPages.length} discovered pages...`);
            await this.runWorkerPool(this.pendingPages, async (pagePayload) => {
                await onPage(pagePayload);
            });
        }

        const discoveredDocs = this.queueManager.documentsList;
        if (discoveredDocs.length > 0 && onDocument) {
            console.log(`[WebsiteCrawler] Processing ${discoveredDocs.length} discovered documents...`);
            await this.runWorkerPool(discoveredDocs, async (docUrl) => {
                await onDocument(docUrl);
            });
        }

        const finalStats = this.queueManager.getStats();
        console.log(`[WebsiteCrawler] Crawl completed. Total crawled: ${finalStats.pagesCrawled} | Discovered docs: ${finalStats.discoveredDocuments.length}`);
        return finalStats;
    }

    async runWorkerPool(items, worker) {
        if (!Array.isArray(items) || items.length === 0) return [];

        const results = [];
        const active = [];
        let index = 0;

        const startNext = () => {
            while (active.length < this.maxConcurrency && index < items.length) {
                const currentItem = items[index++];
                const task = Promise.resolve()
                    .then(() => worker(currentItem))
                    .then((result) => {
                        results.push(result);
                    })
                    .catch((error) => {
                        console.error(`[WebsiteCrawler] Worker failed for ${currentItem?.url || currentItem}:`, error?.message || error);
                    })
                    .finally(() => {
                        const taskIndex = active.indexOf(task);
                        if (taskIndex >= 0) {
                            active.splice(taskIndex, 1);
                        }
                    });

                active.push(task);
            }
        };

        startNext();
        while (active.length > 0) {
            await Promise.race(active);
            startNext();
        }

        return results;
    }

    async processRequest(item, callbacks = {}) {
        const { onProgress } = callbacks;
        const currentUrl = item.url;

        if (!this.robotsManager.isAllowed(currentUrl)) {
            console.log(`[WebsiteCrawler] Robots.txt disallows crawling URL: ${currentUrl}. Skipping.`);
            this.queueManager.setUrlStatus(currentUrl, "failed", "Robots.txt disallowed");
            return;
        }

        let lastError;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
                await this.waitForRateLimit(currentUrl);
                const response = await fetch(currentUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0",
                        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                    },
                    signal: AbortSignal.timeout(20000)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                let html = await response.text();
                if (this.shouldRenderWithPlaywright(currentUrl, html)) {
                    const rendered = await this.renderWithPlaywright(currentUrl);
                    if (rendered && rendered.content) {
                        html = rendered.content;
                    }
                }

                const $ = cheerio.load(html);
                const pageResult = ContentCleaner.clean(html, currentUrl);

                this.pendingPages.push({
                    url: currentUrl,
                    title: pageResult.title,
                    content: pageResult.content
                });
                this.queueManager.markCrawled(currentUrl);

                $("a[href]").each((_, element) => {
                    const href = $(element).attr("href");
                    if (href) {
                        try {
                            const resolved = new URL(href, currentUrl).href;
                            this.queueManager.enqueue(resolved, (item.depth || 0) + 1, this.startUrl);
                        } catch {
                            // Ignore invalid links
                        }
                    }
                });

                if (onProgress) {
                    onProgress(this.queueManager.getStats());
                }
                return;
            } catch (error) {
                lastError = error;
                if (attempt < 3) {
                    await new Promise((resolve) => setTimeout(resolve, Math.min(2000, 250 * attempt)));
                    continue;
                }
            }
        }

        this.queueManager.markFailed(currentUrl, lastError?.message || "Unknown fetch error");
        throw lastError;
    }

    async waitForRateLimit(url) {
        const parsedUrl = new URL(url);
        const domain = parsedUrl.hostname;
        const now = Date.now();
        const lastRequestAt = this.domainLastRequestAt.get(domain) || 0;
        const waitMs = Math.max(0, lastRequestAt + this.delayMs - now);

        if (waitMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, waitMs));
        }

        this.domainLastRequestAt.set(domain, Date.now());
    }

    shouldRenderWithPlaywright(url, html) {
        if (!html) return true;
        const cleanText = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        if (cleanText.length < 250) return true;

        const dynamicMarkers = [
            '<div id="root"></div>',
            '<div id="app"></div>',
            'noscript',
            'enable javascript',
            'loading...',
            '__initial_state__',
            'ng-app',
            'v-app'
        ];
        const lowerHtml = html.toLowerCase();
        return dynamicMarkers.some(marker => lowerHtml.includes(marker) && cleanText.length < 500);
    }

    async renderWithPlaywright(url) {
        try {
            console.log(`[WebsiteCrawler] Playwright rendering triggered for dynamic page: ${url}`);
            let chromium;
            try {
                chromium = require("playwright").chromium;
            } catch {
                try {
                    chromium = require("playwright-core").chromium;
                } catch {
                    console.log(`[WebsiteCrawler] Playwright not installed. Skipping JS rendering.`);
                    return null;
                }
            }

            const browser = await chromium.launch({ headless: true });
            const page = await browser.newPage();
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
            await page.waitForTimeout(1000);

            // Scroll to trigger lazy loading
            await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
            await page.waitForTimeout(500);

            const content = await page.content();
            const cleanText = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

            let pdfBuffer = null;
            if (cleanText.length < 250) {
                console.log(`[WebsiteCrawler] DOM text length < 250. Generating PDF snapshot fallback for: ${url}`);
                try {
                    pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
                } catch (pdfErr) {
                    console.log(`[WebsiteCrawler] PDF fallback creation failed: ${pdfErr.message}`);
                }
            }

            await browser.close();
            return { content, pdfBuffer };
        } catch (err) {
            console.error(`[WebsiteCrawler] Playwright rendering failed for ${url}:`, err.message);
            return null;
        }
    }
}

module.exports = WebsiteCrawler;
