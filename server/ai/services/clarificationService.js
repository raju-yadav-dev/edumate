const { INTENTS } = require("../../constants/intents");

/**
 * Check if the current query requires clarification
 * @param {Object} params
 * @param {string} params.intent - Classified intent
 * @param {Object} params.entities - Extracted entities
 * @param {string} params.question - The user query (or rewritten query)
 * @returns {Object|null} - Clarification response payload or null if no clarification needed
 */
const checkClarification = ({ intent, entities, question }) => {
    const queryText = question.toLowerCase();

    // 1. Fee Clarification Rules
    if (intent === INTENTS.FEES || queryText.includes("fee") || queryText.includes("tuition")) {
        // If course is missing, check if they specified any course keywords
        const courseKeywords = /\b(btech|b\.tech|mtech|m\.tech|mba|bca|mca|bba|ba|bsc|msc|course|program|department|hostel|mess|admission)\b/;
        if (!entities.course && !courseKeywords.test(queryText)) {
            return {
                answer: "Which course or program do you want the fee structure for? For example: B.Tech CSE, BCA, MBA, hostel fee, admission fee, or semester fee.",
                confidence: "high",
                sources: [
                    {
                        type: "system",
                        title: "EduMate Clarification",
                        reference: "fee-course-required"
                    }
                ]
            };
        }
    }

    // 2. Travel / Navigation Route Clarification Rules
    if (intent === INTENTS.TRAVEL_ROUTE || queryText.includes("route") || queryText.includes("directions") || queryText.includes("how to reach")) {
        // If either origin or destination is missing
        const originKeywords = /\b(from|to|near|current location|station|airport|bus stand|college)\b/;
        if ((!entities.routeOrigin || !entities.routeDestination) && !originKeywords.test(queryText)) {
            return {
                answer: "Please share your starting point and destination so I can compare possible routes, travel time, and approximate cost. Example: from Howrah Station to the college.",
                confidence: "high",
                sources: [
                    {
                        type: "system",
                        title: "EduMate Clarification",
                        reference: "route-origin-destination-required"
                    }
                ]
            };
        }
    }

    return null;
};

module.exports = {
    checkClarification
};
