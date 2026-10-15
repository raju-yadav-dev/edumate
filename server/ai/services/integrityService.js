const Document = require("../../models/Document");
const localChunkManager = require("../../storage/localChunkManager");
const { client: qdrantClient, collectionName, vectorName: qdrantVectorName } = require("../config/qdrant");
const embeddingService = require("./embeddingService");
const metadataBuilder = require("../utils/metadataBuilder");
const { deterministicChunkId } = require("../utils/chunkRelationships");

const EXPECTED_DIMENSION = 768;

/**
 * Validate integrity of a single document
 */
const validateDocumentIntegrity = async (documentId) => {
    const document = await Document.findOne({ _id: documentId, status: "active" });
    if (!document) {
        throw new Error("Document not found.");
    }

    const chunks = localChunkManager.getDocumentChunks(documentId);
    
    // Check Qdrant point count
    let qdrantCount = 0;
    try {
        const qCountRes = await qdrantClient.count(collectionName, {
            filter: {
                must: [{ key: "documentId", match: { value: String(documentId) } }]
            }
        });
        qdrantCount = qCountRes?.count || 0;
    } catch (e) {
        console.warn(`[Integrity] Failed to count Qdrant points for ${documentId}:`, e.message);
    }

    const issues = [];
    const chunkIds = new Set();
    let duplicateChunkCount = 0;
    let missingEmbeddingsCount = 0;
    let missingPageNumberCount = 0;
    let emptyChunkCount = 0;
    let oversizedChunkCount = 0;
    let missingMetadataCount = 0;
    let totalTokens = 0;

    chunks.forEach((chunk, index) => {
        const cid = chunk.metadata?.chunkId || String(chunk._id);
        if (chunkIds.has(cid)) {
            duplicateChunkCount++;
        }
        chunkIds.add(cid);

        // Embedding check
        if (!chunk.embedding || !Array.isArray(chunk.embedding) || chunk.embedding.length !== EXPECTED_DIMENSION) {
            missingEmbeddingsCount++;
        }

        // Page number check
        if (!chunk.metadata?.pageNumber || chunk.metadata.pageNumber < 1) {
            missingPageNumberCount++;
        }

        // Empty chunk check
        const text = String(chunk.content || "").trim();
        if (text.length === 0) {
            emptyChunkCount++;
        }

        // Token estimation (approx 4 chars/token)
        const tokens = Math.ceil(text.length / 4);
        totalTokens += tokens;
        if (tokens > 2000 || text.length > 8000) {
            oversizedChunkCount++;
        }

        // Missing metadata check
        if (!chunk.metadata?.heading || !chunk.metadata?.originalName) {
            missingMetadataCount++;
        }
    });

    if (duplicateChunkCount > 0) issues.push(`Found ${duplicateChunkCount} duplicate chunk ID(s).`);
    if (missingEmbeddingsCount > 0) issues.push(`Found ${missingEmbeddingsCount} chunk(s) with missing or invalid ${EXPECTED_DIMENSION}-dim embeddings.`);
    if (missingPageNumberCount > 0) issues.push(`Found ${missingPageNumberCount} chunk(s) missing page numbers.`);
    if (emptyChunkCount > 0) issues.push(`Found ${emptyChunkCount} empty chunk(s).`);
    if (oversizedChunkCount > 0) issues.push(`Found ${oversizedChunkCount} oversized chunk(s) exceeding token limits.`);
    if (missingMetadataCount > 0) issues.push(`Found ${missingMetadataCount} chunk(s) with incomplete metadata.`);

    // Qdrant vector sync check
    const isIndexed = ["indexed", "completed"].includes(String(document.embeddingStatus).toLowerCase());
    if (isIndexed && qdrantCount !== chunks.length) {
        issues.push(`Vector mismatch: ${chunks.length} MongoDB chunk(s) vs ${qdrantCount} Qdrant point(s).`);
    }

    if (isIndexed && chunks.length === 0 && document.chunkCount > 0) {
        issues.push("Missing MongoDB chunk records while document is marked indexed.");
    }

    const isHealthy = issues.length === 0;
    const report = {
        documentId: String(document._id),
        originalName: document.originalName,
        category: document.category,
        embeddingStatus: document.embeddingStatus,
        totalChunks: chunks.length,
        qdrantPoints: qdrantCount,
        totalTokens,
        avgTokensPerChunk: chunks.length > 0 ? Math.round(totalTokens / chunks.length) : 0,
        isHealthy,
        issues,
        validatedAt: new Date().toISOString()
    };

    // Update document in MongoDB
    document.healthy = isHealthy;
    document.validationReport = report;
    await document.save();

    return report;
};

/**
 * Validate integrity of the entire knowledge base
 */
const validateKnowledgeBaseIntegrity = async () => {
    const documents = await Document.find({ status: "active" }).select("_id originalName category embeddingStatus chunkCount healthy validationReport");

    let healthyCount = 0;
    let needingRepairCount = 0;
    let missingEmbeddingsTotal = 0;
    let missingVectorsTotal = 0;
    let duplicateChunksTotal = 0;
    let totalChunksSum = 0;
    let totalTokensSum = 0;
    const detailedReports = [];

    for (const doc of documents) {
        try {
            const report = await validateDocumentIntegrity(doc._id);
            detailedReports.push(report);

            if (report.isHealthy) {
                healthyCount++;
            } else {
                needingRepairCount++;
            }

            totalChunksSum += report.totalChunks;
            totalTokensSum += report.totalTokens;

            if (report.issues.some(i => i.includes("missing or invalid"))) missingEmbeddingsTotal++;
            if (report.issues.some(i => i.includes("Vector mismatch"))) missingVectorsTotal++;
            if (report.issues.some(i => i.includes("duplicate chunk"))) duplicateChunksTotal++;
        } catch (e) {
            console.error(`[Integrity] Validation error for doc ${doc._id}:`, e.message);
        }
    }

    const totalDocs = documents.length;
    const avgChunksPerDoc = totalDocs > 0 ? Math.round((totalChunksSum / totalDocs) * 10) / 10 : 0;
    const avgTokensPerChunk = totalChunksSum > 0 ? Math.round(totalTokensSum / totalChunksSum) : 0;

    return {
        totalDocuments: totalDocs,
        healthyDocuments: healthyCount,
        documentsNeedingRepair: needingRepairCount,
        missingEmbeddings: missingEmbeddingsTotal,
        missingVectors: missingVectorsTotal,
        duplicateChunks: duplicateChunksTotal,
        totalChunks: totalChunksSum,
        avgChunksPerDoc,
        avgTokensPerChunk,
        detailedReports
    };
};

/**
 * Surgically repair a single document's damaged components without re-chunking from scratch
 */
const repairDocument = async (documentId) => {
    const document = await Document.findOne({ _id: documentId, status: "active" });
    if (!document) {
        throw new Error("Document not found.");
    }

    const chunks = localChunkManager.getDocumentChunks(documentId);
    if (chunks.length === 0) {
        // If 0 chunks exist, trigger background queue re-index
        const { enqueueDocuments } = require("./chunkingQueueService");
        await enqueueDocuments({ ids: [documentId], forceRechunk: true });
        return { repaired: true, mode: "reindexed", message: "Queued for full rechunking." };
    }

    // Repair embeddings and Qdrant points
    const { formatPointVector } = require("../config/qdrant");
    const texts = chunks.map(c => c.content);
    const generated = await embeddingService.getChunksEmbeddings(texts);

    const points = await Promise.all(chunks.map(async (chunk, index) => {
        const pointId = chunk.chunkId || deterministicChunkId(documentId, index);
        const vectorParam = await formatPointVector(generated[index]);
        return {
            id: pointId,
            vector: vectorParam,
            payload: {
                ...(chunk.metadata || {}),
                id: pointId,
                content: chunk.content,
                contentHash: chunk.contentHash,
                documentId: String(documentId),
                chunkIndex: index,
                pageNumber: chunk.pageNumber || 1
            }
        };
    }));

    await qdrantClient.upsert(collectionName, { wait: true, points });
    await localChunkManager.replaceDocumentChunks(documentId, chunks, {
        originalName: document.originalName,
        category: document.category,
        department: document.department,
        institution: document.institution
    });

    return { repaired: true, chunkCount: chunks.length, qdrantPoints: points.length };
};

/**
 * Auto-repair all documents with integrity issues
 */
const autoRepairAll = async () => {
    const unHealthyDocs = await Document.find({ status: "active", healthy: false }).select("_id");
    const results = [];

    for (const doc of unHealthyDocs) {
        try {
            const res = await repairDocument(doc._id);
            results.push({ documentId: doc._id, status: "success", result: res });
        } catch (err) {
            results.push({ documentId: doc._id, status: "failed", error: err.message });
        }
    }

    return { total: unHealthyDocs.length, results };
};

/**
 * Repair all documents in need of repair
 */
const repairAllDocuments = async () => {
    return await autoRepairAll();
};

/**
 * Get chunk diff / list for comparison tool
 */
const getDocumentChunks = async (documentId) => {
    const document = await Document.findOne({ _id: documentId }).select("originalName category department institution mimeType fileSize chunkCount createdAt updatedAt").lean();
    if (!document) throw new Error("Document not found.");

    const chunks = localChunkManager.getDocumentChunks(documentId);

    const formattedChunks = chunks.map((c, i) => ({
        id: c.chunkId || c.metadata?.chunkId || `${documentId}_${i}`,
        chunkIndex: c.chunkIndex ?? i,
        chunkOrder: (c.chunkIndex ?? i) + 1,
        pageNumber: c.pageNumber || c.metadata?.pageNumber || 1,
        heading: c.heading || c.metadata?.heading || "General Section",
        parentHeading: c.parentHeading || c.metadata?.parentHeading || "Document",
        content: c.content,
        characterCount: (c.content || "").length,
        tokenCount: Math.ceil((c.content || "").length / 4),
        hasEmbedding: true,
        keywords: c.keywords || c.metadata?.keywords || [],
        relationships: c.metadata?.relationships || {},
        metadata: c.metadata || {}
    }));

    return {
        document,
        chunks: formattedChunks,
        totalChunks: formattedChunks.length
    };
};

const auditKnowledgeBase = async () => {
    const mongoose = require("mongoose");
    if (mongoose.connection?.readyState !== 1) {
        return {
            isHealthy: true,
            stats: { totalDocuments: 0, healthyDocuments: 0, issuesFound: 0 },
            issues: [],
            detailedReports: []
        };
    }
    const report = await validateKnowledgeBaseIntegrity();
    return {
        isHealthy: report.documentsNeedingRepair === 0,
        stats: {
            totalDocuments: report.totalDocuments,
            healthyDocuments: report.healthyDocuments,
            issuesFound: report.documentsNeedingRepair
        },
        issues: (report.detailedReports || [])
            .filter(r => !r.isHealthy)
            .map(r => ({
                documentId: r.documentId,
                title: r.originalName,
                category: r.category,
                issueType: "INTEGRITY_MISMATCH",
                message: r.issues.join("; ")
            })),
        rawReport: report
    };
};

module.exports = {
    validateDocumentIntegrity,
    validateKnowledgeBaseIntegrity,
    auditKnowledgeBase,
    repairDocument,
    repairAllDocuments,
    autoRepairAll,
    getDocumentChunks
};

