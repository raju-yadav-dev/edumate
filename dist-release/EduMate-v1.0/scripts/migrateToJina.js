const path = require("path");
const mongoose = require("mongoose");
const crypto = require("crypto");

// Ensure environment variables are loaded
const projectRoot = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(projectRoot, ".env") });
require("dotenv").config({ path: path.join(projectRoot, "server", ".env") });

const connectDB = require("../server/config/db");
const Document = require("../server/models/Document");
const Chunk = require("../server/models/Chunk");
const embeddings = require("../server/ai/config/embeddings");
const { client: qdrantClient, collectionName: qdrantCollection } = require("../server/ai/config/qdrant");
const indexingService = require("../server/ai/services/indexingService");
const retrievalService = require("../server/ai/services/retrievalService");

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
    console.log("============================================================");
    console.log("          EduMate Jina AI Embedding Migration Runner         ");
    console.log("============================================================\n");

    // 1. Connect to MongoDB
    console.log("[MIGRATION] Connecting to MongoDB...");
    await connectDB();

    // 2. Verify Jina API & dimension size
    console.log("[MIGRATION] Verifying Jina AI Embedding API...");
    let testVector;
    try {
        testVector = await embeddings.embedText("EduMate Qdrant semantic search verification test", { 
            timeout: 10000, 
            maxAttempts: 1, 
            task: "retrieval.passage" 
        });
        if (!Array.isArray(testVector)) {
            throw new Error("Returned embedding is not an array.");
        }
        if (testVector.length !== 768) {
            throw new Error(`Expected vector dimension 768, but Jina returned ${testVector.length}.`);
        }
        console.log(`[MIGRATION] ✓ Jina API connection and vector dimension (768) verified.`);
    } catch (err) {
        console.error(`[MIGRATION] ❌ Jina API check failed: ${err.message}`);
        process.exit(1);
    }

    // 3. Verify Qdrant connection and collection configuration
    console.log("[MIGRATION] Verifying Qdrant Collection...");
    let qdrantDim;
    try {
        const collectionInfo = await qdrantClient.getCollection(qdrantCollection);
        qdrantDim = collectionInfo.config?.params?.vectors?.size;
        if (qdrantDim !== 768) {
            throw new Error(`Qdrant collection is configured for dimension ${qdrantDim}, but Jina uses 768.`);
        }
        console.log(`[MIGRATION] ✓ Qdrant collection "${qdrantCollection}" verified at dimension 768.`);
    } catch (err) {
        console.error(`[MIGRATION] ❌ Qdrant collection check failed: ${err.message}`);
        process.exit(1);
    }

    // 4. Sanity test: Upsert test vector, direct retrieve, exact-text search, informational search, and delete
    console.log("[MIGRATION] Running semantic search sanity test on Qdrant...");
    const testText = "EduMate Qdrant semantic search verification test";
    const testPointId = "00000000-0000-0000-0000-000000000000";
    try {
        // Upsert
        await qdrantClient.upsert(qdrantCollection, {
            wait: true,
            points: [{
                id: testPointId,
                vector: testVector,
                payload: {
                    content: testText,
                    documentId: "test-doc-id",
                    originalName: "test_migration_file.txt",
                    pageNumber: 1,
                    chunkIndex: 0
                }
            }]
        });
        console.log("[MIGRATION] ✓ Successfully upserted test point.");

        // Sleep to allow Qdrant index segment update to settle
        await sleep(1500);

        // Direct retrieval
        console.log("[MIGRATION] Retrieving test point directly by ID...");
        const retrievedPoints = await qdrantClient.retrieve(qdrantCollection, {
            ids: [testPointId],
            with_payload: true
        });

        if (retrievedPoints && retrievedPoints.length > 0 && retrievedPoints[0].id === testPointId) {
            console.log("[MIGRATION] ✓ Direct retrieval: PASS");
        } else {
            throw new Error(`Direct retrieval failed. Expected point ID ${testPointId} not returned.`);
        }

        // Exact-text search
        console.log("[MIGRATION] Performing exact-text semantic search...");
        const queryVector = await embeddings.embedText(testText, {
            timeout: 10000,
            maxAttempts: 1,
            task: "retrieval.query"
        });

        const exactSearchResults = await qdrantClient.search(qdrantCollection, {
            vector: queryVector,
            limit: 5,
            with_payload: true
        });

        const foundTestPoint = exactSearchResults.some(r => r.id === testPointId);
        if (foundTestPoint) {
            console.log("[MIGRATION] ✓ Exact-text semantic search: PASS");
        } else {
            throw new Error("Exact-text semantic search did not return the test vector.");
        }

        // Informational "BCA fee structure" search
        console.log("[MIGRATION] Performing informational search for: \"BCA fee structure\"...");
        const bcaQueryVector = await embeddings.embedText("BCA fee structure", {
            timeout: 10000,
            maxAttempts: 1,
            task: "retrieval.query"
        });

        const bcaSearchResults = await qdrantClient.search(qdrantCollection, {
            vector: bcaQueryVector,
            limit: 5,
            with_payload: true
        });

        console.log(`[MIGRATION] Informational Top BCA matches: ${JSON.stringify(bcaSearchResults.map(r => ({ id: r.id, score: r.score })))}`);

        // Delete test point
        await qdrantClient.delete(qdrantCollection, {
            points: [testPointId]
        });
        console.log("[MIGRATION] ✓ Cleaned up test point.");
    } catch (err) {
        console.error(`[MIGRATION] ❌ Semantic search sanity test failed: ${err.message}`);
        // Attempt clean up
        try {
            await qdrantClient.delete(qdrantCollection, { points: [testPointId] });
        } catch (e) {}
        process.exit(1);
    }

    // 5. Trigger full re-indexing of all documents
    console.log("\n[MIGRATION] Sanity checks passed. Starting full document re-indexing...");
    
    let documents;
    try {
        documents = await Document.find({ status: { $ne: "deleted" } });
        console.log(`[MIGRATION] Found ${documents.length} active documents to re-index.`);
    } catch (err) {
        console.error(`[MIGRATION] ❌ Failed to fetch documents from database: ${err.message}`);
        process.exit(1);
    }

    if (documents.length === 0) {
        console.log("[MIGRATION] No documents found. Migration complete.");
        process.exit(0);
    }

    // Mark documents as pending
    for (const doc of documents) {
        doc.embeddingStatus = "pending";
        doc.metadata = {
            ...(doc.metadata || {}),
            indexAttempts: 0,
            lastIndexAttemptAt: null,
            error: null
        };
        await doc.save();
        // Trigger background indexing
        indexingService.indexDocumentBackground(doc._id).catch(() => {});
    }
    console.log("[MIGRATION] All documents marked as pending. Background workers triggered.");

    // 6. Poll background progress
    console.log("[MIGRATION] Polling progress...");
    let done = false;
    let completedCount = 0;
    let failedCount = 0;
    while (!done) {
        await sleep(3000);
        const pending = await Document.countDocuments({ status: { $ne: "deleted" }, embeddingStatus: "pending" });
        const processing = await Document.countDocuments({ status: { $ne: "deleted" }, embeddingStatus: "processing" });
        failedCount = await Document.countDocuments({ status: { $ne: "deleted" }, embeddingStatus: "failed" });
        const completed = await Document.countDocuments({ status: { $ne: "deleted" }, embeddingStatus: "indexed" });
        
        console.log(`[PROGRESS] Pending: ${pending} | Processing: ${processing} | Completed: ${completed} | Failed: ${failedCount}`);
        
        if (pending === 0 && processing === 0) {
            completedCount = completed;
            done = true;
        }
    }

    console.log(`\n[MIGRATION] Re-indexing completed! Successes: ${completedCount}, Failures: ${failedCount}`);

    // 7. Perform Semantic Retrieval Verification Tests
    console.log("\n============================================================");
    console.log("          Running Semantic Retrieval Verification Tests      ");
    console.log("============================================================\n");

    const testQueries = [
        "BCA fee structure",
        "Who are the BCA faculty?",
        "Tell me about BCA eligibility.",
        "Tell me about B.Pharm."
    ];

    let passedTests = 0;
    for (const query of testQueries) {
        console.log(`Query: "${query}"`);
        try {
            const results = await retrievalService.retrieve({ question: query, user: { institution: "all", department: "all" }, limit: 3 });
            console.log(`Results Found: ${results.length}`);
            if (results.length > 0) {
                passedTests++;
                results.slice(0, 2).forEach((res, idx) => {
                    console.log(`  Match ${idx + 1}: [Score: ${res.score.toFixed(4)}] ${res.metadata.originalName} (Page ${res.metadata.pageNumber})`);
                    console.log(`  Excerpt: "${res.content.substring(0, 120).trim()}..."\n`);
                });
            } else {
                console.log("  ❌ No chunks retrieved for this query.\n");
            }
        } catch (e) {
            console.error(`  ❌ Search failed for query "${query}": ${e.message}\n`);
        }
    }

    console.log(`Retrieval Tests Passed: ${passedTests}/${testQueries.length}`);
    mongoose.connection.close();
    console.log("[MIGRATION] Migration complete.");
    process.exit(failedCount > 0 ? 1 : 0);
}

run().catch((err) => {
    console.error(`Migration runner crashed: ${err.message}`);
    process.exit(1);
});
