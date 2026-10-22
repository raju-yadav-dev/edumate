/**
 * EduMate Mission 5 — Professional Citation Engine
 * 
 * Requirements:
 * 1. Every RAG answer includes structured citations.
 *    Each citation contains:
 *    - documentTitle
 *    - category
 *    - department
 *    - pageNumber
 *    - sectionHeading
 *    - documentId
 * 
 * 2. Citation Rules:
 *    - Merge duplicate citations.
 *    - Sort citations by page order.
 *    - Preserve source order used in answer generation.
 *    - Link citations to document preview endpoint.
 * 
 * 3. Frontend Support:
 *    - Return citations separately from answer text.
 *    - Never embed raw citation JSON inside the answer.
 */

const { extractQueryTarget, parseChunkRecords, findBestMatchingRecord } = require("./entityGroundingService");

/**
 * Builds standard document preview URL
 */
const buildPreviewUrl = (documentId, pageNumber = 1) => {
    if (!documentId) return "";
    return `/api/documents/${documentId}/preview?page=${pageNumber || 1}`;
};

/**
 * Formats retrieved chunks into clean, deduplicated, and merged citation source objects.
 * 
 * @param {Array<Object>} retrievedChunks - Raw or reranked chunks from vector DB
 * @param {Array<Object>} universitySiteResults - University website crawl results
 * @param {Array<Object>} webResults - General web results
 * @returns {Array<Object>} - Formatted, merged, and sorted citation objects
 */
const formatCitations = (retrievedChunks = [], universitySiteResults = [], webResults = [], answerText = "", query = "") => {
    const citations = [];

    if (Array.isArray(retrievedChunks) && retrievedChunks.length > 0) {
        const docGroups = {};

        retrievedChunks.forEach((chunk, chunkIndex) => {
            const metadata = chunk.metadata || {};
            
            // Check if chunk is a crawled webpage
            const isCrawledWeb = metadata.uploadedFrom === "crawler" || 
                metadata.sourceUrl || 
                (metadata.originalName && metadata.originalName.startsWith("[Webpage]"));
            
            if (isCrawledWeb) {
                const url = metadata.sourceUrl || "";
                let domain = "University Website";
                try {
                    if (url) {
                        domain = new URL(url).hostname;
                    }
                } catch {}

                const docTitle = metadata.originalName || "University Page";
                const pageNum = Number(metadata.pageNumber || metadata.page) || 1;
                const section = metadata.heading || metadata.parentSection || "Official Webpage";
                const cat = metadata.category ? String(metadata.category).replace(/_/g, " ") : "Website";
                const dept = metadata.department || "";
                const docId = String(metadata.documentId || metadata.sourceDocumentId || chunk.id || "");

                citations.push({
                    type: "university_website",
                    documentTitle: docTitle,
                    title: docTitle,
                    category: cat,
                    department: dept,
                    pageNumber: pageNum,
                    page: pageNum,
                    pages: [pageNum],
                    sectionHeading: section,
                    section: section,
                    documentId: docId,
                    id: docId,
                    previewUrl: url || buildPreviewUrl(docId, pageNum),
                    downloadUrl: url || "",
                    reference: url || `Page ${pageNum} · ${section}`,
                    similarity: chunk.score !== undefined ? Math.max(0, Math.min(100, Math.round(chunk.score * 100))) : 100,
                    snippet: chunk.content ? String(chunk.content).slice(0, 240).trim() : "",
                    metadata: {
                        snippet: chunk.content || "",
                        domain,
                        category: cat,
                        pageNumber: pageNum,
                        sectionHeading: section,
                        section,
                        department: dept,
                        documentId: docId
                    }
                });
                return;
            }

            // Standard uploaded document grouping (keyed by documentId + sectionHeading)
            const docId = String(metadata.documentId || metadata.sourceDocumentId || metadata.originalName || `doc-${chunkIndex}`);
            const categoryClean = metadata.category ? String(metadata.category).replace(/_/g, " ") : "General";
            const docTitle = metadata.originalName || metadata.filename || "University Document";

            // Check if chunk contains multi-record facts and isolate the matched record
            const targetInfo = extractQueryTarget(query || answerText);
            const chunkRecords = parseChunkRecords(chunk);
            const matchedRecord = (chunkRecords.length > 0 && targetInfo.targetEntity)
                ? findBestMatchingRecord(chunkRecords, targetInfo.targetEntity, targetInfo.entityTokens)
                : null;

            let sectionName = metadata.heading || metadata.parentSection || metadata.sectionPath || "General Section";
            let deptName = metadata.department || "";
            let snippetText = chunk.content ? String(chunk.content).replace(/^[#\s|+-]+/gm, "").slice(0, 200).trim() : "";

            if (matchedRecord && (matchedRecord.room || matchedRecord.floor || matchedRecord.building)) {
                sectionName = matchedRecord.entity ? `${matchedRecord.room ? `${matchedRecord.room} ` : ""}${matchedRecord.entity}` : sectionName;
                deptName = matchedRecord.department || "";
                snippetText = matchedRecord.text || snippetText;
            }

            const docKey = `${docId}::${sectionName}`;
            
            if (!docGroups[docKey]) {
                const sectionPath = deptName ? `${categoryClean} → ${deptName} → ${sectionName}` : `${categoryClean} → ${sectionName}`;

                docGroups[docKey] = {
                    documentTitle: docTitle,
                    title: docTitle,
                    documentId: docId,
                    id: docId,
                    pages: new Set(),
                    category: categoryClean,
                    department: deptName,
                    sectionHeading: sectionName,
                    section: sectionName,
                    sectionPath,
                    maxScore: 0,
                    snippets: [],
                    rawContent: chunk.content || "",
                    firstSeenRank: chunkIndex,
                    downloadUrl: chunk.downloadUrl || metadata.downloadUrl || "",
                    metadata: {
                        documentId: docId,
                        category: categoryClean,
                        sectionHeading: sectionName,
                        section: sectionName,
                        department: deptName,
                        institution: metadata.institution || "",
                        similarity: 0
                    }
                };
            }
            
            const pageNum = Number(metadata.pageNumber || metadata.page || 1);
            if (pageNum) {
                docGroups[docKey].pages.add(pageNum);
            }
            
            const score = chunk.score !== undefined ? Math.max(0, Math.min(100, Math.round(chunk.score * 100))) : 100;
            if (score > docGroups[docKey].maxScore) {
                docGroups[docKey].maxScore = score;
            }

            if (chunk.downloadUrl && !docGroups[docKey].downloadUrl) {
                docGroups[docKey].downloadUrl = chunk.downloadUrl;
            }

            if (snippetText && docGroups[docKey].snippets.length < 3) {
                if (!docGroups[docKey].snippets.includes(snippetText)) {
                    docGroups[docKey].snippets.push(snippetText);
                }
            }
            if (chunk.content && !docGroups[docKey].rawContent.includes(chunk.content)) {
                docGroups[docKey].rawContent += "\n" + chunk.content;
            }
        });
        
        // Sort grouped citations: highest relevance score first (preserving generation source order), then first seen
        const sortedGroups = Object.values(docGroups).sort((a, b) => {
            if (b.maxScore !== a.maxScore) {
                return b.maxScore - a.maxScore;
            }
            return a.firstSeenRank - b.firstSeenRank;
        });

        sortedGroups.forEach(group => {
            // Rule 2: Sort pages by page order (ascending)
            const sortedPages = Array.from(group.pages).sort((a, b) => a - b);
            const primaryPage = sortedPages[0] || 1;
            const pageRef = sortedPages.length > 1 
                ? `Pages ${sortedPages.join(", ")}` 
                : `Page ${primaryPage}`;
                
            group.metadata.similarity = group.maxScore;
            group.metadata.pageNumber = primaryPage;
            group.metadata.pages = sortedPages;
            
            const previewUrl = group.downloadUrl || buildPreviewUrl(group.documentId, primaryPage);

            citations.push({
                type: "document",
                documentTitle: group.documentTitle,
                title: group.documentTitle,
                category: group.category,
                department: group.department,
                pageNumber: sortedPages.length > 1 ? sortedPages.join(", ") : primaryPage,
                page: sortedPages.join(", "),
                pages: sortedPages,
                sectionHeading: group.sectionHeading,
                section: group.sectionHeading,
                sectionPath: group.sectionPath,
                documentId: group.documentId,
                id: group.documentId,
                previewUrl,
                downloadUrl: group.downloadUrl || previewUrl,
                similarity: group.maxScore,
                reference: `${pageRef} · ${group.sectionHeading}`,
                snippet: group.snippets.join(" ... "),
                rawContent: group.rawContent || "",
                metadata: {
                    ...group.metadata,
                    previewUrl,
                    downloadUrl: group.downloadUrl || previewUrl
                }
            });
        });
    }

    if (Array.isArray(universitySiteResults) && universitySiteResults.length > 0) {
        universitySiteResults.forEach((result) => {
            let domain = "University Website";
            try {
                if (result.url) {
                    domain = new URL(result.url).hostname;
                }
            } catch {}

            const docTitle = result.title || "University Page";
            citations.push({
                type: "university_website",
                documentTitle: docTitle,
                title: docTitle,
                category: "Website",
                department: result.department || "",
                pageNumber: 1,
                page: 1,
                pages: [1],
                sectionHeading: "Official Webpage",
                section: "Official Webpage",
                documentId: result.url || "",
                id: result.url || "",
                previewUrl: result.url || "",
                downloadUrl: result.url || "",
                reference: result.url || "Official Webpage",
                similarity: 90,
                snippet: result.snippet || "",
                metadata: {
                    snippet: result.snippet || "",
                    domain,
                    category: "Website",
                    documentTitle: docTitle,
                    sectionHeading: "Official Webpage",
                    previewUrl: result.url || ""
                }
            });
        });
    }

    if (Array.isArray(webResults) && webResults.length > 0) {
        webResults.forEach((result) => {
            let domain = "Web";
            try {
                if (result.url) {
                    domain = new URL(result.url).hostname;
                }
            } catch {}

            const docTitle = result.title || "Web Resource";
            citations.push({
                type: "web",
                documentTitle: docTitle,
                title: docTitle,
                category: "Web",
                department: "",
                pageNumber: 1,
                page: 1,
                pages: [1],
                sectionHeading: "External Web",
                section: "External Web",
                documentId: result.url || "",
                id: result.url || "",
                previewUrl: result.url || "",
                downloadUrl: result.url || "",
                reference: result.url || "",
                similarity: 80,
                snippet: result.snippet || "",
                metadata: {
                    snippet: result.snippet || "",
                    domain,
                    category: "Web",
                    documentTitle: docTitle,
                    sectionHeading: "External Web",
                    previewUrl: result.url || ""
                }
            });
        });
    }

    // Rule 1: Merge and deduplicate citations by documentId, sectionHeading, and page
    const unique = [];
    const seen = new Set();

    for (const cite of citations) {
        const key = `${cite.type}-${cite.documentId || cite.title}-${cite.sectionHeading || cite.section}-${cite.pageNumber}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(cite);
        }
    }

    // Sort final list by similarity descending
    unique.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    // Rule 3: Show ONLY citations that support claims in the final answer (Requirement 6)
    if (answerText && typeof answerText === "string" && answerText.trim()) {
        return filterSupportingCitations(unique, answerText, query);
    }

    return unique;
};

/**
 * Filters formatted citations to retain ONLY those that actually support claims made in the final answer.
 * Does not display irrelevant chunks merely because they passed the retrieval threshold.
 * 
 * @param {Array<Object>} citations - Formatted citation objects
 * @param {string} answerText - The final generated answer text
 * @param {string} [query=""] - Optional original or rewritten query
 * @returns {Array<Object>} - Filtered citations with only verified supporting sources
 */
const filterSupportingCitations = (citations, answerText, query = "") => {
    if (!Array.isArray(citations) || citations.length === 0) return [];
    if (!answerText || typeof answerText !== "string" || !answerText.trim()) return [];

    const lowerAns = answerText.toLowerCase().trim();

    // If the answer is an explicit fallback / ungrounded message, no citations should be shown
    const isFallback = /\b(?:couldn'?t find|cannot find|no (?:matching )?information|not (?:found|mentioned|available) in (?:the )?(?:knowledge base|records|official documents))\b/i.test(lowerAns);
    if (isFallback) {
        return [];
    }

    // General-knowledge definition queries without institutional requirements return empty citations
    const isGeneralDef = /^(?:what\s+is|what\s+are|define|explain|meaning\s+of)\s+(?:a\s+|an\s+|the\s+)?([a-z0-9.]{2,10})\s*(\?|$)/i.test((query || "").trim()) &&
        !/\b(?:fee|fees|admission|eligibility|faculty|room|building|campus|notice|notices|library|schedule|hours|policy|rules|my\s+university|our\s+university|at\s+university|at\s+my\s+university)\b/i.test(query || "");
    if (isGeneralDef) {
        return [];
    }

    // Extract query entity target dynamically
    const queryTarget = extractQueryTarget(query || answerText);
    const targetEntity = queryTarget.targetEntity || "";
    const targetTokens = queryTarget.entityTokens || [];

    // Extract numbers / room numbers from answer (e.g. "101", "109", "205", "206")
    const roomNumberMatches = lowerAns.match(/\b([0-9]{3,4}[a-z]?)\b/g) || [];
    const extractedNumbers = new Set(
        roomNumberMatches.map(m => m.trim().toLowerCase()).filter(n => n.length >= 3)
    );

    // Extract buildings mentioned in answer (e.g. "Building I", "Building II", "Satyajit Bhavan", etc.)
    const buildingMatches = lowerAns.match(/\b(?:building\s+[ivx0-9]+|satyajit\s+bhavan)\b/gi) || [];
    const answerBuildings = new Set(buildingMatches.map(b => b.toLowerCase().trim()));

    // Filter citations
    const supportedCitations = citations.filter(cite => {
        const title = String(cite.documentTitle || cite.title || "").toLowerCase();
        const heading = String(cite.sectionHeading || cite.section || "").toLowerCase();
        const snippet = String(cite.snippet || "").toLowerCase();
        const rawContent = String(cite.rawContent || cite.content || "").toLowerCase();
        const fullSourceText = `${title} ${heading} ${snippet} ${rawContent}`.trim();

        // 1. If the answer claims specific room numbers (e.g. Room 206), verify that this citation actually contains that room
        if (extractedNumbers.size > 0) {
            let matchesCitedNumber = false;
            for (const num of extractedNumbers) {
                const numRegex = new RegExp(`\\b${num}\\b`, "i");
                if (numRegex.test(heading) || numRegex.test(snippet)) {
                    matchesCitedNumber = true;
                    break;
                }
            }

            // If the citation only contains a conflicting room number not in the answer, reject it
            const chunkRoomMatches = snippet.match(/\b([0-9]{3,4}[a-z]?)\b/g) || [];
            const hasConflictingRoomOnly = chunkRoomMatches.length > 0 &&
                chunkRoomMatches.every(cr => !extractedNumbers.has(cr.toLowerCase())) &&
                !matchesCitedNumber;

            if (hasConflictingRoomOnly) {
                return false;
            }

            if (matchesCitedNumber) {
                // If entity tokens exist, verify the citation is relevant to the target entity
                if (targetTokens.length > 0) {
                    const mentionsTarget = targetTokens.some(t => fullSourceText.includes(t));
                    if (mentionsTarget) return true;
                    return false;
                }
                return true;
            }
        }

        // 2. Check dynamic entity match
        if (targetEntity) {
            const matchesEntity = fullSourceText.includes(targetEntity) || 
                (targetTokens.length >= 2 && targetTokens.every(t => fullSourceText.includes(t)));
            if (matchesEntity) {
                return true;
            }
        }

        // 3. Check building alignment
        if (answerBuildings.size > 0) {
            const matchesBuilding = Array.from(answerBuildings).some(b => fullSourceText.includes(b));
            if (matchesBuilding && targetTokens.length > 0 && targetTokens.some(t => fullSourceText.includes(t))) {
                return true;
            }
        }

        // 4. Content overlap check for academic/informational questions (e.g. syllabus, criteria)
        const stopWords = new Set(["the", "and", "is", "in", "at", "of", "for", "to", "a", "an", "this", "that", "it", "room", "number", "building", "university", "official", "department", "college", "admission", "students", "student"]);
        const ansWords = lowerAns.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
        if (ansWords.length >= 4) {
            const matchedWords = ansWords.filter(w => fullSourceText.includes(w));
            // Require 55% word overlap AND at least 3 matched words to guard against
            // false positives from vocabulary shared across all university documents.
            if ((matchedWords.length / ansWords.length) >= 0.55 && matchedWords.length >= 3) {
                // Additional numeric grounding: if the answer contains specific numbers
                // (fees, counts, room numbers), verify at least one appears in the source.
                const ansNums = lowerAns.match(/\b\d[\d,]{2,}\b/g) || [];
                if (ansNums.length === 0) return true; // no numerics to verify
                const hasMatchingNum = ansNums.some(n => fullSourceText.includes(n.replace(/,/g, "")));
                return hasMatchingNum;
            }
        }

        return false;
    });

    // Deduplicate citations by documentId + pageNumber
    const uniqueCitations = [];
    const seenCites = new Set();
    for (const cite of supportedCitations) {
        const docKey = `${cite.documentId || cite.id || cite.documentTitle}-${cite.pageNumber || cite.page || 1}`;
        if (!seenCites.has(docKey)) {
            seenCites.add(docKey);
            uniqueCitations.push(cite);
        }
    }

    return uniqueCitations;
};

module.exports = {
    formatCitations,
    filterSupportingCitations,
    buildPreviewUrl
};
