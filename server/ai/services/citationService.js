/**
 * Formats vector search chunks, university website results, and general web results into clean, deduplicated citation source objects
 * @param {Array<Object>} retrievedChunks
 * @param {Array<Object>} universitySiteResults
 * @param {Array<Object>} webResults
 * @returns {Array<Object>} - Formatted citation array
 */
const formatCitations = (retrievedChunks = [], universitySiteResults = [], webResults = []) => {
    const citations = [];

    if (retrievedChunks && retrievedChunks.length > 0) {
        retrievedChunks.forEach((chunk) => {
            const metadata = chunk.metadata || {};
            citations.push({
                type: "document",
                title: metadata.originalName || "University Document",
                page: String(metadata.pageNumber || 1),
                section: metadata.category ? String(metadata.category).replace(/_/g, " ") : "General",
                similarity: chunk.score !== undefined ? Math.max(0, Math.min(100, Math.round(chunk.score * 100))) : 100,
                reference: `Page ${metadata.pageNumber || 1}`,
                metadata: {
                    documentId: metadata.documentId || "",
                    category: metadata.category || "",
                    department: metadata.department || "",
                    institution: metadata.institution || "",
                    similarity: chunk.score !== undefined ? Math.max(0, Math.min(100, Math.round(chunk.score * 100))) : 100
                }
            });
        });
    }

    if (universitySiteResults && universitySiteResults.length > 0) {
        universitySiteResults.forEach((result) => {
            let domain = "University Website";
            try {
                if (result.url) {
                    domain = new URL(result.url).hostname;
                }
            } catch {
                // Ignore parsing errors
            }

            citations.push({
                type: "university_website",
                title: result.title || "University Page",
                reference: result.url || "",
                metadata: {
                    snippet: result.snippet || "",
                    domain
                }
            });
        });
    }

    if (webResults && webResults.length > 0) {
        webResults.forEach((result) => {
            let domain = "Web";
            try {
                if (result.url) {
                    domain = new URL(result.url).hostname;
                }
            } catch {
                // Ignore parsing errors
            }

            citations.push({
                type: "web",
                title: result.title || "Web Resource",
                reference: result.url || "",
                metadata: {
                    snippet: result.snippet || "",
                    domain
                }
            });
        });
    }

    // Deduplicate citations
    const unique = [];
    const seen = new Set();

    for (const cite of citations) {
        const key = `${cite.type}-${cite.title}-${cite.reference}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(cite);
        }
    }

    return unique;
};

module.exports = {
    formatCitations
};
