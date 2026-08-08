class SitemapCrawler {
    constructor() {
        this.urls = [];
        this.visitedSitemaps = new Set();
    }

    /**
     * Parses a list of sitemap XML URLs and extracts child links
     * @param {Array<string>} sitemapUrls
     * @param {string} baseDomainUrl
     * @returns {Promise<Array<string>>}
     */
    async fetchSitemapUrls(sitemapUrls, baseDomainUrl) {
        const baseOrigin = new URL(baseDomainUrl).origin;
        const discoveredUrls = new Set();
        const sitemapQueue = sitemapUrls.length > 0
            ? [...sitemapUrls]
            : [`${baseOrigin}/sitemap.xml`, `${baseOrigin}/sitemap_index.xml`];
        const seenSitemaps = new Set();

        const isSitemapLocation = (loc) => {
            try {
                const parsed = new URL(loc);
                return /sitemap(?:_index)?\.xml$/i.test(parsed.pathname) || /\/sitemap/i.test(parsed.pathname);
            } catch {
                return false;
            }
        };

        const crawlSitemap = async (sitemapUrl) => {
            if (!sitemapUrl || seenSitemaps.has(sitemapUrl) || this.visitedSitemaps.has(sitemapUrl)) {
                return;
            }

            seenSitemaps.add(sitemapUrl);
            this.visitedSitemaps.add(sitemapUrl);

            try {
                console.log(`[SitemapCrawler] Scanning sitemap: ${sitemapUrl}`);
                const response = await fetch(sitemapUrl, {
                    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36" },
                    signal: AbortSignal.timeout(10000)
                });

                if (!response.ok) {
                    console.log(`[SitemapCrawler] Sitemap not found at: ${sitemapUrl} (HTTP ${response.status})`);
                    return;
                }

                const xml = await response.text();
                const isSitemapIndex = /<\s*sitemapindex\b/i.test(xml);
                
                // Regular expression to extract url tags
                const locRegex = /<loc>([\s\S]*?)<\/loc>/gi;
                for (const match of xml.matchAll(locRegex)) {
                    const loc = match[1].trim();
                    try {
                        const parsedLoc = new URL(loc);
                        // Filter out external domain links
                        if (parsedLoc.origin === baseOrigin) {
                            if (isSitemapIndex || isSitemapLocation(loc)) {
                                await crawlSitemap(loc);
                            } else {
                                discoveredUrls.add(loc);
                            }
                        }
                    } catch {
                        // Ignore malformed loc URLs
                    }
                }
            } catch (err) {
                console.warn(`[SitemapCrawler] Failed to parse sitemap ${sitemapUrl}: ${err.message}`);
            }
        };

        for (const sitemapUrl of sitemapQueue) {
            await crawlSitemap(sitemapUrl);
        }

        const uniqueUrls = [...discoveredUrls];
        console.log(`[SitemapCrawler] Finished scanning sitemaps. Discovered: ${uniqueUrls.length} links.`);
        this.urls = uniqueUrls;
        return uniqueUrls;
    }
}

module.exports = SitemapCrawler;
