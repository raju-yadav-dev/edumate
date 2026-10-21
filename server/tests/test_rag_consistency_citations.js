/**
 * EduMate RAG Regression Test Suite
 * 
 * Verifies RAG Answer Consistency and Citation Precision:
 * 1. Query 1: "What is the room number of HOD-psychology?"
 * 2. Query 2: "What is the room number and building of HOD-psychology?" (Follow-up consistency)
 * 3. Unrelated Low-Relevance Chunks: Verifies non-supporting chunks are filtered out from citations
 * 4. Missing Building Information: Verifies explicit disclosure when building cannot be verified (no guessing)
 * 5. Conflicting Room Numbers: Verifies entity-fact binding prevents cross-contamination across chunks
 */

const path = require("path");
const mongoose = require("mongoose");
const assert = require("assert");

require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const chatService = require("../ai/services/chatService");
const citationService = require("../ai/services/citationService");
const rerankService = require("../ai/services/rerankService");

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function logPass(title) {
    totalTests++;
    passedTests++;
    console.log(`  ✅ [PASS] ${title}`);
}

function logFail(title, err) {
    totalTests++;
    failedTests++;
    console.error(`  ❌ [FAIL] ${title}`);
    console.error(`     Error: ${err.message || err}`);
}

async function runRegressionTestSuite() {
    console.log("\n================================================================================");
    console.log("       EDUMATE RAG REGRESSION TEST SUITE: CONSISTENCY & CITATIONS");
    console.log("================================================================================\n");

    await mongoose.connect(process.env.MONGODB_URI);

    const testUser = {
        _id: new mongoose.Types.ObjectId(),
        role: "student",
        institution: "Brainware University",
        fullName: "RAG Consistency Test Runner"
    };

    const conversationId = new mongoose.Types.ObjectId().toString();

    // ============================================================================
    // TEST 1: Query 1 — "What is the room number of HOD-psychology?"
    // ============================================================================
    console.log("▶ TEST 1: Query 1 — 'What is the room number of HOD-psychology?'");
    let res1;
    try {
        res1 = await chatService.askQuestion({
            user: testUser,
            question: "What is the room number of HOD-psychology?",
            conversationId,
            parentId: null
        });

        const ans1 = (res1.message || res1.answer || "").toLowerCase();
        console.log(`    Answer: "${res1.message || res1.answer}"`);
        console.log(`    Sources Count: ${res1.sources ? res1.sources.length : 0}`);

        // Assert room 101 is identified
        assert(ans1.includes("101"), "Answer must contain Room 101");
        assert(ans1.includes("psychology"), "Answer must refer to Psychology");
        // Assert room 109 is NOT in the answer
        assert(!ans1.includes("109"), "Answer must NOT contain conflicting Room 109");

        // Assert citation precision: only Room 101 chunk cited
        assert(Array.isArray(res1.sources) && res1.sources.length === 1, "Exactly 1 citation supporting Room 101 should be returned");
        const s1 = res1.sources[0];
        assert(
            (s1.sectionHeading || s1.section || "").toLowerCase().includes("101") ||
            (s1.snippet || "").toLowerCase().includes("101"),
            "Citation must support Room 101"
        );
        assert(
            !(s1.sectionHeading || s1.section || "").toLowerCase().includes("109"),
            "Citation must NOT be Room 109"
        );

        logPass("Query 1 identifies Room 101 with precision citation");
    } catch (err) {
        logFail("Query 1 identifies Room 101 with precision citation", err);
    }

    // ============================================================================
    // TEST 2: Query 2 — "What is the room number and building of HOD-psychology?"
    // ============================================================================
    console.log("\n▶ TEST 2: Query 2 (Follow-up) — 'What is the room number and building of HOD-psychology?'");
    try {
        const res2 = await chatService.askQuestion({
            user: testUser,
            question: "What is the room number and building of HOD-psychology?",
            conversationId,
            parentId: res1?.chatId || null
        });

        const ans2 = (res2.message || res2.answer || "").toLowerCase();
        console.log(`    Answer: "${res2.message || res2.answer}"`);
        console.log(`    Sources Count: ${res2.sources ? res2.sources.length : 0}`);

        // Consistency: Must retain Room 101
        assert(ans2.includes("101"), "Answer must maintain consistency with Room 101");
        // Must add Building I
        assert(ans2.includes("building i"), "Answer must accurately include Building I");
        // Must NOT confuse room or entity
        assert(!ans2.includes("109"), "Answer must NOT contain Room 109");

        // Precision citations: Only supporting chunk
        assert(Array.isArray(res2.sources) && res2.sources.length === 1, "Exactly 1 citation supporting Room 101/Building I should be returned");
        const s2 = res2.sources[0];
        assert(
            (s2.documentTitle || s2.title || "").toLowerCase().includes("building i"),
            "Citation must point to Building I"
        );
        assert(
            (s2.sectionHeading || s2.section || "").toLowerCase().includes("101"),
            "Citation must point to Room 101 section"
        );

        logPass("Query 2 preserves Room 101, adds Building I, and retains citation precision");
    } catch (err) {
        logFail("Query 2 preserves Room 101, adds Building I, and retains citation precision", err);
    }

    // ============================================================================
    // TEST 3: Unrelated Low-Relevance Chunks Filtering
    // ============================================================================
    console.log("\n▶ TEST 3: Unrelated Low-Relevance Chunks Filtering");
    try {
        const candidateCitations = [
            {
                type: "document",
                documentTitle: "Building I.txt",
                title: "Building I.txt",
                sectionHeading: "101 HOD-psychology, teachers room - dept of psychology",
                snippet: "101 HOD-psychology, teachers room - dept of psychology",
                similarity: 95
            },
            {
                type: "document",
                documentTitle: "Building I.txt",
                title: "Building I.txt",
                sectionHeading: "109 HOD-cyber sc, teachers room - dept of cyber science and tech",
                snippet: "109 HOD-cyber sc, teachers room - dept of cyber science and tech",
                similarity: 90
            },
            {
                type: "document",
                documentTitle: "Building I.txt",
                title: "Building I.txt",
                sectionHeading: "105 Multimedia and Web Tech Lab",
                snippet: "105 Multimedia and Web Tech Lab",
                similarity: 78
            },
            {
                type: "document",
                documentTitle: "Building I.txt",
                title: "Building I.txt",
                sectionHeading: "106 Animation and VFX Lab",
                snippet: "106 Animation and VFX Lab",
                similarity: 75
            }
        ];

        const answerText = "The room number for HOD-psychology is 101 (101 HOD-psychology, teachers room - dept of psychology), located in Building I.";
        const query = "What is the room number and building of HOD-psychology?";

        const filtered = citationService.filterSupportingCitations(candidateCitations, answerText, query);

        console.log(`    Original candidate citations: ${candidateCitations.length}`);
        console.log(`    Filtered supporting citations: ${filtered.length}`);
        filtered.forEach(c => console.log(`      - [${c.documentTitle}] ${c.sectionHeading}`));

        assert.strictEqual(filtered.length, 1, "Must filter down to only the 1 supporting citation");
        assert(filtered[0].sectionHeading.includes("101"), "Retained citation must be Room 101");
        assert(!filtered.some(c => c.sectionHeading.includes("109")), "Must exclude Room 109 (Cyber Science)");
        assert(!filtered.some(c => c.sectionHeading.includes("105")), "Must exclude Room 105 (Multimedia Lab)");
        assert(!filtered.some(c => c.sectionHeading.includes("106")), "Must exclude Room 106 (Animation Lab)");

        logPass("Irrelevant and low-relevance chunks cleanly removed from citations");
    } catch (err) {
        logFail("Irrelevant and low-relevance chunks cleanly removed from citations", err);
    }

    // ============================================================================
    // TEST 4: Missing Building Information (Explicit Disclosure, No Guessing)
    // ============================================================================
    console.log("\n▶ TEST 4: Missing Building Information (Explicit Disclosure)");
    try {
        const mockChunkWithoutBuilding = {
            id: "mock-chunk-english",
            content: "Room 304 - HOD-English, Department of English Faculty Room",
            metadata: {
                heading: "304 HOD-English",
                filename: "Faculty_Offices_General.txt", // Note: No building name in filename or content
                originalName: "Faculty_Offices_General.txt",
                department: "English"
            }
        };

        const responseWithMissingBuilding = chatService.groundEntityLocationResponse({
            question: "What is the room number and building of HOD-English?",
            textResponse: "Room 304",
            chunks: [mockChunkWithoutBuilding],
            conversationContext: {}
        });

        console.log(`    Response: "${responseWithMissingBuilding}"`);

        // Must verify Room 304
        assert(responseWithMissingBuilding.includes("304"), "Must verify room number 304");
        // Must explicitly state building is not specified
        assert(
            /not specified in (?:the )?official documents/i.test(responseWithMissingBuilding),
            "Must explicitly state that the building is not specified"
        );
        // Must not invent or guess "Building I"
        assert(!responseWithMissingBuilding.includes("Building I"), "Must NOT hallucinate or guess a building name");

        logPass("Missing building information triggers explicit disclosure without guessing");
    } catch (err) {
        logFail("Missing building information triggers explicit disclosure without guessing", err);
    }

    // ============================================================================
    // TEST 5: Conflicting Room Numbers Across Retrieved Chunks
    // ============================================================================
    console.log("\n▶ TEST 5: Conflicting Room Numbers Across Retrieved Chunks");
    try {
        const conflictingChunks = [
            {
                id: "chunk-cyber-109",
                content: "109 HOD-cyber sc, teachers room - dept of cyber science and tech",
                score: 0.72,
                metadata: {
                    originalName: "Building I.txt",
                    heading: "109 HOD-cyber sc, teachers room - dept of cyber science and tech",
                    department: "Cyber Science",
                    category: "Campus"
                }
            },
            {
                id: "chunk-psychology-101",
                content: "101 HOD-psychology, teachers room - dept of psychology",
                score: 0.70, // Initially lower raw score
                metadata: {
                    originalName: "Building I.txt",
                    heading: "101 HOD-psychology, teachers room - dept of psychology",
                    department: "Psychology",
                    category: "Campus"
                }
            }
        ];

        const queryPlan = {
            category: ["Campus", "Faculty"],
            department: "Psychology",
            heading: "HOD"
        };

        const reranked = await rerankService.rerankChunks({
            chunks: conflictingChunks,
            query: "What is the room number of HOD-psychology?",
            plan: queryPlan,
            strategy: "balanced",
            topK: 2
        });

        console.log("    Reranked results:");
        reranked.forEach((c, idx) => {
            console.log(`      Rank ${idx + 1}: [Score: ${c.score.toFixed(4)}] ${c.metadata.heading}`);
        });

        // 1. Assert chunk-psychology-101 is ranked #1 after reranking
        assert.strictEqual(
            reranked[0].id,
            "chunk-psychology-101",
            "Chunk with Psychology HOD (101) must rank above conflicting Cyber Science chunk (109)"
        );

        // 2. Assert entity fact binding in answer assembly
        const groundedAns = chatService.groundEntityLocationResponse({
            question: "What is the room number of HOD-psychology?",
            textResponse: "",
            chunks: reranked,
            conversationContext: {}
        });

        console.log(`    Grounded answer with conflicting candidates: "${groundedAns}"`);
        assert(groundedAns.includes("101"), "Answer must bind to Room 101");
        assert(!groundedAns.includes("109"), "Answer must NOT bind to conflicting Room 109");

        logPass("Conflicting room numbers are resolved correctly with strict entity-fact binding");
    } catch (err) {
        logFail("Conflicting room numbers are resolved correctly with strict entity-fact binding", err);
    }

    // ============================================================================
    // SUMMARY
    // ============================================================================
    console.log("\n================================================================================");
    console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
    console.log("================================================================================\n");

    await mongoose.disconnect();

    if (failedTests > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runRegressionTestSuite().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
