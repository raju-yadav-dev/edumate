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
        indexAttempts: (document.metadata?.indexAttempts || 0)
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

    let attempts = Number(document.metadata?.indexAttempts || 0);
    const maxAttempts = 3;

    for (; attempts < maxAttempts; attempts += 1) {
        try {
            document.embeddingStatus = "processing";
            document.metadata = {
                ...(document.metadata || {}),
                indexAttempts: attempts,
                lastIndexAttemptAt: new Date().toISOString()
            };
            await document.save();

            let buffer = fileBuffer;
            if (!buffer) {
                buffer = await withTimeout(downloadFromSupabase(document.storagePath), 35000, "Supabase file download timed out (35s)");
            }

            const ext = path.extname(document.originalName || "").toLowerCase();
            const isPdf = document.mimeType === "application/pdf" || ext === ".pdf";
            if (!isPdf && document.mimeType !== "application/pdf") {
                const extracted = await withTimeout(UniversalExtractor.extract(buffer, document.originalName), 45000, "Document extraction timed out (45s)");
                const splitter = new RecursiveCharacterTextSplitter();
                const chunks = splitter.splitText(extracted.text || "");
                await deleteDocumentIndex(documentId);
                if (chunks.length > 0) {
                    const embeddings = await withTimeout(embeddingService.getChunksEmbeddings(chunks), 50000, "Embedding generation timed out (50s)");
                    const points = [];
                    const timestamp = new Date().toISOString();
                    chunks.forEach((chunk, index) => {
                        const pointId = crypto.createHash("sha256").update(`${documentId}:${index}:${chunk}`).digest("hex");
                        const meta = metadataBuilder.buildMetadata({
                            documentId: String(documentId),
                            originalName: document.originalName,
                            pageNumber: 1,
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
                                content: chunk,
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
                    await withTimeout(client.upsert(collectionName, { wait: true, points }), 30000, "Qdrant vector database upload timed out (30s)");
                }
                document.embeddingStatus = "indexed";
                document.chunkCount = chunks.length;
                document.metadata = {
                    ...(document.metadata || {}),
                    pages: 1,
                    indexedAt: new Date().toISOString()
                };
                await document.save();
                return;
            }

            const splitter = new RecursiveCharacterTextSplitter();
            const { chunks, pageCount, requiresOcr } = await buildChunks(buffer, document.originalName, document.mimeType, splitter);
            if (requiresOcr) {
                document.embeddingStatus = "not_required";
                document.metadata = {
                    ...(document.metadata || {}),
                    requiresOcr: true,
                    notes: (document.metadata?.notes || "") + "\n[Image-only PDF. Indexing skipped.]"
                };
                await document.save();
                return;
            }

            await deleteDocumentIndex(documentId);
            if (chunks.length > 0) {
                const embeddings = await withTimeout(embeddingService.getChunksEmbeddings(chunks.map((chunk) => chunk.content)), 50000, "Embedding generation timed out (50s)");
                const points = [];
                const timestamp = new Date().toISOString();
                chunks.forEach((chunk, index) => {
                    const pointId = crypto.createHash("sha256").update(`${documentId}:${index}:${chunk.content}`).digest("hex");
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
                await withTimeout(client.upsert(collectionName, { wait: true, points }), 30000, "Qdrant vector database upload timed out (30s)");
            }

            document.embeddingStatus = "indexed";
            document.chunkCount = chunks.length;
            document.metadata = {
                ...(document.metadata || {}),
                pages: pageCount,
                indexedAt: new Date().toISOString()
            };
            await document.save();
            return;
        } catch (err) {
            console.error(`indexingService Background Indexing failed for ${documentId} (attempt ${attempts + 1}/${maxAttempts}):`, err);
            if (attempts + 1 >= maxAttempts) {
                document.embeddingStatus = "failed";
                document.metadata = {
                    ...(document.metadata || {}),
                    error: err.message,
                    lastErrorAt: new Date().toISOString(),
                    notes: (document.metadata?.notes || "") + `\n[Index Error: ${err.message}]`
                };
                await document.save();
                return;
            }
        }
    }
};

setTimeout(async () => {
    try {
        const stuckDocs = await Document.updateMany(
            { status: { $ne: "deleted" }, embeddingStatus: "processing" },
            { $set: { embeddingStatus: "pending" } }
        );
        if (stuckDocs.modifiedCount > 0) {
            console.log(`[IndexingService] Reset ${stuckDocs.modifiedCount} stuck "processing" documents back to "pending".`);
        }
    } catch (err) {
        console.error("Failed to reset stuck processing documents on start:", err);
    }

    processNextJob().catch((err) => console.error("Initial worker queue start failed:", err));
}, 3000);

const deleteDocumentIndex = async (documentId) => {
    try {
        await client.delete(collectionName, {
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
        });
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
