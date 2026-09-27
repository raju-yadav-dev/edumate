const citationService = require("../ai/services/citationService");

/**
 * Formats vector chunks and search engine results into unified citations
 */
const formatSources = (pdfChunks = [], websiteChunks = [], webResults = []) => {
    // Both PDF and crawled website chunks are documents from the vector DB
    const allDocChunks = [...pdfChunks, ...websiteChunks];
    
    // Delegate to the unified citation system for formatting and deduplication
    return citationService.formatCitations(allDocChunks, [], webResults);
};

module.exports = {
    formatSources
};
