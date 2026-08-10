const retrievalService = require("../ai/services/retrievalService");
const webSearchService = require("../ai/services/webSearchService");
const KnowledgeSource = require("../models/KnowledgeSource");

const Document = require("../models/Document");

/**
 * Retrieves chunks from Qdrant and enriches them with MongoDB Document metadata.
 */
const retrieveAndEnrichChunks = async (query, user, limit, ignoreInstitution = false) => {
    // Retrieve a larger candidate pool to ensure enough results after filtering
    const candidates = await retrievalService.retrieve({
        question: query,
        user,
        limit: Math.max(limit * 3, 50),
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

        // Map and preserve all required metadata fields
        const chunkId = chunk.id || "";
        const originalName = doc.originalName || chunk.metadata?.originalName || chunk.metadata?.filename || "Unknown";
        const documentId = chunk.metadata?.documentId || doc._id.toString();
        const pageNumber = chunk.metadata?.pageNumber || chunk.metadata?.page || 1;
        const university = doc.institution || chunk.metadata?.institution || chunk.metadata?.university || "";
        const department = doc.department || chunk.metadata?.department || "";
        const course = chunk.metadata?.course || doc.metadata?.course || "";
        const sourceType = chunk.metadata?.sourceType || (doc.metadata?.uploadedFrom === "crawler" ? "url" : "document");

        return {
            ...chunk,
            id: chunkId,
            metadata: {
                ...chunk.metadata,
                documentId,
                filename: originalName,
                originalName,
                chunkId,
                pageNumber,
                page: pageNumber,
                university,
                institution: university,
                department,
                course,
                sourceType,
                uploadedFrom: doc.metadata?.uploadedFrom || "api",
                sourceUrl: doc.metadata?.sourceUrl || ""
            }
        };
    }).filter(Boolean);

    return enriched;
};

/**
 * Helper to fetch adjacent chunks (previous and next) from MongoDB to expand context.
 */
const expandChunkContext = async (chunk) => {
    try {
        const Chunk = require("../models/Chunk");
        const docId = chunk.metadata?.documentId;
        if (!docId) return chunk;

        // Fetch all chunks for this document sorted by ID (insertion order)
        const allDocChunks = await Chunk.find({ document: docId }).sort({ _id: 1 }).lean();
        if (allDocChunks.length <= 1) return chunk;

        // Find index of current chunk content
        const curIndex = allDocChunks.findIndex(c => 
            c.content.trim() === chunk.content.trim()
        );
        if (curIndex === -1) return chunk;

        let expandedContent = "";
        let pageNumbers = new Set();
        pageNumbers.add(chunk.metadata?.pageNumber || 1);

        if (curIndex > 0) {
            const prev = allDocChunks[curIndex - 1];
            expandedContent += prev.content + "\n";
            if (prev.metadata?.pageNumber) pageNumbers.add(prev.metadata.pageNumber);
        }

        expandedContent += chunk.content;

        if (curIndex < allDocChunks.length - 1) {
            const next = allDocChunks[curIndex + 1];
            expandedContent += "\n" + next.content;
            if (next.metadata?.pageNumber) pageNumbers.add(next.metadata.pageNumber);
        }

        return {
            ...chunk,
            content: expandedContent,
            metadata: {
                ...chunk.metadata,
                pageNumbers: Array.from(pageNumbers).sort((a, b) => a - b),
                isExpanded: true
            }
        };
    } catch (err) {
        console.error("[SearchManager] Failed to expand adjacent chunk context:", err.message);
        return chunk;
    }
};

/**
 * Searches only uploaded local documents in the vector database
 */
const searchLocalPdfs = async (query, user, limit, ignoreInstitution = false) => {
    const enriched = await retrieveAndEnrichChunks(query, user, limit, ignoreInstitution);
    
    // Filter to only include local admin-uploaded documents (uploadedFrom is not "crawler")
    const filtered = enriched.filter(chunk => chunk.metadata?.uploadedFrom !== "crawler");
    const sliced = filtered.slice(0, limit);

    // Expand adjacent context for the selected results
    const expanded = [];
    for (const chunk of sliced) {
        const exp = await expandChunkContext(chunk);
        expanded.push(exp);
    }

    return expanded;
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
