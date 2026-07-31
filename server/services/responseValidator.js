const { INSTITUTIONAL_INTENTS } = require("../constants/intents");

const validateResponse = ({ intent, retrievedContext, generatedAnswer, providerSuccess, questionType }) => {
    const hasTrustedSources = Boolean(retrievedContext?.chunks?.length || retrievedContext?.sources?.length);

    if (questionType === "university_specific" && !hasTrustedSources) {
        return {
            valid: false,
            confidence: "low",
            reason: "No university-specific document context was retrieved for this university query."
        };
    }

    if (!generatedAnswer?.trim() && !providerSuccess) {
        return {
            valid: false,
            confidence: "low",
            reason: "No AI provider response was available."
        };
    }

    const citationRegex = /\[([^\]]+)\]/g;
    let match;
    const citedDocs = new Set();
    while ((match = citationRegex.exec(generatedAnswer)) !== null) {
        const citationContent = match[1];
        let docName = citationContent.split(",")[0].trim().toLowerCase();
        // Strip prefixes like "university source #1: ", "source: ", etc.
        docName = docName.replace(/^(university\s+)?source\s*(#\d+)?\s*[:-]\s*/, "");
        if (!docName.includes("http") && !docName.includes("www") && docName.endsWith(".pdf")) {
            citedDocs.add(docName);
        }
    }

    if (citedDocs.size > 0 && retrievedContext?.chunks) {
        const retrievedDocNames = new Set(
            retrievedContext.chunks.map(chunk => (chunk.metadata?.originalName || "").toLowerCase())
        );

        for (const citedDoc of citedDocs) {
            if (!retrievedDocNames.has(citedDoc)) {
                return {
                    valid: false,
                    confidence: "low",
                    reason: `Hallucination detected: Response cited "${citedDoc}" which was not in the retrieved documents.`
                };
            }
        }
    }

    return {
        valid: true,
        confidence: hasTrustedSources ? "high" : "medium",
        reason: "Response passed validation."
    };
};

module.exports = {
    validateResponse
};
