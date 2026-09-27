const embeddingService = require("./embeddingService");
const vectorService = require("./vectorService");

/**
 * Searches the database for relevant document chunks matching the user question.
 * @param {Object} params
 * @param {string} params.question - User's query
 * @param {string} [params.institution] - Institution filter
 * @param {string} [params.category] - Category filter
 * @param {string} [params.department] - Department filter
 * @param {string} [params.intent] - Classified intent (optional)
 * @returns {Promise<Object>} - RAG Search results with chunks and formatted sources
 */
const searchKnowledgeBase = async ({ question, institution, category, department, intent }) => {
    try {
        // 1. Generate embedding for user query
        const queryEmbedding = await embeddingService.generateEmbedding(question);

        // 2. Build filters
        const filter = {};
        if (institution) filter.institution = institution;
        if (category) filter.category = category;
        if (department) filter.department = department;

        // 3. Similarity search (retrieve top 4 matching chunks)
        const matchedChunks = await vectorService.similaritySearch({
            queryEmbedding,
            limit: 4,
            filter
        });

        // 4. Determine confidence and structure sources
        // Cosine similarity threshold: only count matches with score >= 0.50
        const minSimilarityScore = 0.50;
        const validChunks = matchedChunks.filter((chunk) => chunk.score >= minSimilarityScore);

        const sources = validChunks.map((chunk) => ({
            type: "document",
            title: chunk.metadata.originalName || "University Document",
            reference: `Page ${chunk.metadata.pageNumber || 1}`,
            metadata: {
                category: chunk.metadata.category || "",
                department: chunk.metadata.department || "",
                institution: chunk.metadata.institution || "",
                similarity: Math.round(chunk.score * 100)
            }
        }));

        // Remove duplicate source citations (e.g. same document and page number)
        const uniqueSources = [];
        const seenSources = new Set();

        for (const src of sources) {
            const key = `${src.title}-${src.reference}`;
            if (!seenSources.has(key)) {
                seenSources.add(key);
                uniqueSources.push(src);
            }
        }

        const highestScore = matchedChunks[0] ? matchedChunks[0].score : 0;
        let confidence = "low";
        if (highestScore >= 0.75) {
            confidence = "high";
        } else if (highestScore >= 0.60) {
            confidence = "medium";
        }

        return {
            found: validChunks.length > 0,
            chunks: validChunks,
            sources: uniqueSources,
            confidence,
            metadata: {
                question,
                institution: institution || "",
                intent: intent || "unknown",
                retrievalProvider: "mongodb-cosine",
                highestScore
            }
        };
    } catch (error) {
        console.error("Error searching knowledge base:", error);
        return {
            found: false,
            chunks: [],
            sources: [],
            confidence: "low",
            metadata: {
                question,
                institution: institution || "",
                intent: intent || "unknown",
                retrievalProvider: "mongodb-cosine-failed",
                error: error.message
            }
        };
    }
};

module.exports = {
    searchKnowledgeBase
};
