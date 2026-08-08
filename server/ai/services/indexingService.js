const Document = require("../../models/Document");
const supabase = require("../../config/supabase");
const pdfExtractor = require("../utils/pdfExtractor");
const { RecursiveCharacterTextSplitter } = require("../utils/chunkDocument");
const metadataBuilder = require("../utils/metadataBuilder");
const embeddingService = require("./embeddingService");
const { client, collectionName } = require("../config/qdrant");
const crypto = require("crypto");

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_BUCKET || "documents";

/**
 * Downloads a file from Supabase storage into a Node Buffer
 * @param {string} storagePath
 * @returns {Promise<Buffer>}
 */
const downloadFromSupabase = async (storagePath) => {
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .download(storagePath);
    if (error) {
        throw new Error(`Failed to download ${storagePath} from Supabase: ${error.message}`);
    }
    return Buffer.from(await data.arrayBuffer());
};

/**
 * Indexes a PDF document in Qdrant in the background
 * @param {string} documentId - MongoDB Document reference ID
 * @param {Buffer} [fileBuffer] - Optional document buffer already in memory
 * @returns {Promise<void>}
 */
const bufferCache = new Map();
let isWorkerRunning = false;

/**
 * Wraps a promise in a timeout
 * @param {Promise} promise 
 * @param {number} ms 
 * @param {string} message 
 */
const withTimeout = (promise, ms, message = "Operation timed out") => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(message));
        }, ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

const processNextJob = async () => {
    if (isWorkerRunning) return;
    isWorkerRunning = true;

    try {
        while (true) {
            const nextDoc = await Document.findOne({
                status: { $ne: "deleted" },
                embeddingStatus: "pending"
            }).sort({ updatedAt: 1 });

            if (!nextDoc) break;

            await runIndexingJob(nextDoc._id);

            // Wait 1.5 seconds between jobs to respect Gemini API rate limits
            await new Promise((resolve) => setTimeout(resolve, 1500));
        }
    } catch (err) {
        console.error("Indexing worker queue error:", err);
    } finally {
        isWorkerRunning = false;
    }
};

/**
 * Indexes a PDF document in Qdrant in the background (queued)
 * @param {string} documentId - MongoDB Document reference ID
 * @param {Buffer} [fileBuffer] - Optional document buffer already in memory
 * @returns {Promise<void>}
 */
const indexDocumentBackground = async (documentId, fileBuffer = null) => {
    const document = await Document.findById(documentId);
    if (!document || document.status === "deleted") {
        return;
    }

    document.embeddingStatus = "pending";
    await document.save();

    if (fileBuffer) {
        bufferCache.set(String(documentId), fileBuffer);
    }

    processNextJob().catch((err) => {
        console.error("Background worker process start failure:", err);
    });
};

/**
 * Runs the actual extraction and embedding logic sequentially with timeouts
 * @param {string} documentId
 * @returns {Promise<void>}
 */
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
        await document.save();

        let buffer = fileBuffer;
        if (!buffer) {
            buffer = await withTimeout(
                downloadFromSupabase(document.storagePath),
                35000,
                "Supabase file download timed out (35s)"
            );
        }

        // Only index PDF files
        if (document.mimeType !== "application/pdf") {
            document.embeddingStatus = "not_required";
            await document.save();
            return;
        }

        // 1. Extract text page-by-page (45s timeout)
        const parsed = await withTimeout(
            pdfExtractor.extractText(buffer),
            45000,
            "PDF text extraction timed out (45s)"
        );
        
        if (parsed.requiresOcr) {
            document.embeddingStatus = "not_required";
            document.metadata = {
                ...(document.metadata || {}),
                requiresOcr: true,
                notes: (document.metadata?.notes || "") + "\n[Image-only PDF. Indexing skipped.]"
            };
            await document.save();
            return;
        }

        // 2. Clear any existing chunks for this document in Qdrant
        await deleteDocumentIndex(documentId);

        // 3. Chunk page texts using the splitter
        const splitter = new RecursiveCharacterTextSplitter();
        const rawChunks = [];

        for (const page of parsed.pages) {
            const pageSplits = splitter.splitText(page.text);
            for (const text of pageSplits) {
                rawChunks.push({
                    content: text,
                    pageNumber: page.pageNumber
                });
            }
        }

        if (rawChunks.length > 0) {
            // 4. Batch generate embeddings for all chunks (50s timeout)
            const textsToEmbed = rawChunks.map((c) => c.content);
            const embeddings = await withTimeout(
                embeddingService.getChunksEmbeddings(textsToEmbed),
                50000,
                "Gemini API embedding generation timed out (50s)"
            );

            // 5. Structure payload points for Qdrant
            const points = [];
            const timestamp = new Date().toISOString();

            for (let i = 0; i < rawChunks.length; i++) {
                const pointId = crypto.randomUUID(); // Qdrant requires standard UUID format
                
                const meta = metadataBuilder.buildMetadata({
                    documentId: String(documentId),
                    originalName: document.originalName,
                    pageNumber: rawChunks[i].pageNumber,
                    category: document.category,
                    department: document.department,
                    institution: document.institution,
                    uploadedBy: String(document.createdBy || "")
                });

                points.push({
                    id: pointId,
                    vector: embeddings[i],
                    payload: {
                        id: pointId,
                        documentId: meta.documentId,
                        content: rawChunks[i].content,
                        originalName: meta.originalName,
                        pageNumber: meta.pageNumber,
                        category: meta.category,
                        department: meta.department,
                        institution: meta.institution,
                        uploadedBy: meta.uploadedBy,
                        chunkIndex: i,
                        createdAt: timestamp
                    }
                });
            }

            // 6. Bulk insert points to Qdrant collection (30s timeout)
            await withTimeout(
                client.upsert(collectionName, {
                    wait: true,
                    points
                }),
                30000,
                "Qdrant vector database upload timed out (30s)"
            );
        }

        document.embeddingStatus = "indexed";
        document.chunkCount = rawChunks.length;
        document.metadata = {
            ...(document.metadata || {}),
            pages: parsed.numPages
        };
        await document.save();
    } catch (err) {
        console.error(`indexingService Background Indexing failed for ${documentId}:`, err);
        document.embeddingStatus = "failed";
        document.metadata = {
            ...(document.metadata || {}),
            error: err.message,
            notes: (document.metadata?.notes || "") + `\n[Index Error: ${err.message}]`
        };
        await document.save();
    }
};

// Start queue processor on module load and reset any stuck tasks
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

    processNextJob().catch(err => console.error("Initial worker queue start failed:", err));
}, 3000);

/**
 * Removes a document index from Qdrant using filter key match query
 * @param {string} documentId
 * @returns {Promise<void>}
 */
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

/**
 * Re-indexes a single document
 * @param {Object} params
 * @param {string} params.documentId
 * @returns {Promise<Object>}
 */
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

    indexDocumentBackground(document._id).catch(() => {});
    return document;
};

/**
 * Rebuilds embeddings for all active PDF documents
 * @returns {Promise<Object>}
 */
const rebuildAllEmbeddings = async () => {
    const documents = await Document.find({
        status: { $ne: "deleted" },
        mimeType: "application/pdf"
    });

    for (const doc of documents) {
        indexDocumentBackground(doc._id).catch(() => {});
    }

    return {
        count: documents.length
    };
};

module.exports = {
    indexDocumentBackground,
    deleteDocumentIndex,
    reindexDocument,
    rebuildAllEmbeddings
};
