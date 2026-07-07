const { INTENTS, INSTITUTIONAL_INTENTS } = require("../constants/intents");

const decide = ({ intent }) => {
    if (intent === INTENTS.GREETING) {
        return {
            service: "deterministic",
            requiresVerifiedContext: false,
            allowLlmFallback: false
        };
    }

    if ([INTENTS.NEARBY_PLACES, INTENTS.LOCATION, INTENTS.TRAVEL_ROUTE, INTENTS.DISTANCE, INTENTS.TRAVEL_COST, INTENTS.ETA].includes(intent)) {
        return {
            service: "map",
            requiresVerifiedContext: true,
            allowLlmFallback: false
        };
    }

    if (INSTITUTIONAL_INTENTS.includes(intent)) {
        return {
            service: "knowledge_base",
            requiresVerifiedContext: true,
            allowLlmFallback: false
        };
    }

    return {
        service: "general_ai",
        requiresVerifiedContext: false,
        allowLlmFallback: true
    };
};

module.exports = {
    decide
};
