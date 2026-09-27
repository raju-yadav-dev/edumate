const confidenceGuard = require("../ai/services/confidenceGuard");

/**
 * EduMate Mission 12.2 — Response Validator & Citation Guard
 * 
 * Responsibilities:
 * - Validate grounding against retrieved university chunks
 * - Prevent hallucinations on missing or out-of-domain context
 * - Verify citations (document title, page number, department)
 * - Multi-factor confidence evaluation (HIGH / MEDIUM / LOW)
 * - Clean duplicate statements and format structured responses
 */

const validateResponse = ({
    question = "",
    intent = "general",
    retrievedContext = null,
    generatedAnswer = "",
    providerSuccess = true,
    questionType = "university_specific",
    sources = []
}) => {
    const chunks = retrievedContext?.chunks || [];
    const hasTrustedSources = Boolean(chunks.length > 0 || sources.length > 0);

    const qTypeLower = String(questionType || "").toLowerCase();
    if (qTypeLower === "general_knowledge" || qTypeLower === "conversational" || qTypeLower === "general") {
        return {
            valid: true,
            confidence: "HIGH",
            score: 0.95,
            groundedAnswer: generatedAnswer,
            reason: "General knowledge or conversational query answered directly by local model."
        };
    }

    // 1. Un-grounded Institutional Query Check
    if (qTypeLower === "university_specific" && !hasTrustedSources) {
        return {
            valid: false,
            confidence: "LOW",
            score: 0.1,
            groundedAnswer: "I couldn't find matching information in the university knowledge base.",
            reason: "No university-specific document context was retrieved."
        };
    }

    if (!generatedAnswer?.trim() && !providerSuccess) {
        return {
            valid: false,
            confidence: "LOW",
            score: 0.1,
            groundedAnswer: "I couldn't find matching information in the university knowledge base.",
            reason: "No AI provider response was available."
        };
    }

    // 2. Citation Integrity & Hallucination Check
    const citationRegex = /\[([^\]]+)\]/g;
    let match;
    const citedDocs = new Set();
    while ((match = citationRegex.exec(generatedAnswer)) !== null) {
        const citationContent = match[1];
        let docName = citationContent.split(",")[0].trim().toLowerCase();
        docName = docName.replace(/^(university\s+)?source\s*(#\d+)?\s*[:-]\s*/, "");
        if (!docName.includes("http") && !docName.includes("www") && docName.endsWith(".pdf")) {
            citedDocs.add(docName);
        }
    }

    if (citedDocs.size > 0 && chunks.length > 0) {
        const retrievedDocNames = new Set(
            chunks.map(chunk => (chunk.metadata?.originalName || chunk.metadata?.filename || "").toLowerCase())
        );

        for (const citedDoc of citedDocs) {
            // Fuzzy match cited document
            const isMatch = Array.from(retrievedDocNames).some(rName => rName.includes(citedDoc) || citedDoc.includes(rName));
            if (!isMatch) {
                return {
                    valid: false,
                    confidence: "LOW",
                    score: 0.2,
                    reason: `Hallucination detected: Response cited "${citedDoc}" which was not in the retrieved documents.`
                };
            }
        }
    }

    // 3. Multi-Factor Confidence Scoring
    const confidenceReport = confidenceGuard.calculateConfidence({
        question,
        retrievedChunks: chunks,
        sources,
        generatedAnswer
    });

    // 4. Duplicate Fact Removal
    const deduplicatedAnswer = confidenceGuard.stripDuplicateFacts(generatedAnswer);

    // 5. Apply Partial Information Warning if confidence is MEDIUM
    const finalAnswer = confidenceGuard.applyPartialInfoWarning(deduplicatedAnswer, confidenceReport.confidence);

    return {
        valid: confidenceReport.isGrounded,
        confidence: confidenceReport.confidence,
        score: confidenceReport.score,
        breakdown: confidenceReport.breakdown,
        groundedAnswer: finalAnswer,
        reason: confidenceReport.isGrounded ? "Response passed grounding and citation validation." : "Confidence too low for factual grounding."
    };
};

module.exports = {
    validateResponse
};
