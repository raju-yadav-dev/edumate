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
const indexDocumentBackground = async (documentId, fileBuffer = null) => {
    const document = await Document.findById(documentId);
    if (!document || document.status === "deleted") {
        return;
    }

    try {
        document.embeddingStatus = "processing";
        await document.save();

        let buffer = fileBuffer;
        if (!buffer) {
            buffer = await downloadFromSupabase(document.storagePath);
        }

        let rawChunks = [];
        let numPages = 1;
        let extractedText = "";
        const splitter = new RecursiveCharacterTextSplitter();

        const isPdf = document.mimeType === "application/pdf" || document.originalName.toLowerCase().endsWith(".pdf");

        if (isPdf) {
            const parsed = await pdfExtractor.extractText(buffer);
            numPages = parsed.numPages || 1;
            if (parsed.requiresOcr) {
                console.log(`[IndexingService] Scanned PDF detected for doc ${documentId}. Initiating OCR fallback...`);
                const ImageExtractor = require("../../crawler/extractors/ImageExtractor");
                const ocrResult = await ImageExtractor.extract(buffer);
                extractedText = ocrResult.text || "";
                const splits = splitter.splitText(extractedText);
                splits.forEach((text) => {
                    rawChunks.push({
                        content: text,
                        pageNumber: 1
                    });
                });
            } else {
                for (const page of parsed.pages) {
                    const pageSplits = splitter.splitText(page.text);
                    for (const text of pageSplits) {
                        rawChunks.push({
                            content: text,
                            pageNumber: page.pageNumber
                        });
                    }
                }
            }
        } else {
            const UniversalExtractor = require("../../crawler/extractors/UniversalExtractor");
            const extracted = await UniversalExtractor.extract(buffer, document.originalName);
            extractedText = extracted.text || "";
            const splits = splitter.splitText(extractedText);
            splits.forEach((text) => {
                rawChunks.push({
                    content: text,
                    pageNumber: 1
                });
            });
        }

        // 2. Clear any existing chunks for this document in Qdrant
        await deleteDocumentIndex(documentId);

        if (rawChunks.length > 0) {
            // 4. Batch generate embeddings for all chunks
            const textsToEmbed = rawChunks.map((c) => c.content);
            const embeddings = await embeddingService.getChunksEmbeddings(textsToEmbed);

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

            // 6. Bulk insert points to Qdrant collection in batches of 100 to prevent timeouts/failures
            const qdrantBatchSize = 100;
            for (let start = 0; start < points.length; start += qdrantBatchSize) {
                const subPoints = points.slice(start, start + qdrantBatchSize);
                await client.upsert(collectionName, {
                    wait: true,
                    points: subPoints
                });
            }
        }

        document.embeddingStatus = "indexed";
        document.chunkCount = rawChunks.length;
        document.metadata = {
            ...(document.metadata || {}),
            pages: numPages
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
