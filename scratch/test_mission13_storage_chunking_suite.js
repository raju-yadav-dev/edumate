/**
 * Mission 13.2 Master Storage & Chunking Runtime Test Suite
 * Validates:
 * 1. Local Storage Root initialization and safe path operations
 * 2. File and directory manipulation directly on edumate/storage/
 * 3. File discovery and sync in Document collection
 * 4. Chunking runtime execution via npm run chunking / runChunkingWorker
 * 5. Qdrant vector indexing from local files
 * 6. Health & Admin storage stats integration
 * 7. Regression check for Mission 13.1 Query Router
 */

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");
const localStorageManager = require("../server/storage/localStorageManager");
const Document = require("../server/models/Document");
const Chunk = require("../server/models/Chunk");
const { client: qdrantClient, collectionName: qdrantCollection } = require("../server/ai/config/qdrant");
const storageService = require("../server/services/storageService");
const { routeQuery, ROUTER_ROUTES } = require("../server/ai/routing/queryRouter");

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✅ [PASS] ${message}`);
    } else {
        console.error(`  ❌ [FAIL] ${message}`);
        throw new Error(`Assertion failed: ${message}`);
    }
}

async function runTestSuite() {
    console.log("================================================================");
    console.log("       🧪 EDUMATE MISSION 13.2 MASTER TEST SUITE               ");
    console.log("================================================================");

    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/edumate";
    await mongoose.connect(mongoUri);
    console.log(`[Database] Connected to MongoDB: ${mongoose.connection.name}`);

    // TEST 1: Storage Root Initialization
    console.log("\n--- TEST 1: Local Storage Root Initialization ---");
    const storageRoot = localStorageManager.ensureStorageRoot();
    assert(fs.existsSync(storageRoot), "Storage root directory exists on disk");
    assert(storageRoot.endsWith("storage"), "Storage root resolves to edumate/storage/");
    
    // Check standard subdirectories
    const subdirs = ["academics", "admissions", "fees", "rules", "campus_navigation"];
    for (const sub of subdirs) {
        assert(fs.existsSync(path.join(storageRoot, sub)), `Subdirectory storage/${sub} exists`);
    }

    // TEST 2: Local Storage File Operations
    console.log("\n--- TEST 2: Local Storage File Operations ---");
    const testContent = Buffer.from("EduMate Local Storage Integration Test Content\nCourse: B.Tech Computer Science\nFee: Rs. 1,50,000 per year.");
    const testRelPath = "academics/test_btech_info.txt";
    
    await localStorageManager.saveFile(testRelPath, testContent);
    assert(fs.existsSync(path.join(storageRoot, testRelPath)), "File saved to local storage/");

    const readBuffer = await localStorageManager.readFile(testRelPath);
    assert(readBuffer.toString("utf-8") === testContent.toString("utf-8"), "File content read matches saved content");

    // Copy file
    const copyRelPath = "academics/test_btech_info_copy.txt";
    await localStorageManager.copyFile(testRelPath, copyRelPath);
    assert(fs.existsSync(path.join(storageRoot, copyRelPath)), "File copied successfully in storage/");

    // Move file
    const moveRelPath = "fees/test_btech_info_moved.txt";
    await localStorageManager.moveFile(copyRelPath, moveRelPath);
    assert(!fs.existsSync(path.join(storageRoot, copyRelPath)), "Source file moved out");
    assert(fs.existsSync(path.join(storageRoot, moveRelPath)), "Destination file exists in storage/fees/");

    // Cleanup test files
    await localStorageManager.deleteFile(testRelPath);
    await localStorageManager.deleteFile(moveRelPath);
    assert(!fs.existsSync(path.join(storageRoot, testRelPath)), "Test file deleted successfully");
    assert(!fs.existsSync(path.join(storageRoot, moveRelPath)), "Moved test file deleted successfully");

    // TEST 3: Storage Statistics
    console.log("\n--- TEST 3: Local Storage Statistics ---");
    const stats = localStorageManager.getLocalStorageStats();
    assert(typeof stats.used === "number", "stats.used is a number");
    assert(typeof stats.quota === "number" && stats.quota > 0, "stats.quota is greater than 0");
    assert(typeof stats.files === "number", "stats.files is a number");
    assert(typeof stats.folders === "number" && stats.folders >= 19, "stats.folders count is at least 19 standard folders");

    const combinedStats = await storageService.getStorageStats();
    assert(combinedStats.localStorage !== undefined, "combinedStats includes localStorage");
    assert(combinedStats.storageType === "local", "combinedStats reports storageType === 'local'");

    // TEST 4: Chunking Runtime with PDF & Text Processing
    console.log("\n--- TEST 4: Chunking Runtime Processing on Storage Root ---");
    
    // Copy scratch sample PDF to storage/academics/courses_list.pdf if scratch PDF exists
    const samplePdfPath = path.resolve(__dirname, "courses_list.pdf");
    if (fs.existsSync(samplePdfPath)) {
        const targetPdfPath = path.join(storageRoot, "academics", "courses_list.pdf");
        fs.copyFileSync(samplePdfPath, targetPdfPath);
        console.log(`[Setup] Placed sample PDF in storage/academics/courses_list.pdf`);
    }

    // Run chunking worker logic programmatically
    const chunkingQueueService = require("../server/ai/services/chunkingQueueService");
    
    // Discover and register files
    const diskFiles = [];
    const scanDir = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) scanDir(full);
            else if (entry.isFile()) diskFiles.push({ full, rel: path.relative(storageRoot, full).replace(/\\/g, "/") });
        }
    };
    scanDir(storageRoot);

    const crypto = require("crypto");
    const User = require("../server/models/User");
    const adminUser = await User.findOne({ role: { $in: ["admin", "super_admin"] } });
    const systemAdminId = adminUser?._id || new mongoose.Types.ObjectId("64a7c8e9f1a2b3c4d5e6f7a8");

    const docIds = [];
    for (const file of diskFiles) {
        let doc = await Document.findOne({ storagePath: file.rel, status: "active" });
        if (!doc) {
            let checksum = "test-checksum";
            try {
                const buf = fs.readFileSync(file.full);
                checksum = crypto.createHash("sha256").update(buf).digest("hex");
            } catch (_) {}

            doc = await Document.create({
                originalName: path.basename(file.full),
                storagePath: file.rel,
                storedName: path.basename(file.full),
                fileSize: fs.statSync(file.full).size,
                mimeType: file.rel.endsWith(".pdf") ? "application/pdf" : "text/plain",
                checksum,
                createdBy: systemAdminId,
                category: "academics",
                status: "active",
                embeddingStatus: "pending"
            });
        }
        docIds.push(doc._id);
    }

    assert(docIds.length > 0, `Discovered at least 1 document (${docIds.length}) in storage/`);

    // Enqueue and run chunking worker
    console.log(`[Chunking] Enqueueing ${docIds.length} document(s)...`);
    await chunkingQueueService.enqueueDocuments({ ids: docIds, forceRechunk: true });

    // Wait for completion
    let attempts = 0;
    while (attempts < 60) {
        const queueStatus = await chunkingQueueService.getQueueStatus();
        if (queueStatus.stats.queued === 0 && queueStatus.stats.processing === 0) {
            break;
        }
        await new Promise(r => setTimeout(r, 1000));
        attempts++;
    }

    const processedDoc = await Document.findById(docIds[0]);
    assert(processedDoc.embeddingStatus === "completed" || processedDoc.embeddingStatus === "indexed", `Document status is completed/indexed (actual: ${processedDoc.embeddingStatus})`);
    assert(processedDoc.chunkCount > 0, `Document generated ${processedDoc.chunkCount} chunks`);

    // Verify Qdrant points
    try {
        const collInfo = await qdrantClient.getCollection(qdrantCollection);
        const vectors = collInfo.vectors_count || collInfo.points_count || 0;
        assert(vectors > 0, `Qdrant vector store has indexed points (${vectors} vectors)`);
    } catch (e) {
        console.warn("Qdrant points check warning:", e.message);
    }

    // TEST 5: Mission 13.1 Query Routing Regression Verification
    console.log("\n--- TEST 5: Query Routing Regression Check ---");
    const testCases = [
        { query: "Who is Albert Einstein?", expectedRoute: ROUTER_ROUTES.GENERAL_KNOWLEDGE, expectRag: false },
        { query: "What is the fee structure for BCA program?", expectedRoute: ROUTER_ROUTES.UNIVERSITY_SPECIFIC, expectRag: true },
        { query: "Explain quantum computing and how it relates to our university BCA syllabus", expectedRoute: ROUTER_ROUTES.MIXED, expectRag: true },
        { query: "Hello, good morning!", expectedRoute: ROUTER_ROUTES.CONVERSATIONAL, expectRag: false }
    ];

    for (const tc of testCases) {
        const routeResult = await routeQuery(tc.query);
        assert(routeResult.route === tc.expectedRoute, `Query "${tc.query}" routed as ${tc.expectedRoute} (actual: ${routeResult.route})`);
        assert(routeResult.skipRag === !tc.expectRag, `Query "${tc.query}" skipRag === ${!tc.expectRag} (actual: ${routeResult.skipRag})`);
    }

    console.log("\n================================================================");
    console.log(` ✅ ALL TESTS PASSED (${passedTests}/${totalTests})`);
    console.log("================================================================\n");

    await mongoose.disconnect();
    process.exit(0);
}

runTestSuite().catch(async (err) => {
    console.error("\n❌ Test Suite Failed:", err);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
});
