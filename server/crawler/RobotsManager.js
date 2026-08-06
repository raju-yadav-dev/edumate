class RobotsManager {
    constructor() {
        this.disallowedPaths = [];
        this.sitemaps = [];
        this.host = "";
    }

    /**
     * Fetches and parses robots.txt for a website host origin
     * @param {string} startUrl
     */
    async parse(startUrl) {
        try {
            const url = new URL(startUrl);
            this.host = url.origin;
            const robotsUrl = `${url.origin}/robots.txt`;

            console.log(`[RobotsManager] Fetching robots.txt from: ${robotsUrl}`);
            const response = await fetch(robotsUrl, {
                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36" },
                signal: AbortSignal.timeout(8000)
            });

            if (!response.ok) {
                console.log(`[RobotsManager] No robots.txt found (HTTP ${response.status}). Open crawling permitted.`);
                return;
            }

            const text = await response.text();
            const lines = text.split(/\r?\n/);
            let isUserAgentWildcard = false;

            for (const line of lines) {
                const cleanLine = line.trim();
                if (!cleanLine || cleanLine.startsWith("#")) continue;

                const colonIndex = cleanLine.indexOf(":");
                if (colonIndex === -1) continue;

                const key = cleanLine.substring(0, colonIndex).trim().toLowerCase();
                const value = cleanLine.substring(colonIndex + 1).trim();

                if (key === "user-agent") {
                    isUserAgentWildcard = (value === "*");
                } else if (key === "disallow" && isUserAgentWildcard) {
                    if (value) {
                        this.disallowedPaths.push(value);
                    }
                } else if (key === "sitemap") {
                    this.sitemaps.push(value);
                }
            }
            console.log(`[RobotsManager] Robots parsing complete. Disallows: ${this.disallowedPaths.length} | Sitemaps: ${this.sitemaps.length}`);
        } catch (err) {
            console.warn(`[RobotsManager] Failed to fetch or parse robots.txt: ${err.message}. Defaulting to open crawling.`);
        }
    }

    /**
     * Checks if a URL path is allowed for crawling
     * @param {string} urlStr
     * @returns {boolean}
     */
    isAllowed(urlStr) {
        try {
            const url = new URL(urlStr);
            const pathToCheck = url.pathname + url.search;

            return !this.disallowedPaths.some(disallowed => {
                // If disallowed path is "/" and wildcard matches
                if (disallowed === "/") return true;
                // Basic prefix matching
                return pathToCheck.startsWith(disallowed);
            });
        } catch {
            return false;
        }
    }
}

module.exports = RobotsManager;
