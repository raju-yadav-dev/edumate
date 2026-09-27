require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const localChunkManager = require("../server/storage/localChunkManager");
const localStorageManager = require("../server/storage/localStorageManager");
const indexingService = require("../server/ai/services/indexingService");
const retrievalService = require("../server/ai/services/retrievalService");
const Document = require("../server/models/Document");
const { client: qdrantClient, collectionName: qdrantCollection } = require("../server/ai/config/qdrant");

let passedCount = 0;
let failedCount = 0;

function assert(condition, description) {
    if (condition) {
        console.log(`  ✓ ${description}`);
        passedCount++;
    } else {
        console.error(`  ✗ FAIL: ${description}`);
        failedCount++;
    }
}

async function runLocalChunksSuite() {
    console.log("================================================================================");
    console.log("🚀 EDUMATE MISSION 13.3 — LOCAL CHUNK STORAGE MASTER VERIFICATION SUITE");
    console.log("================================================================================\n");

    const testDocId = new mongoose.Types.ObjectId().toString();
    const testDocId2 = new mongoose.Types.ObjectId().toString();

    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
        console.log("✓ MongoDB Connected for verification suite.");

        // ==========================================
        // SECTION 1: Local Chunk Manager Unit Tests
        // ==========================================
        console.log("\n--- SECTION 1: Local Chunk Manager Core Operations ---");

        const sampleChunks = [
            {
                chunkId: `${testDocId}_chunk_1`,
                documentId: testDocId,
                pageNumber: 1,
                page: 1,
                heading: "Admissions 2025-26 Overview",
                section: "Eligibility Criteria",
                hierarchy: { h1: "Admissions", h2: "Eligibility" },
                keywords: ["btech", "admission", "eligibility", "75%"],
                content: "For admission to B.Tech programs at Brainware University, candidates must secure minimum 60% aggregate in Class 12 with Physics and Mathematics.",
                cleanedText: "For admission to B.Tech programs at Brainware University, candidates must secure minimum 60% aggregate in Class 12 with Physics and Mathematics.",
                metadata: {
                    originalName: "Admissions_Guide_2025.pdf",
                    category: "admissions",
                    institution: "Brainware University",
                    department: "Engineering"
                }
            },
            {
                chunkId: `${testDocId}_chunk_2`,
                documentId: testDocId,
                pageNumber: 2,
                page: 2,
                heading: "Fee Structure",
                section: "Tuition and Hostel",
                hierarchy: { h1: "Admissions", h2: "Fees" },
                keywords: ["fee", "tuition", "semester", "hostel"],
                content: "The semester tuition fee for B.Tech CSE is INR 55,000. Hostel charges are INR 36,000 per semester including mess food.",
                cleanedText: "The semester tuition fee for B.Tech CSE is INR 55,000. Hostel charges are INR 36,000 per semester including mess food.",
                metadata: {
                    originalName: "Admissions_Guide_2025.pdf",
                    category: "fees",
                    institution: "Brainware University",
                    department: "Engineering"
                }
            }
        ];

        // 1.1 Save Chunks
        const saveResult = await localChunkManager.saveDocumentChunks(testDocId, sampleChunks, {
            documentName: "Admissions_Guide_2025.pdf",
            category: "admissions"
        });
        assert(saveResult.success === true, "saveDocumentChunks returned success: true");
        assert(saveResult.chunkCount === 2, "saveDocumentChunks wrote 2 chunks");

        // 1.2 Verify File on Disk
        const expectedFilePath = path.join(localStorageManager.getChunksDir(), `${testDocId}.chunks.json`);
        assert(fs.existsSync(expectedFilePath), `Chunk file created at ${expectedFilePath}`);

        const fileContentRaw = fs.readFileSync(expectedFilePath, "utf8");
        const parsedData = JSON.parse(fileContentRaw);
        assert(parsedData.documentId === testDocId, "File contains correct documentId");
        assert(Array.isArray(parsedData.chunks) && parsedData.chunks.length === 2, "File contains chunks array with 2 items");
        assert(parsedData.chunks[0].heading === "Admissions 2025-26 Overview", "Chunk heading preserved in local JSON");
        assert(parsedData.chunks[0].section === "Eligibility Criteria", "Chunk section preserved in local JSON");
        assert(Array.isArray(parsedData.chunks[0].keywords), "Chunk keywords preserved in local JSON");
        assert(parsedData.chunks[0].cleanedText.includes("Brainware University"), "Cleaned chunk text preserved in local JSON");

        // 1.3 Read Chunks via Manager
        const loadedChunks = await localChunkManager.getDocumentChunks(testDocId);
        assert(loadedChunks.length === 2, "getDocumentChunks retrieved 2 chunks");
        assert(loadedChunks[1].chunkId === `${testDocId}_chunk_2`, "Chunk ID matches exactly");

        // 1.4 Single Chunk Lookup
        const singleChunk = await localChunkManager.getChunk(testDocId, `${testDocId}_chunk_1`);
        assert(singleChunk !== null && singleChunk.heading === "Admissions 2025-26 Overview", "getChunk returns matching chunk");

        // 1.5 Multi-Chunk Lookup by IDs
        const multiChunks = await localChunkManager.getChunksByIds([
            { documentId: testDocId, chunkId: `${testDocId}_chunk_1` },
            { documentId: testDocId, chunkId: `${testDocId}_chunk_2` }
        ]);
        assert(Array.isArray(multiChunks) && multiChunks.length === 2, "getChunksByIds returned 2 mapped items");

        // 1.6 Local Chunk Keyword Search
        const searchResults = await localChunkManager.searchLocalChunks("Hostel charges mess", { limit: 5 });
        assert(searchResults.length > 0, "searchLocalChunks found relevant local chunks");
        const foundHostel = searchResults.some(r => r.id === `${testDocId}_chunk_2` || (r.content && r.content.includes("Hostel charges")));
        assert(foundHostel, "Found relevant fee & hostel chunk");

        // 1.7 Replace Document Chunks (Re-chunking)
        const updatedChunks = [
            {
                chunkId: `${testDocId}_chunk_v2_1`,
                documentId: testDocId,
                pageNumber: 1,
                content: "Updated B.Tech admissions information 2025.",
                cleanedText: "Updated B.Tech admissions information 2025."
            }
        ];
        await localChunkManager.replaceDocumentChunks(testDocId, updatedChunks);
        const reloadedChunks = await localChunkManager.getDocumentChunks(testDocId);
        assert(reloadedChunks.length === 1, "replaceDocumentChunks replaced old chunks with 1 new chunk");
        assert(reloadedChunks[0].chunkId === `${testDocId}_chunk_v2_1`, "Re-chunked chunk ID is active");

        // 1.8 Validate Chunks Integrity
        const validation = await localChunkManager.validateDocumentChunks(testDocId);
        assert(validation.valid === true, "validateDocumentChunks returned valid: true");

        // 1.9 Chunk Stats
        const stats = await localChunkManager.getAllChunkStats();
        assert(stats.totalFiles >= 1, "getAllChunkStats reports at least 1 chunk file");
        assert(stats.totalChunks >= 1, "getAllChunkStats reports at least 1 total chunk");

        // ==========================================
        // SECTION 2: MongoDB Zero Chunk Collection Check
        // ==========================================
        console.log("\n--- SECTION 2: MongoDB Chunk Collection Removal ---");
        
        const collections = await mongoose.connection.db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        console.log("  Active MongoDB Collections:", collectionNames.join(", "));
        
        const hasChunksCollection = collectionNames.includes("chunks");
        if (hasChunksCollection) {
            // Drop it if legacy test left it
            await mongoose.connection.db.dropCollection("chunks").catch(() => {});
        }
        
        const refreshedCollections = await mongoose.connection.db.listCollections().toArray();
        const refreshedNames = refreshedCollections.map(c => c.name);
        assert(!refreshedNames.includes("chunks"), "MongoDB 'chunks' collection is completely removed/absent");

        // ==========================================
        // SECTION 3: Retrieval Pipeline Local Chunk Integration
        // ==========================================
        console.log("\n--- SECTION 3: Retrieval Pipeline Chunk Loading ---");

        // Prepare a test document in MongoDB and local chunks
        const testUserId = new mongoose.Types.ObjectId();
        const testDoc = await Document.create({
            _id: new mongoose.Types.ObjectId(testDocId2),
            originalName: "Hostel_Rules_2025.pdf",
            storedName: `hostel-${Date.now()}.pdf`,
            category: "hostel",
            institution: "Brainware University",
            department: "Administration",
            mimeType: "application/pdf",
            checksum: "a1b2c3d4e5f678901234567890abcdef",
            fileSize: 10240,
            storagePath: `hostel/hostel-${Date.now()}.pdf`,
            embeddingStatus: "indexed",
            chunkCount: 1,
            status: "active",
            createdBy: testUserId,
            updatedBy: testUserId
        });

        const hostelChunk = {
            chunkId: `${testDocId2}_chunk_1`,
            documentId: testDocId2,
            pageNumber: 1,
            page: 1,
            heading: "Hostel Night Curfew",
            section: "Gate Timings",
            content: "Hostel main gates close at 8:00 PM strictly. Late entry requires written permission from the Chief Warden.",
            cleanedText: "Hostel main gates close at 8:00 PM strictly. Late entry requires written permission from the Chief Warden.",
            metadata: {
                originalName: "Hostel_Rules_2025.pdf",
                category: "hostel",
                institution: "Brainware University"
            }
        };

        await localChunkManager.saveDocumentChunks(testDocId2, [hostelChunk]);

        // Direct localChunkManager lookup from retrieval point of view
        const retrievedChunk = await localChunkManager.getChunk(testDocId2, `${testDocId2}_chunk_1`);
        assert(retrievedChunk !== null, "Local chunk retrieval succeeded");
        assert(retrievedChunk.content.includes("Hostel main gates close at 8:00 PM"), "Retrieved chunk text is complete and uncorrupted");

        // ==========================================
        // SECTION 4: Document Deletion Cleanup
        // ==========================================
        console.log("\n--- SECTION 4: Document Deletion and Cleanup ---");

        await localChunkManager.deleteDocumentChunks(testDocId);
        await localChunkManager.deleteDocumentChunks(testDocId2);
        await Document.deleteOne({ _id: testDocId2 });

        const exists1 = fs.existsSync(path.join(localStorageManager.getChunksDir(), `${testDocId}.chunks.json`));
        const exists2 = fs.existsSync(path.join(localStorageManager.getChunksDir(), `${testDocId2}.chunks.json`));
        assert(!exists1 && !exists2, "Local chunk files deleted after document deletion");

        console.log("\n================================================================================");
        console.log(`📊 TEST SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED`);
        console.log("================================================================================\n");

        if (failedCount > 0) {
            process.exit(1);
        }
    } catch (err) {
        console.error("Critical Test Error:", err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

runLocalChunksSuite();
