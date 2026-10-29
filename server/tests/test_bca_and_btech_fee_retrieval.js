const assert = require("assert");
const retrievalService = require("../ai/services/retrievalService");
const rerankService = require("../ai/services/rerankService");
const citationService = require("../ai/services/citationService");
const { buildSmartContext } = require("../ai/utils/contextBuilder");
const { planQuery } = require("../ai/utils/queryPlanner");

function selectDiverseChunks(rankedChunks, maxLimit = 6) {
    if (!Array.isArray(rankedChunks) || rankedChunks.length === 0) return [];
    const sorted = [...rankedChunks].sort((a, b) => (b.score || 0) - (a.score || 0));
    const selected = [];
    const seenSigs = new Set();
    const docCount = new Map();
    for (const chunk of sorted) {
        const text = String(chunk.content || "").slice(0, 150).toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seenSigs.has(text)) continue;
        const docId = String(chunk.metadata?.documentId || chunk.metadata?.originalName || "default");
        const count = docCount.get(docId) || 0;
        if (count >= 3 && sorted.length > selected.length) continue;
        seenSigs.add(text);
        docCount.set(docId, count + 1);
        selected.push(chunk);
        if (selected.length >= maxLimit) break;
    }
    return selected;
}

async function testBCA() {
    console.log("============================================================");
    console.log("TEST 1: BCA Fees Retrieval & Programme Isolation");
    console.log("============================================================");

    const query = "What are the fees for BCA?";
    const plan = planQuery(query);
    console.log("Query Plan -> Program:", plan.program, "| DocumentType:", plan.documentType);
    assert.strictEqual(plan.program, "BCA", "Programme must be detected as BCA");

    const retrieved = await retrievalService.retrieve({ question: query, limit: 12 });
    console.log("Retrieved candidate count:", retrieved.length);
    assert(retrieved.length > 0, "Retrieval must return candidate chunks");

    const ranked = await rerankService.rerank(query, retrieved);
    const positiveEntityMatches = ranked.filter(c => c.rankingSignals && c.rankingSignals.entityScore > 0);
    const nonConflictingChunks = ranked.filter(c => !c.rankingSignals || c.rankingSignals.entityScore >= 0);
    const candidatesForSelection = positiveEntityMatches.length > 0 ? nonConflictingChunks : ranked;
    const selected = selectDiverseChunks(candidatesForSelection, 6);

    const topChunk = selected[0];
    console.log("Top Selected Chunk:", topChunk.metadata?.originalName, "| Program:", topChunk.metadata?.program);
    assert.strictEqual(topChunk.metadata?.program, "BCA", "Top chunk must be BCA");
    assert(!/mobile\s+application\s+and\s+web\s+technologies|mwt/i.test(topChunk.content), "Top chunk must NOT be BCA MWT");

    const context = buildSmartContext(selected, { question: query, queryPlan: plan });
    console.log("\nContext Preview (first 500 chars):\n" + context.slice(0, 500) + "...\n");

    // Verify all 8 semester rows in context
    const expectedSemesters = [
        { sem: "Semester 1", fee: "77,200" },
        { sem: "Semester 2", fee: "77,200" },
        { sem: "Semester 3", fee: "60,700" },
        { sem: "Semester 4", fee: "60,700" },
        { sem: "Semester 5", fee: "60,700" },
        { sem: "Semester 6", fee: "42,700" },
        { sem: "Semester 7", fee: "60,700" },
        { sem: "Semester 8", fee: "42,700" }
    ];

    expectedSemesters.forEach(({ sem, fee }) => {
        const hasSem = context.includes(sem);
        const hasFee = context.includes(fee);
        assert(hasSem && hasFee, `Context must contain ${sem} with fee amount ${fee}`);
        console.log(`  PASS: ${sem} (${fee}) present in context`);
    });

    // Verify total course fee
    assert(context.includes("4,82,600"), "Context must contain total fee 4,82,600");
    console.log("  PASS: Total Course Fee 4,82,600 present in context");

    // Verify citations
    const citations = citationService.formatCitations(selected, [], [], context, query);
    console.log("Generated Citations count:", citations.length);
    assert(citations.length > 0, "Citations must be generated");
    const bcaSources = citations.map(c => c.documentTitle || c.title || c.source || "");
    console.log("Citations sources:", bcaSources);
    assert(bcaSources.some(s => /18\.12\.28/i.test(s) || /Bachelor Course Fee Structure/i.test(s)), "Citation must point to BCA fee card");
    assert(!bcaSources.some(s => /18\.12\.29/i.test(s)), "Citation must NOT point to BCA MWT image (18.12.29)");
    console.log("  PASS: BCA Citations properly grounded without MWT leakage\n");
}

async function testBTech() {
    console.log("============================================================");
    console.log("TEST 2: B.Tech CSE AI/ML Fees Retrieval & Specialization Match");
    console.log("============================================================");

    const query = "What are the fees for B.Tech CSE in Artificial Intelligence and Machine Learning?";
    const plan = planQuery(query);
    console.log("Query Plan -> Program:", plan.program, "| Department:", plan.department);
    assert.strictEqual(plan.program, "B.Tech", "Programme must be detected as B.Tech");

    const retrieved = await retrievalService.retrieve({ question: query, limit: 12 });
    console.log("Retrieved candidate count:", retrieved.length);
    assert(retrieved.length > 0, "Retrieval must return candidate chunks");

    const ranked = await rerankService.rerank(query, retrieved);
    const positiveEntityMatches = ranked.filter(c => c.rankingSignals && c.rankingSignals.entityScore > 0);
    const nonConflictingChunks = ranked.filter(c => !c.rankingSignals || c.rankingSignals.entityScore >= 0);
    const candidatesForSelection = positiveEntityMatches.length > 0 ? nonConflictingChunks : ranked;
    const selected = selectDiverseChunks(candidatesForSelection, 6);

    const topChunk = selected[0];
    console.log("Top Selected Chunk:", topChunk.metadata?.originalName, "| Program:", topChunk.metadata?.program);
    assert(topChunk.metadata?.program === "B.Tech", "Top chunk must be B.Tech");
    assert(/artificial\s+intelligence\s+(?:&|and)\s*machine\s+learning|ai\s*(&|\+|and)?\s*ml/i.test(topChunk.content), "Top chunk must be AI & ML specialization");

    const context = buildSmartContext(selected, { question: query, queryPlan: plan });
    console.log("\nContext Preview (first 500 chars):\n" + context.slice(0, 500) + "...\n");

    // Verify all 8 semester rows in context
    const expectedSemesters = [
        { sem: "Semester 1", fee: "98,200" },
        { sem: "Semester 2", fee: "96,200" },
        { sem: "Semester 3", fee: "75,200" },
        { sem: "Semester 4", fee: "75,200" },
        { sem: "Semester 5", fee: "69,200" },
        { sem: "Semester 6", fee: "64,200" },
        { sem: "Semester 7", fee: "58,200" },
        { sem: "Semester 8", fee: "43,200" }
    ];

    expectedSemesters.forEach(({ sem, fee }) => {
        const hasSem = context.includes(sem);
        const hasFee = context.includes(fee);
        assert(hasSem && hasFee, `Context must contain ${sem} with fee amount ${fee}`);
        console.log(`  PASS: ${sem} (${fee}) present in context`);
    });

    // Verify total course fee
    assert(context.includes("5,79,600"), "Context must contain total fee 5,79,600");
    console.log("  PASS: Total Course Fee 5,79,600 present in context");

    // Verify citations
    const citations = citationService.formatCitations(selected, [], [], context, query);
    console.log("Generated Citations count:", citations.length);
    assert(citations.length > 0, "Citations must be generated");
    const btechSources = citations.map(c => c.documentTitle || c.title || c.source || "");
    console.log("Citations sources:", btechSources);
    assert(btechSources.some(s => /18\.12\.24/i.test(s) || /Artificial Intelligence and Machine Learning/i.test(s)), "Citation must point to B.Tech CSE AI/ML sources");
    console.log("  PASS: B.Tech CSE AI/ML Citations properly grounded\n");
}

async function run() {
    try {
        await testBCA();
        await testBTech();
        console.log("============================================================");
        console.log("ALL REAL SOURCE DOCUMENT FEE RETRIEVAL TESTS PASSED!");
        console.log("============================================================");
    } catch (err) {
        console.error("\nTEST FAILED:", err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

run();
