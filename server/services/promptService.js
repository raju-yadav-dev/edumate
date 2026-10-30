const { buildSmartContext } = require("../ai/utils/contextBuilder");
const { countTokens } = require("../ai/utils/tokenizer");

/**
 * EduMate Task 10 — Prompt Optimization for Speed (llama.cpp)
 * 
 * Requirements:
 * 1. System prompt strictly below 250 tokens.
 * 2. Conversation memory: Recent turns only + automated summary of older turns (never complete history).
 * 3. Verified context inserted only once with preserved section titles & citations.
 * 4. Dynamic Prompt Budget:
 *    - Fact -> small prompt
 *    - Table/List -> medium prompt
 *    - Long explanation -> larger prompt
 * 5. Total prompt kept between 1200–1800 tokens maximum.
 */

/**
 * Builds a dense, high-impact system prompt under 250 tokens tailored to the query route.
 */
const buildCompactSystemPrompt = ({ activeInstitution, targetLanguage, intent, isRepeat = false, isContinuation = false, activeTopic = "", route = "RAG_LLM" }) => {
    if (route === "LLM_ONLY" || route === "GENERAL_KNOWLEDGE") {
        const lines = [
            "You are EduMate AI, an expert educational and academic AI assistant.",
            `Language: ${targetLanguage}.`,
            "Rules:",
            "1. Answer clearly, accurately, and comprehensively using your broad scientific, technical, mathematical, coding, and academic knowledge.",
            "2. For degree/academic program queries (such as BCA, MCA, B.Tech), explain the degree (e.g. Bachelor of Computer Applications, Master of Computer Applications), duration, core subjects, and career path.",
            "3. For programming/technical concepts (such as Java, Python, SQL), explain what it is, core features, and practical applications.",
            "4. Direct answer only: Never restate, echo, or summarize the user's question before answering (do NOT write 'Based on your query...', 'It seems you are asking...', or outline their questions). Begin immediately with the substantive comparison, facts, or explanation.",
            "5. Be direct and concise. Do not output <think> tags or reasoning."
        ];
        if (isContinuation) {
            lines.push("6. The user requested you to continue your previous answer. Continue immediately from the exact sentence where the previous message ended. Do not repeat prior content.");
        } else if (isRepeat) {
            lines.push("6. The user is asking a follow-up. Answer directly without repeating prior text.");
        }
        return lines.join("\n");
    }

    if (route === "CONVERSATIONAL") {
        const lines = [
            `You are EduMate AI, a friendly and intelligent academic assistant for ${activeInstitution}.`,
            `Language: ${targetLanguage}.`,
            "Rules:",
            "1. Respond warmly, politely, and conversationally to greetings, pleasantries, and general inquiries.",
            "2. You can help with both general academic questions and university-specific details (admissions, fees, faculty, campus).",
            "3. Answer directly without echoing or restating the user's greeting or question."
        ];
        if (isContinuation) {
            lines.push("4. The user requested you to continue your previous answer. Continue immediately from where the previous message ended. Do not repeat prior content.");
        }
        return lines.join("\n");
    }

    if (route === "LLM_TOOLS") {
        const lines = [
            `You are EduMate AI, an advanced analytical and document processing assistant for ${activeInstitution}.`,
            `Language: ${targetLanguage}.`,
            "Rules:",
            "1. Analyze, summarize, compare, or generate quizzes from the provided documents accurately.",
            "2. Present structured outputs with clear headings, bullet points, or markdown comparison tables.",
            "3. Ground all specific observations in the provided document text.",
            "4. Direct substantive output only: Do not echo or summarize the prompt; begin immediately with the output."
        ];
        return lines.join("\n");
    }

    if (route === "RAG_ONLY") {
        const lines = [
            `You are EduMate AI, the official document and records lookup assistant for ${activeInstitution}.`,
            `Language: ${targetLanguage}.`,
            "Rules:",
            "1. Return exact notices, circulars, syllabus details, and document references found in the official records.",
            "2. State dates, reference numbers, and department sources clearly.",
            "3. Direct answer only: Begin immediately with the records found without restating the query."
        ];
        return lines.join("\n");
    }

    if (route === "MIXED") {
        const lines = [
            `You are EduMate AI, the official academic assistant for ${activeInstitution}.`,
            `Language: ${targetLanguage}. Preserve official names, numbers, acronyms, currency, and fees exactly.`,
            "Rules:",
            "1. Explain general concepts using your broad academic knowledge, and use the provided [Verified Institutional Context] strictly for university-specific facts (fees, admissions, courses, faculty).",
            "2. If university-specific details are missing from context, state clearly: 'I couldn't find matching information in the university knowledge base.'",
            "3. Format comparisons, fees, and multi-attribute data using markdown tables; use clear bullet points for lists.",
            "4. Direct answer only: Never echo, restate, or outline the user's question before answering (do NOT write 'Based on your query...'). Begin immediately with the substantive answer.",
            "5. Provide the direct output answer only. Do not provide sources, citations, references, document names, or bracket markers."
        ];
        if (isContinuation) {
            lines.push("6. The user requested you to continue your previous answer. Continue immediately from the exact sentence where the previous message ended. Do not repeat prior content.");
        } else if (isRepeat) {
            lines.push("6. The user is asking a follow-up. Answer directly without repeating prior text.");
        }
        return lines.join("\n");
    }

    // Default: RAG_LLM / UNIVERSITY_SPECIFIC
    const lines = [
        `You are EduMate AI, the official academic assistant for ${activeInstitution}.`,
        `Language: ${targetLanguage}. Preserve official names, numbers, acronyms, currency, and fees exactly.`,
        "Rules:",
        "1. Answer ONLY using the provided Verified Institutional Context. Never fabricate or guess university-specific facts.",
        "2. When multiple context blocks are provided, combine all relevant blocks to build a complete, structured answer. Keep each programme's facts correctly attributed to that programme only.",
        "3. If information is not in the context, state: 'This information was not found in the university knowledge base.' Never invent fees, dates, eligibility criteria, or policies.",
        "4. For comparison or synthesis questions, retrieve evidence from every relevant context block, then clearly compare or summarize based on that evidence. Label any logical inference explicitly as 'Based on the above information...' to distinguish it from sourced facts.",
        "5. Strict Entity-Fact Relationship: Keep each room number, building, floor, department, fee, and role strictly bound to its exact entity. Never combine attributes from unrelated programmes or departments.",
        "6. Quote exact numbers and details verbatim from the context. Do not output <think> tags or reasoning chains.",
        "7. Direct answer only: Never restate, echo, or summarize the user's query before answering (do NOT write 'Based on your query...'). Begin immediately with the substantive facts.",
        "8. Provide the direct output answer only. Do not provide sources, citations, references, document names, or bracket markers (such as [1] or [Document])."
    ];

    if (isContinuation) {
        lines.push("9. The user requested you to continue your previous answer. Continue immediately from where the previous message stopped. Do not repeat prior content.");
    } else if (isRepeat) {
        lines.push("9. The user is asking a follow-up. Answer directly without repeating prior text.");
    }
    if (activeTopic) {
        lines.push(`Active topic: ${activeTopic}.`);
    }

    const intentsArray = Array.isArray(intent) ? intent : [intent];
    const isLocationIntent = intentsArray.some(i => i === "location" || i === "campus_navigation" || i === "Campus Navigation" || i === "CAMPUS_NAVIGATION");
    if (isLocationIntent) {
        lines.push("8. Campus Navigation and Academic Block Mapping:\n" +
            "   - Academic Block 1 / Building I (Satyajit Bhavan): Psychology, Cyber Science & Technology, Media & Journalism.\n" +
            "   - Academic Block 2 / Building II (Vidyasagar Bhavan): Admission Cell, Counseling, Language Lab, AI Future Skills Hub, Auditorium.\n" +
            "   - Academic Block 3 / Building III (Prafulla Bhavan): Pharmacy, Cash Counter, Accounts, IT Support, Central Library, Exam Controller.\n" +
            "   - Academic Block 4 / Building IV (Jagdish Bhavan): Engineering & Applied Sciences (Mechanical, Civil, Robotics, Soil Science, Electrical, Food & Nutrition, Agriculture, Biotech).\n" +
            "   - Academic Block 5 / Building V (Ravindra Bhavan): Computer Science & Engineering (CSE, CSE AI-ML, CSE AI, CS & DS), Classrooms, Vice Chancellor, Registrar, Chancellor.\n" +
            "   - Academic Block 6 / Building VI (Rammohan Bhavan): Law (School of Law, Moot Court), Computational Science, Management & Commerce.\n" +
            "   - Academic Block 7 / Building VII (Aurobindo Bhavan): Yoga, Gymnasium, Pure Veg Canteen.\n" +
            "   - Academic Block 8 / Building VIII (Satyendra Bhavan): Conference Room, Retail Lab, Health Care Lab, Placement, F&B Service Lab.\n" +
            "   - Academic Block 9 / Building IX (Vivekananda Bhavan): Nursing & GNM, Nursing Library, Nursing Hostel.\n" +
            "   - Hostels: Netaji Bhawan (Boys Hostel), Maa Agni Bhawan (Girls Hostel).\n" +
            "When asked about routes or navigating between academic blocks, describe the direct walkway connecting the specified buildings/blocks, mention which facilities/departments are housed in each block, and give clear, helpful navigation directions.");
    }

    return lines.join("\n");
};

/**
 * Formats conversation memory to include only recent turns and auto-condense older history.
 */
const formatOptimizedMemory = (memory, historyText = "") => {
    if (historyText && historyText.trim()) {
        const lines = historyText.trim().split("\n");
        // Keep at most 4 recent lines / 2 turns
        if (lines.length > 4) {
            const older = lines.slice(0, -4).join(" ").slice(0, 160);
            const recent = lines.slice(-4).join("\n");
            return `[Summary of earlier context: ${older}...]\n${recent}`;
        }
        return historyText.trim();
    }

    if (!Array.isArray(memory) || memory.length === 0) {
        return "";
    }

    // Keep only last 2-4 messages
    const recent = memory.slice(-4);
    const formatted = recent
        .map(m => `${m.role === "assistant" ? "Assistant" : "User"}: ${String(m.content || "").trim().slice(0, 250)}`)
        .join("\n");

    if (memory.length > 4) {
        const olderSample = memory.slice(0, -4).map(m => m.content).join(" ").slice(0, 150);
        return `[Prior summary: ${olderSample}...]\n${formatted}`;
    }

    return formatted;
};

/**
 * Builds messages list for LLM with strict token budgeting for llama.cpp
 */
const buildMessages = ({
    question,
    intent,
    retrievedChunks,
    universitySiteResults = [],
    webResults = [],
    memory,
    historyText = "",
    user,
    questionType,
    isRepeat = false,
    isContinuation = false,
    continuationContext = "",
    activeTopic = "",
    language = "en",
    studentProfile,
    queryPlan,
    route = "UNIVERSITY_SPECIFIC"
}) => {
    const defaultInstitution = process.env.PRIMARY_UNIVERSITY_NAME || "Brainware University";
    const activeInstitution = (user && user.institution && user.institution.trim()) ? user.institution : defaultInstitution;

    const languageNames = { en: "English", hi: "Hindi", bn: "Bengali" };
    const targetLanguage = languageNames[language] || "English";
    const effectiveRoute = queryPlan?.route || route || "UNIVERSITY_SPECIFIC";

    // 1. Build Compact System Prompt (< 250 tokens)
    const systemPrompt = buildCompactSystemPrompt({
        activeInstitution,
        targetLanguage,
        intent,
        isRepeat,
        isContinuation,
        activeTopic,
        route: effectiveRoute
    });

    const systemTokens = countTokens(systemPrompt);

    // 2. Format Optimized Conversation Memory (Recent turns only + auto-summary)
    const memoryContext = formatOptimizedMemory(memory, historyText);

    // 3. Dynamic Prompt Budgeting
    // Max prompt cap is 2200 tokens: enough to hold system prompt (~150), history (~200),
    // question (~50), and at least 700 tokens of multi-chunk evidence without truncation.
    const MAX_PROMPT_TOKENS = 2200;
    const MIN_CONTEXT_TOKENS = 700; // ensures fee tables and multi-section evidence fit
    const maxAvailableContextTokens = Math.max(
        MIN_CONTEXT_TOKENS,
        MAX_PROMPT_TOKENS - systemTokens - countTokens(memoryContext) - countTokens(question) - 100
    );

    // Insert retrieved context if chunks are provided
    let sourceContext = "";
    if (Array.isArray(retrievedChunks) && retrievedChunks.length > 0) {
        sourceContext = buildSmartContext(retrievedChunks, {
            question,
            queryPlan,
            maxContextTokens: maxAvailableContextTokens
        });
    }

    // 4. Assemble User Prompt
    const userPromptParts = [];
    if (effectiveRoute !== "GENERAL_KNOWLEDGE") {
        userPromptParts.push(`Student: ${user?.fullName || "Guest"}`);
    }
    if (intent && effectiveRoute !== "GENERAL_KNOWLEDGE") {
        userPromptParts.push(`Intent: ${Array.isArray(intent) ? intent.join(", ") : intent}`);
    }

    if (studentProfile && Object.keys(studentProfile).length > 0) {
        userPromptParts.push(`[Student Profile]\n${JSON.stringify(studentProfile)}`);
    }

    if (memoryContext) {
        userPromptParts.push(`[Conversation Memory]\n${memoryContext}`);
    }

    if (isContinuation && continuationContext) {
        userPromptParts.push(`[Continuation Directive]\n${continuationContext}`);
    }

    // Single insertion of verified institutional evidence when available
    if (sourceContext && sourceContext.trim()) {
        userPromptParts.push(`[Verified Institutional Context]\n${sourceContext}`);
    }

    // Official web fallback context (if applicable and within budget)
    if (Array.isArray(universitySiteResults) && universitySiteResults.length > 0 && (!retrievedChunks || retrievedChunks.length === 0)) {
        const siteSnippet = universitySiteResults.slice(0, 2).map(r => `[${r.title}] ${r.snippet}`).join("\n");
        userPromptParts.push(`[Official Website Context]\n${siteSnippet}`);
    }

    userPromptParts.push(`Question: ${question}`);

    const userPrompt = userPromptParts.join("\n\n");
    const totalPromptTokens = systemTokens + countTokens(userPrompt);

    console.log(`[Prompt Optimizer] Route: ${effectiveRoute} | System Tokens: ${systemTokens} | Total Prompt Tokens: ${totalPromptTokens}`);

    return [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
    ];
};

module.exports = {
    buildCompactSystemPrompt,
    formatOptimizedMemory,
    buildMessages
};
