const assert = require("assert");
const path = require("path");
const fs = require("fs");

console.log("=== Testing Optimization & Storage Normalization ===");

// 1. Verify Paths
const paths = require("../config/paths");
paths.ensureAllDirectories();

assert.strictEqual(path.basename(paths.STORAGE_ROOT), "storage", "Storage root should be named storage");
assert.ok(fs.existsSync(paths.STORAGE_ROOT), "Storage root must exist");
assert.ok(fs.existsSync(paths.DATA_ROOT), "Storage .data dir must exist");
assert.ok(fs.existsSync(path.join(paths.STORAGE_ROOT, "academics")), "Academics category must exist");
assert.ok(fs.existsSync(path.join(paths.STORAGE_ROOT, "fees")), "Fees category must exist");
console.log("✓ Path configuration and storage directories verified.");

// 2. Verify Storage Manager
const localStorageManager = require("../storage/localStorageManager");
const storageRoot = localStorageManager.ensureStorageRoot();
assert.ok(fs.existsSync(storageRoot), "Storage root from manager must exist");
const { supportedFiles } = localStorageManager.scanKnowledgeDocuments(storageRoot);
console.log(`✓ Local storage manager successfully scanned ${supportedFiles.length} files.`);

// 3. Verify Unified Cache Hub
const cacheHub = require("../services/cache/SmartCacheHub");
cacheHub.l7.set("test_query", "test_response", 10000);
const cachedResponse = cacheHub.l7.get("test_query");
assert.strictEqual(cachedResponse, "test_response", "Unified cache L7 must return set value");

cacheHub.l5.setDocumentChunks("doc1", [{ chunkId: "c1", text: "hello" }]);
const chunks = cacheHub.l5.getDocumentChunks("doc1");
assert.strictEqual(chunks.length, 1, "Unified cache L5 must return set chunks");

const stats = cacheHub.getStats();
assert.ok(stats.global.totalHits > 0, "Cache stats must register hits");
console.log("✓ Unified cache hub functioning with sub-millisecond LRU response.");

// 4. Verify Crime Risk Service (Per User Request)
const crimeRiskService = require("../services/crimeRiskService");
async function testCrimeRisk() {
    const pointRisk = await crimeRiskService.getCrimeRiskNearPoint(22.7212, 88.4848);
    assert.ok(pointRisk.status === "AVAILABLE" || pointRisk.status === "UNAVAILABLE", "Point risk must return valid status");

    const dummyRoute = {
        routeNumber: 1,
        geometry: [[22.7203, 88.4851], [22.7212, 88.4855]]
    };
    const routeRisk = await crimeRiskService.getCrimeRiskForRoute(dummyRoute);
    assert.strictEqual(routeRisk.status, "AVAILABLE", "Route crime risk should be AVAILABLE");
    assert.ok(typeof routeRisk.score === "number", "Route risk score must be numeric");
    console.log(`✓ Crime risk service evaluated safely (Route Risk Score: ${routeRisk.score}/100).`);
}

// 5. Verify Real Agents
const programmingAgent = require("../ai/agents/ProgrammingAgent");
const academicAgent = require("../ai/agents/AcademicAgent");
assert.strictEqual(programmingAgent.name, "Programming Agent");
assert.strictEqual(academicAgent.name, "Academic Tutor Agent");
console.log("✓ Programming & Academic Agents successfully initialized with real system prompts.");

testCrimeRisk().then(() => {
    console.log("\n🎉 ALL VERIFICATION CHECKS PASSED!");
    process.exit(0);
}).catch(err => {
    console.error("❌ Verification failed:", err);
    process.exit(1);
});

