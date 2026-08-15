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
 * @param {Object} params.conversationContext
 * @returns {Promise<Object>} - { rewrittenQuery, activeTopic, intent, entities, isRepeat, subqueries, conversationContext, clarificationPrompt }
 */
const resolveHeuristicReferences = (question, context) => {
    let rewritten = String(question || "").trim();
    if (!context) return rewritten;

    const topic = context.currentTopic || "";
    const department = context.mentionedDepartment || context.currentTopic || "";
    
    // 1. Course references
    if (topic) {
        // Replace "this course", "the course", "that course", "its course"
        const courseRegex = /\b(this course|the course|that course|its course)\b/gi;
        if (courseRegex.test(rewritten)) {
            rewritten = rewritten.replace(courseRegex, topic);
        }

        // Placements reference: e.g. "What about placements?", "What is the placement?"
        if (/\b(career opportunities|placements|placement)\b/i.test(rewritten) && !new RegExp(`\\b${topic}\\b`, "i").test(rewritten)) {
            if (rewritten.toLowerCase().includes("what about")) {
                rewritten = rewritten.replace(/\bwhat about\s+(career opportunities|placements|placement)\b/gi, `What are the placements/career opportunities for ${topic}`);
            } else {
                rewritten = rewritten.replace(/\b(career opportunities|placements|placement)\b/gi, `$1 for ${topic}`);
            }
        }
        
        // Eligibility reference: e.g. "What is the eligibility?", "eligibility criteria"
        if (/\b(admission criteria|eligibility|requirements)\b/i.test(rewritten) && !new RegExp(`\\b${topic}\\b`, "i").test(rewritten)) {
            rewritten = rewritten.replace(/\b(admission criteria|eligibility|requirements)\b/gi, `$1 for ${topic}`);
        }

        // Fee reference: e.g. "What is the fee?", "fee structure"
        if (/\b(fee structure|fees|fee|cost|tuition)\b/i.test(rewritten) && !new RegExp(`\\b${topic}\\b`, "i").test(rewritten)) {
            rewritten = rewritten.replace(/\b(fee structure|fees|fee|cost|tuition)\b/gi, `$1 for ${topic}`);
        }

        // Admission process reference
        if (/\b(admission process|admission procedure)\b/i.test(rewritten) && !new RegExp(`\\b${topic}\\b`, "i").test(rewritten)) {
            rewritten = rewritten.replace(/\b(admission process|admission procedure)\b/gi, `$1 for ${topic}`);
        }
        
        // Pronoun resolutions if query contains "it" or "its" with punctuation-agnostic word boundaries
        if (/\b(it|its)\b/i.test(rewritten)) {
            rewritten = rewritten.replace(/\b(it|its)\b/gi, topic);
        }
    }

    // 2. Department / HOD / Room references
    if (department) {
        // e.g. "Who is the HOD?" -> "Who is the HOD of the CSS department?"
        const hodRegex = /\b(the HOD|HOD)\b/gi;
        if (hodRegex.test(rewritten) && !new RegExp(`\\b${department}\\b`, "i").test(rewritten)) {
            rewritten = rewritten.replace(hodRegex, `the HOD of the ${department}`);
        }
        
        // e.g. "What is the room number?" -> "What is the room number of the CSS department HOD?"
        const roomRegex = /\b(the room number|room number|room no|the room)\b/gi;
        if (roomRegex.test(rewritten) && !new RegExp(`\\b${department}\\b`, "i").test(rewritten)) {
            rewritten = rewritten.replace(roomRegex, `the room number of the ${department} HOD`);
        }

        const deptRegex = /\b(this department|that department|the department)\b/gi;
        if (deptRegex.test(rewritten)) {
            rewritten = rewritten.replace(deptRegex, department);
        }
    }

    // 3. Map route references
    if (context.routeStart && context.routeDestination) {
        const startName = context.routeStart.name || "start location";
        const destName = context.routeDestination.name || "destination";
        const routeText = `from ${startName} to ${destName}`;
        
        // "how long will it take" -> "What is the travel time for the route from Shyamnagar to Brainware University?"
        if (/\b(how long will it take|how long does it take|travel time|eta)\b/i.test(rewritten)) {
            rewritten = `What is the travel time for the route ${routeText}?`;
        }
        // "show me the second route" -> "Show route 2 from Shyamnagar to Brainware University"
        if (/\b(second route|2nd route|route 2)\b/i.test(rewritten)) {
            rewritten = `Show route 2 ${routeText}`;
        }
    }

    return rewritten;
};

const getAmbiguousClarification = (question, historyText) => {
    const q = String(question || "").toLowerCase();
    
    // Check if the query itself is ambiguous (e.g. doesn't mention BCA or B.Tech)
    const hasBca = /\b(bca|b\.c\.a)\b/i.test(q);
    const hasBtech = /\b(b\.?tech|btech|b\s*tech)\b/i.test(q);
    if (hasBca || hasBtech) {
        return null;
    }

    const isFeeQuery = /\b(fee|fees|cost|tuition|charge|charges)\b/i.test(q);
    const isEligibilityQuery = /\b(eligibility|criteria|requirement|requirements|eligible)\b/i.test(q);
    const isPlacementQuery = /\b(placements|placement|career)\b/i.test(q);
    
    if (!isFeeQuery && !isEligibilityQuery && !isPlacementQuery) {
        return null;
    }
    
    if (!historyText) return null;
    
    // Filter historyText to only include lines containing user queries
    const userLines = historyText.split("\n")
        .filter(line => line.toLowerCase().startsWith("user:"))
        .join("\n");
        
    const histLower = userLines.toLowerCase();
    const bcaCount = (histLower.match(/\bbca\b/g) || []).length;
    const btechCount = (histLower.match(/\b(b\.?tech|btech|b\s*tech)\b/g) || []).length;
    
    if (bcaCount > 0 && btechCount > 0) {
        if (isFeeQuery) {
            return "Do you mean the BCA fee or the B.Tech fee?";
        }
        if (isEligibilityQuery) {
            return "Do you mean the BCA eligibility or the B.Tech eligibility?";
        }
        if (isPlacementQuery) {
            return "Do you mean the BCA placements or the B.Tech placements?";
        }
    }
    
    return null;
};

/**
 * Perform a unified analysis of the user query against conversation memory
 * @param {Object} params
 * @param {string} params.question
 * @param {string} params.historyText
 * @param {Object} params.conversationContext
 * @returns {Promise<Object>} - { rewrittenQuery, activeTopic, intent, entities, isRepeat, subqueries, conversationContext, clarificationPrompt }
 */
const analyzeQuery = async ({ question, historyText, conversationContext }) => {
    let conversationContextRes = conversationContext || {
        currentTopic: null,
        currentEntity: null,
        currentIntent: null,
        mentionedDepartment: null,
        mentionedCollege: null,
        lastRelevantDocument: null,
        lastRetrievedSources: []
    };

    // Explicit Topic Overrides
    const lowerQ = question.toLowerCase();
    let explicitTopic = null;
    if (/\b(bca|b\.c\.a)\b/i.test(lowerQ)) {
        explicitTopic = "BCA";
    } else if (/\b(b\.?tech|btech|b\s*tech)\b/i.test(lowerQ)) {
        explicitTopic = "B.Tech";
    } else if (/\b(bba|b\.b\.a)\b/i.test(lowerQ)) {
        explicitTopic = "BBA";
    } else if (/\b(b\.?sc|bsc|b\s*sc)\b/i.test(lowerQ)) {
        explicitTopic = "B.Sc";
    } else if (/\b(css|computational sciences)\b/i.test(lowerQ)) {
        explicitTopic = "CSS department";
    }

    if (explicitTopic) {
        conversationContextRes.currentTopic = explicitTopic;
        conversationContextRes.currentEntity = explicitTopic;
    }

    const activeTopic = conversationContextRes.currentTopic || "";

    // 1. Ambiguity clarification check
    let clarificationPromptRes = getAmbiguousClarification(question, historyText);

    // 2. Perform local heuristic rewriting
    const heuristicRewritten = resolveHeuristicReferences(question, conversationContextRes);

    const systemPrompt = `You are a precise conversational analyzer for an academic assistant chatbot at a university.
Analyze the user's question, the conversation history, and the previous conversation context.
Identify the following and return ONLY a valid JSON object:

1. "conversationContext": Update the conversation context object. Rules:
   - "currentTopic": The current active topic (e.g. "BCA", "B.Tech", "hostel", "placement", "library"). If the user mentions a new course/subject/facility, switch to it. If the user asks a follow-up (e.g., "What is the fee?", "what about eligibility?"), retain the previous topic. If the topic switches to a non-academic topic (e.g. "library"), clear course/department to null.
   - "currentEntity": Specific entity being discussed (e.g., "BCA course", "library building").
   - "currentIntent": Active intent.
   - "mentionedDepartment": Any department mentioned, or null.
   - "mentionedCollege": Any college/university mentioned, or null.
   - "lastRelevantDocument": Maintain or update based on conversation.
   - "lastRetrievedSources": Keep or update.
   - "selectedRouteNumber": If user specifies a route (e.g., "second route", "Route 2", "1st route"), set to that integer (e.g. 2, 1). Keep for follow-ups on same route. Set to null if a new routing request starts.
   - "routeStart": Object { "lat": number, "lng": number, "name": string } of the origin coordinates, or null.
   - "routeDestination": Object { "lat": number, "lng": number, "name": string } of the destination coordinates, or null.

2. "clarificationPrompt": If there is ambiguity because multiple topics/courses are active in the context (e.g., user said "Tell me about BCA and B.Tech" and then asks "What is the fee?"), set this to a string asking the user for clarification (e.g., "Do you mean the BCA fee or B.Tech fee?"). If there is no ambiguity, set to null.

3. "activeTopic": The current active topic string (value of conversationContext.currentTopic).

4. "rewrittenQuery": Rewrite the user's question to be standalone, descriptive, and optimized for search. Explicitly resolve all pronouns/references ("it", "this", "the fee", "its eligibility", "the department", "the HOD", "second route", "how long will it take") using the conversationContext.
   - Example 1: Context topic "BCA". Question: "What is the fee?" -> "What is the BCA course fee structure?"
   - Example 2: Context topic "BCA department". Question: "Who is the HOD?" -> "Who is the HOD of the BCA department?"
   - Example 3: Context route "Shyamnagar to Brainware University". Question: "Show the second route." -> "Show the second route from Shyamnagar to Brainware University"
   - Example 4: Context route "Shyamnagar to Brainware University", selectedRouteNumber 2. Question: "How long does it take?" -> "What is the travel time of Route 2 from Shyamnagar to Brainware University?"

5. "intent": Classify the intent into one of these exact lowercase values:
   ["greeting", "admission", "fees", "scholarship", "hostel", "library", "faculty", "placement", "departments", "courses", "events", "academic_calendar", "document_question", "announcement", "nearby_places", "location", "travel_route", "transport", "distance", "travel_cost", "eta", "emergency", "general_chat"]

6. "entities": Extract any key entities matching this structure:
   {
     "course": "e.g., B.Pharm, BCA, or null",
     "department": "e.g., Computer Science, or null",
     "location": "e.g., Boys Hostel, or null",
     "institution": "e.g., Heritage, or null"
   }

7. "isRepeat": A boolean indicating if the user is asking the exact same question.

8. "subqueries": If multi-part, decompose into 2 to 4 subqueries. Otherwise, return a 1-element array with rewrittenQuery.

Return ONLY a valid JSON block, without markdown formatting or backticks.`;

    const userPrompt = `Previous Conversation Context:
${JSON.stringify(conversationContextRes, null, 2)}

Conversation History:
${historyText || "No prior history"}

User Question: "${heuristicRewritten}"`;

    let activeTopicRes = activeTopic || "";
    let rewrittenQueryRes = heuristicRewritten;
    let intentRes = "general_chat";
    let entitiesRes = {};
    let isRepeatRes = false;
    let subqueriesRes = [];

    // If clarification is already heuristically detected, we don't need to ask the LLM
    if (clarificationPromptRes) {
        return {
            activeTopic: activeTopicRes,
            rewrittenQuery: rewrittenQueryRes,
            intent: "general_chat",
            entities: {},
            isRepeat: false,
            subqueries: [rewrittenQueryRes],
            conversationContext: conversationContextRes,
            clarificationPrompt: clarificationPromptRes
        };
    }

    try {
        const response = await llmService.generateCompletion([
            { role: "system", content: "You are a precise JSON query analyzer." },
            { role: "user", content: systemPrompt + "\n\n" + userPrompt }
        ], { temperature: 0.1, maxOutputTokens: 500 });

        const cleaned = String(response)
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();
        const parsed = JSON.parse(cleaned);

        activeTopicRes = parsed.activeTopic || parsed.conversationContext?.currentTopic || activeTopic || "";
        rewrittenQueryRes = parsed.rewrittenQuery || heuristicRewritten;
        intentRes = parsed.intent || "general_chat";
        entitiesRes = parsed.entities || {};
        isRepeatRes = !!parsed.isRepeat;
        clarificationPromptRes = parsed.clarificationPrompt || null;
        if (parsed.conversationContext) {
            conversationContextRes = parsed.conversationContext;
        }
        if (Array.isArray(parsed.subqueries) && parsed.subqueries.length > 0) {
            subqueriesRes = parsed.subqueries.map(s => String(s).trim()).filter(Boolean);
        }
    } catch (e) {
        console.error("Query analysis failed, falling back:", e.message);
        // Fallback to our heuristic rewriting
        rewrittenQueryRes = heuristicRewritten;
    }

    // Heuristic Subquery Decomposition Fallback if subqueries array is empty
    if (subqueriesRes.length === 0) {
        const lowerRewritten = rewrittenQueryRes.toLowerCase();
        const detectedTopic = entitiesRes.course || activeTopicRes || (lowerRewritten.includes("bca") ? "BCA" : "");
        const fallbackSubs = [];

        if (lowerRewritten.includes("course") || lowerRewritten.includes("overview") || lowerRewritten.includes("eligibility") || lowerRewritten.includes("programme")) {
            fallbackSubs.push(`${detectedTopic} course details overview eligibility`.trim());
        }
        if (lowerRewritten.includes("fee") || lowerRewritten.includes("cost") || lowerRewritten.includes("tuition") || lowerRewritten.includes("charge")) {
            fallbackSubs.push(`${detectedTopic} fee structure tuition fees`.trim());
        }
        if (lowerRewritten.includes("faculty") || lowerRewritten.includes("faculties") || lowerRewritten.includes("teacher") || lowerRewritten.includes("professor") || lowerRewritten.includes("staff") || lowerRewritten.includes("hod") || lowerRewritten.includes("head") || lowerRewritten.includes("dean") || lowerRewritten.includes("director") || lowerRewritten.includes("coordinator")) {
            const deptExt = (detectedTopic.toUpperCase().includes("BCA") || lowerRewritten.includes("bca") || lowerRewritten.includes("css")) 
                ? "Department of Computational Sciences faculty" 
                : "faculty members";
            fallbackSubs.push(`${detectedTopic} ${deptExt}`.trim());
        }

        if (fallbackSubs.length > 1) {
            subqueriesRes = fallbackSubs;
        } else {
            subqueriesRes = [rewrittenQueryRes];
        }
    }

    return {
        activeTopic: activeTopicRes,
        rewrittenQuery: rewrittenQueryRes,
        intent: intentRes,
        entities: entitiesRes,
        isRepeat: isRepeatRes,
        subqueries: subqueriesRes,
        conversationContext: conversationContextRes,
        clarificationPrompt: clarificationPromptRes
    };
};

module.exports = {
    rewriteQuery,
    analyzeQuery
};
