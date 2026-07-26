const formatUnavailable = ({ reason }) => ({
    answer: [
        "I couldn't verify this information from trusted sources.",
        reason ? `Reason: ${reason}` : "",
        "You can upload an official document or ask an administrator to add this information to the EduMate knowledge base."
    ].filter(Boolean).join("\n\n"),
    confidence: "low",
    sources: []
});

const SOURCE_LABELS = {
    UNIVERSITY: "📚 University Knowledge Base",
    WEB: "🌐 Trusted Internet Sources",
    COMBINED: "📚 + 🌐 Combined Sources"
};

const formatAnswer = ({ answer, confidence, sources, sourceLabel }) => {
    let finalAnswer = answer.trim();
    
    if (sourceLabel && !finalAnswer.startsWith(sourceLabel)) {
        finalAnswer = `${sourceLabel}\n\n${finalAnswer}`;
    }

    return {
        answer: finalAnswer,
        confidence,
        sources: sources || [],
        sourceLabel: sourceLabel || SOURCE_LABELS.UNIVERSITY
    };
};

module.exports = {
    formatUnavailable,
    formatAnswer,
    SOURCE_LABELS
};
