const path = require("path");

class QueueManager {
    constructor(maxPages = 50, maxDepth = 3) {
        this.maxPages = maxPages === "ALL" ? Infinity : Number(maxPages);
        this.maxDepth = maxDepth;
        this.queue = [];      // Array of objects: { url, depth, attempts, status }
        this.visited = new Set();
        this.crawledUrlsList = [];
        this.documentsList = []; // Track URLs of supported files (PDF, DOCX, etc.)
        this.urlStatuses = new Map();
        this.discoveredCount = 0;
        this.supportedExtensions = [
            ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
            ".csv", ".txt", ".md", ".markdown", ".xml", ".json",
            ".odt", ".ods", ".odp"
        ];
    }

    /**
     * Enqueues a URL with a specific depth
     * @param {string} urlStr 
     * @param {number} depth 
     * @param {string} baseDomainUrl
     */
    enqueue(urlStr, depth, baseDomainUrl) {
        try {
            const normalized = this.normalizeUrl(urlStr);
            if (!normalized) return;

            // Restrict external domains
            if (!this.isSameDomain(baseDomainUrl, normalized)) return;

            // Check visited
            if (this.visited.has(normalized)) return;

            // Check depth
            if (depth > this.maxDepth) return;

            // Verify if it is a document file URL or HTML page
            const parsedUrl = new URL(normalized);
            const ext = path.extname(parsedUrl.pathname).toLowerCase();
            const isSitemapUrl = /sitemap(?:_index)?\.xml$/i.test(parsedUrl.pathname) || /\/sitemap/i.test(parsedUrl.pathname);

            if (this.supportedExtensions.includes(ext) && !isSitemapUrl) {
                // If it is a document file, add to documentsList but do not enqueue for recursive crawl outlinks
                if (!this.documentsList.includes(normalized)) {
                    this.documentsList.push(normalized);
                }
                return;
            }

            // Check if already in queue
            if (this.queue.some(item => item.url === normalized)) return;
            if (this.urlStatuses.has(normalized)) return;

            this.discoveredCount += 1;
            this.queue.push({ url: normalized, depth, attempts: 0, status: "pending" });
        } catch {
            // Ignore parse errors
        }
    }

    /**
     * Dequeues the next item in the queue
     * @returns {Object|null}
     */
    dequeue() {
        if (this.queue.length === 0 || this.crawledUrlsList.length >= this.maxPages) {
            return null;
        }

        const item = this.queue.shift();
        this.visited.add(item.url);
        this.setUrlStatus(item.url, "processing");
        return item;
    }

    /**
     * Mark a URL as successfully crawled
     */
    markCrawled(urlStr) {
        const normalized = this.normalizeUrl(urlStr);
        if (!normalized) return;
        if (!this.crawledUrlsList.includes(normalized)) {
            this.crawledUrlsList.push(normalized);
        }
        this.setUrlStatus(normalized, "completed");
    }

    setUrlStatus(urlStr, status, error = null) {
        const normalized = this.normalizeUrl(urlStr);
        if (!normalized) return;
        const current = this.urlStatuses.get(normalized) || { status: "pending", attempts: 0, errors: [] };
        const next = {
            ...current,
            status,
            attempts: status === "processing" ? current.attempts + 1 : current.attempts,
            errors: error ? [...(current.errors || []), error] : current.errors || []
        };
        this.urlStatuses.set(normalized, next);
    }

    markFailed(urlStr, error) {
        const normalized = this.normalizeUrl(urlStr);
        if (!normalized) return;
        const current = this.urlStatuses.get(normalized) || { status: "pending", attempts: 0, errors: [] };
        const attempts = current.attempts + 1;
        this.urlStatuses.set(normalized, {
            ...current,
            status: "failed",
            attempts,
            errors: [...(current.errors || []), error]
        });
    }

    /**
     * Normalizes URLs (stripping query parameters / hashes / trailing slashes)
     */
    normalizeUrl(urlStr) {
        try {
            const parsed = new URL(urlStr);
            parsed.hash = "";
            let href = parsed.href;
            if (href.endsWith("/")) {
                href = href.slice(0, -1);
            }
            return href;
        } catch {
            return null;
        }
    }

    /**
     * Domain match helper
     */
    isSameDomain(baseUrl, targetUrl) {
        try {
            const baseHost = new URL(baseUrl).hostname.replace(/^www\./, "");
            const targetHost = new URL(targetUrl).hostname.replace(/^www\./, "");
            return targetHost === baseHost || targetHost.endsWith("." + baseHost);
        } catch {
            return false;
        }
    }

    /**
     * Get crawl diagnostics
     */
    getStats() {
        const statuses = Array.from(this.urlStatuses.values());
        const pending = statuses.filter((item) => item.status === "pending" || item.status === "processing").length;
        const completed = statuses.filter((item) => item.status === "completed").length;
        const failed = statuses.filter((item) => item.status === "failed").length;

        const queued = this.queue.length;
        const processing = statuses.filter((item) => item.status === "processing").length;
        const indexed = completed;

        return {
            totalQueued: queued,
            totalVisited: this.visited.size,
            pagesCrawled: this.crawledUrlsList.length,
            crawledUrls: this.crawledUrlsList,
            discoveredDocuments: this.documentsList,
            discovered: this.discoveredCount,
            queued,
            processing,
            indexed,
            failed,
            pending,
            completed,
            failed,
            urlStatuses: Object.fromEntries(this.urlStatuses)
        };
    }
}

module.exports = QueueManager;
