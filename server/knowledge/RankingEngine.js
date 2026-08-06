const rerankService = require("../ai/services/rerankService");

const SIMILARITY_CONFIDENCE_THRESHOLD = 0.65; // Matches the AI pipeline threshold

/**
 * Reranks retrieval candidates and scores them for keyword overlap.
 */
const rerankCandidates = async (query, chunks) => {
    return rerankService.rerank(query, chunks);
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
