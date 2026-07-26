/**
 * Formats vector search candidate chunks into clean, deduplicated citation source objects
 * @param {Array<Object>} retrievedChunks
 * @returns {Array<Object>} - Formatted citation array
 */
const formatCitations = (retrievedChunks) => {
    if (!retrievedChunks || retrievedChunks.length === 0) {
        return [];
    }

    const citations = retrievedChunks.map((chunk) => {
        const metadata = chunk.metadata || {};
        return {
            type: "document",
            title: metadata.originalName || "University Document",
            reference: `Page ${metadata.pageNumber || 1}`,
            metadata: {
                category: metadata.category || "",
                department: metadata.department || "",
                institution: metadata.institution || "",
                similarity: chunk.score !== undefined ? Math.max(0, Math.min(100, Math.round(chunk.score * 100))) : 100
            }
        };
    });

    // Deduplicate citations by comparing document title and page reference
    const unique = [];
    const seen = new Set();

    for (const cite of citations) {
        const key = `${cite.title}-${cite.reference}`;
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
