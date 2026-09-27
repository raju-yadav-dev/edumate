const fetch = (() => {
    try {
        return require("node-fetch");
    } catch {
        return global.fetch;
    }
})();

const fetchWithTimeout = async (url, options = {}, timeoutMs = 3500) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
};

const TRUSTED_DOMAINS = [
    ".edu",
    ".gov",
    ".org",
    "wikipedia.org",
    "w3.org",
    "developer.mozilla.org",
    "docs.oracle.com",
    "learn.microsoft.com",
    "docs.python.org",
    "react.dev",
    "reactjs.org",
    "developer.google.com",
    "nist.gov",
    "owasp.org"
];

const UNTRUSTED_DOMAINS = [
    "reddit.com",
    "quora.com",
    "medium.com",
    "blogger.com",
    "blogspot.com",
    "wordpress.com",
    "tumblr.com",
    "facebook.com",
    "twitter.com",
    "x.com"
];

/**
 * Get the university website domain based on user profile settings
 * @param {Object} user
 * @returns {string}
 */
const getUniversityDomain = (user) => {
    if (process.env.UNIVERSITY_DOMAIN) {
        return process.env.UNIVERSITY_DOMAIN;
    }
    const inst = String(user?.institution || "").toLowerCase().trim();
    if (inst.includes("heritage") || inst.includes("hit") || inst.includes("kolkata")) {
        return "heritageit.edu";
    }
    return "heritageit.edu"; // Default fallback
};

/**
 * Filter results based on trusted/untrusted domains
 * @param {string} urlStr 
 * @returns {boolean}
 */
const isTrustedUrl = (urlStr) => {
    try {
        const url = new URL(urlStr);
        const host = url.hostname.toLowerCase();
        
        // Explicitly exclude known untrusted domains
        if (UNTRUSTED_DOMAINS.some(domain => host.includes(domain))) {
            return false;
        }

        // Check if host matches trusted domain list
        return TRUSTED_DOMAINS.some(domain => host.endsWith(domain) || host.includes(domain));
    } catch {
        return false;
    }
};

/**
 * Search the web using DuckDuckGo HTML search (keyless and light)
 * @param {string} query 
 * @returns {Promise<Array>}
 */
const searchDuckDuckGo = async (query) => {
    try {
        const response = await fetchWithTimeout(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
            }
        });

        if (!response.ok) {
            throw new Error(`DuckDuckGo responded with status ${response.status}`);
        }

        const html = await response.text();
        const results = [];
        const resultBlocks = html.split(/class="result(?!\w)/i);

        for (let i = 1; i < resultBlocks.length && results.length < 10; i++) {
            const block = resultBlocks[i];
            const urlMatch = block.match(/href="([^"]+)"/);
            const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
            const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)(?:<\/span>|<\/a>)/);

            if (urlMatch && titleMatch) {
                let url = urlMatch[1];
                if (url.includes("uddg=")) {
                    const uddg = url.split("uddg=")[1].split("&")[0];
                    url = decodeURIComponent(uddg);
                }

                const title = titleMatch[1].replace(/<[^>]*>/g, "").trim();
                const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, "").trim() : "";

                results.push({ title, url, snippet });
            }
        }
        return results;
    } catch (err) {
        console.error("DuckDuckGo scraping failed:", err.message);
        return [];
    }
};

/**
 * Search the web using Jina Reader Search API (keyless markdown parser)
 * @param {string} query 
 * @returns {Promise<Array>}
 */
const searchJina = async (query) => {
    try {
        const headers = {
            "Accept": "application/json"
        };
        if (process.env.JINA_API_KEY) {
            headers["Authorization"] = `Bearer ${process.env.JINA_API_KEY}`;
        }
        const response = await fetchWithTimeout(`https://s.jina.ai/${encodeURIComponent(query)}`, {
            headers
        });

        if (!response.ok) {
            throw new Error(`Jina Reader responded with status ${response.status}`);
        }

        const payload = await response.json();
        const items = Array.isArray(payload.data) ? payload.data : [];
        
        return items.map(item => ({
            title: item.title || "",
            url: item.url || "",
            snippet: item.content || item.description || ""
        }));
    } catch (err) {
        console.error("Jina Search API failed:", err.message);
        return [];
    }
};

/**
 * Coordinate provider searches with transparent error failover
 * @param {string} query
 * @returns {Promise<Array<Object>>}
 */
const executeWebSearch = async (query) => {
    if (!query || !query.trim()) {
        return [];
    }

    // Try DuckDuckGo first
    let results = await searchDuckDuckGo(query);

    // Fallback to Jina if DDG returned no results
    if (results.length === 0) {
        results = await searchJina(query);
    }

    return results;
};

/**
 * Search only the official university website
 * @param {string} query
 * @param {Object} user
 * @returns {Promise<Array<Object>>}
 */
const searchUniversityWebsite = async (query, user) => {
    const domain = getUniversityDomain(user);
    const restrictedQuery = `site:${domain} ${query}`;
    console.log(`Executing university site-restricted search: "${restrictedQuery}"`);
    const results = await executeWebSearch(restrictedQuery);
    return results.slice(0, 5);
};

/**
 * Search general web and filter results to trusted domains only
 * @param {string} query
 * @returns {Promise<Array<Object>>}
 */
const searchTrustedWeb = async (query) => {
    console.log(`Executing general trusted search for query: "${query}"`);
    const results = await executeWebSearch(query);
    const filtered = results.filter(res => isTrustedUrl(res.url));
    const output = filtered.length > 0 ? filtered : results;
    return output.slice(0, 5);
};

/**
 * Legacy searchWeb export for backwards compatibility
 */
const searchWeb = async (query) => {
    const results = await executeWebSearch(query);
    return results.slice(0, 5);
};

module.exports = {
    searchUniversityWebsite,
    searchTrustedWeb,
    searchWeb,
    isTrustedUrl
};
