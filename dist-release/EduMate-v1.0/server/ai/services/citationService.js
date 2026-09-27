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
const formatCitations = (retrievedChunks = [], universitySiteResults = [], webResults = []) => {
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
            const sectionName = metadata.heading || metadata.parentSection || metadata.sectionPath || "General Section";
            const docKey = `${docId}::${sectionName}`;
            
            if (!docGroups[docKey]) {
                const categoryClean = metadata.category ? String(metadata.category).replace(/_/g, " ") : "General";
                const docTitle = metadata.originalName || metadata.filename || "University Document";

                docGroups[docKey] = {
                    documentTitle: docTitle,
                    title: docTitle,
                    documentId: docId,
                    id: docId,
                    pages: new Set(),
                    category: categoryClean,
                    department: metadata.department || "",
                    sectionHeading: sectionName,
                    section: sectionName,
                    sectionPath: metadata.sectionPath || `${categoryClean} > ${sectionName}`,
                    maxScore: 0,
                    snippets: [],
                    firstSeenRank: chunkIndex,
                    downloadUrl: chunk.downloadUrl || metadata.downloadUrl || "",
                    metadata: {
                        documentId: docId,
                        category: categoryClean,
                        sectionHeading: sectionName,
                        section: sectionName,
                        department: metadata.department || "",
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

            if (chunk.content && docGroups[docKey].snippets.length < 3) {
                const cleanSnippet = String(chunk.content).replace(/^[#\s|+-]+/gm, "").slice(0, 200).trim();
                if (cleanSnippet && !docGroups[docKey].snippets.includes(cleanSnippet)) {
                    docGroups[docKey].snippets.push(cleanSnippet);
                }
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

    return unique;
};

module.exports = {
    formatCitations,
    buildPreviewUrl
};
