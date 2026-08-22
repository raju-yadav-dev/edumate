/**
 * Reranks retrieval candidate chunks based on keyword matching, metadata boosting, and domain semantics.
 * @param {string} query - The user subquery
 * @param {Array<Object>} chunks - List of retrieved vector chunks
 * @returns {Promise<Array<Object>>} - Reranked chunks with initialScore, rerankScore, and final score
 */
const rerank = async (query, chunks) => {
    if (!chunks || chunks.length === 0) return [];
    
    const lowerQuery = String(query).toLowerCase();
    
    // Normalize query terms for keyword matching
    const queryWords = lowerQuery
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 2);
        
    const scoredChunks = chunks.map(chunk => {
        const content = (chunk.content || "").toLowerCase();
        const filename = (chunk.metadata?.originalName || chunk.metadata?.filename || "").toLowerCase();
        const category = (chunk.metadata?.category || "").toLowerCase();
        const department = (chunk.metadata?.department || "").toLowerCase();
        const documentType = (chunk.metadata?.documentType || "").toLowerCase();
        const building = (chunk.metadata?.buildingName || chunk.metadata?.buildingNumber || "").toLowerCase();
        const office = (chunk.metadata?.office || "").toLowerCase();
        const room = (chunk.metadata?.roomNumber || "").toLowerCase();
        
        const initialScore = Number(chunk.score || 0);
        let boost = 0;
        
        // 1. Keyword overlap (percentage of query words found in content/filename, max 0.25)
        let matchedWords = 0;
        queryWords.forEach(word => {
            if (content.includes(word) || filename.includes(word)) {
                matchedWords++;
            }
        });
        const keywordScore = queryWords.length > 0 ? (matchedWords / queryWords.length) * 0.25 : 0;
        
        // 2. Title & Heading match (max 0.20)
        let hasTitleMatch = false;
        queryWords.forEach(word => {
            if (filename.includes(word)) {
                hasTitleMatch = true;
            }
        });
        if (hasTitleMatch) boost += 0.10;
        
        const hasHeading = content.includes("###") || content.includes("##") || content.includes("#") || 
                            /\n[A-Z\s]{4,30}\n/.test(chunk.content);
        if (hasHeading) boost += 0.10;
        
        // 3. Metadata Match / Boosting instead of filtering (up to 0.35)
        let matchesMetadata = false;
        queryWords.forEach(word => {
            if (
                category.includes(word) || 
                department.includes(word) || 
                documentType.includes(word) || 
                building.includes(word) || 
                office.includes(word) || 
                room.includes(word)
            ) {
                matchesMetadata = true;
            }
        });
        if (matchesMetadata) boost += 0.25;
        
        // Targeted content matches
        if (/\broom\s+[a-zA-Z\d-]+\b/i.test(content) || /\b(?:rm|office|lab)\s+\d+\b/i.test(content)) {
            boost += 0.10;
        }
        if (/\b(dr\.|prof\.|professor|hod|head of department)\b/i.test(content) || 
            /designation|qualification/i.test(content) || 
            /jayanta|aich/i.test(content)) {
            boost += 0.10;
        }
        const hasTable = content.includes("|") || 
                         content.includes("----") || 
                         /\d+\s{2,}\d+/.test(content) || 
                         (content.match(/\d+/g) || []).length > 10;
        if (hasTable) {
            boost += 0.10;
        }
        
        // 4. Adjacent Chunk Bonus (0.15)
        if (chunk.metadata?.chunkIndex !== undefined || chunk.metadata?.pageNumber !== undefined) {
            boost += 0.15;
        }
        
        const finalScore = initialScore + keywordScore + boost;
        
        return {
            ...chunk,
            initialScore: parseFloat(initialScore.toFixed(4)),
            rerankScore: parseFloat(finalScore.toFixed(4)),
            score: parseFloat(finalScore.toFixed(4))
        };
    });
    
    return scoredChunks.sort((a, b) => b.score - a.score);
};

module.exports = {
    rerank
};
