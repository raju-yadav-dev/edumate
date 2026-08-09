/**
 * Reranks retrieval candidate chunks based on keyword matching, metadata boosting, and domain semantics.
 * @param {string} query - The user subquery
 * @param {Array<Object>} chunks - List of retrieved vector chunks
 * @returns {Promise<Array<Object>>} - Reranked chunks with initialScore, rerankScore, and final score
 */
const rerank = async (query, chunks) => {
    if (!chunks || chunks.length === 0) return [];
    
    const lowerQuery = query.toLowerCase();
    const queryWords = lowerQuery
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter(w => w.length > 2);
        
    const isFeeQuery = lowerQuery.includes("fee") || lowerQuery.includes("cost") || lowerQuery.includes("tuition");
    const isFacultyQuery = lowerQuery.includes("faculty") || lowerQuery.includes("faculties") || lowerQuery.includes("teacher") || lowerQuery.includes("professor");
    const isCourseQuery = lowerQuery.includes("course") || lowerQuery.includes("bca") || lowerQuery.includes("overview") || lowerQuery.includes("eligibility");

    const scoredChunks = chunks.map(chunk => {
        const content = (chunk.content || "").toLowerCase();
        const filename = (chunk.metadata?.originalName || chunk.metadata?.filename || "").toLowerCase();
        const category = (chunk.metadata?.category || "").toLowerCase();
        const department = (chunk.metadata?.department || "").toLowerCase();

        const initialScore = Number(chunk.score || 0);
        let keywordMatches = 0;
        
        queryWords.forEach(word => {
            if (content.includes(word)) {
                keywordMatches += 1;
            }
        });

        let domainBoost = 0;

        // 1. Fee Structure Boosting
        if (isFeeQuery) {
            if (filename.includes("fee") || category.includes("fee")) {
                domainBoost += 0.25;
            }
            if (content.includes("fee structure") || content.includes("tuition") || content.includes("per semester") || content.includes("annual fee")) {
                domainBoost += 0.20;
            }
            if (content.includes("bca") && (content.includes("rs") || content.includes("₹") || content.includes("fee") || content.includes("00"))) {
                domainBoost += 0.20;
            }
        }

        // 2. Faculty & Department Boosting (BCA -> Department of Computational Sciences)
        if (isFacultyQuery) {
            if (filename.includes("faculty") || category.includes("faculty") || filename.includes("staff")) {
                domainBoost += 0.30;
            }
            if (department.includes("computational") || department.includes("computer") || 
                content.includes("department of computational sciences") || content.includes("computational sciences") ||
                content.includes("school of computing") || content.includes("computer application")) {
                domainBoost += 0.25;
            }
            if (content.includes("professor") || content.includes("dr.") || content.includes("designation") || content.includes("qualification")) {
                domainBoost += 0.20;
            }
        }

        // 3. Course Boosting
        if (isCourseQuery) {
            if (filename.includes("bca") || category.includes("course") || filename.includes("brochure") || filename.includes("syllabus")) {
                domainBoost += 0.25;
            }
            if (content.includes("bca") || content.includes("bachelor of computer applications")) {
                domainBoost += 0.20;
            }
        }

        const keywordScore = keywordMatches * 0.05;
        const rerankScore = Math.min(1.0, initialScore + keywordScore + domainBoost);
        
        return {
            ...chunk,
            initialScore: parseFloat(initialScore.toFixed(4)),
            rerankScore: parseFloat(rerankScore.toFixed(4)),
            score: parseFloat(rerankScore.toFixed(4))
        };
    });
    
    // Sort descending by final rerank score
    return scoredChunks.sort((a, b) => b.score - a.score);
};

module.exports = {
    rerank
};
