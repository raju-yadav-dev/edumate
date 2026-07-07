const formatUnavailable = ({ reason }) => ({
    answer: [
        "I couldn't verify this information from trusted sources.",
        reason ? `Reason: ${reason}` : "",
        "You can upload an official document or ask an administrator to add this information to the EduMate knowledge base."
    ].filter(Boolean).join("\n\n"),
    confidence: "low",
    sources: []
});

const formatAnswer = ({ answer, confidence, sources }) => ({
    answer: answer.trim(),
    confidence,
    sources: sources || []
});

module.exports = {
    formatUnavailable,
    formatAnswer
};
