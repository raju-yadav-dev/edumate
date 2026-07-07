const searchKnowledgeBase = async ({ question, institution, intent }) => {
    return {
        found: false,
        chunks: [],
        sources: [],
        confidence: 0,
        metadata: {
            question,
            institution: institution || "",
            intent,
            retrievalProvider: "not_configured"
        }
    };
};

module.exports = {
    searchKnowledgeBase
};
