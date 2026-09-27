const path = require("path");
const { fetchWithTimeoutAndRetry } = require("../../utils/fetchHelper");
const Document = require("../../models/Document");
const localStorageManager = require("../../storage/localStorageManager");
const localChunkManager = require("../../storage/localChunkManager");
const pdfExtractor = require("../utils/pdfExtractor");
const { RecursiveCharacterTextSplitter } = require("../utils/chunkDocument");
const DocumentTextCleaner = require("../utils/documentTextCleaner");
const { extractSearchMetadata } = require("../utils/keywordEntityExtractor");
const { validateChunks } = require("../utils/chunkValidator");
const { deterministicChunkId, buildChunkRelationships } = require("../utils/chunkRelationships");
const { resolveKnowledgeCategory } = require("../utils/knowledgeCategory");
const metadataBuilder = require("../utils/metadataBuilder");
const embeddingService = require("./embeddingService");
const { client, collectionName, vectorName: qdrantVectorName } = require("../config/qdrant");
const crypto = require("crypto");
const UniversalExtractor = require("../../crawler/extractors/UniversalExtractor");

const ROMAN_MAP = {
    "i": "1", "ii": "2", "iii": "3", "iv": "4", "v": "5", "vi": "6", "vii": "7", "viii": "8", "ix": "9",
    "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9"
};

function parseBuildingContent(text, filename) {
    const lines = text.split(/\r?\n/);
    const results = [];
    
    let buildingNumber = "";
    let buildingName = "";
    
    for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i].trim();
        const numMatch = line.match(/(?:Building|Buliding)\s+([IVX0-9]+)/i);
        if (numMatch) {
            const rawNum = numMatch[1].toLowerCase();
            buildingNumber = ROMAN_MAP[rawNum] || numMatch[1];
        }
    }
    
    if (!buildingNumber) {
        const fileNumMatch = filename.match(/(?:Building|Buliding)\s+([IVX0-9]+)/i);
        if (fileNumMatch) {
            const rawNum = fileNumMatch[1].toLowerCase();
            buildingNumber = ROMAN_MAP[rawNum] || fileNumMatch[1];
        }
    }
    
    const nameMatch = text.match(/(?:Building|Buliding)\s+[IVX0-9]+\s*(?:\r?\n\s*)?\(?([a-zA-Z0-9\s&]+)\)?/i) ||
                      text.match(/(?:Building|Buliding)\s+[0-9]+\s*(?:\r?\n\s*)?([a-zA-Z0-9\s&]+)/i);
    if (nameMatch) {
        buildingName = nameMatch[1].trim();
    }
    if (buildingName) {
        buildingName = buildingName.replace(/\s+/g, " ").trim();
    }
    
    let currentFloor = "";
    
    for (let line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        const floorMatch = trimmed.match(/^(?:Ground|1st|2nd|3rd|4th|5th|6th|7th|8th|9th|Frist|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Basement)\s*floor/i);
        if (floorMatch) {
            currentFloor = trimmed;
            continue;
        }
        
        if (!currentFloor) continue;
        
        const roomMatch = trimmed.match(/^([0-9a-zA-Z()\-,\s]+?)(?:\s{2,}|\t+)(.+)$/);
        
        if (roomMatch) {
            const roomPart = roomMatch[1].trim();
            const descPart = roomMatch[2].trim();
            
            const isRoomNumber = /^[0-9a-zA-Z()\-,\s/]+$/.test(roomPart) && roomPart.length < 20;
            
            if (isRoomNumber) {
                const rooms = roomPart.split(/,\s*/);
                for (const r of rooms) {
                    results.push({
                        buildingNumber,
                        buildingName,
                        floor: currentFloor,
                        roomNumber: r,
                        description: descPart
                    });
                }
            } else {
                results.push({
                    buildingNumber,
                    buildingName,
                    floor: currentFloor,
                    roomNumber: "",
                    description: trimmed
                });
            }
        } else {
            const colonRoomMatch = trimmed.match(/^([0-9a-zA-Z()\-,\s]+?)\s*:\s*(.+)$/);
            if (colonRoomMatch && colonRoomMatch[1].trim().length < 15) {
                const roomPart = colonRoomMatch[1].trim();
                const descPart = colonRoomMatch[2].trim();
                const rooms = roomPart.split(/,\s*/);
                for (const r of rooms) {
                    results.push({
                        buildingNumber,
                        buildingName,
                        floor: currentFloor,
                        roomNumber: r,
                        description: descPart
                    });
                }
            } else {
                results.push({
                    buildingNumber,
                    buildingName,
                    floor: currentFloor,
                    roomNumber: "",
                    description: trimmed
                });
            }
        }
    }
    
    if (results.length === 0) {
        results.push({
            buildingNumber,
            buildingName,
            floor: "",
            roomNumber: "",
            description: text
        });
    }
    
    return results;
}

/**
 * Uses Gemini API to transcribe scanned PDF page-by-page.
 */
const extractTextFromScannedPdf = async (buffer) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set. Cannot run OCR fallback.");
    }
    const configuredModel = process.env.GEMINI_COMPLETION_MODEL;
    const model = (!configuredModel || configuredModel === "gemini-2.5-flash") ? "gemini-3.5-flash" : configuredModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    const requestBody = {
        contents: [
            {
                parts: [
                    {
                        inlineData: {
                            mimeType: "application/pdf",
                            data: buffer.toString("base64")
                        }
                    },
                    {
                        text: "Extract all the text from this scanned PDF document page-by-page. For each page, please start with [PAGE_START_X] and end with [PAGE_END_X], where X is the page number. Ensure no pages are omitted and formatting/layout is preserved where possible."
                    }
                ]
            }
        ]
    };
    const response = await fetchWithTimeoutAndRetry(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
        },
        body: JSON.stringify(requestBody)
    }, 45000, 3, 2000);
    
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error?.message || `Gemini scanned-PDF OCR failed with status ${response.status}`);
    }
    
    const extractedText = payload.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    const pages = [];
    const pageRegex = /\[PAGE_START_(\d+)\]([\s\S]*?)\[PAGE_END_\1\]/g;
    let match;
    while ((match = pageRegex.exec(extractedText)) !== null) {
        pages.push({
            pageNumber: parseInt(match[1]),
            text: match[2].trim()
        });
    }
    
    if (pages.length === 0) {
        pages.push({
            pageNumber: 1,
            text: extractedText.trim()
        });
    }
    
    return pages;
};

/**
 * Uses Gemini API to transcribe specific scanned PDF pages.
 */
const extractTextFromScannedPages = async (buffer, pageNumbers) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set. Cannot run OCR fallback.");
    }
    const configuredModel = process.env.GEMINI_COMPLETION_MODEL;
    const model = (!configuredModel || configuredModel === "gemini-2.5-flash") ? "gemini-3.5-flash" : configuredModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    const requestBody = {
        contents: [
            {
                parts: [
                    {
                        inlineData: {
                            mimeType: "application/pdf",
                            data: buffer.toString("base64")
                        }
                    },
                    {
                        text: `This is a PDF file. Please perform high-quality OCR and text/table extraction ONLY on the following page numbers: ${pageNumbers.join(", ")}.
For each page, start your output with [PAGE_START_X] and end with [PAGE_END_X], where X is the page number. 
Ensure you preserve any tables, layouts, and all textual content on those pages. Do not write any explanations or preambles.`
                    }
                ]
            }
        ]
    };
    const response = await fetchWithTimeoutAndRetry(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
        },
        body: JSON.stringify(requestBody)
    }, 45000, 3, 2000);
    
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error?.message || `Gemini page-level OCR failed with status ${response.status}`);
    }
    
    const extractedText = payload.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    const pages = [];
    const pageRegex = /\[PAGE_START_(\d+)\]([\s\S]*?)\[PAGE_END_\1\]/g;
    let match;
    while ((match = pageRegex.exec(extractedText)) !== null) {
        pages.push({
            pageNumber: parseInt(match[1]),
            text: match[2].trim()
        });
    }
    
    if (pages.length === 0 && extractedText.trim().length > 0) {
        if (pageNumbers.length === 1) {
            pages.push({
                pageNumber: pageNumbers[0],
                text: extractedText.trim()
            });
        } else {
            console.warn("[OCR] Gemini returned text without page tags for multiple pages.");
        }
    }
    
    return pages;
};

const bufferCache = new Map();
const manuallyQueuedIds = new Set();
const INDEXING_CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.INDEXING_CONCURRENCY) || 1));
const workers = Array.from({ length: INDEXING_CONCURRENCY }, (_, index) => ({
    id: index + 1,
    busy: false
}));

const withTimeout = (promise, ms, message = "Operation timed out") => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

const loadFromLocalStorage = async (storagePath) => {
    return await localStorageManager.readFile(storagePath);
};

const claimNextPendingDocument = async () => {
    if (manuallyQueuedIds.size === 0) {
        return null;
    }
    const nextId = manuallyQueuedIds.values().next().value;
    manuallyQueuedIds.delete(nextId);

    return Document.findOneAndUpdate(
        {
            _id: nextId,
            status: { $ne: "deleted" },
            embeddingStatus: "pending"
        },
        {
            $set: {
                embeddingStatus: "processing",
                "metadata.lastIndexAttemptAt": new Date().toISOString()
            },
            $inc: {
                "metadata.indexAttempts": 1
            }
        },
        {
            returnDocument: "after"
        }
    );
};

const processNextJob = async () => {
    // If the queue is empty, do nothing
    if (manuallyQueuedIds.size === 0) return;

    // Find any idle worker
    const idleWorker = workers.find(w => !w.busy);
    if (!idleWorker) return; // All workers are busy

    // Claim next pending document
    const nextDoc = await claimNextPendingDocument();
    if (!nextDoc) return; // No documents can be claimed

    idleWorker.busy = true;

    // Process document in background asynchronously
    (async () => {
        try {
            console.log(`[IndexingService] Worker ${idleWorker.id} indexing document ${nextDoc._id}`);
            await runIndexingJob(nextDoc._id);
        } catch (jobErr) {
            console.error(`[IndexingService] Worker ${idleWorker.id} failed to run indexing job for document ${nextDoc._id}:`, jobErr);
            try {
                await Document.findByIdAndUpdate(nextDoc._id, {
                    $set: {
                        embeddingStatus: "failed",
                        "metadata.error": jobErr.message,
                        "metadata.lastErrorAt": new Date().toISOString()
                    }
                });
            } catch (saveErr) {
                console.error("Failed to mark document as failed:", saveErr);
            }
        } finally {
            idleWorker.busy = false;
            // Yield to keep Express responsive
            await new Promise(resolve => setImmediate(resolve));
            // Trigger processing of next queued document
            processNextJob();
        }
    })();

    // Check if more idle workers can immediately pull work
    if (manuallyQueuedIds.size > 0) {
        processNextJob();
    }
};


const indexDocumentBackground = async (documentId, fileBuffer = null) => {
    const document = await Document.findById(documentId);
    if (!document || document.status === "deleted") {
        return;
    }

    document.embeddingStatus = "pending";
    document.metadata = {
        ...(document.metadata || {}),
        lastIndexAttemptAt: null,
        indexAttempts: 0
    };
    await document.save();

    if (fileBuffer) {
        bufferCache.set(String(documentId), fileBuffer);
    }

    manuallyQueuedIds.add(String(documentId));

    processNextJob().catch((err) => {
        console.error("Background worker process start failure:", err);
    });
};

const buildChunks = async (buffer, originalName, mimeType, splitter) => {
    const ext = path.extname(originalName || "").toLowerCase();
    const isPdf = mimeType === "application/pdf" || ext === ".pdf";

    if (isPdf) {
        const parsed = await withTimeout(pdfExtractor.extractText(buffer), 45000, "PDF text extraction timed out (45s)");
        if (parsed.requiresOcr) {
            return { chunks: [], pageCount: parsed.numPages || 1, requiresOcr: true };
        }
        const chunks = [];
        for (const page of parsed.pages || []) {
            const pageChunks = splitter.splitText(page.text || "");
            pageChunks.forEach((chunk) => chunks.push({ content: chunk, pageNumber: page.pageNumber }));
        }
        return { chunks, pageCount: parsed.numPages || 1, requiresOcr: false };
    }

    const extracted = await withTimeout(UniversalExtractor.extract(buffer, originalName), 45000, "Document extraction timed out (45s)");
    const chunks = [];
    const splits = splitter.splitText(extracted.text || "");
    splits.forEach((chunk) => chunks.push({ content: chunk, pageNumber: 1 }));
    return { chunks, pageCount: 1, requiresOcr: false };
};

const runIndexingPipeline = async (documentId, initialBuffer = null, options = {}) => {
    const {
        workerId = "Worker #1",
        onProgress = () => {},
        isPaused = () => false,
        isCancelled = () => false
    } = options;

    const document = await Document.findById(documentId);
    if (!document || document.status === "deleted") {
        return;
    }

    const cacheKey = String(documentId);
    const fileBuffer = initialBuffer || bufferCache.get(cacheKey);
    bufferCache.delete(cacheKey);

    let buffer = fileBuffer;
    let text = "";
    let pageCount = 1;
    let rawChunks = [];
    let academicEntities = [];
    let embeddings = [];
    let points = [];
    let pages = [];
    let currentStageName = "Reading document";

    const updateStage = async (status, stage, progress, extraStats = {}) => {
        currentStageName = stage;
        document.embeddingStatus = status;
        document.progress = progress;
        document.currentStage = stage;
        document.workerId = workerId;
        if (extraStats.chunkStats) {
            document.chunkStats = {
                ...(document.chunkStats?.toObject ? document.chunkStats.toObject() : document.chunkStats || {}),
                ...extraStats.chunkStats
            };
        }
        await document.save();
        await onProgress({
            progress,
            stage,
            status,
            chunkStats: document.chunkStats
        });
    };

    try {
        if (isCancelled()) {
            document.embeddingStatus = "cancelled";
            document.currentStage = "Cancelled by user";
            await document.save();
            return;
        }

        // STAGE 1: Reading document (10%)
        await updateStage("processing", "Reading document", 10);

        if (!buffer) {
            try {
                buffer = await loadFromLocalStorage(document.storagePath);
            } catch (storageErr) {
                const fs = require("fs");
                const localPath = path.join(__dirname, "../../uploads/documents", document.storedName || "");
                if (fs.existsSync(localPath)) {
                    console.log(`[INDEX] Loading document from fallback local path: ${localPath}`);
                    buffer = fs.readFileSync(localPath);
                } else {
                    throw new Error(`Failed to load document from storage path '${document.storagePath}': ${storageErr.message}`);
                }
            }
        }

        if (isCancelled()) {
            document.embeddingStatus = "cancelled";
            await document.save();
            return;
        }

        console.log(`[INDEX] Starting document: ${document.originalName} (${documentId})`);

        const ext = path.extname(document.originalName || "").toLowerCase();
        const isPdf = document.mimeType === "application/pdf" || ext === ".pdf";
        const isImage = document.mimeType && document.mimeType.startsWith("image/");
        const splitter = new RecursiveCharacterTextSplitter();

        if (isPdf) {
            let parsed;
            try {
                parsed = await withTimeout(pdfExtractor.extractText(buffer), 45000, "PDF text extraction timed out (45s)");
            } catch (pdfErr) {
                const err = new Error(pdfErr.message || "Failed to extract text from PDF");
                err.errorCode = "PDF_EXTRACTION_FAILED";
                throw err;
            }

            pages = parsed.pages || [];
            pageCount = parsed.numPages || pages.length;

            const ocrPages = pages.filter(p => p.needsOcr).map(p => p.pageNumber);
            const requiresOcr = ocrPages.length > 0;

            if (requiresOcr) {
                try {
                    const ocrResults = await withTimeout(
                        extractTextFromScannedPages(buffer, ocrPages),
                        90000,
                        "Gemini OCR timed out (90s)"
                    );
                    for (const ocrPage of ocrResults) {
                        const page = pages.find(p => p.pageNumber === ocrPage.pageNumber);
                        if (page) {
                            if (page.text.trim().length > 0) {
                                page.text = page.text.trim() + "\n\n=== OCR Content ===\n" + ocrPage.text.trim();
                            } else {
                                page.text = ocrPage.text.trim();
                            }
                        }
                    }
                } catch (ocrErr) {
                    console.error("[INDEX] OCR fallback warning:", ocrErr.message);
                }
            }

            // STAGE 2: Cleaning text (25%)
            await updateStage("processing", "Cleaning document text", 25);
            pages = DocumentTextCleaner.cleanPages(pages);
            text = pages.map(p => p.text || "").join("\n");

            // STAGE 3: Building semantic chunks (40%)
            await updateStage("chunked", "Generating chunks", 40);
            for (const page of pages) {
                const pageChunks = splitter.splitText(page.text || "");
                pageChunks.forEach((chunk) => {
                    rawChunks.push({
                        content: chunk,
                        pageNumber: page.pageNumber,
                        isOcr: page.needsOcr || false,
                        contentType: page.needsOcr ? "ocr" : "text"
                    });
                });
                page.text = "";
            }
        } else if (document.category && document.category.startsWith("campus_navigation")) {
            const textContent = buffer.toString("utf-8");
            const parsedRooms = parseBuildingContent(textContent, document.originalName);

            await updateStage("processing", "Cleaning document text", 25);
            await updateStage("chunked", "Generating chunks", 40);

            rawChunks = parsedRooms.map(item => {
                const chunkContent = `📍 Campus Location\nBuilding: Building ${item.buildingNumber} (${item.buildingName})\nFloor: ${item.floor}\nRoom: ${item.roomNumber || "N/A"}\nDetails: ${item.description}`;
                return {
                    content: chunkContent,
                    pageNumber: 1,
                    campusMeta: item,
                    isOcr: false,
                    contentType: "text"
                };
            });
            text = textContent;
        } else {
            let extracted;
            try {
                extracted = await withTimeout(UniversalExtractor.extract(buffer, document.originalName), 45000, "Document extraction timed out (45s)");
            } catch (extErr) {
                const err = new Error(extErr.message || "Failed to extract text from document");
                err.errorCode = "EXTRACTION_FAILED";
                throw err;
            }

            text = extracted.text || "";
            if (text.trim().length === 0) {
                const err = new Error("Extraction returned empty text (Empty or unreadable file).");
                err.errorCode = "EMPTY_DOCUMENT";
                throw err;
            }

            // STAGE 2: Cleaning text (25%)
            await updateStage("processing", "Cleaning document text", 25);
            text = DocumentTextCleaner.cleanText(text);

            // STAGE 3: Building semantic chunks (40%)
            await updateStage("chunked", "Generating chunks", 40);
            const splits = splitter.splitText(text);
            splits.forEach((chunk) => {
                rawChunks.push({
                    content: chunk,
                    pageNumber: 1,
                    isOcr: isImage ? true : false,
                    contentType: isImage ? "ocr_text" : "text"
                });
            });
        }

        if (isCancelled()) {
            document.embeddingStatus = "cancelled";
            await document.save();
            return;
        }

        // STAGE 4: Generating metadata & keywords (55%)
        await updateStage("chunked", "Extracting metadata and keywords", 55, {
            chunkStats: { totalChunks: rawChunks.length, pageCount }
        });

        // Graceful llama.cpp metadata extraction fallback
        try {
            const entityExtractionService = require("./entityExtractionService");
            academicEntities = await entityExtractionService.extractAcademicMetadata(text);
        } catch (entityErr) {
            console.warn("[INDEX] llama.cpp entity extraction skipped (fallback to local keyword extraction):", entityErr.message);
        }

        rawChunks.forEach((chunk) => {
            chunk.searchMetadata = extractSearchMetadata(chunk.content, { originalName: document.originalName });
        });

        const chunkValidation = validateChunks(rawChunks);
        rawChunks = chunkValidation.validChunks;

        if (rawChunks.length === 0) {
            const err = new Error("Chunking returned 0 valid chunks.");
            err.errorCode = "CHUNKING_FAILED";
            throw err;
        }

        const chunkIds = rawChunks.map((_, index) => deterministicChunkId(documentId, index));
        const relationships = buildChunkRelationships(rawChunks, chunkIds, { documentId });
        rawChunks.forEach((chunk, index) => { chunk.relationships = relationships[index]; });

        const knowledgeCategory = resolveKnowledgeCategory({
            storagePath: document.storagePath,
            documentCategory: document.category,
            originalName: document.originalName,
            metadata: document.metadata
        });

        if (isCancelled()) {
            document.embeddingStatus = "cancelled";
            await document.save();
            return;
        }

        // STAGE 5: Generating embeddings (70%)
        await updateStage("embedding", "Generating vector embeddings", 70);

        rawChunks.forEach((chunk) => {
            chunk.contentHash = crypto.createHash("sha256").update(String(chunk.content || "").trim()).digest("hex");
        });

        const expectedDimension = 768;
        const missingTexts = rawChunks.map(c => c.content);

        try {
            embeddings = await withTimeout(
                embeddingService.getChunksEmbeddings(missingTexts),
                60000,
                "Embedding generation timed out (60s)"
            );

            if (!embeddings || embeddings.length !== rawChunks.length) {
                const err = new Error(`Generated embedding count (${embeddings ? embeddings.length : 0}) does not match chunk count (${rawChunks.length})`);
                err.errorCode = "EMBEDDING_FAILED";
                throw err;
            }
        } catch (embErr) {
            const err = new Error(embErr.message || "Failed to generate embeddings");
            err.errorCode = "EMBEDDING_FAILED";
            throw err;
        }

        if (isCancelled()) {
            document.embeddingStatus = "cancelled";
            await document.save();
            return;
        }

        // STAGE 6: Saving local chunk storage (85%)
        await updateStage("indexing", "Saving chunks to local storage", 85, {
            chunkStats: { embeddedChunks: embeddings.length }
        });

        try {
            const chunkObjects = rawChunks.map((chunk, index) => {
                const pointId = deterministicChunkId(documentId, index);
                const chunkMeta = metadataBuilder.buildChunkMetadata({
                    documentId: String(documentId),
                    chunkId: pointId,
                    content: chunk.content,
                    chunkIndex: index,
                    pageNumber: chunk.pageNumber,
                    originalName: document.originalName,
                    storagePath: document.storagePath,
                    documentCategory: document.category,
                    department: document.department,
                    institution: document.institution,
                    uploadedBy: String(document.createdBy || ""),
                    searchMetadata: chunk.searchMetadata,
                    relationships: chunk.relationships,
                    campusMeta: chunk.campusMeta,
                    isImage,
                    mimeType: document.mimeType
                });

                return {
                    chunkId: pointId,
                    documentId: String(documentId),
                    chunkIndex: index,
                    pageNumber: chunk.pageNumber || 1,
                    heading: chunkMeta.heading || "Document",
                    parentHeading: chunkMeta.parentHeading || "Document",
                    hierarchy: [chunkMeta.parentHeading || "Document", chunkMeta.heading || "Document"],
                    keywords: chunkMeta.keywords || [],
                    content: chunk.content,
                    contentHash: chunk.contentHash,
                    isOcr: chunk.isOcr || false,
                    contentType: chunk.contentType || "text",
                    campusMeta: chunk.campusMeta,
                    metadata: {
                        ...chunkMeta,
                        academicEntities: academicEntities,
                        isOcr: chunk.isOcr || false,
                        contentType: chunk.contentType || "text"
                    }
                };
            });

            await localChunkManager.replaceDocumentChunks(documentId, chunkObjects, {
                originalName: document.originalName,
                category: document.category,
                department: document.department,
                institution: document.institution
            });
        } catch (storageErr) {
            const err = new Error(storageErr.message || "Failed to save chunks to local storage");
            err.errorCode = "LOCAL_CHUNK_SAVE_FAILED";
            throw err;
        }

        if (isCancelled()) {
            document.embeddingStatus = "cancelled";
            await document.save();
            return;
        }

        // STAGE 7: Indexing into Qdrant (95%)
        await updateStage("indexing", "Indexing into Qdrant", 95);

        // Pre-check Qdrant availability & collection
        try {
            const { ensureCollection } = require("../config/qdrant");
            await ensureCollection();
        } catch (qdrantConnErr) {
            console.warn("[INDEX] Qdrant offline during indexing:", qdrantConnErr.message);
            document.embeddingStatus = "partial";
            document.progress = 85;
            document.currentStage = "Qdrant Offline - Chunks saved locally, vector upload pending";
            await document.save();
            return;
        }

        await deleteDocumentIndex(documentId);

        // Determine whether Qdrant collection uses named or unnamed vector
        let isNamedVector = false;
        try {
            const collInfo = await client.getCollection(collectionName);
            const vConfig = collInfo.config?.params?.vectors;
            if (vConfig && !vConfig.size && (vConfig[qdrantVectorName] || vConfig.default)) {
                isNamedVector = true;
            }
        } catch (_) {}

        const timestamp = new Date().toISOString();
        points = rawChunks.map((chunk, index) => {
            const pointId = deterministicChunkId(documentId, index);
            const chunkMeta = metadataBuilder.buildChunkMetadata({
                documentId: String(documentId),
                chunkId: pointId,
                content: chunk.content,
                chunkIndex: index,
                pageNumber: chunk.pageNumber,
                originalName: document.originalName,
                storagePath: document.storagePath,
                documentCategory: document.category,
                department: document.department,
                institution: document.institution,
                uploadedBy: String(document.createdBy || ""),
                searchMetadata: chunk.searchMetadata,
                relationships: chunk.relationships,
                campusMeta: chunk.campusMeta,
                isImage,
                mimeType: document.mimeType
            });

            return {
                id: pointId,
                vector: isNamedVector ? { [qdrantVectorName || "default"]: embeddings[index] } : embeddings[index],
                payload: {
                    ...chunkMeta,
                    id: pointId,
                    content: chunk.content,
                    contentHash: chunk.contentHash,
                    academicEntities: academicEntities,
                    createdAt: timestamp,
                    isOcr: chunk.isOcr || false,
                    contentType: chunk.contentType || "text"
                }
            };
        });

        try {
            const QDRANT_BATCH_SIZE = 64;
            for (let start = 0; start < points.length; start += QDRANT_BATCH_SIZE) {
                const subPoints = points.slice(start, start + QDRANT_BATCH_SIZE);
                await withTimeout(
                    client.upsert(collectionName, { wait: true, points: subPoints }),
                    30000,
                    `Qdrant vector database upload batch timed out (30s)`
                );
            }
        } catch (qdrantErr) {
            console.warn("[INDEX] Qdrant upsert error:", qdrantErr.message);
            document.embeddingStatus = "partial";
            document.progress = 85;
            document.currentStage = `Qdrant upload failed: ${qdrantErr.message}`;
            await document.save();
            return;
        }

        // STAGE 8: Strict Validation & Completion (100%)
        let pointCount = 0;
        try {
            const qCountRes = await withTimeout(
                client.count(collectionName, {
                    filter: {
                        must: [{ key: "documentId", match: { value: String(documentId) } }]
                    }
                }),
                10000,
                "Qdrant point count verification timed out (10s)"
            );
            pointCount = qCountRes?.count || 0;
        } catch (_) {}

        // Strict Completion Validation: pointCount > 0 and matches chunks
        if (pointCount !== rawChunks.length || pointCount === 0) {
            document.embeddingStatus = "partial";
            document.progress = 90;
            document.currentStage = `Partial: Verified ${pointCount}/${rawChunks.length} vectors in Qdrant`;
            document.chunkStats = {
                totalChunks: rawChunks.length,
                embeddedChunks: embeddings.length,
                indexedChunks: pointCount,
                failedChunks: Math.max(0, rawChunks.length - pointCount),
                pageCount
            };
            await document.save();
            return;
        }

        const totalTokens = rawChunks.reduce((acc, c) => acc + Math.ceil((c.content || "").length / 4), 0);

        document.embeddingStatus = "completed";
        document.chunkCount = rawChunks.length;
        document.progress = 100;
        document.currentStage = "Completed & Indexed";
        document.healthy = true;
        document.failureInfo = {};
        document.chunkStats = {
            totalChunks: rawChunks.length,
            embeddedChunks: embeddings.length,
            indexedChunks: pointCount,
            failedChunks: 0,
            tokenCount: totalTokens,
            pageCount
        };
        document.metadata = {
            ...(document.metadata || {}),
            pages: pageCount,
            extractedLength: text.length,
            qdrantPoints: pointCount,
            indexedAt: new Date().toISOString(),
            academicEntities: academicEntities
        };
        await document.save();

        await onProgress({
            progress: 100,
            stage: "Completed & Indexed",
            status: "completed",
            chunkStats: document.chunkStats
        });

        // Invalidate retrieval category cache
        try {
            const cacheService = require("../../services/cacheService");
            await cacheService.invalidateCategory(document.category);
        } catch (cacheInvErr) {
            console.warn("[INDEX] Cache invalidation warning:", cacheInvErr.message);
        }
    } catch (err) {
        console.error(`[INDEX] Indexing failed at stage "${currentStageName}" for ${documentId}:`, err.message);
        document.embeddingStatus = "failed";
        document.progress = 0;
        document.currentStage = `Failed at ${currentStageName}`;
        document.healthy = false;
        document.failureInfo = {
            failedStage: currentStageName,
            errorCode: err.errorCode || "INDEXING_FAILED",
            errorMessage: err.message || "Unknown error",
            timestamp: new Date()
        };
        document.metadata = {
            ...(document.metadata || {}),
            error: err.message,
            errorCode: err.errorCode || "INDEXING_FAILED",
            lastErrorAt: new Date().toISOString()
        };
        await document.save();
        throw err;
    } finally {
        buffer = null;
        text = null;
        rawChunks = [];
        embeddings = [];
        points = [];
        pages = [];
        if (global.gc) {
            try {
                global.gc();
            } catch (gcErr) {}
        }
    }
};

const runIndexingJob = async (documentId) => {
    return runIndexingPipeline(documentId);
};

const deleteDocumentIndex = async (documentId) => {
    try {
        await localChunkManager.deleteDocumentChunks(documentId);
        await withTimeout(
            client.delete(collectionName, {
                filter: {
                    should: [
                        { key: "documentId", match: { value: String(documentId) } },
                        { key: "sourceDocumentId", match: { value: String(documentId) } }
                    ]
                }
            }),
            15000,
            "Qdrant delete index timed out (15s)"
        );
    } catch (e) {
        console.error(`indexingService Delete Index failed for ${documentId}:`, e.message);
    }
};

const reindexDocument = async ({ documentId }) => {
    const document = await Document.findOne({
        _id: documentId,
        status: { $ne: "deleted" }
    });

    if (!document) {
        const error = new Error("Document not found.");
        error.statusCode = 404;
        throw error;
    }

    const { enqueueDocuments } = require("./chunkingQueueService");
    await enqueueDocuments({ ids: [documentId], forceRechunk: true });
    return document;
};

const rebuildAllEmbeddings = async () => {
    return { count: 0 };
};

module.exports = {
    indexDocumentBackground,
    deleteDocumentIndex,
    reindexDocument,
    rebuildAllEmbeddings,
    runIndexingJob,
    runIndexingPipeline
};

