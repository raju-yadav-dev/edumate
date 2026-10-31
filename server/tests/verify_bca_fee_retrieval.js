const assert = require('assert');
const { planQuery } = require('../ai/utils/queryPlanner');
const { retrieve } = require('../ai/services/retrievalService');
const promptService = require('../services/promptService');

async function verifyBcaFeeRetrieval() {
    console.log("=== Testing BCA Fee Structure Retrieval & Context Assembly ===");

    const q = "fees structure of bca";
    const queryPlan = planQuery(q);

    assert.strictEqual(queryPlan.intent, "FEE_QUERY", "Intent must be FEE_QUERY");
    assert.strictEqual(String(queryPlan.program).toUpperCase(), "BCA", "Program must be BCA");
    console.log("✓ Query planning verified: Intent: FEE_QUERY | Program: BCA");

    const chunks = await retrieve({ question: q, queryPlan });
    assert(chunks.length >= 3, `Expected at least 3 retrieved chunks, got ${chunks.length}`);

    // Check retrieved documents
    const docNames = chunks.map(c => c.metadata?.originalName || c.metadata?.filename || c.documentTitle || "");
    const pages = chunks.map(c => c.metadata?.pageNumber);

    console.log(`✓ Retrieved ${chunks.length} chunks across documents:`);
    chunks.forEach((c, idx) => {
        console.log(`  [Chunk #${idx + 1}] Doc: ${docNames[idx]} | Page: ${pages[idx]} | Score: ${c.score}`);
    });

    // 1. Fee_Structure.pdf must be retrieved
    const hasFeeStructureDoc = docNames.some(d => /fee_structure/i.test(d));
    assert(hasFeeStructureDoc, "Fee_Structure.pdf must be in retrieved chunks");
    console.log("✓ Universal Fee_Structure.pdf retrieved");

    // 2. BCA course details chunks must be retrieved
    const hasBcaDoc = docNames.some(d => /bca/i.test(d));
    assert(hasBcaDoc, "BCA brochure document must be in retrieved chunks");

    // 3. Neither B.Tech brochure nor MCA brochure should be retrieved in top fee chunks
    const hasBtechDedicated = docNames.some(d => /b\.?tech/i.test(d) && !/fee_structure/i.test(d));
    const hasMcaDedicated = docNames.some(d => /mca/i.test(d) && !/fee_structure/i.test(d));
    assert(!hasBtechDedicated, "B.Tech brochure should not contaminate BCA fee query");
    assert(!hasMcaDedicated, "MCA brochure should not contaminate BCA fee query");
    console.log("✓ Cross-programme contamination prevented (no B.Tech or MCA chunks)");

    // 4. Verify context assembly
    const messages = promptService.buildMessages({
        question: q,
        intent: queryPlan.intent,
        retrievedChunks: chunks,
        queryPlan,
        route: "UNIVERSITY_SPECIFIC"
    });

    const userPrompt = messages[1].content;

    // Must contain BCA total fee and semester figures
    assert(userPrompt.includes("4,82,600") || userPrompt.includes("482600"), "Context must contain BCA total fee (482600)");
    assert(userPrompt.includes("77200"), "Context must contain semester fee (77200)");
    assert(userPrompt.includes("60700"), "Context must contain semester fee (60700)");

    // Fee_Structure.pdf must NOT have false "Program: B.Tech" header
    assert(!userPrompt.includes("[Document: Fee_Structure.pdf | Category: fee & finance rules | Program: B.Tech"), "Fee_Structure.pdf must not be labeled Program: B.Tech");

    console.log("✓ Context assembled with exact BCA total fee (₹4,82,600) and semester figures (₹77,200 / ₹60,700)");
    console.log("✓ False 'Program: B.Tech' header eliminated from Fee_Structure.pdf");
    console.log("\nALL BCA FEE RETRIEVAL AND CONTEXT CHECKS PASSED!");
}

verifyBcaFeeRetrieval().catch(err => {
    console.error("FAILED:", err.message);
    process.exit(1);
});

