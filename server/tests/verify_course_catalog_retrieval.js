const assert = require("assert");
const { resolveDynamicTopK } = require("../ai/services/retrievalService");
const { searchLocalChunks } = require("../storage/localChunkManager");
const rerankService = require("../ai/services/rerankService");
const { buildSmartContext } = require("../ai/utils/contextBuilder");
const { calculateDynamicOutputBudget } = require("../config/llm");

async function runTests() {
    console.log("=== RUNNING COURSE CATALOG RETRIEVAL VERIFICATION ===");

    // Test 1: Dynamic Top-K Classification
    console.log("\n--- TEST 1: Dynamic Top-K Classification ---");
    const catalogQueries = [
        "what courses this college offer",
        "what courses does this university offer",
        "list of courses",
        "all courses",
        "courses offered by the college"
    ];
    for (const q of catalogQueries) {
        const res = resolveDynamicTopK(q);
        console.log(`Query: "${q}" -> topK: ${res.topK} (${res.rule})`);
        assert.strictEqual(res.topK >= 12, true, `Query "${q}" should have topK >= 12`);
    }
    console.log("PASS: Dynamic Top-K classified all queries as Course Catalog (topK >= 12).");

    // Test 2: Local Chunk Search Retrieves courses_list.pdf Chunks
    console.log("\n--- TEST 2: Local Chunk Search Retrieves courses_list.pdf ---");
    const results = searchLocalChunks("what courses this college offer", {}, 15);
    const courseListChunks = results.filter(r => /courses_list/i.test(r.metadata?.originalName || ""));
    console.log(`Retrieved ${results.length} chunks. Found ${courseListChunks.length} chunks from courses_list.pdf.`);
    assert.strictEqual(courseListChunks.length >= 5, true, "Should retrieve at least 5 chunks from courses_list.pdf");

    const pages = courseListChunks.map(c => c.metadata?.pageNumber).sort((a, b) => a - b);
    console.log("Retrieved pages from courses_list.pdf:", [...new Set(pages)]);
    assert.strictEqual(pages.includes(1), true, "Should include Page 1 (Undergraduate Engineering & Computational Science)");
    console.log("PASS: Local chunk search successfully retrieves courses_list.pdf chunks.");

    // Test 3: Reranker does not penalize master course catalog chunks
    console.log("\n--- TEST 3: Reranker Entity Score & Specialization Neutrality ---");
    const reranked = await rerankService.rerank("what courses this college offer", courseListChunks);
    for (const chunk of reranked) {
        const entityScore = chunk.rankingSignals?.entityScore || 0;
        assert.strictEqual(entityScore >= 0, true, `Chunk on page ${chunk.metadata?.pageNumber} should not have negative entityScore: ${entityScore}`);
    }
    console.log("PASS: All courses_list.pdf chunks have non-negative entity scores (no specialization penalties).");

    // Test 4: Dynamic Output Budget Allocation
    console.log("\n--- TEST 4: Dynamic Output Budget Allocation ---");
    const budget = calculateDynamicOutputBudget("what courses this college offer");
    console.log(`Output budget for "what courses this college offer": maxTokens = ${budget.maxTokens}, tier = ${budget.tier}`);
    assert.strictEqual(budget.tier, "COURSE_CATALOG", "Budget tier should be COURSE_CATALOG");
    assert.strictEqual(budget.maxTokens >= 700, true, "Output budget should be at least 700 tokens for comprehensive listing");
    console.log("PASS: Output budget allocates sufficient tokens (>=700) for course catalog.");

    // Test 5: Smart Context Builder Assembles Comprehensive Overview
    console.log("\n--- TEST 5: Smart Context Builder Assembles Context ---");
    const smartContext = buildSmartContext(courseListChunks, { question: "what courses this college offer" });
    console.log(`Built context length: ${smartContext.length} characters`);
    assert.strictEqual(smartContext.includes("courses_list.pdf") || smartContext.includes("Programmes") || smartContext.includes("Undergraduate"), true, "Context should include course catalog text");
    console.log("PASS: Smart context built successfully with all schools.");

    console.log("\n=== ALL COURSE CATALOG VERIFICATION CHECKS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
    console.error("FAIL:", err);
    process.exit(1);
});
