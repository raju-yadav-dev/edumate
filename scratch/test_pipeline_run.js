const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const indexingService = require("../server/ai/services/indexingService");
const Document = require("../server/models/Document");
const Chunk = require("../server/models/Chunk");
const { client: qdrantClient, collectionName } = require("../server/ai/config/qdrant");

require("dotenv").config({ path: path.join(__dirname, "../server/.env") });

const withTimeout = (promise, ms, label) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");
    
    // We will test three local files:
    // 1. Text-based PDF: 824efd14-1ee0-4d2b-8d36-5fecc66615f6.pdf (requiresOcr: false)
    // 2. Mixed/Table PDF: 13a75df0-063e-4411-b3ff-da9eeb3485bd.pdf (requiresOcr: true, has images/tables)
    
    const localFiles = [
        { type: "Text PDF", name: "824efd14-1ee0-4d2b-8d36-5fecc66615f6.pdf", originalName: "Test_Text_Document.pdf" },
        { type: "OCR PDF", name: "13a75df0-063e-4411-b3ff-da9eeb3485bd.pdf", originalName: "Test_OCR_Document.pdf" }
    ];
    
    const mockUserId = new mongoose.Types.ObjectId();
    const testDocs = [];
    
    for (const fileSpec of localFiles) {
        const filePath = path.join(__dirname, "../server/uploads/documents", fileSpec.name);
        if (!fs.existsSync(filePath)) {
            console.log(`Warning: Local file not found: ${filePath}`);
            continue;
        }
        
        // Find existing or create temporary
        let doc = await Document.findOne({ storedName: fileSpec.name, status: "active" });
        let isTemp = false;
        if (!doc) {
            console.log(`[TEST] Creating temporary document record for ${fileSpec.name}`);
            doc = await Document.create({
                originalName: fileSpec.originalName,
                storedName: fileSpec.name,
                category: "courses",
                mimeType: "application/pdf",
                fileSize: fs.statSync(filePath).size,
                checksum: "test_checksum_" + Math.random().toString(36).substring(2),
                storagePath: "courses/" + fileSpec.name,
                embeddingStatus: "pending",
                status: "active",
                createdBy: mockUserId
            });
            isTemp = true;
        }
        
        testDocs.push({
            type: fileSpec.type,
            id: doc._id,
            name: doc.originalName,
            storedName: doc.storedName,
            isTemp
        });
    }
    
    console.log(`\nStarting pipeline test run on ${testDocs.length} documents...`);
    
    for (const test of testDocs) {
        console.log(`\n==================================================`);
        console.log(`Testing document type: ${test.type}`);
        console.log(`Name: ${test.name}`);
        console.log(`StoredName: ${test.storedName}`);
        console.log(`ID: ${test.id}`);
        console.log(`==================================================`);
        
        try {
            // Run indexing with a timeout (120 seconds per doc)
            await withTimeout(
                indexingService.runIndexingJob(test.id),
                120000,
                `Indexing of ${test.name}`
            );
            
            // Verification:
            // 1. Check MongoDB status
            const updated = await Document.findById(test.id).lean();
            console.log(`[VERIFY] MongoDB status: ${updated.embeddingStatus}`);
            console.log(`[VERIFY] Chunks created: ${updated.chunkCount}`);
            console.log(`[VERIFY] Extracted character count: ${updated.metadata?.extractedLength}`);
            console.log(`[VERIFY] Pages counted: ${updated.metadata?.pages}`);
            
            // 2. Check MongoDB Chunk collection count
            const mongoChunksCount = await Chunk.countDocuments({ document: test.id });
            console.log(`[VERIFY] MongoDB Chunk count: ${mongoChunksCount}`);
            
            // 3. Check Qdrant point count
            const qCountRes = await qdrantClient.count(collectionName, {
                filter: {
                    must: [
                        { key: "documentId", match: { value: String(test.id) } }
                    ]
                }
            });
            const qCount = qCountRes?.count || 0;
            console.log(`[VERIFY] Qdrant point count: ${qCount}`);
            
            // 4. Retrieve one chunk metadata to verify contentType and isOcr properties
            const sampleChunk = await Chunk.findOne({ document: test.id }).lean();
            if (sampleChunk) {
                console.log(`[VERIFY] Sample Chunk metadata:`, JSON.stringify(sampleChunk.metadata, null, 2));
            }
        } catch (err) {
            console.error(`[TEST ERROR] Test failed for document:`, err);
        } finally {
            // Clean up temporary documents to avoid polluting the DB
            if (test.isTemp) {
                console.log(`[CLEANUP] Removing temporary document and chunks for ${test.storedName}`);
                await Document.deleteOne({ _id: test.id });
                await Chunk.deleteMany({ document: test.id });
                try {
                    await indexingService.deleteDocumentIndex(test.id);
                } catch (delErr) {
                    console.error("Cleanup Qdrant delete failed:", delErr.message);
                }
            }
        }
    }
    
    await mongoose.disconnect();
    console.log("\nPipeline tests complete.");
}

main().catch(console.error);
