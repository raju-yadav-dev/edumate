const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Document = require("../server/models/Document");
const Chunk = require("../server/models/Chunk");
const indexingService = require("../server/ai/services/indexingService");
const retrievalService = require("../server/ai/services/retrievalService");
const { client: qdrantClient, collectionName } = require("../server/ai/config/qdrant");

require("dotenv").config({ path: path.join(__dirname, "../server/.env") });

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // 1. Prepare test image buffer
    const srcImagePath = path.join(__dirname, "../client/src/assets/hero.png");
    if (!fs.existsSync(srcImagePath)) {
        throw new Error(`Source test image not found at: ${srcImagePath}`);
    }
    const fileBuffer = fs.readFileSync(srcImagePath);
    console.log(`Loaded test image buffer from ${srcImagePath} (${fileBuffer.length} bytes)`);

    // 2. Create mock document
    const testDocName = "BBA in Business analytics.jpeg";
    const testDocId = new mongoose.Types.ObjectId();
    const storedName = `${Date.now()}-test-image.png`;
    const storagePath = `courses/${storedName}`;

    console.log(`Creating mock Document record with ID: ${testDocId}`);
    const document = await Document.create({
        _id: testDocId,
        originalName: testDocName,
        storedName: storedName,
        category: "courses",
        institution: "all",
        department: "management",
        mimeType: "image/jpeg",
        fileSize: fileBuffer.length,
        checksum: "test-checksum-img",
        contentHash: "test-checksum-img",
        storagePath: storagePath,
        embeddingStatus: "pending",
        createdBy: new mongoose.Types.ObjectId(),
        updatedBy: new mongoose.Types.ObjectId(),
        metadata: {
            uploadedFrom: "api",
            notes: "Test image RAG pipeline"
        }
    });

    // Write file locally so the indexing service fallback can read it if needed
    const localDir = path.join(__dirname, "../server/uploads/documents");
    if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
    }
    const localFilePath = path.join(localDir, storedName);
    fs.writeFileSync(localFilePath, fileBuffer);
    console.log(`Saved local file copy for fallback: ${localFilePath}`);

    // 3. Register buffer in indexingService cache
    const cacheKey = String(testDocId);
    if (indexingService.bufferCache) {
        indexingService.bufferCache.set(cacheKey, fileBuffer);
        console.log(`Cached image buffer in memory under key: ${cacheKey}`);
    }

    // 4. Run the Indexing Job
    console.log("\n--- RUNNING INDEXING JOB ---");
    await indexingService.runIndexingJob(testDocId);
    console.log("--- INDEXING JOB FINISHED ---\n");

    // 5. Verify MongoDB Document update
    const updatedDoc = await Document.findById(testDocId).lean();
    console.log("Updated Document embeddingStatus:", updatedDoc.embeddingStatus);
    console.log("Document metadata:", JSON.stringify(updatedDoc.metadata, null, 2));

    // 6. Verify MongoDB Chunk update
    const chunks = await Chunk.find({ document: testDocId }).lean();
    console.log(`Found ${chunks.length} Chunk records in MongoDB.`);
    if (chunks.length > 0) {
        const firstChunk = chunks[0];
        console.log("Chunk metadata sample:");
        console.log(JSON.stringify(firstChunk.metadata, null, 2));
    }

    // 7. Verify Qdrant Points
    const qPoints = await qdrantClient.count(collectionName, {
        filter: {
            must: [
                { key: "documentId", match: { value: String(testDocId) } }
            ]
        }
    });
    console.log(`Qdrant vector count for document: ${qPoints.count}`);

    // Retrieve Qdrant point payloads to verify
    const scrollRes = await qdrantClient.scroll(collectionName, {
        filter: {
            must: [
                { key: "documentId", match: { value: String(testDocId) } }
            ]
        },
        limit: 1,
        with_payload: true
    });
    if (scrollRes.points && scrollRes.points.length > 0) {
        console.log("Qdrant point payload sample:");
        console.log(JSON.stringify(scrollRes.points[0].payload, null, 2));
    }

    // 8. Test Retrieval
    console.log("\n--- TESTING RAG RETRIEVAL ---");
    const query = "What is BBA in Business Analytics?";
    console.log(`Searching for query: "${query}"`);
    const results = await retrievalService.retrieve({
        question: query,
        user: { institution: "all", role: "student" },
        limit: 5
    });

    console.log(`Retrieved ${results.length} chunks from search.`);
    const matched = results.filter(r => String(r.metadata?.documentId) === String(testDocId));
    console.log(`Matched chunks belonging to our test document: ${matched.length}`);
    if (matched.length > 0) {
        console.log("Successfully retrieved our image chunk through RAG retrieval!");
    } else {
        console.log("Warning: Image chunk was not retrieved. Top retrieved documents:");
        results.forEach((r, i) => {
            console.log(`[${i+1}] Doc ID: ${r.metadata?.documentId}, Title: ${r.metadata?.originalName}, Score: ${r.score}`);
        });
    }

    // 9. CLEANUP
    console.log("\n--- CLEANING UP ---");
    if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        console.log("Deleted local file copy.");
    }
    await Document.deleteOne({ _id: testDocId });
    await Chunk.deleteMany({ document: testDocId });
    console.log("Deleted document and chunks from MongoDB.");

    await indexingService.deleteDocumentIndex(testDocId);
    console.log("Deleted vectors from Qdrant.");

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
}

main().catch(async (err) => {
    console.error("Test failed with error:", err);
    await mongoose.disconnect();
});
