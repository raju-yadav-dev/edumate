const fs = require("fs");
const path = require("path");
const paths = require("../config/paths");
const localStorageManager = require("./localStorageManager");

// Dedicated directory for document chunks in external edumate-data/chunks/
const CHUNK_STORAGE_DIR = paths.CHUNKS_ROOT;

/**
 * Ensures that the chunk storage directory exists.
 */
function ensureChunkStorageRoot() {
    paths.ensureAllDirectories();
    if (!fs.existsSync(CHUNK_STORAGE_DIR)) {
        fs.mkdirSync(CHUNK_STORAGE_DIR, { recursive: true });
    }
    return CHUNK_STORAGE_DIR;
}

/**
 * Computes safe filepath for a document's chunks JSON file.
 */
function getChunkFilePath(documentId) {
    const safeDocId = String(documentId || "").replace(/[^a-zA-Z0-9_-]/g, "");
    return path.join(CHUNK_STORAGE_DIR, `${safeDocId}.chunks.json`);
}

/**
 * Saves all chunks of a document to local JSON storage.
 * Atomic write via temp file prevents corrupted chunk files on crash.
 */
async function saveDocumentChunks(documentId, chunks = [], docMeta = {}) {
    ensureChunkStorageRoot();
    const filePath = getChunkFilePath(documentId);
    const tempPath = `${filePath}.${Date.now()}.tmp`;

    const normalizedChunks = chunks.map((c, index) => {
        const chunkId = c.chunkId || c.metadata?.chunkId || `${documentId}_${index}`;
        return {
            chunkId,
            documentId: String(documentId),
            chunkIndex: c.chunkIndex !== undefined ? c.chunkIndex : (c.metadata?.chunkIndex ?? index),
            pageNumber: c.pageNumber || c.metadata?.pageNumber || 1,
            heading: c.heading || c.metadata?.heading || "Document",
            section: c.section || c.metadata?.section || "",
            parentHeading: c.parentHeading || c.metadata?.parentHeading || "Document",
            hierarchy: c.hierarchy || c.metadata?.hierarchy || [],
            keywords: c.keywords || c.metadata?.keywords || [],
            content: c.content || c.cleanedText || "",
            cleanedText: c.cleanedText || c.content || "",
            contentHash: c.contentHash || c.metadata?.contentHash || "",
            contentType: c.contentType || c.metadata?.contentType || "text",
            isOcr: c.isOcr || c.metadata?.isOcr || false,
            campusMeta: c.campusMeta || c.metadata?.campusMeta || null,
            metadata: {
                ...(c.metadata || {}),
                documentId: String(documentId),
                chunkId,
                chunkIndex: c.chunkIndex !== undefined ? c.chunkIndex : (c.metadata?.chunkIndex ?? index),
                pageNumber: c.pageNumber || c.metadata?.pageNumber || 1,
                heading: c.heading || c.metadata?.heading || "Document",
                section: c.section || c.metadata?.section || "",
                originalName: docMeta.originalName || c.metadata?.originalName || "",
                category: docMeta.category || c.metadata?.category || "",
                department: docMeta.department || c.metadata?.department || "",
                institution: docMeta.institution || c.metadata?.institution || ""
            }
        };
    });

    const payload = {
        documentId: String(documentId),
        originalName: docMeta.originalName || "",
        category: docMeta.category || "",
        chunkCount: normalizedChunks.length,
        updatedAt: new Date().toISOString(),
        chunks: normalizedChunks
    };

    const jsonString = JSON.stringify(payload, null, 2);
    fs.writeFileSync(tempPath, jsonString, "utf-8");
    fs.renameSync(tempPath, filePath);

    // Update Layer 5 Memory Cache
    try {
        const smartCacheHub = require("../services/cache/SmartCacheHub");
        smartCacheHub.l5.setDocumentChunks(documentId, payload.chunks, docMeta.category);
    } catch (_) {}

    return {
        success: true,
        documentId: String(documentId),
        chunkCount: normalizedChunks.length,
        filePath
    };
}

/**
 * Loads all chunks for a document from local storage with Layer 5 in-memory caching.
 */
function getDocumentChunks(documentId) {
    if (!documentId) return [];

    // Check Layer 5 Memory Cache first
    try {
        const smartCacheHub = require("../services/cache/SmartCacheHub");
        const cached = smartCacheHub.l5.getDocumentChunks(documentId);
        if (cached && Array.isArray(cached)) {
            return cached;
        }
    } catch (_) {}

    const filePath = getChunkFilePath(documentId);
    if (!fs.existsSync(filePath)) {
        return [];
    }

    try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        const chunks = Array.isArray(parsed.chunks) ? parsed.chunks : [];

        // Populate Layer 5 Cache
        try {
            const smartCacheHub = require("../services/cache/SmartCacheHub");
            smartCacheHub.l5.setDocumentChunks(documentId, chunks, parsed.category);
        } catch (_) {}

        return chunks;
    } catch (err) {
        console.error(`[LocalChunkManager] Error reading chunks for document ${documentId}:`, err.message);
        return [];
    }
}

/**
 * Loads a specific chunk by its chunkId for a document.
 */
function getChunk(documentId, chunkId) {
    if (!documentId || !chunkId) return null;

    // Check Layer 5 Single Chunk Cache
    try {
        const smartCacheHub = require("../services/cache/SmartCacheHub");
        const cached = smartCacheHub.l5.getChunk(documentId, chunkId);
        if (cached) return cached;
    } catch (_) {}

    const chunks = getDocumentChunks(documentId);
    return chunks.find(c => (c.chunkId === chunkId || c.id === chunkId || c.metadata?.chunkId === chunkId)) || null;
}

function getChunksByIds(chunkIdentifiers = [], docIds = []) {
    const results = [];
    if (!Array.isArray(chunkIdentifiers) || chunkIdentifiers.length === 0) {
        return results;
    }

    const docToChunkMap = new Map();
    const globalChunkIds = new Set();

    for (const item of chunkIdentifiers) {
        if (!item) continue;
        if (typeof item === "string") {
            globalChunkIds.add(item);
        } else if (typeof item === "object") {
            const cId = String(item.chunkId || item.id || "");
            const dId = String(item.documentId || item.docId || "");
            if (cId) {
                if (dId) {
                    if (!docToChunkMap.has(dId)) {
                        docToChunkMap.set(dId, new Set());
                    }
                    docToChunkMap.get(dId).add(cId);
                } else {
                    globalChunkIds.add(cId);
                }
            }
        }
    }

    // 1. Direct document lookups when documentIds were supplied
    for (const [docId, cIds] of docToChunkMap.entries()) {
        const docChunks = getDocumentChunks(docId);
        for (const chunk of docChunks) {
            if (cIds.has(String(chunk.chunkId))) {
                results.push(chunk);
            }
        }
    }

    // 2. Global search for unassigned chunkIds
    if (globalChunkIds.size > 0) {
        let searchDocIds = Array.isArray(docIds) && docIds.length > 0 ? docIds : [];
        if (searchDocIds.length === 0) {
            ensureChunkStorageRoot();
            try {
                const files = fs.readdirSync(CHUNK_STORAGE_DIR);
                searchDocIds = files
                    .filter(f => f.endsWith(".chunks.json"))
                    .map(f => f.replace(".chunks.json", ""));
            } catch {
                return results;
            }
        }

        for (const docId of searchDocIds) {
            const docChunks = getDocumentChunks(docId);
            for (const chunk of docChunks) {
                if (globalChunkIds.has(String(chunk.chunkId))) {
                    results.push(chunk);
                }
            }
        }
    }

    return results;
}

/**
 * Deletes all chunks for a document from local storage.
 */
async function deleteDocumentChunks(documentId) {
    // Invalidate Layer 5 cache
    try {
        const smartCacheHub = require("../services/cache/SmartCacheHub");
        smartCacheHub.l5.invalidateDocument(documentId);
    } catch (_) {}

    const filePath = getChunkFilePath(documentId);
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            return true;
        } catch (err) {
            console.error(`[LocalChunkManager] Error deleting chunk file for document ${documentId}:`, err.message);
            return false;
        }
    }
    return false;
}

/**
 * Replaces chunk file on re-chunking.
 */
async function replaceDocumentChunks(documentId, chunks, docMeta) {
    // Invalidate caches before replacement
    try {
        const smartCacheHub = require("../services/cache/SmartCacheHub");
        if (smartCacheHub?.l5?.invalidateDocument) {
            smartCacheHub.l5.invalidateDocument(documentId);
        }
    } catch (_) {}

    // Atomic write via temp file (safe: does not destroy existing file if saving throws)
    return await saveDocumentChunks(documentId, chunks, docMeta);
}

/**
 * Validates integrity of a document's local chunk file.
 */
function validateDocumentChunks(documentId) {
    const filePath = getChunkFilePath(documentId);
    if (!fs.existsSync(filePath)) {
        return { valid: false, reason: "Chunk file does not exist on disk", chunkCount: 0 };
    }

    try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.chunks) || parsed.chunks.length === 0) {
            return { valid: false, reason: "Chunk array is missing or empty", chunkCount: 0 };
        }

        for (let i = 0; i < parsed.chunks.length; i++) {
            const c = parsed.chunks[i];
            if (!c.chunkId || !c.content || typeof c.content !== "string") {
                return { valid: false, reason: `Chunk at index ${i} is missing chunkId or content`, chunkCount: parsed.chunks.length };
            }
        }

        return { valid: true, chunkCount: parsed.chunks.length, updatedAt: parsed.updatedAt };
    } catch (err) {
        return { valid: false, reason: `Invalid JSON format: ${err.message}`, chunkCount: 0 };
    }
}

/**
 * Returns total chunk count for a document.
 */
function getChunkCount(documentId) {
    const chunks = getDocumentChunks(documentId);
    return chunks.length;
}

/**
 * Computes storage metrics across all local chunk files.
 */
function getAllChunkStats() {
    ensureChunkStorageRoot();
    let totalFiles = 0;
    let totalChunks = 0;
    let totalBytes = 0;

    try {
        const files = fs.readdirSync(CHUNK_STORAGE_DIR);
        for (const file of files) {
            if (file.endsWith(".chunks.json")) {
                const fullPath = path.join(CHUNK_STORAGE_DIR, file);
                try {
                    const stat = fs.statSync(fullPath);
                    totalBytes += stat.size;
                    totalFiles++;

                    const raw = fs.readFileSync(fullPath, "utf-8");
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed.chunks)) {
                        totalChunks += parsed.chunks.length;
                    }
                } catch (_) {}
            }
        }
    } catch (err) {
        console.warn("[LocalChunkManager] Stats calculation warning:", err.message);
    }

    return {
        totalFiles,
        totalChunks,
        totalBytes,
        chunkDir: CHUNK_STORAGE_DIR
    };
}

/**
 * High-performance keyword & semantic metadata search across local chunk files.
 */
function searchLocalChunks(queryText = "", filters = {}, limit = 30) {
    ensureChunkStorageRoot();
    const results = [];
    if (!queryText || typeof queryText !== "string") return results;

    const cleanQuery = queryText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
    const stopWords = new Set(["what", "is", "the", "for", "tell", "me", "show", "who", "where", "when", "why", "which", "are", "am", "a", "an", "of", "in", "on", "at", "to", "with", "by", "from", "and", "or", "about", "how", "much", "many", "does", "do", "can"]);
    const rawTokens = cleanQuery.split(/\s+/).filter(Boolean);
    const significantTokens = rawTokens.filter(t => !stopWords.has(t) && t.length > 1);
    const tokens = significantTokens.length > 0 ? significantTokens : rawTokens;

    if (tokens.length === 0) return results;
    const fullPhrase = significantTokens.join(" ");

    try {
        const files = fs.readdirSync(CHUNK_STORAGE_DIR);
        for (const file of files) {
            if (!file.endsWith(".chunks.json")) continue;
            const fullPath = path.join(CHUNK_STORAGE_DIR, file);

            try {
                const raw = fs.readFileSync(fullPath, "utf-8");
                const parsed = JSON.parse(raw);
                const docId = parsed.documentId;
                const chunks = Array.isArray(parsed.chunks) ? parsed.chunks : [];

                const docCategory = String(parsed.category || "").toLowerCase();
                const docOriginalName = String(parsed.originalName || "").toLowerCase();

                // 1. Metadata Level Filtering (Doc level)
                if (filters.category && docCategory && docCategory !== "all" && docCategory !== "general") {
                    const filterCat = String(filters.category).toLowerCase();
                    if (!docCategory.includes(filterCat) && !filterCat.includes(docCategory)) {
                        // Allow if query didn't strictly require it or check chunk level
                    }
                }

                for (const chunk of chunks) {
                    const meta = chunk.metadata || {};
                    const chunkCat = String(meta.category || docCategory).toLowerCase();
                    const chunkDept = String(meta.department || "").toLowerCase();
                    const chunkProg = String(meta.program || meta.course || "").toLowerCase();
                    const chunkDocType = String(meta.documentType || "").toLowerCase();
                    const chunkHeading = String(chunk.heading || meta.heading || "").toLowerCase();
                    const chunkParentHeading = String(chunk.parentHeading || meta.parentHeading || "").toLowerCase();
                    const chunkKeywords = Array.isArray(meta.keywords) ? meta.keywords.map(k => String(k).toLowerCase()) : [];
                    const content = chunk.content || "";
                    const contentLower = content.toLowerCase();

                    // Filter matching
                    if (filters.category && filters.category !== "all" && filters.category !== "general") {
                        const targetCat = String(filters.category).toLowerCase();
                        if (chunkCat && chunkCat !== targetCat && !chunkCat.includes(targetCat) && !targetCat.includes(chunkCat)) {
                            // Don't discard immediately, but lower priority
                        }
                    }

                    if (filters.department) {
                        const targetDept = String(filters.department).toLowerCase();
                        if (chunkDept && chunkDept !== "unknown" && chunkDept !== targetDept && !chunkDept.includes(targetDept) && !targetDept.includes(chunkDept)) {
                            continue; // Skip chunks from definitely different departments
                        }
                    }

                    if (filters.program) {
                        const targetProg = String(filters.program).toLowerCase();
                        if (chunkProg && chunkProg !== targetProg && !chunkProg.includes(targetProg) && !targetProg.includes(chunkProg) && !contentLower.includes(targetProg)) {
                            // If chunk belongs to another specific program, skip
                        }
                    }

                    let score = 0;
                    let matchedTerms = 0;

                    // Exact phrase match
                    if (fullPhrase.length > 4 && (contentLower.includes(fullPhrase) || chunkHeading.includes(fullPhrase))) {
                        score += 8.0;
                    }

                    // Token matches across fields
                    for (const token of tokens) {
                        let tokenMatched = false;

                        // Match in program / course name (highest weight)
                        if (chunkProg.includes(token)) {
                            score += 4.0;
                            tokenMatched = true;
                        }

                        // Match in heading / section title (high weight)
                        if (chunkHeading.includes(token) || chunkParentHeading.includes(token)) {
                            score += 3.0;
                            tokenMatched = true;
                        }

                        // Match in keywords
                        if (chunkKeywords.some(k => k.includes(token))) {
                            score += 2.0;
                            tokenMatched = true;
                        }

                        // Match in content
                        if (contentLower.includes(token)) {
                            // Count occurrences (capped at 4)
                            const count = (contentLower.match(new RegExp(`\\b${token}`, "g")) || []).length;
                            score += Math.min(count, 4) * 1.0;
                            tokenMatched = true;
                        }

                        if (tokenMatched) matchedTerms++;
                    }

                    // Metadata alignment bonus
                    if (filters.program && (chunkProg.includes(String(filters.program).toLowerCase()) || contentLower.includes(String(filters.program).toLowerCase()))) {
                        score += 3.0;
                    }
                    if (filters.category) {
                        const filterCategories = Array.isArray(filters.category)
                            ? filters.category.map(c => String(c).toLowerCase())
                            : [String(filters.category).toLowerCase()];
                        if (filterCategories.some(fc => chunkCat === fc || chunkCat.includes(fc) || fc.includes(chunkCat))) {
                            score += 2.0;
                        }
                    }
                    if (filters.documentType) {
                        const targetDocType = String(filters.documentType).toLowerCase();
                        if (chunkDocType.includes(targetDocType) || (targetDocType.includes("fee") && (chunkCat === "fees" || chunkKeywords.some(k => k.includes("fee"))))) {
                            score += 2.5;
                        }
                    }

                    // Special fee query alignment: prioritize actual fee cards / fee schedules over generic text
                    const isFeeQuery = tokens.includes("fee") || tokens.includes("fees") || String(filters.documentType || "").toLowerCase().includes("fee");
                    if (isFeeQuery) {
                        const hasFeeTable = contentLower.includes("total course fee") || contentLower.includes("fee card") || (contentLower.includes("semester 1") && contentLower.includes("semester 2"));
                        if (hasFeeTable) {
                            score += 15.0;
                        } else if (chunkCat === "fees" || chunkKeywords.some(k => k.includes("fee"))) {
                            score += 4.0;
                        }
                    }

                    if (score > 0 && matchedTerms > 0) {
                        const coverage = matchedTerms / tokens.length;
                        const finalScore = parseFloat(((score * 0.1) * (0.5 + 0.5 * coverage)).toFixed(4));

                        results.push({
                            id: chunk.chunkId || `${docId}_${chunk.chunkIndex}`,
                            content: chunk.content,
                            score: finalScore,
                            metadata: {
                                ...meta,
                                documentId: docId,
                                sourceDocumentId: docId,
                                chunkId: chunk.chunkId || `${docId}_${chunk.chunkIndex}`,
                                pageNumber: chunk.pageNumber || meta.pageNumber || 1,
                                page: chunk.pageNumber || meta.pageNumber || 1,
                                heading: chunk.heading || meta.heading || "Document",
                                parentHeading: chunk.parentHeading || meta.parentHeading || "Document",
                                parentSection: meta.parentSection || chunk.parentHeading || "Document",
                                originalName: parsed.originalName || meta.originalName || "Document",
                                filename: parsed.originalName || meta.originalName || "Document",
                                category: meta.category || parsed.category || "general",
                                department: meta.department || parsed.department || "",
                                program: meta.program || parsed.program || "",
                                course: meta.course || meta.program || "",
                                documentType: meta.documentType || parsed.documentType || "general",
                                institution: meta.institution || parsed.institution || "all"
                            }
                        });
                    }
                }
            } catch (_) {}
        }
    } catch (err) {
        console.error("[LocalChunkManager] Search error:", err.message);
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
}

module.exports = {
    CHUNK_STORAGE_DIR,
    getChunksDir: () => CHUNK_STORAGE_DIR,
    ensureChunkStorageRoot,
    getChunkFilePath,
    saveDocumentChunks,
    getDocumentChunks,
    getChunk,
    getChunksByIds,
    deleteDocumentChunks,
    replaceDocumentChunks,
    validateDocumentChunks,
    getChunkCount,
    getAllChunkStats,
    searchLocalChunks
};
