const { INTENTS, INSTITUTIONAL_INTENTS } = require("../constants/intents");

const decide = ({ intent, question }) => {
    const q = String(question || "").toLowerCase();
    const mapKeywords = [
        "distance", "route", "directions", "navigation", "nearest", "nearby", 
        "travel time", "how do i reach", "how far", "bus", "metro", "train", 
        "airport", "hospital", "restaurant", "hostel", "pg", "parking",
        "navigate", "reach", "map", "cab", "taxi", "fare", "fuel cost"
    ];

    const hasMapKeyword = mapKeywords.some(kw => q.includes(kw));

    if (hasMapKeyword) {
        return {
            service: "map",
            requiresVerifiedContext: true,
            allowLlmFallback: false
        };
    }

    if (intent === INTENTS.GREETING) {
        return {
            service: "deterministic",
            requiresVerifiedContext: false,
            allowLlmFallback: false
        };
    }

    if ([
        INTENTS.NEARBY_PLACES, 
        INTENTS.LOCATION, 
        INTENTS.TRAVEL_ROUTE, 
        INTENTS.DISTANCE, 
        INTENTS.TRAVEL_COST, 
        INTENTS.ETA,
        INTENTS.TRANSPORT
    ].includes(intent)) {
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
