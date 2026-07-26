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
        const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
            }
        });

        if (!response.ok) {
            throw new Error(`DuckDuckGo responded with status ${response.status}`);
        }

        const html = await response.text();
        const results = [];
        const resultBlocks = html.split('class="result');

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
        const response = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
            headers: {
                "Accept": "application/json"
            }
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
 * Execute a hybrid web search with fallback mechanisms and domain verification
 * @param {string} query - The search query
 * @returns {Promise<Array<Object>>} - Filtered and trusted search results
 */
const searchWeb = async (query) => {
    if (!query || !query.trim()) {
        return [];
    }

    console.log(`Starting web search for query: "${query}"`);
    
    // Attempt DuckDuckGo HTML first (reliable, keyless)
    let results = await searchDuckDuckGo(query);

    // Fallback to Jina if DDG returned no results
    if (results.length === 0) {
        results = await searchJina(query);
    }

    // Filter results to only trust list
    const filteredResults = results.filter(res => isTrustedUrl(res.url));

    // If filtering left us with nothing, fall back to allow standard results
    // but rank trusted ones first
    const outputResults = filteredResults.length > 0 ? filteredResults : results;

    // Return the top 5 results
    return outputResults.slice(0, 5);
};

module.exports = {
    searchWeb,
    isTrustedUrl
};
