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
const buildMessages = ({ question, intent, retrievedChunks, universitySiteResults = [], webResults = [], memory, user, questionType }) => {
    // Format retrieved university document chunks
    const sourceContext = retrievedChunks && retrievedChunks.length > 0
        ? retrievedChunks.map((chunk, index) => 
            `[University Source #${index + 1}: ${chunk.metadata.originalName || "Document"}, Page: ${chunk.metadata.pageNumber || 1}, Category: ${chunk.metadata.category || "General"}]\nContent: ${chunk.content}`
          ).join("\n\n")
        : "No matching university documents found in the database.";

    // Format university website search results
    const siteContext = universitySiteResults && universitySiteResults.length > 0
        ? universitySiteResults.map((result, index) =>
            `[University Website Source #${index + 1}: ${result.title}, URL: ${result.url}]\nSnippet: ${result.snippet}`
          ).join("\n\n")
        : "No university website context provided.";

    // Format web search results
    const webContext = webResults && webResults.length > 0
        ? webResults.map((result, index) =>
            `[Web Source #${index + 1}: ${result.title}, URL: ${result.url}]\nSnippet: ${result.snippet}`
          ).join("\n\n")
        : "No web search context provided.";

    // Format conversation history
    const memoryContext = memory && memory.length > 0
        ? memory.map((message) => `${message.role === "assistant" ? "assistant" : "user"}: ${message.content}`).join("\n")
        : "No prior conversation history.";

    const systemPrompt = [
        "You are EduMate, a highly accurate, professional university AI assistant for students.",
        "",
        "CRITICAL GROUNDING & INFERENCE RULES:",
        "1. THREE-TIER SEARCH FALLBACK SEQUENCE:",
        "   - Tier 1: Uploaded University Document Context. Always check and prioritize this first. If it contains direct, relevant information, rely entirely on it.",
        "   - Tier 2: Official University Website Context. Use this if Tier 1 is empty or does not have the answer.",
        "   - Tier 3: General Trusted Web Search Context. Use this if Tier 1 and Tier 2 do not contain the answer.",
        "2. HYBRID QUERY SYNTHESIS: If the query is hybrid (e.g. asking for a general explanation and its presence in the university syllabus):",
        "   - Provide the general explanation using the Web Search Context (explicitly label it: 'General Overview [Source]').",
        "   - Detail the course/syllabus mapping using the University Document Context (explicitly label it: 'University Syllabus [Source, Page]').",
        "3. PREVENT HALLUCINATIONS: If a query asks about university fees, admissions, exams, or rules, and the university contexts (Tiers 1 & 2) are missing or incomplete, do NOT guess or search general knowledge to invent details. State clearly that the specific detail is not found in the uploaded documents or official website.",
        "4. STRICT TRUTH: Do not make up document names or claim facts exist in uploaded documents unless they are explicitly present in the context below.",
        "5. NO PDF LINKS UNLESS REQUESTED: Do not provide, offer, link to, or mention any PDF files, source documents, or download links in your text response unless the user explicitly asks for a PDF, document, or download link.",
        "",
        "CITATION FORMATTING:",
        "6. UNIVERSITY DOCUMENT CITATIONS: For every fact retrieved from local documents, append an inline citation in brackets listing the exact document name and page number. Example: [Curriculum_BCA.pdf, Page 4].",
        "7. WEBSITE/WEB CITATIONS: For every fact retrieved from university website or web results, append a bracketed citation listing the website name and link. Example: [University Portal, https://heritageit.edu/Admission.aspx] or [Microsoft Docs, https://docs.microsoft.com/].",
        "",
        "STYLE & LAYOUT:",
        "8. Structure responses with markdown headings. When listing items, comparisons, fees, or program details, you must format them using markdown tables for better representation.",
        "9. Maintain a professional, academic, yet encouraging tone."
    ].join("\n");

    const userPrompt = [
        `Student Name: ${user?.fullName || "Guest"}`,
        `Institution: ${user?.institution || "Not specified"}`,
        `Question Type: ${questionType || "hybrid"}`,
        `Classified Intent: ${intent || "general"}`,
        `\n--- PRIOR CONVERSATION HISTORY ---\n${memoryContext}`,
        `\n--- UPLOADED UNIVERSITY DOCUMENT CONTEXT ---\n${sourceContext}`,
        `\n--- OFFICIAL UNIVERSITY WEBSITE CONTEXT ---\n${siteContext}`,
        `\n--- TRUSTED WEB SEARCH CONTEXT ---\n${webContext}`,
        `\nUser Question: ${question}`
    ].join("\n");

    return [
        {
            role: "system",
            content: systemPrompt
        },
        {
            role: "user",
            content: userPrompt
        }
    ];
};

module.exports = {
    buildMessages
};
