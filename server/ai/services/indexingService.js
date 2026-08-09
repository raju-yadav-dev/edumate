const path = require("path");
const Document = require("../../models/Document");
const supabase = require("../../config/supabase");
const pdfExtractor = require("../utils/pdfExtractor");
const { RecursiveCharacterTextSplitter } = require("../utils/chunkDocument");
const metadataBuilder = require("../utils/metadataBuilder");
const embeddingService = require("./embeddingService");
const { client, collectionName } = require("../config/qdrant");
const crypto = require("crypto");
const UniversalExtractor = require("../../crawler/extractors/UniversalExtractor");

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_BUCKET || "documents";

const bufferCache = new Map();
let isWorkerRunning = false;
const INDEXING_CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.INDEXING_CONCURRENCY) || 3));

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
    return Document.findOneAndUpdate(
        {
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
            sort: { updatedAt: 1 },
            returnDocument: "after"
        }
    );
};

const processNextJob = async () => {
    if (isWorkerRunning) return;
    isWorkerRunning = true;

    try {
        const workerLoop = async (workerId) => {
            let emptyPolls = 0;
            while (true) {
                const nextDoc = await claimNextPendingDocument();
                if (!nextDoc) {
                    emptyPolls += 1;
                    if (emptyPolls < 3) {
                        await new Promise((resolve) => setTimeout(resolve, 250));
                        continue;
                    }
                    break;
                }

                emptyPolls = 0;
                console.log(`[IndexingService] Worker ${workerId} indexing document ${nextDoc._id}`);
                try {
                    await runIndexingJob(nextDoc._id);
                } catch (jobErr) {
                    console.error(`[IndexingService] Worker ${workerId} failed to run indexing job for document ${nextDoc._id}:`, jobErr);
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
                }

                const moreWork = await Document.exists({
                    status: { $ne: "deleted" },
                    embeddingStatus: "pending"
                });

                if (!moreWork) {
                    await new Promise((resolve) => setTimeout(resolve, 250));
                }
            }
        };

        const workers = Array.from({ length: INDEXING_CONCURRENCY }, (_, index) => workerLoop(index + 1));
        await Promise.all(workers);
    } catch (err) {
        console.error("Indexing worker queue error:", err);
    } finally {
        isWorkerRunning = false;
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

    try {
        document.embeddingStatus = "processing";
        document.metadata = {
            ...(document.metadata || {}),
            indexAttempts: (document.metadata?.indexAttempts || 0) + 1,
            lastIndexAttemptAt: new Date().toISOString()
        };
        await document.save();

        let buffer = fileBuffer;
        if (!buffer) {
            buffer = await withTimeout(downloadFromSupabase(document.storagePath), 35000, "Supabase file download timed out (35s)");
        }

        console.log(`[INDEX] Starting document: ${document.originalName} (${documentId})`);

        // 1. Extraction Stage
        console.log(`[EXTRACT] Started`);
        const ext = path.extname(document.originalName || "").toLowerCase();
        const isPdf = document.mimeType === "application/pdf" || ext === ".pdf";
        
        let text = "";
        let pageCount = 1;
        let rawChunks = [];
        let ocrFlag = false;

        const splitter = new RecursiveCharacterTextSplitter();

        if (isPdf) {
            const parsed = await withTimeout(pdfExtractor.extractText(buffer), 45000, "PDF text extraction timed out (45s)");
            ocrFlag = parsed.requiresOcr;
            pageCount = parsed.numPages || 1;
            
            // Collect full text to measure char count
            const fullText = (parsed.pages || []).map(p => p.text || "").join("\n");
            text = fullText;

            if (ocrFlag || text.trim().length === 0) {
                throw new Error("Extraction returned empty text (Image-only or scanned PDF with no text layer).");
            }

            // 2. Chunking Stage
            console.log(`[CHUNK] Started`);
            for (const page of parsed.pages || []) {
                const pageChunks = splitter.splitText(page.text || "");
                pageChunks.forEach((chunk) => {
                    rawChunks.push({ content: chunk, pageNumber: page.pageNumber });
                });
            }
        } else {
            const extracted = await withTimeout(UniversalExtractor.extract(buffer, document.originalName), 45000, "Document extraction timed out (45s)");
            text = extracted.text || "";
            
            if (text.trim().length === 0) {
                throw new Error("Extraction returned empty text (Empty or unreadable file).");
            }

            // 2. Chunking Stage
            console.log(`[CHUNK] Started`);
            const splits = splitter.splitText(text);
            splits.forEach((chunk) => {
                rawChunks.push({ content: chunk, pageNumber: 1 });
            });
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

        const points = [];
        const timestamp = new Date().toISOString();
        rawChunks.forEach((chunk, index) => {
            const sha = crypto.createHash("sha256").update(`${documentId}:${index}:${chunk.content}`).digest("hex");
            const pointId = `${sha.slice(0, 8)}-${sha.slice(8, 12)}-4${sha.slice(13, 16)}-a${sha.slice(17, 20)}-${sha.slice(20, 32)}`;
            const meta = metadataBuilder.buildMetadata({
                documentId: String(documentId),
                originalName: document.originalName,
                pageNumber: chunk.pageNumber,
                category: document.category,
                department: document.department,
                institution: document.institution,
                uploadedBy: String(document.createdBy || "")
            });
            points.push({
                id: pointId,
                vector: embeddings[index],
                payload: {
                    id: pointId,
                    documentId: meta.documentId,
                    content: chunk.content,
                    originalName: meta.originalName,
                    pageNumber: meta.pageNumber,
                    category: meta.category,
                    department: meta.department,
                    institution: meta.institution,
                    uploadedBy: meta.uploadedBy,
                    chunkIndex: index,
                    createdAt: timestamp,
                    contentHash: document.contentHash || document.checksum
                }
            });
        });

        console.log(`[QDRANT] Vector count before upsert: ${points.length}`);
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
            const chunkDocs = rawChunks.map((chunk, index) => ({
                document: documentId,
                content: chunk.content,
                embedding: embeddings[index] || [],
                metadata: {
                    pageNumber: chunk.pageNumber || 1,
                    originalName: document.originalName || "",
                    category: document.category || "",
                    institution: document.institution || "",
                    department: document.department || ""
                }
            }));
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
            indexedAt: new Date().toISOString()
        };
        await document.save();
        console.log(`[INDEX] Document completed successfully with ${pointCount} Qdrant vectors`);
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
    }
};

setTimeout(async () => {
    try {
        const stuckDocs = await Document.updateMany(
            { status: { $ne: "deleted" }, embeddingStatus: "processing" },
            { 
                $set: { 
                    embeddingStatus: "pending",
                    "metadata.indexAttempts": 0
                } 
            }
        );
        if (stuckDocs.modifiedCount > 0) {
            console.log(`[IndexingService] Reset ${stuckDocs.modifiedCount} stuck "processing" documents back to "pending" and cleared attempts.`);
        }
    } catch (err) {
        console.error("Failed to reset stuck processing documents on start:", err);
    }

    processNextJob().catch((err) => console.error("Initial worker queue start failed:", err));
}, 3000);

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
    indexDocumentBackground(document._id).catch(() => {});
    return document;
};

const rebuildAllEmbeddings = async () => {
    const documents = await Document.find({
        status: { $ne: "deleted" }
    });

    for (const doc of documents) {
        indexDocumentBackground(doc._id).catch(() => {});
    }

    return { count: documents.length };
};

module.exports = {
    indexDocumentBackground,
    deleteDocumentIndex,
    reindexDocument,
    rebuildAllEmbeddings
};
