const { planQuery } = require("../utils/queryPlanner");

/**
 * Reranks retrieval candidate chunks based on the three ranking signals:
 * 1. Semantic similarity from Qdrant.
 * 2. Keyword overlap.
 * 3. Metadata relevance.
 * Plus Section Preference Boosting.
 * 
 * @param {string} query - The user subquery
 * @param {Array<Object>} chunks - List of retrieved vector chunks
 * @param {Object} [queryPlan=null] - Optional precomputed query plan
 * @returns {Promise<Array<Object>>} - Reranked chunks sorted by combined score
 */
const rerank = async (query, chunks, queryPlan = null) => {
    if (!chunks || chunks.length === 0) return [];
    
    const plan = queryPlan || planQuery(query);
    const lowerQuery = String(query).toLowerCase();
    
    // Normalize query terms for keyword matching
    const cleanQuery = lowerQuery.replace(/[^a-z0-9\s]/g, " ").trim();
    const words = cleanQuery.split(/\s+/).filter(w => w.length > 2);
    const stopWords = new Set(["what", "is", "the", "for", "tell", "me", "show", "who", "where", "when", "why", "which", "are", "am", "a", "an", "of", "in", "on", "at", "to", "with", "by", "from", "and", "or", "about"]);
    const queryTerms = words.filter(w => !stopWords.has(w));
        
    const scoredChunks = chunks.map(chunk => {
        const content = (chunk.content || "").toLowerCase();
        const filename = (chunk.metadata?.originalName || chunk.metadata?.filename || "").toLowerCase();
        const heading = (chunk.metadata?.heading || chunk.metadata?.parentSection || "").toLowerCase();
        const category = (chunk.metadata?.category || "").toLowerCase();
        const department = (chunk.metadata?.department || "").toLowerCase();
        const program = (chunk.metadata?.program || chunk.metadata?.course || "").toLowerCase();
        const documentType = (chunk.metadata?.documentType || "").toLowerCase();
        const chunkKeywords = Array.isArray(chunk.metadata?.keywords)
            ? chunk.metadata.keywords.map(k => String(k).toLowerCase())
            : [];
        
        // Signal 1: Semantic Similarity (0..1)
        const initialScore = Number(chunk.score || 0.5);
        const semanticScore = Math.max(0, Math.min(1, initialScore));
        
        // Signal 2: Keyword Overlap (0..1)
        let matchedTerms = 0;
        queryTerms.forEach(term => {
            const matchesContent = content.includes(term) ||
                (term === "hod" && (content.includes("head of department") || heading.includes("head of department"))) ||
                (term === "head" && (content.includes("hod") || heading.includes("hod"))) ||
                (term === "department" && (content.includes("hod") || heading.includes("hod") || filename.includes("department")));
            if (
                matchesContent ||
                heading.includes(term) ||
                filename.includes(term) ||
                chunkKeywords.some(k => k.includes(term))
            ) {
                matchedTerms++;
            }
        });
        const termRatio = queryTerms.length > 0 ? (matchedTerms / queryTerms.length) : 0.5;
        let phraseBonus = 0;
        if (queryTerms.length >= 2 && content.includes(queryTerms.join(" "))) {
            phraseBonus = 0.20;
        }
        const keywordScore = Math.max(0, Math.min(1, (termRatio * 0.80) + phraseBonus));
        
        // Signal 3: Metadata Relevance (0..1)
        let metaMatches = 0;
        let metaTotal = 0;
        if (plan.category) {
            metaTotal += 0.25;
            const targetCat = plan.category.toLowerCase();
            if (category === targetCat || category.includes(targetCat) || targetCat.includes(category) || category === "general") {
                metaMatches += 0.25;
            }
        }
        if (plan.department) {
            metaTotal += 0.30;
            const targetDept = plan.department.toLowerCase();
            const deptsArray = Array.isArray(chunk.metadata?.departments) ? chunk.metadata.departments.map(d => String(d).toLowerCase()) : [];
            const isCssMatch = (targetDept.includes("computational") || targetDept === "css") &&
                (department.includes("computational") || department === "css" || deptsArray.includes("css") || filename.includes("computational"));
            if (department === targetDept || department.includes(targetDept) || targetDept.includes(department) || deptsArray.includes(targetDept) || isCssMatch) {
                metaMatches += 0.30;
            }
        }
        if (plan.program) {
            metaTotal += 0.25;
            const targetProg = plan.program.toLowerCase();
            if (program === targetProg || program.includes(targetProg) || (chunk.metadata?.programs && chunk.metadata.programs.includes(plan.program))) {
                metaMatches += 0.25;
            }
        }
        if (plan.documentType) {
            metaTotal += 0.20;
            if (documentType === plan.documentType.toLowerCase()) metaMatches += 0.20;
        }
        if (plan.heading) {
            metaTotal += 0.25;
            const targetHeading = plan.heading.toLowerCase();
            const isHodMatch = (targetHeading === "hod" || targetHeading.includes("head")) &&
                (content.includes("hod") || content.includes("head of department") || heading.includes("hod"));
            if (heading.includes(targetHeading) || targetHeading.includes(heading) || isHodMatch) {
                metaMatches += 0.25;
            }
        }
        const metadataScore = metaTotal > 0 ? Math.max(0, Math.min(1, metaMatches / metaTotal)) : 0.5;
        
        // Combined Base Score (45% semantic + 25% keyword + 25% metadata)
        const baseScore = (0.45 * semanticScore) + (0.25 * keywordScore) + (0.25 * metadataScore);
        
        return {
            ...chunk,
            initialScore: parseFloat(initialScore.toFixed(4)),
            baseScore: parseFloat(baseScore.toFixed(4)),
            score: parseFloat(baseScore.toFixed(4)),
            rerankScore: parseFloat(baseScore.toFixed(4)),
            rankingSignals: {
                semanticScore: parseFloat(semanticScore.toFixed(4)),
                keywordScore: parseFloat(keywordScore.toFixed(4)),
                metadataScore: parseFloat(metadataScore.toFixed(4)),
                sectionBoost: 0
            }
        };
    });
    
    // Sort by base score before applying section preference
    scoredChunks.sort((a, b) => b.baseScore - a.baseScore);
    
    // Apply Section Preference (Anchor coherence bonus)
    const anchor = scoredChunks[0];
    const anchorDoc = String(anchor.metadata?.documentId || anchor.metadata?.sourceDocumentId || "");
    const anchorSection = String(anchor.metadata?.parentSection || anchor.metadata?.heading || anchor.metadata?.sectionPath || "").trim().toLowerCase();
    
    scoredChunks.forEach((cand, idx) => {
        let sectionBoost = 0;
        const candDoc = String(cand.metadata?.documentId || cand.metadata?.sourceDocumentId || "");
        const candSection = String(cand.metadata?.parentSection || cand.metadata?.heading || cand.metadata?.sectionPath || "").trim().toLowerCase();
        
        if (idx > 0 && anchorDoc && candDoc === anchorDoc) {
            if (anchorSection && candSection && (candSection === anchorSection || candSection.includes(anchorSection) || anchorSection.includes(candSection))) {
                sectionBoost = 0.12;
            } else {
                sectionBoost = 0.05;
            }
        }
        
        cand.rankingSignals.sectionBoost = sectionBoost;
        const finalScore = parseFloat((cand.baseScore + sectionBoost).toFixed(4));
        cand.score = finalScore;
        cand.rerankScore = finalScore;
        cand.combinedScore = finalScore;
    });
    
    return scoredChunks.sort((a, b) => b.score - a.score);
};

module.exports = {
    rerank
};
