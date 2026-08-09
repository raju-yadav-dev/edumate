const rerankService = require("../ai/services/rerankService");

const SIMILARITY_CONFIDENCE_THRESHOLD = 0.65; // Matches the AI pipeline threshold

/**
 * Reranks retrieval candidates and scores them for keyword overlap.
 */
const rerankCandidates = async (query, chunks, user = null) => {
    const ranked = await rerankService.rerank(query, chunks);
    
    if (user && user.institution) {
        const userInst = String(user.institution).toLowerCase().trim();
        ranked.forEach(chunk => {
            const chunkInst = String(chunk.metadata?.institution || "").toLowerCase().trim();
            if (chunkInst === userInst || chunkInst === "all" || chunkInst === "general" || chunkInst === "") {
                chunk.score += 0.15; // Boost score for user's own institution
            }
        });
        // Sort again since scores changed
        ranked.sort((a, b) => b.score - a.score);
    }
    
    return ranked;
};

/**
 * Checks if a list of ranked chunks contains high-confidence answers.
 */
const isConfident = (rankedChunks) => {
    if (!Array.isArray(rankedChunks) || rankedChunks.length === 0) {
        return false;
    }
    
    // Find the highest score among candidates
    const maxScore = Math.max(...rankedChunks.map(c => c.score));
    
    // If the top score exceeds the similarity threshold, it is confident
    return maxScore >= SIMILARITY_CONFIDENCE_THRESHOLD;
};

module.exports = {
    rerankCandidates,
    isConfident,
    SIMILARITY_CONFIDENCE_THRESHOLD
};
