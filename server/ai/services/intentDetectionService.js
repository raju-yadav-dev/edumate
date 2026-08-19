const { classifyIntent: ruleClassifyIntent } = require("../../services/intentService");
const { INTENTS } = require("../../constants/intents");
const llmService = require("./llmService");

/**
 * Classify user intent using rules and LLM validation
 * @param {string} question
 * @returns {Promise<Object>} - { intent: string, confidence: number }
 */
const detectIntent = async (question) => {
    const ruleResult = ruleClassifyIntent(question);
    
    // If the rule classification matched a specific intent with high confidence, use it
    if (ruleResult.intent !== INTENTS.GENERAL_CHAT && ruleResult.intent !== INTENTS.UNKNOWN) {
        return {
            intent: ruleResult.intent,
            confidence: ruleResult.confidence || 0.85
        };
    }

    // Otherwise, ask Gemini to classify
    const systemPrompt = `You are a query intent classifier for an educational university AI assistant.
Classify the user's question into EXACTLY ONE of the following intent categories:
- ${INTENTS.GREETING} (simple hellos, hey, greetings)
- ${INTENTS.ADMISSION} (joining college, applications, eligibility)
- ${INTENTS.FEES} (cost of courses, tuition fees, how to pay)
- ${INTENTS.SCHOLARSHIP} (fee waivers, financial support, awards)
- ${INTENTS.HOSTEL} (room allotment, lodging, mess hall food)
- ${INTENTS.LIBRARY} (borrowing books, library hours, reference guides)
- ${INTENTS.FACULTY} (professors, teachers, staff information)
- ${INTENTS.PLACEMENT} (job packages, recruitment companies, internships)
- ${INTENTS.DEPARTMENTS} (engineering, sciences schools, HOD information)
- ${INTENTS.COURSES} (syllabus, curriculum programs, degrees offered)
- ${INTENTS.EVENTS} (fests, cultural activities, webinars)
- ${INTENTS.ACADEMIC_CALENDAR} (exam dates, semester starts, holidays)
- ${INTENTS.DOCUMENT_QUESTION} (specifically requesting files or uploaded context)
- ${INTENTS.ANNOUNCEMENT} (university circulars, news updates, notifications)
- ${INTENTS.NEARBY_PLACES} (attractions, restaurants, stores near college)
- ${INTENTS.LOCATION} (location details of campus departments)
- ${INTENTS.TRAVEL_ROUTE} (directions, navigation instructions, route queries)
- ${INTENTS.TRANSPORT} (bus services, train, transport routes)
- ${INTENTS.DISTANCE} (how far the college is from specific points)
- ${INTENTS.TRAVEL_COST} (bus/train fares, travel expenses)
- ${INTENTS.ETA} (estimated travel arrival times)
- ${INTENTS.EMERGENCY} (medical help, urgent assistance, security contacts)
- ${INTENTS.COURSE_RECOMMENDATION} (user provides personal academic profile/marks/interests and asks which course/career to choose or what is best/better for them)
- ${INTENTS.GENERAL_CHAT} (general chit-chat, conversational queries, non-university topics)

Response MUST be exactly one of the words above in lowercase, without any other text.
Question: "${question}"`;

    try {
        const completion = await llmService.generateCompletion([
            { role: "system", content: "You are a precise classifier." },
            { role: "user", content: systemPrompt }
        ], { temperature: 0.1, maxOutputTokens: 20 });

        const cleanedResult = String(completion).trim().toLowerCase();
        const validIntents = Object.values(INTENTS);

        if (validIntents.includes(cleanedResult)) {
            return {
                intent: cleanedResult,
                confidence: 0.9
            };
        }
    } catch (e) {
        console.error("Gemini Intent Detection failed:", e.message);
    }

    // Fallback to rule result
    return {
        intent: ruleResult.intent || INTENTS.GENERAL_CHAT,
        confidence: ruleResult.confidence || 0.5
    };
};

module.exports = {
    detectIntent
};
