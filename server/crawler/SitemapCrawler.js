class SitemapCrawler {
    constructor() {
        this.urls = [];
    }

    /**
     * Parses a list of sitemap XML URLs and extracts child links
     * @param {Array<string>} sitemapUrls
     * @param {string} baseDomainUrl
     * @returns {Promise<Array<string>>}
     */
    async fetchSitemapUrls(sitemapUrls, baseDomainUrl) {
        const extractedUrls = [];
        const baseOrigin = new URL(baseDomainUrl).origin;

        // Add standard fallback sitemaps to scan if list is empty
        const sitemapsToScan = sitemapUrls.length > 0 
            ? sitemapUrls 
            : [`${baseOrigin}/sitemap.xml`, `${baseOrigin}/sitemap_index.xml`];

        for (const sitemapUrl of sitemapsToScan) {
            try {
                console.log(`[SitemapCrawler] Scanning sitemap: ${sitemapUrl}`);
                const response = await fetch(sitemapUrl, {
                    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36" },
                    signal: AbortSignal.timeout(10000)
                });

                if (!response.ok) {
                    console.log(`[SitemapCrawler] Sitemap not found at: ${sitemapUrl} (HTTP ${response.status})`);
                    continue;
                }

                const xml = await response.text();
                
                // Regular expression to extract url tags
                const locRegex = /<loc>([\s\S]*?)<\/loc>/gi;
                let match;

                while ((match = locRegex.exec(xml)) !== null) {
                    const loc = match[1].trim();
                    try {
                        const parsedLoc = new URL(loc);
                        // Filter out external domain links
                        if (parsedLoc.origin === baseOrigin) {
                            extractedUrls.push(loc);
                        }
                    } catch {
                        // Ignore malformed loc URLs
                    }
                }
            } catch (err) {
                console.warn(`[SitemapCrawler] Failed to parse sitemap ${sitemapUrl}: ${err.message}`);
            }
        }

        const uniqueUrls = [...new Set(extractedUrls)];
        console.log(`[SitemapCrawler] Finished scanning sitemaps. Discovered: ${uniqueUrls.length} links.`);
        this.urls = uniqueUrls;
        return uniqueUrls;
    }
}

module.exports = SitemapCrawler;
