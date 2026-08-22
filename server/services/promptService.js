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

    let sourceContext = "No matching university documents found in the database.";
    
    if (retrievedChunks && retrievedChunks.length > 0) {
        const docsMap = {};
        // Maximum 4-6 chunks (slice to 6)
        retrievedChunks.slice(0, 6).forEach((chunk) => {
            const docId = chunk.metadata?.documentId || chunk.metadata?.originalName || "Unknown Doc";
            if (!docsMap[docId]) {
                docsMap[docId] = {
                    title: chunk.metadata?.originalName || chunk.metadata?.filename || "Unknown Document",
                    category: chunk.metadata?.category || "General",
                    chunks: []
                };
            }
            docsMap[docId].chunks.push(chunk);
        });
        
        const docContexts = [];
        for (const docId of Object.keys(docsMap)) {
            const doc = docsMap[docId];
            
            // Sort chunks by page number
            doc.chunks.sort((a, b) => (a.metadata?.pageNumber || 0) - (b.metadata?.pageNumber || 0));
            
            let mergedContent = "";
            const seenParagraphs = new Set();
            
            doc.chunks.forEach((chunk) => {
                const paragraphs = String(chunk.content || "").split(/\n\s*\n+/);
                paragraphs.forEach((para) => {
                    const cleanPara = para.trim().toLowerCase().replace(/\s+/g, " ");
                    if (!cleanPara) return;
                    
                    let isDup = false;
                    for (const seen of seenParagraphs) {
                        if (seen === cleanPara || (seen.length > 50 && (seen.includes(cleanPara) || cleanPara.includes(seen)))) {
                            isDup = true;
                            break;
                        }
                    }
                    
                    if (!isDup) {
                        seenParagraphs.add(cleanPara);
                        mergedContent += (mergedContent ? "\n\n" : "") + para.trim();
                    }
                });
            });
            
            const pages = Array.from(new Set(doc.chunks.map(c => c.metadata?.pageNumber).filter(Boolean)));
            const pageStr = pages.length > 0 ? `, Page(s): ${pages.sort((a, b) => a - b).join(", ")}` : "";
            
            docContexts.push(`[Source Document: ${doc.title}${pageStr}, Category: ${doc.category}]\n${mergedContent}`);
        }
        
        // Preserve source ordering and build text
        let joinedContext = docContexts.join("\n\n");
        
        // Limit to 1400 tokens (approx 5600 characters)
        const maxContextChars = 1400 * 4; // 1400 tokens * 4 chars/token = 5600 chars
        if (joinedContext.length > maxContextChars) {
            joinedContext = joinedContext.slice(0, maxContextChars) + "\n... [Context truncated to fit token limits]";
        }
        sourceContext = joinedContext;
    }

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

    let systemPrompt = [
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
        "Never provide generic market estimates when institutional evidence is missing.",
        "Examine ALL retrieved chunks collectively to answer the question. Do not treat a single incomplete chunk as the complete truth or assume information does not exist just because one chunk does not contain it.",
        "If a retrieved chunk states 'information not found' or is silent on a topic (such as fees), it only means that particular chunk is incomplete. Look at other retrieved chunks to find the answer. Only conclude that information is not available if none of the provided chunks contain it.",
        "Do not use conversation history (Prior context) to pull HOD names, room numbers, or course details for the current query unless they are explicitly present in the current `Institutional evidence`."
    ].filter(Boolean).join("\n");

    const checkIntent = Array.isArray(intent) ? intent[0] : intent;
    if (checkIntent === "location" || checkIntent === "campus_navigation" || checkIntent === "Campus Navigation") {
        systemPrompt += `\n\n## CAMPUS LOCATION RULES (CRITICAL):
1. The response for a successful location query must follow this exact format:
   Building [Number] ([Building Name] - e.g. "Ravindra Bhavan" instead of "Ravindra Bhavan Ground 001". Remove any floor/room location suffixes from the building name itself)
   [Floor]
   Room [Room Number]

   [requested room/person/department details, e.g. HOD of CSS:\\nDr. Jayanta Aich, or Room details:\\nHOD of CSS\\nDr. Jayanta Aich]

   Make sure there is exactly one blank line before the requested details.
   Do NOT add any extra text, preambles, or pleasantries. Only output the structured location format directly.
2. If multiple distinct locations, departments, or HODs match (e.g. user asks "Where is HOD?" and multiple HODs exist), you MUST ask to clarify:
   "Which department are you looking for? Which HOD do you mean — [List the matching departments/roles]?"
   Do not guess.
3. If the exact location is NOT found in the retrieved chunks, you MUST say exactly:
   "I couldn't find the exact location in the Campus Navigation data."
   Do NOT invent or guess a room number.`;
    }

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
