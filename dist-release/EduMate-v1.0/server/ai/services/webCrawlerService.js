const axios = require("axios");
const webSearchService = require("./webSearchService");

const FIRECRAWL_API_URL = process.env.FIRECRAWL_API_URL || "https://api.firecrawl.dev";

/**
 * Clean content by stripping excessive whitespaces and formatting
 */
const cleanContent = (text) => {
    if (!text) return "";
    return text
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]+/g, " ")
        .trim();
};

/**
 * Extract domain name from URL
 */
const getDomain = (urlStr) => {
    try {
        const url = new URL(urlStr);
        return url.hostname.replace("www.", "");
    } catch {
        return "";
    }
};

/**
 * Scrapes a single URL using Firecrawl's /v1/scrape endpoint
 */
const scrapeUrlWithFirecrawl = async (url, apiKey) => {
    try {
        console.log(`[Firecrawl] Scraping URL: ${url}`);
        const response = await axios.post(
            `${FIRECRAWL_API_URL}/v1/scrape`,
            { url, formats: ["markdown", "html"] },
            {
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                timeout: 8000 // 8 seconds timeout
            }
        );

        if (response.data && response.data.success && response.data.data) {
            const doc = response.data.data;
            const content = doc.markdown || doc.content || doc.html || "";
            const title = doc.metadata?.title || doc.title || "Untitled Page";
            const retrievedUrl = doc.metadata?.sourceURL || doc.url || url;

            return {
                title,
                url: retrievedUrl,
                extractedContent: cleanContent(content),
                domain: getDomain(retrievedUrl),
                retrievalTimestamp: new Date().toISOString(),
                relevantSnippets: doc.metadata?.description || content.slice(0, 300)
            };
        }
        throw new Error(response.data?.error || "Firecrawl scrape returned success: false");
    } catch (err) {
        console.warn(`[Firecrawl] Failed to scrape ${url}:`, err.message);
        return null;
    }
};

/**
 * Perform a web search and retrieve pages, utilizing Firecrawl where possible
 */
const searchAndScrape = async (query) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;

    if (!apiKey || apiKey === "YOUR_FIRECRAWL_KEY" || apiKey.trim() === "") {
        console.log("[Web Crawler] Firecrawl API key not configured. Falling back to default search engine...");
        return fallbackSearch(query);
    }

    try {
        console.log(`[Firecrawl] Executing web search for: "${query}"`);
        // Attempt Firecrawl's unified search and scrape endpoint
        const response = await axios.post(
            `${FIRECRAWL_API_URL}/v1/search`,
            { query, limit: 3, scrapeOptions: { formats: ["markdown"] } },
            {
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                timeout: 10000 // 10 seconds timeout
            }
        );

        if (response.data && response.data.success && Array.isArray(response.data.data)) {
            const results = response.data.data.map(item => {
                const content = item.markdown || item.content || item.snippet || "";
                const title = item.title || item.metadata?.title || "Untitled";
                const itemUrl = item.url || item.metadata?.sourceURL || "";

                return {
                    title,
                    url: itemUrl,
                    extractedContent: cleanContent(content),
                    domain: getDomain(itemUrl),
                    retrievalTimestamp: new Date().toISOString(),
                    relevantSnippets: item.snippet || item.metadata?.description || content.slice(0, 300)
                };
            }).filter(res => res.url);

            if (results.length > 0) {
                console.log(`[Firecrawl] Search succeeded. Found ${results.length} results.`);
                return results;
            }
        }
    } catch (err) {
        console.warn("[Firecrawl] /v1/search endpoint failed or unsupported:", err.message);
    }

    // Fallback: search via traditional web search, then scrape the top 2 results in parallel using Firecrawl /v1/scrape
    console.log("[Web Crawler] Executing fallback scraping strategy: Search then Scrape...");
    try {
        const searchResults = await webSearchService.searchTrustedWeb(query);
        if (!searchResults || searchResults.length === 0) {
            return [];
        }

        const topUrls = searchResults.slice(0, 2).map(r => r.url);
        const scrapePromises = topUrls.map(url => scrapeUrlWithFirecrawl(url, apiKey));
        const scrapedPages = await Promise.all(scrapePromises);
        
        const validPages = scrapedPages.filter(Boolean);
        if (validPages.length > 0) {
            console.log(`[Web Crawler] Successfully scraped ${validPages.length} pages using Firecrawl.`);
            return validPages;
        }
    } catch (fallbackErr) {
        console.warn("[Web Crawler] Search-then-scrape fallback failed:", fallbackErr.message);
    }

    return fallbackSearch(query);
};

/**
 * Fallback search utilizing the existing searchTrustedWeb
 */
const fallbackSearch = async (query) => {
    console.log("[Web Crawler] Falling back entirely to trusted search snippets...");
    try {
        const searchResults = await webSearchService.searchTrustedWeb(query);
        return searchResults.map(res => ({
            title: res.title || "Untitled",
            url: res.url || "",
            extractedContent: res.snippet || "",
            domain: getDomain(res.url),
            retrievalTimestamp: new Date().toISOString(),
            relevantSnippets: res.snippet || ""
        }));
    } catch (err) {
        console.error("[Web Crawler] Fallback search failed:", err.message);
        return [];
    }
};

module.exports = {
    searchAndScrape
};
