const SourcePriorityEngine = require("./SourcePriorityEngine");
const SearchManager = require("./SearchManager");
const RankingEngine = require("./RankingEngine");
const CitationManager = require("./CitationManager");

/**
 * Executes a prioritized search across knowledge sources
 * @param {Object} params
 * @param {string} params.question - User's query
 * @param {Object} params.user - Active user profile context
 * @returns {Promise<Object>} - Formatted search results with chunks, web results, and citations
 */
const search = async ({ question, user }) => {
    console.log(`[KnowledgeManager] Processing prioritized search for query: "${question}"`);

    // 1. Fetch enabled knowledge sources sorted by priority
    const sourcesConfig = await SourcePriorityEngine.getSources();
    const enabledSources = sourcesConfig.filter(s => s.isEnabled);

    let pdfChunks = [];
    let websiteChunks = [];
    let webResults = [];
    let matchedSourceType = "none";
    let isFound = false;

    // 2. Sequential fallback execution
    for (const source of enabledSources) {
        if (source.type === "pdf") {
            console.log("[KnowledgeManager] Tier 1: Querying local uploaded PDFs...");
            const rawPdfs = await SearchManager.searchLocalPdfs(question, user, 8);
            const rankedPdfs = await RankingEngine.rerankCandidates(question, rawPdfs);
            
            if (RankingEngine.isConfident(rankedPdfs)) {
                console.log("[KnowledgeManager] High-confidence matches found in PDFs. Ending search loop.");
                pdfChunks = rankedPdfs.slice(0, 4);
                matchedSourceType = "pdf";
                isFound = true;
                break;
            } else if (rankedPdfs.length > 0) {
                // Save them as backup in case next tiers yield no confidence
                pdfChunks = rankedPdfs.slice(0, 4);
            }
        }

        if (source.type === "url") {
            console.log("[KnowledgeManager] Tier 2: Querying approved and crawled websites...");
            const rawWebsites = await SearchManager.searchApprovedUrls(question, user, 8);
            const rankedWebsites = await RankingEngine.rerankCandidates(question, rawWebsites);

            if (RankingEngine.isConfident(rankedWebsites)) {
                console.log("[KnowledgeManager] High-confidence matches found in Web URLs. Ending search loop.");
                websiteChunks = rankedWebsites.slice(0, 4);
                matchedSourceType = "url";
                isFound = true;
                break;
            } else if (rankedWebsites.length > 0 && websiteChunks.length === 0) {
                websiteChunks = rankedWebsites.slice(0, 4);
            }
        }

        if (source.type === "internet") {
            // Only trigger internet search if PDFs and crawled URLs did not confidently answer
            if (!isFound) {
                console.log("[KnowledgeManager] Tier 3: Falling back to general internet search...");
                const results = await SearchManager.searchInternet(question);
                if (results.length > 0) {
                    webResults = results;
                    matchedSourceType = "internet";
                    isFound = true;
                }
            }
        }
    }

    // 3. If nothing was confidently found, combine whatever partial local results we got
    const finalPdfChunks = pdfChunks;
    const finalWebsiteChunks = websiteChunks;

    // Determine highest similarity score for confidence labeling
    const allChunks = [...finalPdfChunks, ...finalWebsiteChunks];
    const highestScore = allChunks.length > 0 ? Math.max(...allChunks.map(c => c.score)) : 0;
    
    let confidence = "low";
    if (highestScore >= 0.75) {
        confidence = "high";
    } else if (highestScore >= 0.60) {
        confidence = "medium";
    } else if (webResults.length > 0) {
        confidence = "medium"; // Web search results are moderately confident
    }

    // 4. Structure citations via CitationManager
    const sources = CitationManager.formatSources(finalPdfChunks, finalWebsiteChunks, webResults);

    return {
        found: isFound || allChunks.length > 0 || webResults.length > 0,
        chunks: allChunks,
        webResults,
        sources,
        confidence,
        metadata: {
            question,
            matchedSourceType,
            highestScore,
            retrievalProvider: `knowledge-manager-${matchedSourceType}`
        }
    };
};

module.exports = {
    search
};
