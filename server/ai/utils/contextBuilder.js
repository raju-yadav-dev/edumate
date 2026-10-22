const AI_CONSTANTS = require("../constants/aiConstants");
const { countTokens } = require("./tokenizer");
const { parseChunkRecords } = require("../services/entityGroundingService");

/**
 * EduMate Task 9 — Smart Context Builder
 * 
 * Cleans, deduplicates, merges contiguous section chunks, and constructs
 * structured, hierarchy-preserving context under adaptive token budgets.
 */

// Common header / footer patterns across university documents
const HEADER_FOOTER_PATTERNS = [
    /^\s*page\s+\d+\s+(?:of\s+\d+)?\s*$/gim,
    /^\s*[-–—_]{2,}\s*page\s+\d+\s*(?:of\s+\d+)?\s*[-–—_]{2,}\s*$/gim,
    /^\s*[-–—_]{0,4}\s*(?:confidential|draft|internal\s+use\s+only)(?:\s+draft)?\s*[-–—_]{0,4}\s*$/gim,
    /^\s*[-–—_]{0,4}\s*(?:brainware\s+university|university\s+handbook|prospectus\s+\d{4}[-–]\d{4})\s*[-–—_]{0,4}\s*$/gim,
    /^\s*printed\s+on\s*:\s*\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b.*$/gim,
    /^\s*©\s*\d{4}\s*[^,\n]+.*$/gim
];

// OCR noise and garbage patterns
const OCR_NOISE_PATTERNS = [
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFD]/g, // unprintable control & replacement characters
    /(?:[~^`§¬]{2,})/g, // orphan OCR symbol clusters
    /[.]{5,}/g, // excessive periods / dot leaders
    /[_]{5,}/g // excessive underscores
];

/**
 * Strips OCR noise and broken glyphs while preserving valid markdown, tables, bullets, and accents.
 */
const cleanOcrNoise = (text) => {
    if (!text || typeof text !== "string") return "";
    let cleaned = text;

    for (const pattern of OCR_NOISE_PATTERNS) {
        cleaned = cleaned.replace(pattern, " ");
    }

    // Normalize multiple spaces within a line while preserving linebreaks
    cleaned = cleaned
        .split("\n")
        .map(line => line.replace(/[ \t]{2,}/g, " ").trimEnd())
        .join("\n");

    return cleaned;
};

/**
 * Strips recurring page headers, page numbers, and footer watermarks.
 */
const cleanHeadersAndFooters = (text) => {
    if (!text || typeof text !== "string") return "";
    let cleaned = text;

    for (const pattern of HEADER_FOOTER_PATTERNS) {
        cleaned = cleaned.replace(pattern, "");
    }

    // Collapse 3+ consecutive newlines to double newline
    return cleaned.replace(/\n{3,}/g, "\n\n").trim();
};

/**
 * Normalizes paragraph for deduplication comparison.
 */
const normalizeParagraphForDedupe = (p) => {
    return p
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .trim();
};

/**
 * Removes duplicate paragraphs and repetitive sentences.
 */
const deduplicateParagraphs = (text) => {
    if (!text || typeof text !== "string") return "";

    const lines = text.split("\n");
    const resultLines = [];
    const seenParagraphs = new Set();

    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Preserve tables verbatim (lines starting/containing '|')
        if (trimmed.startsWith("|") || trimmed.includes(" | ") || /^[\s|+-]{4,}$/.test(trimmed)) {
            inTable = true;
            resultLines.push(line);
            continue;
        } else {
            inTable = false;
        }

        // Preserve bullet lists and numbered lists verbatim
        if (/^[-*•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
            const sig = normalizeParagraphForDedupe(trimmed);
            if (sig.length > 15 && seenParagraphs.has(sig)) {
                continue; // Skip exact duplicate bullet point
            }
            if (sig.length > 15) seenParagraphs.add(sig);
            resultLines.push(line);
            continue;
        }

        if (trimmed.length === 0) {
            resultLines.push(line);
            continue;
        }

        const sig = normalizeParagraphForDedupe(trimmed);
        if (sig.length > 25) {
            if (seenParagraphs.has(sig)) {
                continue; // Deduplicate repeated paragraph
            }
            seenParagraphs.add(sig);
        }

        resultLines.push(line);
    }

    return resultLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
};

/**
 * Cleans a single chunk's raw content.
 */
const cleanChunkText = (content) => {
    let text = String(content || "");
    text = cleanOcrNoise(text);
    text = cleanHeadersAndFooters(text);
    text = deduplicateParagraphs(text);
    return text;
};

/**
 * Determines the adaptive token context budget based on query complexity.
 */
const determineAdaptiveBudget = (question, queryPlan) => {
    const q = String(question || "").toLowerCase();
    const words = q.trim().split(/\s+/).filter(Boolean);

    // 1. Small direct factual questions take priority (who is, where is, when was, which room, hod of, head of, etc.)
    const isDirectFact = (
        q.startsWith("who ") ||
        q.startsWith("where ") ||
        q.startsWith("when ") ||
        q.startsWith("which room") ||
        q.startsWith("what is the name") ||
        q.startsWith("who's") ||
        q.includes("hod") ||
        q.includes("head of") ||
        q.includes("phone number") ||
        q.includes("contact number") ||
        q.includes("email") ||
        queryPlan?.intent === "HOD_QUERY" ||
        queryPlan?.intent === "LOCATION_QUERY"
    );

    if (isDirectFact && words.length < 14) {
        return {
            type: "SMALL_FACTUAL",
            minTokens: 150,
            maxTokens: 350,
            targetTokens: 250,
            description: "Small factual question (150–350 tokens)"
        };
    }

    // 2. Large informational question (900–1400 tokens)
    if (
        words.length >= 14 ||
        /\b(?:compare|comparison|versus|vs\.?|difference|complete\s+guide|full\s+overview|everything\s+about|all\s+details|handbook|comprehensive|all\s+courses|entire\s+syllabus|curriculum)\b/i.test(q) ||
        queryPlan?.queryType === "Comparison" ||
        queryPlan?.queryType === "Summary"
    ) {
        return {
            type: "LARGE_INFORMATIONAL",
            minTokens: 900,
            maxTokens: 1400,
            targetTokens: 1300,
            description: "Large informational question (900–1400 tokens)"
        };
    }

    // 3. Medium question (400–650 tokens)
    if (
        words.length >= 7 ||
        queryPlan?.intent === "FEE_QUERY" ||
        queryPlan?.intent === "ADMISSION_QUERY" ||
        queryPlan?.intent === "FACULTY_QUERY" ||
        queryPlan?.intent === "HOSTEL_QUERY" ||
        queryPlan?.intent === "PLACEMENT_QUERY" ||
        queryPlan?.intent === "SCHOLARSHIP_QUERY" ||
        /\b(?:fees?|admission|eligibility|faculty|professors|hostel|placement|scholarship|criteria|process|steps|procedure|requirements?)\b/i.test(q)
    ) {
        return {
            type: "MEDIUM",
            minTokens: 350,
            maxTokens: 650,
            targetTokens: 500,
            description: "Medium question (350–650 tokens)"
        };
    }

    // 3. Small factual question (250–400 tokens)
    return {
        type: "SMALL_FACTUAL",
        minTokens: 250,
        maxTokens: 400,
        targetTokens: 380,
        description: "Small factual question (250–400 tokens)"
    };
};

/**
 * Merges consecutive chunks belonging to the same section, preserving:
 * - Heading hierarchy
 * - Page order
 * - Markdown & ASCII tables
 * - Bullet lists & numbered lists
 */
const mergeConsecutiveSectionChunks = (chunks) => {
    if (!Array.isArray(chunks) || chunks.length === 0) return [];

    // Group chunks by documentId
    const documentGroups = new Map();

    chunks.forEach((chunk, index) => {
        const metadata = chunk.metadata || {};
        const documentId = String(metadata.documentId || metadata.sourceDocumentId || metadata.originalName || `doc-${index}`);

        if (!documentGroups.has(documentId)) {
            documentGroups.set(documentId, {
                documentId,
                firstIndex: index,
                title: metadata.originalName || metadata.filename || "Institutional Document",
                category: metadata.category || "",
                department: metadata.department || "",
                chunks: []
            });
        }
        documentGroups.get(documentId).chunks.push(chunk);
    });

    const structuredBlocks = [];

    for (const docGroup of documentGroups.values()) {
        // Sort chunks by page number, sectionOrder, and chunkOrder
        const sortedChunks = docGroup.chunks.slice().sort((a, b) => {
            const aPage = Number(a.metadata?.pageNumber || a.metadata?.page || 1);
            const bPage = Number(b.metadata?.pageNumber || b.metadata?.page || 1);
            if (aPage !== bPage) return aPage - bPage;

            const aOrder = Number(a.metadata?.sectionOrder || a.metadata?.chunkOrder || a.metadata?.chunkIndex || 0);
            const bOrder = Number(b.metadata?.sectionOrder || b.metadata?.chunkOrder || b.metadata?.chunkIndex || 0);
            return aOrder - bOrder;
        });

        // Merge consecutive chunks belonging to the same section
        const mergedSections = [];

        for (const chunk of sortedChunks) {
            let rawCleaned = cleanChunkText(chunk.content);
            if (!rawCleaned) continue;

            // Preserve and demarcate individual records within multi-record chunks generically (Requirement 2 & 3)
            try {
                const parsed = parseChunkRecords(chunk);
                const roomRecords = parsed.filter(r => r.room);
                const isTable = String(chunk.content || "").includes("|");
                // Only format as discrete record bullets if the chunk is specifically a multi-room directory listing or table
                if (roomRecords.length >= 2 || (isTable && parsed.length >= 2)) {
                    const formattedRecords = parsed.map(rec => {
                        const parts = [];
                        if (rec.room) parts.push(`Room: ${rec.room}`);
                        parts.push(`Entity: ${rec.entity || rec.subject || rec.text}`);
                        if (rec.floor) parts.push(`Floor: ${rec.floor}`);
                        if (rec.department) parts.push(`Department: ${rec.department}`);
                        if (rec.building) parts.push(`Building: ${rec.building}`);
                        if (rec.attributes) {
                            for (const [k, v] of Object.entries(rec.attributes)) {
                                if (!["room", "floor", "building", "department", "entity", "subject"].includes(k) && v) {
                                    parts.push(`${k}: ${v}`);
                                }
                            }
                        }
                        return `• ${parts.join(" | ")}`;
                    });
                    rawCleaned = formattedRecords.join("\n");
                }
            } catch (_) {}

            const meta = chunk.metadata || {};
            const sectionKey = String(meta.parentSection || meta.heading || meta.sectionPath || "General Section").trim();
            const pageNum = Number(meta.pageNumber || meta.page || 1);

            const previous = mergedSections[mergedSections.length - 1];

            // Check if previous chunk belongs to the same section in the same document
            const isSameSection = previous && previous.sectionKey.toLowerCase() === sectionKey.toLowerCase();
            const isAdjacentOrLinked = previous && (
                previous.nextChunkId === chunk.id ||
                meta.previousChunkId === previous.lastChunkId ||
                Math.abs(pageNum - previous.lastPage) <= 1
            );

            if (previous && isSameSection && (isAdjacentOrLinked || previous.pages.has(pageNum))) {
                // Merge content cleanly
                const prevContent = previous.content.trim();
                const newContent = rawCleaned.trim();

                // Preserve tables if splitting across chunk boundaries
                let combinedText;
                if (prevContent.includes("|") && newContent.startsWith("|")) {
                    combinedText = `${prevContent}\n${newContent}`;
                } else {
                    combinedText = `${prevContent}\n\n${newContent}`;
                }

                previous.content = deduplicateParagraphs(combinedText);
                previous.pages.add(pageNum);
                previous.lastPage = pageNum;
                previous.lastChunkId = chunk.id;
                previous.nextChunkId = meta.nextChunkId || null;
            } else {
                mergedSections.push({
                    documentTitle: docGroup.title,
                    category: meta.category || docGroup.category,
                    department: meta.department || docGroup.department,
                    parentSection: meta.parentSection || "General",
                    heading: meta.heading || meta.parentHeading || sectionKey,
                    sectionKey,
                    sectionPath: meta.sectionPath || `${docGroup.category || "General"} > ${sectionKey}`,
                    pages: new Set([pageNum]),
                    lastPage: pageNum,
                    firstChunkId: chunk.id,
                    lastChunkId: chunk.id,
                    nextChunkId: meta.nextChunkId || null,
                    content: rawCleaned,
                    score: chunk.score || chunk.combinedScore || 0
                });
            }
        }

        // Format structured blocks with clear heading hierarchy
        for (const section of mergedSections) {
            const pagesList = Array.from(section.pages).sort((a, b) => a - b);
            const pagesStr = pagesList.length > 1
                ? `${pagesList[0]}–${pagesList[pagesList.length - 1]}`
                : `${pagesList[0] || 1}`;

            const headerParts = [`Document: ${section.documentTitle}`];
            if (section.category) headerParts.push(`Category: ${section.category}`);
            if (section.department) headerParts.push(`Department: ${section.department}`);
            if (section.parentSection && section.parentSection !== "General") headerParts.push(`Section: ${section.parentSection}`);
            if (section.heading) headerParts.push(`Heading: ${section.heading}`);
            headerParts.push(`Page(s): ${pagesStr}`);

            const headerLine = `[${headerParts.join(" | ")}]`;
            const blockText = `${headerLine}\n${section.content.trim()}`;

            structuredBlocks.push({
                firstIndex: docGroup.firstIndex,
                score: section.score,
                tokens: countTokens(blockText),
                text: blockText
            });
        }
    }

    // Sort structured blocks by relevance score / appearance
    structuredBlocks.sort((a, b) => b.score - a.score);
    return structuredBlocks;
};

/**
 * Builds clean, structured, hierarchy-preserving context under an adaptive token budget.
 * 
 * @param {Array<Object>} retrievedChunks - Ranked candidate chunks
 * @param {Object} options
 * @param {string} options.question - The user query
 * @param {Object} [options.queryPlan] - Output from Query Planner
 * @param {number} [options.maxContextTokens] - Upper limit override
 * @returns {string} - Formatted context ready for LLM prompt
 */
const buildSmartContext = (retrievedChunks, { question = "", queryPlan = null, maxContextTokens = null } = {}) => {
    if (!Array.isArray(retrievedChunks) || retrievedChunks.length === 0) {
        return "No matching university documents found in the database.";
    }

    // 1. Determine Adaptive Context Budget
    const adaptiveRule = determineAdaptiveBudget(question, queryPlan);
    const configuredMax = Number(process.env.RAG_MAX_CONTEXT_TOKENS) || 4000;
    const tokenCeiling = maxContextTokens
        ? Math.min(maxContextTokens, configuredMax)
        : Math.min(adaptiveRule.maxTokens, configuredMax);

    console.log(`[Smart Context Builder] Question: "${question}" | Adaptive Rule: ${adaptiveRule.description} | Token Budget: ${tokenCeiling}`);

    // 2. Merge consecutive chunks belonging to the same section
    const structuredBlocks = mergeConsecutiveSectionChunks(retrievedChunks);

    // 3. Assemble blocks strictly within the adaptive token budget
    let accumulatedTokens = 0;
    const selectedBlocks = [];

    for (const block of structuredBlocks) {
        const blockTokens = block.tokens || countTokens(block.text);

        if (selectedBlocks.length > 0 && (accumulatedTokens + blockTokens > tokenCeiling)) {
            // Reached budget limit
            break;
        }

        selectedBlocks.push(block.text);
        accumulatedTokens += blockTokens;

        if (accumulatedTokens >= adaptiveRule.targetTokens && selectedBlocks.length >= 2) {
            break;
        }
    }

    const finalContext = selectedBlocks.join("\n\n");
    console.log(`[Smart Context Builder] Final Context Tokens: ${countTokens(finalContext)} | Blocks: ${selectedBlocks.length}`);

    return finalContext || "No matching university documents found in the database.";
};

module.exports = {
    cleanOcrNoise,
    cleanHeadersAndFooters,
    deduplicateParagraphs,
    determineAdaptiveBudget,
    mergeConsecutiveSectionChunks,
    buildSmartContext
};
