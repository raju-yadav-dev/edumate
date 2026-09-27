const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Ensure environment variables are loaded
const projectRoot = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(projectRoot, ".env") });
require("dotenv").config({ path: path.join(projectRoot, "server", ".env") });

const embeddings = require("../server/ai/config/embeddings");
const { client, collectionName } = require("../server/ai/config/qdrant");

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const safeExit = (code) => {
    setTimeout(() => {
        process.exit(code);
    }, 200);
};

async function run() {
    const provider = process.env.EMBEDDING_PROVIDER || "jina";
    const model = process.env.EMBEDDING_MODEL || "jina-embeddings-v3";
    const testText = "EduMate Qdrant semantic search verification test";
    const testPointId = "00000000-0000-0000-0000-000000000000";

    console.log("[Embedding API] Testing embedding provider connection & verifying dimension size...");

    let actualDimension = "Unknown";
    let qdrantDim = "Unknown";
    let dimensionValidation = "FAILED";
    let qdrantConnection = "FAILED";
    let directRetrieval = "FAILED";
    let exactTextSearch = "FAILED";
    let bcaFeeRetrieval = "INFORMATIONAL";
    let bcaResultsList = [];

    try {
        // 1. Generate passage embedding for exact test text
        const testVector = await embeddings.embedText(testText, { 
            timeout: 8000, 
            maxAttempts: 1, 
            task: "retrieval.passage" 
        });
        
        if (!Array.isArray(testVector)) {
            throw new Error("Returned embedding is not a valid array.");
        }
        
        actualDimension = testVector.length;

        // 2. Query Qdrant Collection details
        try {
            const collectionInfo = await client.getCollection(collectionName);
            qdrantDim = collectionInfo.config?.params?.vectors?.size || "Unknown";
            qdrantConnection = "PASS";
        } catch (qdrantErr) {
            throw new Error(`Qdrant collection "${collectionName}" not found or database is unreachable. Error: ${qdrantErr.message}`);
        }

        // 3. Compare dimensions
        if (actualDimension === qdrantDim && actualDimension === 768) {
            dimensionValidation = "PASS";
        } else {
            throw new Error(`Dimension mismatch: Model is ${actualDimension}, Qdrant collection is ${qdrantDim}`);
        }

        // 4. Upsert the test vector into the collection
        console.log(`[QDRANT] Upserting test point with ID: ${testPointId}...`);
        await client.upsert(collectionName, {
            wait: true,
            points: [{
                id: testPointId,
                vector: testVector,
                payload: {
                    content: testText,
                    documentId: "test-doc-id",
                    originalName: "test_verification_file.txt",
                    pageNumber: 1,
                    chunkIndex: 0
                }
            }]
        });

        // Sleep to allow Qdrant index segment update to settle
        await sleep(1500);

        // 5. Direct Retrieval Verification
        console.log(`[QDRANT] Retrieving test point directly by ID...`);
        const retrievedPoints = await client.retrieve(collectionName, {
            ids: [testPointId],
            with_payload: true
        });

        if (retrievedPoints && retrievedPoints.length > 0 && retrievedPoints[0].id === testPointId) {
            directRetrieval = "PASS";
        } else {
            throw new Error(`Direct retrieval failed. Expected point ID ${testPointId} not returned.`);
        }

        // 6. Exact-Text Semantic Search
        console.log(`[QDRANT] Performing exact-text semantic search...`);
        const queryVector = await embeddings.embedText(testText, {
            timeout: 8000,
            maxAttempts: 1,
            task: "retrieval.query"
        });

        const exactSearchResults = await client.search(collectionName, {
            vector: queryVector,
            limit: 5,
            with_payload: true
        });

        const foundTestPoint = exactSearchResults.some(r => r.id === testPointId);
        if (foundTestPoint) {
            exactTextSearch = "PASS";
        } else {
            console.warn(`[WARNING] Test point not found in top search results. Results: ${JSON.stringify(exactSearchResults.map(r => ({ id: r.id, score: r.score })))}`);
        }

        // 7. Informational "BCA fee structure" Search
        console.log(`[QDRANT] Performing informational search for: "BCA fee structure"...`);
        const bcaQueryVector = await embeddings.embedText("BCA fee structure", {
            timeout: 8000,
            maxAttempts: 1,
            task: "retrieval.query"
        });

        const bcaSearchResults = await client.search(collectionName, {
            vector: bcaQueryVector,
            limit: 5,
            with_payload: true
        });

        bcaResultsList = bcaSearchResults.map(r => ({ id: r.id, score: r.score }));

        // Clean up: delete test point
        await client.delete(collectionName, {
            points: [testPointId]
        });

        // Print final status block exactly as requested
        console.log(`\nProvider: ${provider}`);
        console.log(`Model: ${model}`);
        console.log(`Embedding dimension: ${actualDimension}`);
        console.log(`Qdrant dimension: ${qdrantDim}`);
        
        console.log(`\nDimension validation: ${dimensionValidation}`);
        console.log(`Qdrant connection: ${qdrantConnection}`);
        console.log(`Direct retrieval: ${directRetrieval}`);
        console.log(`Exact-text semantic search: ${exactTextSearch}`);
        console.log(`"BCA fee structure" retrieval: ${bcaFeeRetrieval}`);
        console.log(`Top 5 BCA Results: ${JSON.stringify(bcaResultsList)}`);
        
        const success = dimensionValidation === "PASS" && qdrantConnection === "PASS" && directRetrieval === "PASS" && exactTextSearch === "PASS";
        console.log(`Status: ${success ? "PASS" : "FAILED"}`);
        
        safeExit(success ? 0 : 1);

    } catch (err) {
        // Attempt clean up
        try {
            await client.delete(collectionName, { points: [testPointId] });
        } catch (e) {}

        console.log("\nFAILURE:");
        console.log(`Provider: ${provider}`);
        console.log(`Model: ${model}`);
        console.log(`Dimension validation: ${dimensionValidation}`);
        console.log(`Qdrant connection: ${qdrantConnection}`);
        console.log(`Status: FAILED`);
        console.log(`Error: ${err.message}`);
        
        safeExit(1);
    }
}

run().catch((err) => {
    console.error(`Diagnostic execution failed: ${err.message}`);
    safeExit(1);
});
