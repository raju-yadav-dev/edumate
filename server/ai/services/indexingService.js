const path = require("path");
const { fetchWithTimeoutAndRetry } = require("../../utils/fetchHelper");
const Document = require("../../models/Document");
const supabase = require("../../config/supabase");
const pdfExtractor = require("../utils/pdfExtractor");
const { RecursiveCharacterTextSplitter } = require("../utils/chunkDocument");
const metadataBuilder = require("../utils/metadataBuilder");
const embeddingService = require("./embeddingService");
const { client, collectionName, vectorName: qdrantVectorName } = require("../config/qdrant");
const crypto = require("crypto");
const UniversalExtractor = require("../../crawler/extractors/UniversalExtractor");

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_BUCKET || "documents";

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

const downloadFromSupabase = async (storagePath) => {
    const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
    if (error) {
        throw new Error(`Failed to download ${storagePath} from Supabase: ${error.message}`);
    }
    return Buffer.from(await data.arrayBuffer());
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

const runIndexingJob = async (documentId) => {
    const document = await Document.findById(documentId);
    if (!document || document.status === "deleted") {
        return;
    }

    const cacheKey = String(documentId);
    const fileBuffer = bufferCache.get(cacheKey);
    bufferCache.delete(cacheKey);

    let buffer = fileBuffer;
    let text = "";
    let pageCount = 1;
    let rawChunks = [];
    let ocrFlag = false;
    let academicEntities = [];
    let embeddings = [];
    let points = [];
    let pages = [];

    try {
        document.embeddingStatus = "processing";
        document.metadata = {
            ...(document.metadata || {}),
            indexAttempts: (document.metadata?.indexAttempts || 0) + 1,
            lastIndexAttemptAt: new Date().toISOString()
        };
        await document.save();

        if (!buffer) {
            const fs = require("fs");
            const localPath = path.join(__dirname, "../../uploads/documents", document.storedName || "");
            if (fs.existsSync(localPath)) {
                console.log(`[INDEX] Loading document from local path: ${localPath}`);
                buffer = fs.readFileSync(localPath);
            } else {
                buffer = await withTimeout(downloadFromSupabase(document.storagePath), 35000, "Supabase file download timed out (35s)");
            }
        }

        console.log(`[INDEX] Starting document: ${document.originalName} (${documentId})`);

        // 1. Extraction Stage
        console.log(`[EXTRACT] Started`);
        const ext = path.extname(document.originalName || "").toLowerCase();
        const isPdf = document.mimeType === "application/pdf" || ext === ".pdf";
        const isImage = document.mimeType && document.mimeType.startsWith("image/");
        
        let text = "";
        let pageCount = 1;
        let rawChunks = [];
        let ocrFlag = false;

        const splitter = new RecursiveCharacterTextSplitter();

        if (isPdf) {
            const parsed = await withTimeout(pdfExtractor.extractText(buffer), 45000, "PDF text extraction timed out (45s)");
            pages = parsed.pages || [];
            pageCount = parsed.numPages || pages.length;

            const ocrPages = pages.filter(p => p.needsOcr).map(p => p.pageNumber);
            const requiresOcr = ocrPages.length > 0;

            console.log(`[OCR] Required: ${requiresOcr}`);
            if (requiresOcr) {
                console.log(`[OCR] Pages detected: ${ocrPages.length}`);
                try {
                    const ocrResults = await withTimeout(
                        extractTextFromScannedPages(buffer, ocrPages),
                        90000,
                        "Gemini OCR timed out (90s)"
                    );
                    for (const ocrPage of ocrResults) {
                        const page = pages.find(p => p.pageNumber === ocrPage.pageNumber);
                        if (page) {
                            console.log(`[OCR] Processing page: ${page.pageNumber}`);
                            console.log(`[OCR] Text extracted: ${ocrPage.text.length} characters`);
                            if (page.text.trim().length > 0) {
                                page.text = page.text.trim() + "\n\n=== OCR Content ===\n" + ocrPage.text.trim();
                            } else {
                                page.text = ocrPage.text.trim();
                            }
                        }
                    }
                    console.log(`[OCR] Completed`);
                } catch (ocrErr) {
                    console.error("[INDEX] Gemini page-level OCR failed:", ocrErr.message);
                    console.warn("[INDEX] Falling back to text layer or basic extraction...");
                    for (const page of pages) {
                        if (page.needsOcr && page.text.trim().length === 0) {
                            page.text = `[Scanned PDF Page ${page.pageNumber}: Text extraction unavailable. OCR failed: ${ocrErr.message}]`;
                        }
                    }
                }
            }

            text = pages.map(p => p.text || "").join("\n");

            // 2. Chunking Stage
            console.log(`[CHUNK] Started`);
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
                page.text = ""; // Release page text buffer immediately (Requirement 6)
            }
        } else if (document.category && document.category.startsWith("campus_navigation")) {
            console.log(`[INDEX] Custom Campus Navigation parser activated for ${document.originalName}`);
            const textContent = buffer.toString("utf-8");
            const parsedRooms = parseBuildingContent(textContent, document.originalName);
            
            rawChunks = parsedRooms.map(item => {
                const chunkContent = `📍 Campus Location
Building: Building ${item.buildingNumber} (${item.buildingName})
Floor: ${item.floor}
Room: ${item.roomNumber || "N/A"}
Details: ${item.description}`;

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
            if (isImage) {
                console.log(`[IMAGE INDEX] Starting image: ${document.originalName}`);
                console.log(`[IMAGE INDEX] MIME: ${document.mimeType}`);
            }
            const extracted = await withTimeout(UniversalExtractor.extract(buffer, document.originalName), 45000, "Document extraction timed out (45s)");
            text = extracted.text || "";
            
            if (text.trim().length === 0) {
                throw new Error("Extraction returned empty text (Empty or unreadable file).");
            }

            if (isImage) {
                console.log(`[IMAGE INDEX] Extracted text:\n${text}`);
            }

            // 2. Chunking Stage
            console.log(`[CHUNK] Started`);
            const splits = splitter.splitText(text);
            splits.forEach((chunk) => {
                rawChunks.push({
                    content: chunk,
                    pageNumber: 1,
                    isOcr: isImage ? true : false,
                    contentType: isImage ? "ocr_text" : "text"
                });
            });
            if (isImage) {
                console.log(`[IMAGE INDEX] Created chunks: ${rawChunks.length}`);
            }
        }

        let academicEntities = [];
        try {
            const entityExtractionService = require("./entityExtractionService");
            academicEntities = await entityExtractionService.extractAcademicMetadata(text);
            console.log(`[INDEX] Extracted ${academicEntities.length} academic entities/relationships from document text.`);
        } catch (entityErr) {
            console.error("[INDEX] Error extracting academic entities:", entityErr.message);
        }

        const charCount = text.length;
        console.log(`[EXTRACT] Completed - characters: ${charCount}`);
        console.log(`[CHUNK] Completed - chunks: ${rawChunks.length}`);

        if (rawChunks.length === 0) {
            throw new Error("Chunking returned 0 chunks.");
        }

        // 3. Embedding Stage
        console.log(`[EMBEDDING] Started`);
        console.log(`[EMBEDDING] Chunk count before embedding: ${rawChunks.length}`);
        if (isImage) {
            console.log(`[IMAGE INDEX] Embedding image chunks: ${rawChunks.length}`);
        }
        const embeddings = await withTimeout(
            embeddingService.getChunksEmbeddings(rawChunks.map((chunk) => chunk.content)),
            50000,
            "Embedding generation timed out (50s)"
        );
        console.log(`[EMBEDDING] Completed - vectors: ${embeddings.length}`);

        if (!embeddings || embeddings.length !== rawChunks.length) {
            throw new Error(`Embedding count (${embeddings ? embeddings.length : 0}) does not match chunk count (${rawChunks.length})`);
        }

        // 4. Qdrant Upsert Stage
        console.log(`[QDRANT] Upsert started`);
        const { ensureCollection } = require("../config/qdrant");
        await ensureCollection();

        await deleteDocumentIndex(documentId);

        // Retrieve expected embedding dimension from configured model (strictly 768 for Jina)
        const expectedDimension = 768;

        const points = [];
        const timestamp = new Date().toISOString();
        rawChunks.forEach((chunk, index) => {
            const vector = embeddings[index];
            if (!vector || !Array.isArray(vector) || vector.length !== expectedDimension) {
                throw new Error(`Runtime embedding dimension mismatch: Expected vector of length ${expectedDimension}, but got ${vector ? vector.length : "undefined"}.`);
            }

            // Deterministic point ID based on documentId + chunkIndex
            const sha = crypto.createHash("sha256").update(`${documentId}:${index}`).digest("hex");
            const pointId = `${sha.slice(0, 8)}-${sha.slice(8, 12)}-4${sha.slice(13, 16)}-a${sha.slice(17, 20)}-${sha.slice(20, 32)}`;
            const isCampusNav = document.category && document.category.startsWith("campus_navigation");
            const meta = metadataBuilder.buildMetadata({
                documentId: String(documentId),
                originalName: document.originalName,
                pageNumber: chunk.pageNumber,
                category: document.category,
                department: document.department,
                institution: document.institution,
                uploadedBy: String(document.createdBy || "")
            });
            
            if (isCampusNav && chunk.campusMeta) {
                meta.sourceType = "campus_navigation";
                meta.buildingNumber = chunk.campusMeta.buildingNumber || "";
                meta.buildingName = chunk.campusMeta.buildingName || "";
                meta.floor = chunk.campusMeta.floor || "";
                meta.roomNumber = chunk.campusMeta.roomNumber || "";
                meta.department = chunk.campusMeta.description || "";
            }

            points.push({
                id: pointId,
                vector: {
                    [qdrantVectorName || "default"]: vector
                },
                payload: {
                    id: pointId,
                    documentId: meta.documentId,
                    content: chunk.content,
                    originalName: meta.originalName,
                    documentName: meta.documentName,
                    pageNumber: meta.pageNumber,
                    page: meta.page,
                    category: meta.category,
                    documentType: isImage ? "image" : meta.documentType,
                    department: isCampusNav ? (chunk.campusMeta?.description || "") : meta.department,
                    institution: meta.institution,
                    source: meta.source,
                    academicEntities: academicEntities,
                    uploadedBy: meta.uploadedBy,
                    chunkIndex: index,
                    createdAt: timestamp,
                    contentHash: document.contentHash || document.checksum,
                    sourceType: isImage ? "image" : (isCampusNav ? "campus_navigation" : "pdf"),
                    buildingNumber: isCampusNav ? (chunk.campusMeta?.buildingNumber || "") : undefined,
                    buildingName: isCampusNav ? (chunk.campusMeta?.buildingName || "") : undefined,
                    floor: isCampusNav ? (chunk.campusMeta?.floor || "") : undefined,
                    roomNumber: isCampusNav ? (chunk.campusMeta?.roomNumber || "") : undefined,
                    mimeType: isImage ? document.mimeType : undefined,
                    filename: isImage ? document.originalName : undefined,
                    isOcr: chunk.isOcr || false,
                    contentType: chunk.contentType || "text"
                }
            });
        });

        console.log(`[QDRANT] Vector count before upsert: ${points.length}`);
        if (isImage) {
            console.log(`[IMAGE INDEX] Qdrant upsert: ${points.length} vector${points.length === 1 ? "" : "s"}`);
        }
        console.log(`[QDRANT] Collection: ${collectionName}`);
        console.log(`[QDRANT] Vector Name: ${qdrantVectorName || "default"}`);
        console.log(`[QDRANT] Dimension: ${expectedDimension}`);
        await withTimeout(client.upsert(collectionName, { wait: true, points }), 30000, "Qdrant vector database upload timed out (30s)");
        console.log(`[QDRANT] Upsert completed`);

        // Verify vectors are inserted in Qdrant PER DOCUMENT
        const qCountRes = await withTimeout(
            client.count(collectionName, {
                filter: {
                    must: [
                        { key: "documentId", match: { value: String(documentId) } }
                    ]
                }
            }),
            10000,
            "Qdrant point count verification timed out (10s)"
        );

        const pointCount = qCountRes?.count || 0;
        console.log(`[QDRANT] Verified point count for document ${documentId}: ${pointCount}`);

        if (pointCount === 0) {
            throw new Error(`Qdrant vector verification failed: 0 points found for document ${documentId}`);
        }

        // 5. Save/Sync MongoDB Chunk collection
        try {
            const Chunk = require("../../models/Chunk");
            await Chunk.deleteMany({ document: documentId });
            const chunkDocs = rawChunks.map((chunk, index) => {
                const isCampusNav = document.category && document.category.startsWith("campus_navigation");
                const meta = metadataBuilder.buildMetadata({
                    documentId: String(documentId),
                    originalName: document.originalName,
                    pageNumber: chunk.pageNumber,
                    category: document.category,
                    department: document.department,
                    institution: document.institution,
                    uploadedBy: String(document.createdBy || "")
                });
                
                if (isCampusNav && chunk.campusMeta) {
                    meta.sourceType = "campus_navigation";
                    meta.buildingNumber = chunk.campusMeta.buildingNumber || "";
                    meta.buildingName = chunk.campusMeta.buildingName || "";
                    meta.floor = chunk.campusMeta.floor || "";
                    meta.roomNumber = chunk.campusMeta.roomNumber || "";
                    meta.department = chunk.campusMeta.description || "";
                }
                return {
                    document: documentId,
                    content: chunk.content,
                    embedding: embeddings[index] || [],
                    metadata: {
                        pageNumber: chunk.pageNumber || 1,
                        page: chunk.pageNumber || 1,
                        originalName: document.originalName || "",
                        documentName: document.originalName || "",
                        category: document.category || "",
                        documentType: isImage ? "image" : meta.documentType,
                        institution: document.institution || "",
                        academicEntities: academicEntities,
                        department: isCampusNav ? (chunk.campusMeta?.description || "") : meta.department,
                        source: document.originalName || "",
                        sourceType: isImage ? "image" : (isCampusNav ? "campus_navigation" : "pdf"),
                        buildingNumber: isCampusNav ? (chunk.campusMeta?.buildingNumber || "") : undefined,
                        buildingName: isCampusNav ? (chunk.campusMeta?.buildingName || "") : undefined,
                        floor: isCampusNav ? (chunk.campusMeta?.floor || "") : undefined,
                        roomNumber: isCampusNav ? (chunk.campusMeta?.roomNumber || "") : undefined,
                        mimeType: isImage ? document.mimeType : undefined,
                        filename: isImage ? document.originalName : undefined,
                        isOcr: chunk.isOcr || false,
                        contentType: chunk.contentType || "text"
                    }
                };
            });
            if (chunkDocs.length > 0) {
                await Chunk.insertMany(chunkDocs);
            }
        } catch (mongoChunkErr) {
            console.error(`Failed to sync MongoDB Chunk collection for ${documentId}:`, mongoChunkErr);
        }

        // 6. MongoDB Update & Completion (ONLY AFTER VERIFYING QDRANT POINTS > 0)
        document.embeddingStatus = "indexed";
        document.chunkCount = rawChunks.length;
        document.metadata = {
            ...(document.metadata || {}),
            pages: pageCount,
            extractedLength: text.length,
            qdrantPoints: pointCount,
            indexedAt: new Date().toISOString(),
            academicEntities: academicEntities
        };
        await document.save();
        console.log(`[INDEX] Document completed successfully with ${pointCount} Qdrant vectors`);
        if (isImage) {
            console.log(`[IMAGE INDEX] Completed: ${document.originalName}`);
        }
    } catch (err) {
        console.error(`[INDEX] Background Indexing failed for ${documentId}:`, err);
        document.embeddingStatus = "failed";
        document.metadata = {
            ...(document.metadata || {}),
            error: err.message,
            lastErrorAt: new Date().toISOString(),
            notes: (document.metadata?.notes || "") + `\n[Index Error: ${err.message}]`
        };
        await document.save();
        throw err; // Do not hide exceptions
    } finally {
        // Free memory after every indexed document (Requirement 2 & 6)
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

// Automatic startup worker queue and stale reset is disabled as per CRITICAL FIX requirements
// setTimeout(async () => {
//     try {
//         const staleThresholdMs = Number(process.env.STALE_JOB_THRESHOLD_MS) || 15 * 60 * 1000;
//         const cutoffTime = new Date(Date.now() - staleThresholdMs);
//         const stuckDocs = await Document.updateMany(
//             { 
//                 status: { $ne: "deleted" }, 
//                 embeddingStatus: "processing",
//                 $or: [
//                     { updatedAt: { $lt: cutoffTime } },
//                     { "metadata.lastIndexAttemptAt": { $lt: cutoffTime.toISOString() } }
//                 ]
//             },
//             { 
//                 $set: { 
//                     embeddingStatus: "pending",
//                     "metadata.indexAttempts": 0
//                 } 
//             }
//         );
//         if (stuckDocs.modifiedCount > 0) {
//             console.log(`[IndexingService] Reset ${stuckDocs.modifiedCount} stuck "processing" documents back to "pending" and cleared attempts.`);
//         }
//     } catch (err) {
//         console.error("Failed to reset stuck processing documents on start:", err);
//     }
// 
//     processNextJob().catch((err) => console.error("Initial worker queue start failed:", err));
// }, 3000);

const deleteDocumentIndex = async (documentId) => {
    try {
        await withTimeout(
            client.delete(collectionName, {
                filter: {
                    must: [
                        {
                            key: "documentId",
                            match: {
                                value: String(documentId)
                            }
                        }
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

    document.embeddingStatus = "pending";
    document.metadata = {
        ...(document.metadata || {}),
        indexAttempts: 0
    };
    await document.save();
    
    manuallyQueuedIds.add(String(documentId));

    indexDocumentBackground(document._id).catch(() => {});
    return document;
};

const rebuildAllEmbeddings = async () => {
    // Disable rebuilding all embeddings completely
    return { count: 0 };
};

module.exports = {
    indexDocumentBackground,
    deleteDocumentIndex,
    reindexDocument,
    rebuildAllEmbeddings,
    runIndexingJob
};
