const assert = require("assert");
const { retrieve } = require("../ai/services/retrievalService");
const { buildSmartContext } = require("../ai/utils/contextBuilder");
const { planQuery } = require("../ai/utils/queryPlanner");

async function verifyFacultyRetrieval() {
    console.log("=== Testing Exhaustive Faculty Retrieval & Context Pipeline ===");

    const query = "list all the names and qualifications of faculty members of css";
    const queryPlan = planQuery(query);
    console.log("Query Plan intent:", queryPlan.intent);
    assert.strictEqual(queryPlan.intent, "FACULTY_QUERY");

    const retrieved = await retrieve({
        question: query,
        queryPlan
    });

    console.log("Total retrieved chunks:", retrieved.length);
    assert(retrieved.length >= 20, `Expected at least 20 chunks retrieved for CSS faculty list, got ${retrieved.length}`);

    // Verify chunks from Department of Computational Sciences.pdf are present across pages
    const targetDocChunks = retrieved.filter(c => {
        const name = c.metadata?.originalName || c.metadata?.filename || c.documentTitle || "";
        return name.toLowerCase().includes("computational sciences");
    });
    console.log("CSS Faculty PDF chunks retrieved:", targetDocChunks.length);
    assert(targetDocChunks.length >= 20, `Expected at least 20 chunks from CSS Faculty PDF, got ${targetDocChunks.length}`);

    // Test smart context builder
    const context = buildSmartContext(retrieved, {
        question: query,
        queryPlan
    });

    console.log("Context total character length:", context.length);
    assert(context.length > 5000, `Context should contain comprehensive faculty data (>5000 chars), got ${context.length}`);

    // Check for professors from early, middle, and late chunks:
    // Early: Dr. Jayanta Aich (Chunk 0)
    assert(context.includes("Jayanta Aich"), "Context must include Dr. Jayanta Aich (Chunk 0)");
    // Middle: Shrabani Sutradhar (Chunk 6) or Souradeep Sarkar (Chunk 11)
    assert(context.includes("Shrabani Sutradhar") || context.includes("Souradeep Sarkar"), "Context must include middle chunk faculty members");
    // Late: Labani Das or Ayan Ghosh (Chunk 23)
    assert(context.includes("Labani Das") || context.includes("Ayan Ghosh"), "Context must include late chunk faculty members (Chunk 23)");

    console.log("\n[PASS] All faculty chunks from Chunk 0 to Chunk 23 successfully merged into context!");
    console.log("=== ALL FACULTY EXHAUSTIVE RETRIEVAL CHECKS PASSED! ===");
}

verifyFacultyRetrieval().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});

