const retrievalService = require("../ai/services/retrievalService");
const webSearchService = require("../ai/services/webSearchService");
const KnowledgeSource = require("../models/KnowledgeSource");

const Document = require("../models/Document");

/**
 * Retrieves chunks from Qdrant and enriches them with MongoDB Document metadata.
 */
const retrieveAndEnrichChunks = async (query, user, limit, ignoreInstitution = true) => {
    // Retrieve a larger candidate pool to ensure enough results after filtering
    const candidates = await retrievalService.retrieve({
        question: query,
        user,
        limit: Math.max(limit * 3, 30),
        ignoreInstitution
    });
    if (candidates.length === 0) return [];

    const docIds = candidates.map(c => c.metadata?.documentId).filter(Boolean);
    const docs = await Document.find({ _id: { $in: docIds }, status: "active" }).lean();
    
    const docMap = {};
    docs.forEach(doc => {
        docMap[doc._id.toString()] = doc;
    });

    const enriched = candidates.map(chunk => {
        const doc = docMap[chunk.metadata?.documentId?.toString()];
        if (!doc) return null; // Discard chunks belonging to missing/deleted documents

        return {
            ...chunk,
            metadata: {
                ...chunk.metadata,
                uploadedFrom: doc.metadata?.uploadedFrom || "api",
                sourceUrl: doc.metadata?.sourceUrl || "",
                originalName: doc.originalName || chunk.metadata?.originalName || ""
            }
        };
    }).filter(Boolean);

    return enriched;
};

/**
 * Searches only uploaded local documents in the vector database
 */
const searchLocalPdfs = async (query, user, limit, ignoreInstitution = true) => {
    const enriched = await retrieveAndEnrichChunks(query, user, limit, ignoreInstitution);
    
    // Filter to only include local admin-uploaded documents (uploadedFrom is not "crawler")
    const filtered = enriched.filter(chunk => chunk.metadata?.uploadedFrom !== "crawler");
    return filtered.slice(0, limit);
};

/**
 * Searches only crawled pages that belong to approved and enabled website URLs
 */
const searchApprovedUrls = async (query, user, limit, ignoreInstitution = true) => {
    // 1. Fetch all enabled website URLs configured in DB
    const approvedUrls = await KnowledgeSource.find({ type: "url", isEnabled: true });
    if (approvedUrls.length === 0) return [];

    const enriched = await retrieveAndEnrichChunks(query, user, limit, ignoreInstitution);

    // Filter to only include crawled website content (uploadedFrom is "crawler") matching approved URLs
    const filtered = enriched.filter(chunk => {
        if (chunk.metadata?.uploadedFrom !== "crawler") return false;
        const sourceUrl = chunk.metadata?.sourceUrl || "";
        if (!sourceUrl) return false;

        return approvedUrls.some((approved) => {
            const cleanApproved = String(approved.url || "").trim().toLowerCase();
            const cleanSource = String(sourceUrl || "").trim().toLowerCase();
            return cleanSource.includes(cleanApproved) || cleanApproved.includes(cleanSource);
        });
    });

    return filtered.slice(0, limit);
};

/**
 * Searches the general internet using trusted fallbacks
 */
const searchInternet = async (query, force = false) => {
    if (!force) {
        // Check if general internet search is globally enabled
        const internetConfig = await KnowledgeSource.findOne({ type: "internet" });
        if (internetConfig && !internetConfig.isEnabled) {
            console.log("[SearchManager] Internet search is disabled. Skipping general web search.");
            return [];
        }
    }

    return webSearchService.searchTrustedWeb(query);
};

module.exports = {
    searchLocalPdfs,
    searchApprovedUrls,
    searchInternet
};
