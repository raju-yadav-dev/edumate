const assert = require("assert");
const { classifyQueryRoute } = require("../ai/routing/queryRouter");
const { planQuery } = require("../ai/utils/queryPlanner");
const localChunkManager = require("../storage/localChunkManager");
const locationHelper = require("../utils/locationHelper");

console.log("=== Testing Campus Navigation & Academic Block Routing ===");

// 1. Test Query Routing: Must be RAG_LLM with skipRag: false
const navQueries = [
    "routes between academic block",
    "route between academic blocks",
    "how to go from academic block 1 to academic block 2",
    "what is in academic block 3",
    "campus navigation",
    "routes between buildings",
    "where is academic block 5"
];

for (const q of navQueries) {
    const routeDecision = classifyQueryRoute(q);
    assert.strictEqual(routeDecision.mode, "RAG_LLM", `Query "${q}" must route to RAG_LLM, got: ${routeDecision.mode}`);
    assert.strictEqual(routeDecision.skipRag, false, `Query "${q}" must NOT skip RAG`);
    console.log(`✓ Routing verified: "${q}" -> ${routeDecision.mode} (skipRag: false)`);
}

// 2. Test Query Planning
const plan = planQuery("routes between academic block");
assert.strictEqual(plan.skipRag, false, "Query planner must not skip RAG for routes between academic blocks");
assert.ok(plan.category, "Category must be set for campus navigation");
console.log(`✓ Query planning verified: Intent: ${plan.intent} | Category: ${JSON.stringify(plan.category)}`);

// 3. Test Local Chunk Search: Must discover Campus Navigation / Building documents
const chunks = localChunkManager.searchLocalChunks("routes between academic block building", {}, 10);
assert.ok(chunks.length > 0, "Chunk search for routes between academic blocks must return relevant chunks");
const hasCampusDoc = chunks.some(c => 
    /building|campus|block/i.test(c.metadata?.originalName || "") || 
    c.metadata?.documentType === "campus" ||
    /campus/i.test(c.metadata?.category || "")
);
assert.ok(hasCampusDoc, "Retrieved chunks must include Campus Navigation / Building documents");
console.log(`✓ Chunk search verified: Found ${chunks.length} chunks including "${chunks[0]?.metadata?.originalName}"`);

// 4. Test Campus Location Resolution for Academic Blocks
async function testLocationResolution() {
    const b1 = await locationHelper.resolveLocation("academic block 1");
    assert.ok(b1 && b1.name.includes("Academic Block 1"), "Must resolve Academic Block 1");

    const b5 = await locationHelper.resolveLocation("academic block 5");
    assert.ok(b5 && b5.name.includes("Academic Block 5"), "Must resolve Academic Block 5");

    console.log(`✓ Location resolution verified: Academic Block 1 & 5 resolved to campus coordinates.`);
}

testLocationResolution().then(() => {
    console.log("\nALL CAMPUS NAVIGATION & ACADEMIC BLOCK CHECKS PASSED!");
}).catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});

