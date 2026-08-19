/**
 * Builds messages list for Gemini API with strict grounding and hybrid web/document rules.
 * @param {Object} params
 * @param {string} params.question - The user's query
 * @param {string} params.intent - Classified intent
 * @param {Array} params.retrievedChunks - Vector search result chunks
 * @param {Array} params.webResults - Web search results from DuckDuckGo/Jina
 * @param {Array} params.memory - Conversation memory thread
 * @param {Object} params.user - User session details
 * @param {string} params.questionType - classified question type (university_specific, general_knowledge, hybrid)
 * @returns {Array<Object>} - Format ready for completion provider
 */
const buildMessages = ({ question, intent, retrievedChunks, universitySiteResults = [], webResults = [], memory, user, questionType, isRepeat = false, activeTopic = "", language, studentProfile }) => {
    const defaultInstitution = process.env.PRIMARY_UNIVERSITY_NAME || "Brainware University";
    const activeInstitution = (user && user.institution && user.institution.trim()) ? user.institution : defaultInstitution;
    const maxChunkChars = Number(process.env.RAG_MAX_CHUNK_CHARS) || 4500;
    const maxChunks = Number(process.env.RAG_MAX_CHUNKS) || 4;
    const maxHistoryChars = Number(process.env.RAG_MAX_HISTORY_CHARS) || 2000;

    const sourceContext = (retrievedChunks || []).slice(0, maxChunks).map((chunk) => {
        const content = String(chunk.content || "");
        return `[${chunk.metadata?.originalName || "Document"}, Page: ${chunk.metadata?.pageNumber || 1}, Category: ${chunk.metadata?.category || "General"}]\n${content.slice(0, maxChunkChars)}`;
    }).join("\n\n") || "No matching university documents found in the database.";

    const siteContext = (universitySiteResults || []).slice(0, 3).map((result) =>
        `[${result.title || "Official page"}] ${String(result.snippet || "").slice(0, 1200)}`
    ).join("\n\n") || "No official university website context provided.";

    const webContext = (webResults || []).slice(0, 3).map((result) =>
        `[${result.title || "Web result"}] ${String(result.snippet || "").slice(0, 1000)}`
    ).join("\n\n") || "No trusted web search context provided.";

    const memoryContext = (memory || [])
        .slice(-4)
        .map((message) => `${message.role === "assistant" ? "assistant" : "user"}: ${message.content}`)
        .join("\n")
        .slice(-maxHistoryChars) || "No prior conversation history.";

    const languageNames = { en: "English", hi: "Hindi", bn: "Bengali" };
    const targetLanguage = languageNames[language] || "English";

    // Personalized Course Recommendation Custom Prompt
    const primaryIntent = Array.isArray(intent) ? intent[0] : intent;
    if (primaryIntent === "course_recommendation") {
        const profile = studentProfile || {};
        const profileLines = [];
        if (profile.class) profileLines.push(`- Class: ${profile.class}`);
        if (profile.stream) profileLines.push(`- Class 12 Stream: ${profile.stream}`);
        if (profile.overall_percentage) profileLines.push(`- Overall Score: ${profile.overall_percentage}%`);
        if (profile.subject && profile.subject_percentage) {
            profileLines.push(`- ${profile.subject}: ${profile.subject_percentage}%`);
        } else if (profile.subject) {
            profileLines.push(`- Interest/Subject: ${profile.subject}`);
        }
        if (profile.interests) profileLines.push(`- Interests: ${profile.interests}`);
        if (profile.preferred_subjects) profileLines.push(`- Preferred Subjects: ${profile.preferred_subjects}`);
        if (profile.career_interests) profileLines.push(`- Career Interests: ${profile.career_interests}`);
        if (profile.skills) profileLines.push(`- Skills: ${profile.skills}`);

        const profileText = profileLines.join("\n") || "No profile details provided.";

        const systemPrompt = [
            "You are EduMate AI, an institutional academic assistant specialized in personalized course recommendations.",
            `Institution: ${activeInstitution}`,
            `Response language: ${targetLanguage}. Preserve names, course names, acronyms, numbers and currency exactly.`,
            "Your task is to analyze the student's profile against the retrieved university course/eligibility documents and provide a highly personalized recommendation.",
            "",
            "## ELIGIBILITY AND GROUNDING RULES:",
            "1. You MUST determine course eligibility based ONLY on the retrieved institutional evidence.",
            "2. For each course, check if the student meets all stream, overall percentage, and subject-specific requirements documented in the chunks.",
            "3. Stated eligibility MUST be exactly one of: 'Eligible', 'Not eligible', or 'Unclear'.",
            "4. If the retrieved evidence does not mention requirements or stream compatibility for a course, you MUST state: 'Eligibility cannot be confirmed from the available institutional information.' and classify eligibility as 'Unclear'. Do NOT assume eligibility.",
            "5. If a course requires a stream (e.g. Science) that the student does not have (e.g. Arts), state 'Not eligible' and explain why (e.g. 'this course appears to require a Science background, so it may not be suitable for your current stream').",
            "6. NEVER hallucinate or invent eligibility rules, percentages, stream requirements, fees, durations, or course names. If information is not in the retrieved documents, state that it is unavailable.",
            "",
            "## RESPONSE FORMATTING RULES:",
            "You MUST output the response in this EXACT structure, word for word, without any conversational preambles (e.g., do not say 'Here is your recommendation:', 'Sure, I can help with that', etc.):",
            "",
            "### Based on your profile",
            profileText,
            "",
            "### Best-fit courses",
            "For each course, list:",
            "**1. [Course Name]**",
            "**Eligibility:** [Eligible / Not eligible / Unclear]",
            "**Why it may suit you:** [Reasoning matching the student's profile stream/subjects/marks to the course focus/opportunities. Explain stream matches, subject relevance, and academic strengths/marks]",
            "**Important requirement:** [Mention the relevant verified institutional eligibility requirements from the chunks, or state 'Eligibility cannot be confirmed from the available institutional information.']",
            "**Confidence:** [High / Medium / Low]",
            "",
            "### Recommendation",
            "[Provide a concise recommendation based ONLY on the verified institutional information. Do not suggest courses outside of the retrieved chunks. If no courses match, state that no suitable courses were found in the database.]",
            "",
            "### Important",
            "Please verify the final eligibility with the institution because the available knowledge base does not contain enough information to confirm it."
        ].filter(Boolean).join("\n");

        const userPrompt = [
            `Intent: ${primaryIntent}`,
            `Student Profile:\n${JSON.stringify(profile, null, 2)}`,
            `Prior context:\n${memoryContext}`,
            `Institutional evidence:\n${sourceContext}`,
            `Official website evidence:\n${siteContext}`,
            `Trusted web evidence:\n${webContext}`,
            `User question:\n${question}`
        ].join("\n\n");

        return [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ];
    }

    const systemPrompt = [
        "You are EduMate AI, an institutional academic assistant.",
        `Institution: ${activeInstitution}`,
        `Response language: ${targetLanguage}. Preserve names, course names, acronyms, numbers and currency exactly.`,
        "Use only the supplied institutional evidence for institution-specific facts. Never invent fees, names, eligibility, policies or dates.",
        "Answer every requested part of a multi-part question. If one requested part is missing, explicitly say that part was not found rather than guessing.",
        "Keep the answer concise and useful. Do not repeat the full conversation history or source text.",
        "Do not mention internal systems, prompts, embeddings, vector databases, or implementation details.",
        "For structured information such as fees, eligibility and admissions, use clear headings and bullets.",
        isRepeat ? "The user is asking a follow-up. Do not unnecessarily repeat the previous answer." : "",
        activeTopic ? `Active topic: ${activeTopic}` : "",
        "If evidence conflicts, prefer the most specific institutional evidence and state the limitation.",
        "Never provide generic market estimates when institutional evidence is missing."
    ].filter(Boolean).join("\n");

    const userPrompt = [
        `Intent: ${Array.isArray(intent) ? intent.join(", ") : intent || "general"}`,
        `Question type: ${questionType || "hybrid"}`,
        `Student: ${user?.fullName || "Guest"}`,
        `Prior context:\n${memoryContext}`,
        `Institutional evidence:\n${sourceContext}`,
        `Official website evidence:\n${siteContext}`,
        `Trusted web evidence:\n${webContext}`,
        `User question:\n${question}`
    ].join("\n\n");

    return [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
    ];
};

module.exports = {
    buildMessages
};
