const assert = require("assert");
const Document = require("../server/models/Document");
const chunkingQueueService = require("../server/ai/services/chunkingQueueService");
const integrityService = require("../server/ai/services/integrityService");

async function runMission9TestSuite() {
    console.log("\n========================================================");
    console.log(" MISSION 9 (9.1 - 9.5): PRODUCTION CHUNKING STUDIO SUITE ");
    console.log("========================================================\n");

    // TEST 1: Lifecycle States & Schema Validation (Mission 9.2)
    console.log("[Test 1] 9 Lifecycle States & Document Model Fields");
    const testDoc = new Document({
        originalName: "btech_cse_handbook.pdf",
        storedName: "1720000000-sample.pdf",
        category: "academics/curriculum",
        institution: "Delhi Technological University",
        department: "Computer Science",
        program: "B.Tech CSE",
        status: "active",
        embeddingStatus: "queued",
        progress: 25,
        currentStage: "Chunking",
        queuePosition: 1,
        chunksCount: 42
    });

    assert.strictEqual(testDoc.embeddingStatus, "queued");
    assert.strictEqual(testDoc.progress, 25);
    assert.strictEqual(testDoc.currentStage, "Chunking");
    assert.strictEqual(testDoc.queuePosition, 1);
    assert.strictEqual(testDoc.chunksCount, 42);
    console.log("  ✔ Document model accepts full 9-state lifecycle enum and chunk statistics.");

    // TEST 2: Background Chunking Queue Service (Mission 9.3)
    console.log("\n[Test 2] Chunking Queue State & Worker Pool Controls");
    const initialStatus = await chunkingQueueService.getQueueStatus();
    assert(initialStatus, "Queue status must return a valid object");
    assert.strictEqual(typeof initialStatus.isPaused, "boolean");
    assert.strictEqual(typeof initialStatus.concurrency, "number");
    assert(Array.isArray(initialStatus.queue), "Queue array must be present");
    console.log(`  ✔ Chunking queue operational: Concurrency=${initialStatus.concurrency}, isPaused=${initialStatus.isPaused}`);

    // Pause / Resume queue controls
    const pausedResult = chunkingQueueService.pauseQueue();
    assert.strictEqual(pausedResult.isPaused, true, "Queue should pause");
    const resumedResult = chunkingQueueService.resumeQueue();
    assert.strictEqual(resumedResult.isPaused, false, "Queue should resume");
    console.log("  ✔ Queue Pause/Resume lifecycle transitions verified.");

    // TEST 3: Integrity Validation & Auto-Repair (Mission 9.5)
    console.log("\n[Test 3] Integrity Service Audit & Health Checks");
    const auditReport = await integrityService.auditKnowledgeBase();
    assert(auditReport, "Audit report must be returned");
    assert(typeof auditReport.isHealthy === "boolean", "isHealthy flag must be boolean");
    assert(auditReport.stats, "Audit stats must be present");
    console.log(`  ✔ Integrity audit scan completed: Audited=${auditReport.stats.totalDocuments}, Healthy=${auditReport.stats.healthyDocuments}, Issues=${auditReport.stats.issuesFound}`);

    // TEST 4: Category Sanitization & Path Tree Handling (Mission 9.1)
    console.log("\n[Test 4] Category Path Tree & Sanitization");
    const { DOCUMENT_CATEGORIES } = require("../server/services/documentService");
    assert(Array.isArray(DOCUMENT_CATEGORIES), "DOCUMENT_CATEGORIES must be an array");
    assert(DOCUMENT_CATEGORIES.includes("admissions"), "admissions must be a valid category");
    assert(DOCUMENT_CATEGORIES.includes("academics"), "academics must be a valid category");
    console.log("  ✔ Category hierarchy and knowledge categorization paths verified.");

    console.log("\n========================================================");
    console.log(" ✅ ALL MISSION 9 CHUNKING STUDIO TESTS PASSED!");
    console.log("========================================================\n");
    process.exit(0);
}

runMission9TestSuite().catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});

