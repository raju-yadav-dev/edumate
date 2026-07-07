const { INSTITUTIONAL_INTENTS } = require("../constants/intents");

const validateResponse = ({ intent, retrievedContext, generatedAnswer, providerSuccess }) => {
    const institutionalAnswer = INSTITUTIONAL_INTENTS.includes(intent);
    const hasTrustedSources = Boolean(retrievedContext?.sources?.length);

    if (institutionalAnswer && !hasTrustedSources) {
        return {
            valid: false,
            confidence: "low",
            reason: "No trusted institutional source was available."
        };
    }

    if (!generatedAnswer?.trim() && !providerSuccess) {
        return {
            valid: false,
            confidence: "low",
            reason: "No AI provider response was available."
        };
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
