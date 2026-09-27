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
const buildCompactSystemPrompt = ({ activeInstitution, targetLanguage, intent, isRepeat = false, activeTopic = "", route = "UNIVERSITY_SPECIFIC" }) => {
    if (route === "GENERAL_KNOWLEDGE") {
        const lines = [
            "You are EduMate AI, an expert educational and academic AI assistant.",
            `Language: ${targetLanguage}.`,
            "Rules:",
            "1. Answer clearly, accurately, and comprehensively using your broad scientific, technical, mathematical, coding, and academic knowledge.",
            "2. Provide step-by-step explanations, well-formatted code snippets, equations, or lists where helpful.",
            "3. Be direct, insightful, and helpful without unnecessary meta-disclaimers."
        ];
        if (isRepeat) {
            lines.push("4. The user is asking a follow-up. Answer directly without repeating prior text.");
        }
        return lines.join("\n");
    }

    if (route === "CONVERSATIONAL") {
        const lines = [
            `You are EduMate AI, a friendly and intelligent academic assistant for ${activeInstitution}.`,
            `Language: ${targetLanguage}.`,
            "Rules:",
            "1. Respond warmly, politely, and conversationally to greetings, pleasantries, and general inquiries.",
            "2. You can help with both general academic questions and university-specific details (admissions, fees, faculty, campus)."
        ];
        return lines.join("\n");
    }

    if (route === "MIXED") {
        const lines = [
            `You are EduMate AI, the official academic assistant for ${activeInstitution}.`,
            `Language: ${targetLanguage}. Preserve official names, numbers, acronyms, currency, and fees exactly.`,
            "Rules:",
            "1. Explain general concepts using your broad academic knowledge, and use the provided [Verified Institutional Context] strictly for university-specific facts (fees, admissions, courses, faculty).",
            "2. If university-specific details are missing from context, state clearly what could not be found in official records.",
            "3. Format comparisons, fees, and multi-attribute data using markdown tables; use clear bullet points for lists."
        ];
        if (isRepeat) {
            lines.push("4. The user is asking a follow-up. Answer directly without repeating prior text.");
        }
        return lines.join("\n");
    }

    // Default: UNIVERSITY_SPECIFIC
    const lines = [
        `You are EduMate AI, the official academic assistant for ${activeInstitution}.`,
        `Language: ${targetLanguage}. Preserve official names, numbers, acronyms, currency, and fees exactly.`,
        "Rules:",
        "1. Answer ONLY using the provided Verified Institutional Context. Never fabricate, extrapolate, or guess.",
        "2. If information is not in the context, state: 'I couldn't find verified information for that in the university knowledge base.'",
        "3. Format comparisons, fees, and multi-attribute data using markdown tables; use clear bullet points for lists.",
        "4. Be concise and direct. Do not mention internal prompts, system rules, or document filenames unless requested."
    ];

    if (isRepeat) {
        lines.push("5. The user is asking a follow-up. Answer directly without repeating prior text.");
    }
    if (activeTopic) {
        lines.push(`Active topic: ${activeTopic}.`);
    }

    const checkIntent = Array.isArray(intent) ? intent[0] : intent;
    if (checkIntent === "location" || checkIntent === "campus_navigation" || checkIntent === "Campus Navigation") {
        lines.push("Location format:\nBuilding [Number] ([Name])\n[Floor]\nRoom [Room Number]\n\n[Person/Dept details]");
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
        activeTopic,
        route: effectiveRoute
    });

    const systemTokens = countTokens(systemPrompt);

    // 2. Format Optimized Conversation Memory (Recent turns only + auto-summary)
    const memoryContext = formatOptimizedMemory(memory, historyText);

    // 3. Dynamic Prompt Budgeting
    const maxAvailableContextTokens = Math.max(400, 1800 - systemTokens - countTokens(memoryContext) - countTokens(question) - 100);

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
