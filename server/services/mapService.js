const settingsService = require("./settingsService");

const buildUnavailableMapResponse = (question) => ({
    found: false,
    answer: "I couldn't verify route or nearby-place information because the map provider is not configured.",
    sources: [],
    metadata: {
        question,
        provider: "openrouteservice",
        configured: false
    }
});

const resolveLocationRequest = async ({ question }) => {
    const settings = await settingsService.getApiKeys();
    const apiKey = process.env.OPENROUTE_SERVICE_API_KEY || settings.openRouteServiceApiKey;

    if (!apiKey) {
        return buildUnavailableMapResponse(question);
    }

    return {
        found: false,
        answer: "I couldn't verify this route from the configured map provider yet.",
        sources: [],
        metadata: {
            question,
            provider: "openrouteservice",
            configured: true
        }
    };
};

module.exports = {
    resolveLocationRequest
};
