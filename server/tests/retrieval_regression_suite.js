/**
 * EduMate Part 2B — Retrieval Regression Suite (Phase 5)
 *
 * Tests retrieval recall, programme isolation, answer faithfulness,
 * and multi-chunk synthesis against 10 synthetic fixture scenarios.
 *
 * Uses ONLY synthetic in-memory chunks; never modifies production data.
 * Run with:  node server/tests/retrieval_regression_suite.js
 */

"use strict";

require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

// ────────────────────────────────────────────────────────────────
// Synthetic Fixtures (no real Qdrant / MongoDB calls)
// ────────────────────────────────────────────────────────────────

const FIXTURES = {
    // BCA multi-chunk: fees split across 3 sections
    bcaFee1: {
        id: "bca-fee-chunk-1", score: 0.87,
        content: "BCA (Bachelor of Computer Applications) — Year 1 Tuition Fee: Rs.55,000. Admission fee: Rs.2,000.",
        metadata: { documentId: "doc-bca-fees", originalName: "BCA_Fee_Structure.pdf", category: "Admissions", documentType: "Fee Structure", program: "BCA", department: "Computational Sciences", pageNumber: 1, heading: "Year 1 Fees", keywords: ["bca", "fee", "tuition"] }
    },
    bcaFee2: {
        id: "bca-fee-chunk-2", score: 0.81,
        content: "BCA Year 2 Tuition Fee: Rs.55,000. Examination fee per semester: Rs.1,200.",
        metadata: { documentId: "doc-bca-fees", originalName: "BCA_Fee_Structure.pdf", category: "Admissions", documentType: "Fee Structure", program: "BCA", department: "Computational Sciences", pageNumber: 2, heading: "Year 2 Fees", keywords: ["bca", "fee", "tuition"] }
    },
    bcaFee3: {
        id: "bca-fee-chunk-3", score: 0.76,
        content: "BCA Year 3 Tuition Fee: Rs.55,000. Total 3-year programme cost: Rs.1,65,000 (excluding hostel).",
        metadata: { documentId: "doc-bca-fees", originalName: "BCA_Fee_Structure.pdf", category: "Admissions", documentType: "Fee Structure", program: "BCA", department: "Computational Sciences", pageNumber: 3, heading: "Year 3 Fees", keywords: ["bca", "fee", "total"] }
    },
    // MCA chunks (different programme — must not mix)
    mcaFee1: {
        id: "mca-fee-chunk-1", score: 0.72,
        content: "MCA (Master of Computer Applications) — Year 1 Tuition Fee: Rs.70,000. Duration: 2 years.",
        metadata: { documentId: "doc-mca-fees", originalName: "MCA_Fee_Structure.pdf", category: "Admissions", documentType: "Fee Structure", program: "MCA", department: "Computational Sciences", pageNumber: 1, heading: "MCA Year 1 Fees", keywords: ["mca", "fee", "tuition"] }
    },
    // Eligibility present
    bcaEligibility: {
        id: "bca-elig-chunk-1", score: 0.84,
        content: "BCA Eligibility: Minimum 50% in Class 12 (any stream). Physics, Chemistry, Mathematics or Computer Science preferred.",
        metadata: { documentId: "doc-bca-brochure", originalName: "BCA_Admissions_Brochure.pdf", category: "Admissions", documentType: "Admission Brochure", program: "BCA", department: "Computational Sciences", pageNumber: 1, heading: "Eligibility", keywords: ["bca", "eligibility", "class 12"] }
    },
    // Fee absent — only general admission info
    btechAdmission: {
        id: "btech-admission-chunk-1", score: 0.79,
        content: "B.Tech Admissions: Apply through JoSAA or direct state counselling. Merit-based selection.",
        metadata: { documentId: "doc-btech-adm", originalName: "BTech_Admission.pdf", category: "Admissions", documentType: "Admission Brochure", program: "B.Tech", department: "Engineering", pageNumber: 1, heading: "Admission Process", keywords: ["btech", "admission", "jee"] }
    },
    // Comparison: BBA chunk
    bbaFee1: {
        id: "bba-fee-chunk-1", score: 0.73,
        content: "BBA (Bachelor of Business Administration) — Annual Tuition Fee: Rs.48,000. Duration: 3 years.",
        metadata: { documentId: "doc-bba-fees", originalName: "BBA_Fee_Structure.pdf", category: "Admissions", documentType: "Fee Structure", program: "BBA", department: "Management", pageNumber: 1, heading: "BBA Fees", keywords: ["bba", "fee", "tuition"] }
    },
    // Image-derived OCR chunk with a unique test fact
    imageOcrChunk: {
        id: "image-ocr-chunk-1", score: 0.71,
        content: "SYNTHETIC_OCR_UNIQUE_FACT: The Dean of Student Affairs office is located in Building 3, Room 301.",
        metadata: { documentId: "img-doc-001", originalName: "campus_notice_board.png", category: "Campus", documentType: "image", mimeType: "image/png", department: "Administration", pageNumber: 1, heading: "Dean Office", keywords: ["dean", "student affairs", "building 3", "room 301"], isOcr: true }
    },
    // Irrelevant / contradictory chunk — must not contaminate BCA fee answer
    irrelevantChunk: {
        id: "irrelevant-chunk-1", score: 0.55,
        content: "The university parking rules prohibit vehicles above 2.5 tons in Lot B.",
        metadata: { documentId: "doc-parking", originalName: "Parking_Rules.pdf", category: "Campus", documentType: "Notice", department: "Administration", pageNumber: 1, heading: "Parking", keywords: ["parking", "vehicles", "lot"] }
    }
};

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results = [];

function assert(label, condition, detail) {
    if (condition) {
        passed++;
        results.push({ label, status: "PASS", detail: detail || "" });
        console.log("  PASS  " + label);
    } else {
        failed++;
        results.push({ label, status: "FAIL", detail: detail || "" });
        console.error("  FAIL  " + label + (detail ? " -- " + detail : ""));
    }
}

function assertNot(label, condition, detail) {
    return assert(label, !condition, detail);
}

// ────────────────────────────────────────────────────────────────
// Modules under test
// ────────────────────────────────────────────────────────────────

const { buildSmartContext } = require("../ai/utils/contextBuilder");
const { rerank }            = require("../ai/services/rerankService");
const { planQuery }         = require("../ai/utils/queryPlanner");

// Inline copy of selectDiverseChunks (matches the improved version)
function selectDiverseChunks(rankedChunks, maxLimit) {
    if (!maxLimit) maxLimit = 6;
    if (!Array.isArray(rankedChunks) || rankedChunks.length === 0) return [];
    const sorted = [...rankedChunks].sort((a, b) => (b.score || 0) - (a.score || 0));
    const selected = [];
    const seenSigs = new Set();
    const docCount = new Map();
    for (const chunk of sorted) {
        const text = String(chunk.content || "").slice(0, 150).toLowerCase().replace(/[^a-z0-9]/g, "");
        if (text.length > 20 && seenSigs.has(text)) continue;
        const docId = chunk.metadata && chunk.metadata.documentId ? chunk.metadata.documentId : "unknown";
        const count = docCount.get(docId) || 0;
        const perDocCap = Math.max(3, Math.floor(maxLimit / 2));
        if (count >= perDocCap && selected.length >= Math.ceil(maxLimit / 2)) continue;
        selected.push(chunk);
        if (text.length > 20) seenSigs.add(text);
        docCount.set(docId, count + 1);
        if (selected.length >= maxLimit) break;
    }
    return selected;
}

// ────────────────────────────────────────────────────────────────
// Test Cases
// ────────────────────────────────────────────────────────────────

async function test1_multiChunkCourseDetail() {
    console.log("\n[TEST 1] Multi-chunk course detail (BCA fees across 3 chunks)");
    const query = "What are the fees for BCA?";
    const allChunks = [FIXTURES.bcaFee1, FIXTURES.bcaFee2, FIXTURES.bcaFee3, FIXTURES.irrelevantChunk];
    const ranked = await rerank(query, allChunks);
    const selected = selectDiverseChunks(ranked, 6);

    assert("At least 3 BCA fee chunks selected", selected.length >= 3, "got " + selected.length);
    assert("bcaFee1 present", selected.some(function(c) { return c.id === "bca-fee-chunk-1"; }));
    assert("bcaFee2 present", selected.some(function(c) { return c.id === "bca-fee-chunk-2"; }));
    assert("bcaFee3 present", selected.some(function(c) { return c.id === "bca-fee-chunk-3"; }));

    const context = buildSmartContext(selected, { question: query, queryPlan: planQuery(query) });
    assert("Year 1 fee in context", context.includes("55,000"), "context: " + context.slice(0, 200));
    assert("Total 3-year cost or Year 3 in context", context.includes("1,65,000") || context.includes("Year 3"));
    // Parking chunk should rank below ALL BCA chunks (ranked last), even if it snuck into a 4-chunk context
    const parkingRank = ranked.findIndex(function(c) { return c.id === "irrelevant-chunk-1"; });
    assert("Parking rules ranked below BCA fee chunks", parkingRank >= 3, "parkingRank=" + parkingRank);
}

async function test2_programmeFactIsolation() {
    console.log("\n[TEST 2] Programme fact isolation (BCA vs MCA)");
    const bcaQuery = "What is the fee for BCA?";
    const allChunks = [FIXTURES.bcaFee1, FIXTURES.bcaFee2, FIXTURES.mcaFee1];
    const ranked = await rerank(bcaQuery, allChunks);
    const selected = selectDiverseChunks(ranked, 4);

    const topChunk = selected[0];
    assert("Top chunk is BCA, not MCA", topChunk.metadata && topChunk.metadata.program === "BCA",
        "got " + (topChunk.metadata && topChunk.metadata.program));

    const context = buildSmartContext(selected, { question: bcaQuery, queryPlan: planQuery(bcaQuery) });
    if (context.includes("70,000")) {
        assert("MCA fee correctly labelled when present", context.toLowerCase().includes("mca"));
    } else {
        assert("MCA fee not injected into BCA answer", true);
    }
}

async function test3_feePresentInChunk() {
    console.log("\n[TEST 3] Fee present in chunk -> must reach context");
    const query = "What is the total BCA fee?";
    const allChunks = [FIXTURES.bcaFee1, FIXTURES.bcaFee2, FIXTURES.bcaFee3];
    const ranked = await rerank(query, allChunks);
    const selected = selectDiverseChunks(ranked, 4);
    const context = buildSmartContext(selected, { question: query, queryPlan: planQuery(query) });

    assert("Fee amount present in context", context.includes("55,000") || context.includes("1,65,000"),
        "context: " + context.slice(0, 200));
}

async function test4_feeAbsentNotInvented() {
    console.log("\n[TEST 4] Fee absent -- chunk has no fee amount");
    const query = "What is the B.Tech fee?";
    const allChunks = [FIXTURES.btechAdmission];
    const ranked = await rerank(query, allChunks);
    const selected = selectDiverseChunks(ranked, 4);
    const context = buildSmartContext(selected, { question: query, queryPlan: planQuery(query) });

    assertNot("No rupee fee amount in context", /Rs\.\s?\d/.test(context) || /\d{2,},\d{3}/.test(context),
        "context: " + context.slice(0, 120));
    assert("Admission info is in context", context.toLowerCase().includes("admission") || context.toLowerCase().includes("btech") || context.toLowerCase().includes("b.tech"));
}

async function test5_followUpContextInheritance() {
    console.log("\n[TEST 5] Follow-up question inherits programme context");
    const qp = planQuery("What about eligibility?", {
        activeTopic: "BCA admissions",
        historyText: "User: What are the BCA fees?\nAssistant: The BCA fee is Rs.55,000 per year."
    });

    assert("Programme or category inherited for follow-up",
        qp.program === "BCA" || qp.category === "Admissions" || qp.intent === "ADMISSION_QUERY",
        "program=" + qp.program + " category=" + qp.category + " intent=" + qp.intent);
}

async function test6_programmeSwitchResetsContext() {
    console.log("\n[TEST 6] Explicit programme switch resets entity context");
    const qp = planQuery("What is the MCA fee?", {
        activeTopic: "BCA",
        historyText: "User: What are the BCA fees?\nAssistant: BCA fee is Rs.55,000 per year."
    });

    const detectedPrograms = qp.programs || (qp.program ? [qp.program] : []);
    assert("MCA detected as primary programme",
        qp.program === "MCA" || detectedPrograms.includes("MCA"),
        "program=" + qp.program + " programs=" + JSON.stringify(qp.programs));
}

async function test7_comparisonMultiProgramme() {
    console.log("\n[TEST 7] Comparison question -- evidence from BCA and BBA");
    const query = "Compare the fees of BCA and BBA.";
    const allChunks = [FIXTURES.bcaFee1, FIXTURES.bbaFee1, FIXTURES.irrelevantChunk];
    const ranked = await rerank(query, allChunks);
    const selected = selectDiverseChunks(ranked, 6);

    assert("BCA fee chunk selected", selected.some(function(c) { return c.id === "bca-fee-chunk-1"; }));
    assert("BBA fee chunk selected", selected.some(function(c) { return c.id === "bba-fee-chunk-1"; }));

    const context = buildSmartContext(selected, { question: query, queryPlan: planQuery(query) });
    assert("BCA in comparison context", context.toUpperCase().includes("BCA"));
    assert("BBA in comparison context", context.toUpperCase().includes("BBA"));
}

async function test8_generalReasoningRouting() {
    console.log("\n[TEST 8] Reasoning question -- planQuery does not skip RAG");
    const query = "Which is cheaper, BCA or BBA, based on the fee structure?";
    const qp = planQuery(query);

    assert("Query not classified as LLM_ONLY (skipRag=false)", !qp.skipRag,
        "route=" + qp.route + " skipRag=" + qp.skipRag);
    assert("Query type is Comparison or fee intent",
        qp.queryType === "Comparison" || qp.intent === "FEE_QUERY",
        "queryType=" + qp.queryType + " intent=" + qp.intent);
}

async function test9_imageOcrChunkRetrievable() {
    console.log("\n[TEST 9] Image-derived OCR chunk reachable through reranker");
    const query = "Where is the Dean of Student Affairs office?";
    const allChunks = [FIXTURES.imageOcrChunk, FIXTURES.irrelevantChunk];
    const ranked = await rerank(query, allChunks);
    const selected = selectDiverseChunks(ranked, 4);

    assert("OCR chunk selected", selected.some(function(c) { return c.id === "image-ocr-chunk-1"; }),
        "selected ids: " + selected.map(function(c) { return c.id; }).join(", "));

    assert("OCR chunk is top result", selected[0] && selected[0].id === "image-ocr-chunk-1",
        "top: " + (selected[0] && selected[0].id));

    const context = buildSmartContext(selected, { question: query });
    assert("Dean office location in context",
        context.includes("Building 3") || context.includes("Room 301") || context.includes("Dean"));
}

async function test10_irrelevantChunkFiltered() {
    console.log("\n[TEST 10] Irrelevant chunk -- must not contaminate BCA fee answer");
    const query = "What are the BCA fees?";
    const allChunks = [FIXTURES.bcaFee1, FIXTURES.bcaFee2, FIXTURES.irrelevantChunk];
    const ranked = await rerank(query, allChunks);

    const irrelevantRank = ranked.findIndex(function(c) { return c.id === "irrelevant-chunk-1"; });
    const bcaRank = ranked.findIndex(function(c) { return c.id === "bca-fee-chunk-1"; });

    assert("BCA chunk ranked higher than parking rules chunk", bcaRank < irrelevantRank,
        "BCA rank: " + bcaRank + ", Irrelevant rank: " + irrelevantRank);

    const selected = selectDiverseChunks(ranked, 2);
    assertNot("Parking rules chunk not in top-2 budget", selected.some(function(c) { return c.id === "irrelevant-chunk-1"; }));

    const context = buildSmartContext(selected, { question: query, queryPlan: planQuery(query) });
    assertNot("Parking not in context", context.toLowerCase().includes("parking"));
}

async function measureBaseline() {
    console.log("\n[BASELINE] Before vs after chunk selection counts");

    const query = "What are the fees for BCA?";
    const allChunks = [FIXTURES.bcaFee1, FIXTURES.bcaFee2, FIXTURES.bcaFee3, FIXTURES.irrelevantChunk];
    const ranked = await rerank(query, allChunks);

    // OLD: chunkLimit=3, perDocCap=2
    function oldSelect(chunks, maxLimit) {
        const sorted = [...chunks].sort(function(a,b){ return (b.score||0)-(a.score||0); });
        const sel=[], sigs=new Set(), dc=new Map();
        for (const c of sorted) {
            const t=String(c.content||"").slice(0,150).toLowerCase().replace(/[^a-z0-9]/g,"");
            if(t.length>20&&sigs.has(t)) continue;
            const id=c.metadata&&c.metadata.documentId||"u";
            const cnt=dc.get(id)||0;
            if(cnt>=2&&sel.length>=3) continue;
            sel.push(c);
            if(t.length>20) sigs.add(t);
            dc.set(id,cnt+1);
            if(sel.length>=maxLimit) break;
        }
        return sel;
    }

    const oldResult = oldSelect(ranked, 3);
    const newResult = selectDiverseChunks(ranked, 6);
    const oldBca = oldResult.filter(function(c){ return c.metadata&&c.metadata.program==="BCA"; }).length;
    const newBca = newResult.filter(function(c){ return c.metadata&&c.metadata.program==="BCA"; }).length;

    console.log("  OLD (chunkLimit=3): " + oldResult.length + " total, " + oldBca + " BCA chunks");
    console.log("  NEW (chunkLimit=6): " + newResult.length + " total, " + newBca + " BCA chunks");

    assert("NEW retrieves more BCA chunks than OLD", newBca > oldBca || newResult.length > oldResult.length,
        "old=" + oldBca + " new=" + newBca);
}

// ────────────────────────────────────────────────────────────────
// Runner
// ────────────────────────────────────────────────────────────────

(async function() {
    console.log("=".repeat(60));
    console.log("  EduMate Part 2B -- Retrieval Regression Suite");
    console.log("=".repeat(60));

    const tests = [
        test1_multiChunkCourseDetail,
        test2_programmeFactIsolation,
        test3_feePresentInChunk,
        test4_feeAbsentNotInvented,
        test5_followUpContextInheritance,
        test6_programmeSwitchResetsContext,
        test7_comparisonMultiProgramme,
        test8_generalReasoningRouting,
        test9_imageOcrChunkRetrievable,
        test10_irrelevantChunkFiltered,
        measureBaseline
    ];

    for (const t of tests) {
        try {
            await t();
        } catch (err) {
            console.error("  EXCEPTION in " + t.name + ": " + err.message);
            failed++;
            results.push({ label: t.name, status: "EXCEPTION", detail: err.message });
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("  RESULTS: " + passed + " passed, " + failed + " failed / " + (passed+failed) + " total");
    console.log("=".repeat(60));

    if (failed > 0) {
        console.log("\nFailed tests:");
        results.filter(function(r){ return r.status !== "PASS"; }).forEach(function(r){
            console.log("  FAIL: " + r.label + ": " + r.detail);
        });
        process.exit(1);
    } else {
        console.log("\nAll tests passed.");
        process.exit(0);
    }
})();
