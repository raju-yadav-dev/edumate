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
        const docGroups = {};
        retrievedChunks.forEach((chunk) => {
            const metadata = chunk.metadata || {};
            // Use documentId or originalName to uniquely identify the document
            const docKey = metadata.documentId || metadata.originalName || "University Document";
            
            if (!docGroups[docKey]) {
                docGroups[docKey] = {
                    title: metadata.originalName || "University Document",
                    pages: new Set(),
                    category: metadata.category || "",
                    maxScore: 0,
                    metadata: {
                        documentId: metadata.documentId || "",
                        category: metadata.category || "",
                        department: metadata.department || "",
                        institution: metadata.institution || "",
                        similarity: 0
                    }
                };
            }
            
            if (metadata.pageNumber !== undefined && metadata.pageNumber !== null) {
                docGroups[docKey].pages.add(Number(metadata.pageNumber));
            } else {
                docGroups[docKey].pages.add(1);
            }
            
            const score = chunk.score !== undefined ? Math.max(0, Math.min(100, Math.round(chunk.score * 100))) : 100;
            if (score > docGroups[docKey].maxScore) {
                docGroups[docKey].maxScore = score;
            }
        });
        
        // Add grouped document citations
        Object.values(docGroups).forEach(group => {
            const sortedPages = Array.from(group.pages).sort((a, b) => a - b);
            const pageRef = sortedPages.length > 1 
                ? `Pages ${sortedPages.join(", ")}` 
                : `Page ${sortedPages[0] || 1}`;
                
            group.metadata.similarity = group.maxScore;
            
            citations.push({
                type: "document",
                title: group.title,
                page: sortedPages.join(", "),
                section: group.category ? String(group.category).replace(/_/g, " ") : "General",
                similarity: group.maxScore,
                reference: pageRef,
                metadata: group.metadata
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

    // Deduplicate any non-document citations by type, title and reference
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
