/**
 * Reranks vector retrieval candidate chunks based on relevance models.
 * Currently serves as an enterprise architectural pass-through extension point.
 * @param {string} query - The user query
 * @param {Array<Object>} chunks - List of retrieved vector chunks
 * @returns {Promise<Array<Object>>} - Reranked chunks
 */
const rerank = async (query, chunks) => {
    if (!chunks || chunks.length === 0) return [];
    
    // Normalize and extract query words (length > 2 to avoid stop words)
    const queryWords = query.toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter(w => w.length > 2);
        
    const scoredChunks = chunks.map(chunk => {
        const content = (chunk.content || "").toLowerCase();
        let keywordMatches = 0;
        
        queryWords.forEach(word => {
            if (content.includes(word)) {
                keywordMatches += 1;
            }
        });
        
        // Add weight for keyword matches to the vector score
        const finalScore = chunk.score + (keywordMatches * 0.04);
        
        return {
            ...chunk,
            score: finalScore
        };
    });
    
    // Sort descending by final score
    return scoredChunks.sort((a, b) => b.score - a.score);
};

module.exports = {
    rerank
};
