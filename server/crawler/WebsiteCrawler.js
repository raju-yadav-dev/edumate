const { CheerioCrawler, Dataset } = require("crawlee");
const cheerio = require("cheerio");
const RobotsManager = require("./RobotsManager");
const SitemapCrawler = require("./SitemapCrawler");
const QueueManager = require("./QueueManager");
const ContentCleaner = require("./ContentCleaner");

class WebsiteCrawler {
    /**
     * Initializes the crawler configuration
     * @param {Object} options
     * @param {string} options.startUrl - The entry point URL
     * @param {number|string} options.maxPages - Maximum pages to crawl (10 to ALL)
     * @param {number} [options.maxDepth=3] - Maximum link depth
     * @param {number} [options.delayMs=1000] - Rate limiting delay between fetches
     */
    constructor({ startUrl, maxPages, maxDepth = 3, delayMs = 1000 }) {
        this.startUrl = startUrl;
        this.maxPages = maxPages;
        this.maxDepth = maxDepth;
        this.delayMs = delayMs;

        this.robotsManager = new RobotsManager();
        this.sitemapCrawler = new SitemapCrawler();
        this.queueManager = new QueueManager(maxPages, maxDepth);
    }

    /**
     * Executes the prioritized web crawl job
     * @param {Object} callbacks
     * @param {Function} callbacks.onPage - Invoked when an HTML page is fetched: (url, title, cleanText) => Promise
     * @param {Function} [callbacks.onProgress] - Invoked for status reports: (stats) => void
     */
    async crawl(callbacks = {}) {
        const { onPage, onProgress } = callbacks;

        // 1. Fetch and respect robots.txt
        await this.robotsManager.parse(this.startUrl);

        // 2. Discover links from sitemaps
        let sitemapLinks = [];
        if (this.robotsManager.sitemaps.length > 0) {
            sitemapLinks = await this.sitemapCrawler.fetchSitemapUrls(
                this.robotsManager.sitemaps,
                this.startUrl
            );
        }

        // 3. Queue bootstrap
        this.queueManager.enqueue(this.startUrl, 0, this.startUrl);
        sitemapLinks.forEach(link => {
            this.queueManager.enqueue(link, 1, this.startUrl);
        });

        const startOrigin = new URL(this.startUrl).origin;
        console.log(`[WebsiteCrawler] Crawl queue bootstrapped with ${this.queueManager.queue.length} targets.`);

        // 4. Initialize Crawlee CheerioCrawler
        const self = this;
        const crawler = new CheerioCrawler({
            // Respect rate limiting and max requests bounds
            maxRequestsPerCrawl: this.queueManager.maxPages,
            minConcurrency: 1,
            maxConcurrency: 2,
            requestHandlerTimeoutSecs: 20,
            
            // Custom request execution hook
            requestHandler: async ({ request, body, $ }) => {
                const currentUrl = request.url;

                // Validate URL against robots.txt permissions
                if (!self.robotsManager.isAllowed(currentUrl)) {
                    console.log(`[WebsiteCrawler] Robots.txt disallows crawling URL: ${currentUrl}. Skipping.`);
                    return;
                }

                // Respect rate limiting delay
                if (self.delayMs > 0) {
                    await new Promise(resolve => setTimeout(resolve, self.delayMs));
                }

                console.log(`[WebsiteCrawler] Fetching page: ${currentUrl}`);
                self.queueManager.markCrawled(currentUrl);

                // Extract clean readability article text
                const pageResult = ContentCleaner.clean(body, currentUrl);
                
                // Invoke callback to persist and index the HTML page
                if (onPage) {
                    try {
                        await onPage({
                            url: currentUrl,
                            title: pageResult.title,
                            content: pageResult.content
                        });
                    } catch (saveError) {
                        console.error(`[WebsiteCrawler] onPage callback failed for ${currentUrl}:`, saveError.message);
                    }
                }

                // Retrieve current crawling depth
                const currentDepth = request.userData?.depth || 0;

                // Discover outgoing links inside the page using Cheerio
                $("a[href]").each((_, element) => {
                    const href = $(element).attr("href");
                    if (href) {
                        try {
                            const resolved = new URL(href, currentUrl).href;
                            // Enqueue outlink targets with incremented depth
                            self.queueManager.enqueue(resolved, currentDepth + 1, self.startUrl);
                        } catch {
                            // Skip invalid links
                        }
                    }
                });

                // Report current crawl diagnostics
                if (onProgress) {
                    onProgress(self.queueManager.getStats());
                }
            }
        });

        // 5. Feed our custom queue targets to Crawlee
        const initialRequests = this.queueManager.queue.map(item => ({
            url: item.url,
            userData: { depth: item.depth }
        }));

        // Clear queue in queueManager since they are handed to Crawlee
        this.queueManager.queue = [];

        if (initialRequests.length > 0) {
            await crawler.run(initialRequests);
        }

        // Process discovered documents sequentially
        const discoveredDocs = this.queueManager.documentsList;
        if (discoveredDocs.length > 0 && callbacks.onDocument) {
            console.log(`[WebsiteCrawler] Processing ${discoveredDocs.length} discovered documents...`);
            for (const docUrl of discoveredDocs) {
                try {
                    await callbacks.onDocument(docUrl);
                } catch (err) {
                    console.error(`[WebsiteCrawler] Failed to process document ${docUrl}:`, err.message);
                }
            }
        }

        const finalStats = this.queueManager.getStats();
        console.log(`[WebsiteCrawler] Crawl completed. Total crawled: ${finalStats.pagesCrawled} | Discovered docs: ${finalStats.discoveredDocuments.length}`);
        return finalStats;
    }
}

module.exports = WebsiteCrawler;
