const retrievalService = require("../ai/services/retrievalService");
const webSearchService = require("../ai/services/webSearchService");
const KnowledgeSource = require("../models/KnowledgeSource");

/**
 * Searches only uploaded PDFs in the vector database
 */
const searchLocalPdfs = async (query, user, limit) => {
    // 1. Fetch chunks from Qdrant via retrievalService
    const chunks = await retrievalService.retrieve({ question: query, user, limit });
    
    // 2. Filter in-memory to only include standard uploaded PDFs (non-webpages)
    return chunks.filter((chunk) => {
        const name = chunk.metadata?.originalName || "";
        return !name.startsWith("[Webpage]") && name.toLowerCase().endsWith(".pdf");
    });
};

/**
 * Searches only crawled pages that belong to approved and enabled website URLs
 */
const searchApprovedUrls = async (query, user, limit) => {
    // 1. Fetch all enabled website URLs configured in DB
    const approvedUrls = await KnowledgeSource.find({ type: "url", isEnabled: true });
    if (approvedUrls.length === 0) return [];

    // 2. Fetch chunks from Qdrant
    const chunks = await retrievalService.retrieve({ question: query, user, limit });

    // 3. Filter chunks in-memory to match crawled page metadata and configured URLs
    return chunks.filter((chunk) => {
        const name = chunk.metadata?.originalName || "";
        const sourceUrl = chunk.metadata?.sourceUrl || "";
        const isCrawled = name.startsWith("[Webpage]") || sourceUrl !== "";

        if (!isCrawled) return false;

        // Check if the crawled source matches any of the active approved URLs
        return approvedUrls.some((approved) => {
            const cleanApproved = String(approved.url || "").trim().toLowerCase();
            const cleanSource = String(sourceUrl || "").trim().toLowerCase();
            return cleanSource.includes(cleanApproved) || cleanApproved.includes(cleanSource);
        });
    });
};

/**
 * Searches the general internet using trusted fallbacks
 */
const searchInternet = async (query) => {
    // Check if general internet search is globally enabled
    const internetConfig = await KnowledgeSource.findOne({ type: "internet" });
    if (internetConfig && !internetConfig.isEnabled) {
        console.log("[SearchManager] Internet search is disabled. Skipping general web search.");
        return [];
    }

    return webSearchService.searchTrustedWeb(query);
};

module.exports = {
    searchLocalPdfs,
    searchApprovedUrls,
    searchInternet
};
