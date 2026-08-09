const llmService = require("./llmService");

/**
 * Rewrite the user query based on conversational context to be standalone
 * @param {Object} params
 * @param {string} params.question - The current user question
 * @param {string} params.historyText - Recent conversational history text
 * @returns {Promise<string>} - The rewritten standalone query
 */
const rewriteQuery = async ({ question, historyText }) => {
    if (!historyText || historyText.trim() === "") {
        return question;
    }

    const systemPrompt = `You are an AI assistant specialized in search query rewriting.
Given a conversation history and a user's follow-up question, rewrite the question into a single, standalone search query that contains all necessary context (like subjects, names, locations, referents, etc.) to be searched in a database.
Do not answer the question; only output the rewritten question.

Rules:
1. Preserve core meaning.
2. Resolve pronouns (it, they, he, she, there, them, that, etc.) to their context from the history.
3. Keep it brief and optimize for semantic keyword search.
4. If the question is already standalone and does not require context, output the original question exactly.

Output ONLY the rewritten search query. Do not add quotes, preambles, or markdown.

Conversation History:
${historyText}

Follow-up Question: "${question}"`;

    try {
        const response = await llmService.generateCompletion([
            { role: "system", content: "You are a precise query rewriter." },
            { role: "user", content: systemPrompt }
        ], { temperature: 0.1, maxOutputTokens: 100 });

        const cleaned = String(response).trim().replace(/^"|"$/g, ""); // strip quotes if generated
        if (cleaned) {
            return cleaned;
        }
    } catch (e) {
        console.error("Query Rewriting failed, using original query:", e.message);
    }

    return question;
};

/**
 * Perform a unified analysis of the user query against conversation memory
 * @param {Object} params
 * @param {string} params.question
 * @param {string} params.historyText
 * @param {string} params.activeTopic
 * @returns {Promise<Object>} - { rewrittenQuery, activeTopic, intent, entities, isRepeat }
 */
const analyzeQuery = async ({ question, historyText, activeTopic }) => {
    const systemPrompt = `You are a precise conversational analyzer for an academic assistant chatbot at a university.
Analyze the user's question, the conversation history, and the previous active topic.
Identify the following and return ONLY a valid JSON object:
1. "activeTopic": The current subject/course/facility/general context of conversation. If the user mentions a new course/subject (e.g. "BCA", "B.Pharm", "hostel", "placement", "library"), switch to it. If the user asks a follow-up continuing the previous topic (e.g., "What is the fee?", "what about eligibility?", "duration?"), retain the previous topic "${activeTopic || "none"}".
2. "rewrittenQuery": Rewrite the user's question to be standalone, descriptive, and optimized for search. Explicitly include the active topic/context (e.g., if previous topic is "B.Pharm" and question is "What is the fee?", rewrite to "What is the fee structure for B.Pharm?"). If the question is already standalone, keep it as is.
3. "intent": Classify the intent into one of these exact lowercase values:
   ["greeting", "admission", "fees", "scholarship", "hostel", "library", "faculty", "placement", "departments", "courses", "events", "academic_calendar", "document_question", "announcement", "nearby_places", "location", "travel_route", "transport", "distance", "travel_cost", "eta", "emergency", "general_chat"]
4. "entities": Extract any key entities matching this structure:
   {
     "course": "e.g., B.Pharm, BCA, or null",
     "department": "e.g., Computer Science, or null",
     "location": "e.g., Boys Hostel, or null",
     "institution": "e.g., Heritage, or null"
   }
5. "isRepeat": A boolean indicating if the user is asking the exact same question they already asked in the conversation history.

Return ONLY a valid JSON block, without markdown formatting or backticks.`;

    const userPrompt = `Previous Active Topic: "${activeTopic || "none"}"
Conversation History:
${historyText || "No prior history"}

User Question: "${question}"`;

    try {
        const response = await llmService.generateCompletion([
            { role: "system", content: "You are a precise JSON query analyzer." },
            { role: "user", content: systemPrompt + "\n\n" + userPrompt }
        ], { temperature: 0.1, maxOutputTokens: 350 });

        const cleaned = String(response)
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();
        const parsed = JSON.parse(cleaned);

        return {
            activeTopic: parsed.activeTopic || activeTopic || "",
            rewrittenQuery: parsed.rewrittenQuery || question,
            intent: parsed.intent || "general_chat",
            entities: parsed.entities || {},
            isRepeat: !!parsed.isRepeat
        };
    } catch (e) {
        console.error("Query analysis failed, falling back:", e.message);
        return {
            activeTopic: activeTopic || "",
            rewrittenQuery: question,
            intent: "general_chat",
            entities: {},
            isRepeat: false
        };
    }
};

module.exports = {
    rewriteQuery,
    analyzeQuery
};
