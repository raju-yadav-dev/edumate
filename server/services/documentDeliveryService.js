const path = require("path");
const Document = require("../models/Document");
const SearchManager = require("../knowledge/SearchManager");
const llmService = require("../ai/services/llmService");
const DOCUMENT_KEYWORDS = /\b(document|documents|pdf|pdfs|file|files|official document|source document|official documents|source documents)\b/i;

/**
 * Generates download URL for the document.
 */
const getDocumentDownloadUrl = (doc) => {
    return `/api/documents/${doc._id}/download`;
};

/**
 * Calls LLM to check if the user is asking for a document and resolves the topic using conversation history.
 */
const analyzeDocumentRequest = async (question, historyText) => {
    const prompt = `You are a conversation analyzer for an educational chatbot.
Your task is to analyze the current user message and the preceding conversation history to determine if the user is explicitly requesting a physical document, file, PDF, or official document, and to extract/resolve the target document's topic.

Conversation history:
${historyText || "(No history)"}

Current user message:
"${question}"

Analyze the input and output a JSON object with the following fields:
- "isDocumentRequest": boolean. Set to true if the user is explicitly asking for a document/file/PDF/official document/source document in their current message. Set to false if they are asking a normal informational question (e.g. "What is the fee?"), even if it mentions a document in passing but is not asking to receive/download it.
- "documentTopic": string or null. The specific course, department, or topic of the requested document, resolved using the history context (e.g., "BCA fee", "Hostel Rules", "BCA admission"). If the user's message is a generic request like "give me the document" or "send the pdf", resolve the topic from the conversation history.
- "isAmbiguous": boolean. Set to true if the request refers to multiple potential documents or courses active in the conversation history (e.g., the user discussed both "BCA" and "B.Pharm", and then said "Give me the document").
- "ambiguousOptions": array of strings. If isAmbiguous is true, list the specific topics or documents the user needs to choose from.

Respond ONLY with a JSON object. No markdown formatting, no backticks, no other text.`;

    const messages = [
        { role: "system", content: "You are a JSON conversation analyzer." },
        { role: "user", content: prompt }
    ];

    try {
        const responseText = await llmService.generateCompletion(messages, { temperature: 0.1 });
        const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        return llmService.parseLlamaContent(cleaned);
    } catch (e) {
        console.error("[DocumentDelivery] LLM Intent Analysis failed:", e);
        return { isDocumentRequest: false, documentTopic: null, isAmbiguous: false, ambiguousOptions: [] };
    }
};

/**
 * Filter candidates using the LLM for strict relevance matching.
 */
const matchDocumentsWithLLM = async (documentTopic, docs, retrievedDocIds) => {
    if (!docs || docs.length === 0) return [];

    // Strip unnecessary fields like MongoDB _id and notes to prevent token bloat (under 6000 TPM limit)
    const docCandidates = docs.map((doc, idx) => ({
        index: idx,
        filename: doc.originalName,
        category: doc.category,
        institution: doc.institution,
        department: doc.department || "",
        hasRetrievedChunks: retrievedDocIds.has(doc._id.toString())
    }));

    const prompt = `You are a precise document retrieval verification system.
Your task is to select which Admin-uploaded documents from the list of candidates match the user's requested document topic/question: "${documentTopic}".

Candidate documents list:
${JSON.stringify(docCandidates, null, 2)}

Strict Selection Rules:
1. ONLY select a document if it is directly and highly relevant to the requested topic "${documentTopic}".
2. Matching must consider course (e.g., BCA, B.Pharm, BSc Digital Media), department, and topic (e.g., fee, admission, eligibility, guidelines).
3. If the user asks for a specific course fee document (e.g., "BCA fee document"), match a document like "Fee_Structure.pdf" or "Semester_Fees.pdf" only if it belongs to BCA category or if it contains BCA info, or "BCA_ Course Details, Course Fee, Eligibility and Admission 2026.pdf" because it explicitly covers BCA course fee.
4. Do NOT select similar but unrelated course documents. For example, if the user asks for "B.Pharm fee document" and we only have "BCA_ Course Details, Course Fee, Eligibility and Admission 2026.pdf" or "BA LLB 2026.pdf", do NOT select any of them, as they are for different courses.
5. If the request is for a general document like "Admission Calendar" or "Admission Guidelines", select the general "Admission_Calendar.pdf" or "Admission_Guidelines.pdf".
6. If no documents are relevant, return an empty array.

Return a JSON array of the indices (numbers) of the matching documents. Format:
[0, 2]

Respond ONLY with a JSON array of indices. No markdown formatting, no backticks, no other text.`;

    const messages = [
        { role: "system", content: "You are a JSON document matcher." },
        { role: "user", content: prompt }
    ];

    try {
        const responseText = await llmService.generateCompletion(messages, { temperature: 0.1 });
        const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        const indices = llmService.parseLlamaContent(cleaned);
        if (Array.isArray(indices)) {
            return indices.map(idx => docs[idx]).filter(Boolean);
        }
    } catch (e) {
        console.error("[DocumentDelivery] LLM document selection failed:", e);
    }
    return [];
};

/**
 * Handle document delivery request.
 * Returns a response object if a document request is detected, otherwise returns null.
 */
const handleDocumentDelivery = async ({ user, question, conversationId, parentId, historyText }) => {
    // 1. Quick regex guard to avoid running LLM on non-document questions
    if (!DOCUMENT_KEYWORDS.test(question)) {
        return null;
    }

    console.log(`[DocumentDelivery] Document request pattern detected. Running intent analysis...`);

    // 2. Classify intent and resolve context using LLM
    const analysis = await analyzeDocumentRequest(question, historyText);
    if (!analysis.isDocumentRequest) {
        console.log(`[DocumentDelivery] LLM determined this is NOT a document request.`);
        return null;
    }

    console.log(`[DocumentDelivery] Request analyzed: topic="${analysis.documentTopic}", ambiguous=${analysis.isAmbiguous}`);

    // 3. Handle Ambiguity
    if (analysis.isAmbiguous) {
        const optionsText = Array.isArray(analysis.ambiguousOptions) && analysis.ambiguousOptions.length > 0
            ? analysis.ambiguousOptions.map(opt => `- ${opt} document`).join("\n")
            : "";
        return {
            answer: `I found multiple possible documents in your context. Which one would you like?\n${optionsText}`,
            confidence: "medium",
            sources: [],
            sourceLabel: "📚 University Documents",
            topic: analysis.documentTopic
        };
    }

    const topic = analysis.documentTopic || question;

    // 4. Perform semantic search to find relevance indicators via chunks
    let retrievedDocIds = new Set();
    try {
        const localChunks = await SearchManager.searchLocalPdfs(topic, user, 10);
        localChunks.forEach(chunk => {
            if (chunk.metadata?.documentId) {
                retrievedDocIds.add(chunk.metadata.documentId.toString());
            }
        });
    } catch (err) {
        console.error("[DocumentDelivery] Local PDF search failed:", err.message);
    }

    // 5. Retrieve candidate documents from the Admin repository (metadata.uploadedFrom = "api")
    const activeAdminDocs = await Document.find({
        status: "active",
        "metadata.uploadedFrom": "api"
    }).lean();

    // 6. Filter candidate documents strictly down to those that matched chunks semantically
    const candidateDocs = activeAdminDocs.filter(doc => retrievedDocIds.has(doc._id.toString()));

    if (candidateDocs.length === 0) {
        console.log(`[DocumentDelivery] No semantic chunk matches found. Skipping LLM selection for topic "${topic}".`);
        return {
            answer: "No relevant Admin document was found for your request.",
            confidence: "low",
            sources: [],
            sourceLabel: "📚 University Documents",
            topic
        };
    }

    // 7. Match documents using the LLM for strict relevance check
    const matchedDocs = await matchDocumentsWithLLM(topic, candidateDocs, retrievedDocIds);

    // 8. No documents match
    if (matchedDocs.length === 0) {
        console.log(`[DocumentDelivery] No matching Admin documents found for topic "${topic}".`);
        return {
            answer: "No relevant Admin document was found for your request.",
            confidence: "low",
            sources: [],
            sourceLabel: "📚 University Documents",
            topic
        };
    }

    // 9. Found matching documents, generate download URLs
    const sources = [];
    const answerLines = ["These Admin documents match your request:\n"];

    for (let i = 0; i < matchedDocs.length; i++) {
        const doc = matchedDocs[i];
        const downloadUrl = getDocumentDownloadUrl(doc);
        
        answerLines.push(`${i + 1}. [${doc.originalName}](${downloadUrl})`);

        sources.push({
            type: "document",
            title: doc.originalName,
            reference: doc.storagePath,
            downloadUrl,
            metadata: {
                documentId: doc._id.toString(),
                originalName: doc.originalName,
                storagePath: doc.storagePath,
                mimeType: doc.mimeType,
                fileType: doc.mimeType.split("/")[1] || "pdf",
                institution: doc.institution,
                department: doc.department || "",
                category: doc.category,
                uploadedFrom: doc.metadata?.uploadedFrom || "api"
            }
        });
    }

    return {
        answer: answerLines.join("\n"),
        confidence: "high",
        sources,
        sourceLabel: "📚 University Documents",
        topic
    };
};

module.exports = {
    handleDocumentDelivery
};
