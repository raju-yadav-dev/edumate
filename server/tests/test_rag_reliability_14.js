const assert = require("assert");
const {
    extractQueryTarget,
    parseChunkRecords,
    findBestMatchingRecord,
    groundEntityResponse,
    formatDemarcatedContext
} = require("../ai/services/entityGroundingService");
const { rerankChunks } = require("../ai/services/rerankService");
const { stripQwenThinking, calculateDynamicOutputBudget } = require("../config/llm");
const { filterSupportingCitations } = require("../ai/services/citationService");
const { resolveReferences } = require("../ai/services/queryOptimizationService");
const { buildSmartContext } = require("../ai/utils/contextBuilder");
const { classifyQuestionType, QUESTION_TYPES } = require("../services/intentService");
const { validateResponse } = require("../services/responseValidator");

async function runRegressionSuite() {
    console.log("================================================================================");
    console.log(" EduMate: 14-Point Automated RAG Reliability & Regression Test Suite");
    console.log("================================================================================\n");

    let passed = 0;
    let failed = 0;

    const test = async (num, name, fn) => {
        try {
            await fn();
            console.log(`  [PASS] Test ${num}: ${name}`);
            passed++;
        } catch (err) {
            console.error(`  [FAIL] Test ${num}: ${name}`);
            console.error(`         Error: ${err.message}\n`);
            failed++;
        }
    };

    // Sample multi-record chunk from Building I.txt
    const multiRecordChunk = {
        id: "chunk-bld-1",
        content: `205 Photography Lab

206 3D and VFX lab 3rd floor (Media and medical science and journalism)

303 classic animation lab

401 sound recording studio`,
        metadata: {
            originalName: "Building I.txt",
            filename: "Building I.txt",
            documentId: "doc-bld-1",
            pageNumber: 1
        }
    };

    // Test 1: VFX Lab returns room 206 and the third floor based on the displayed source record.
    await test(1, "VFX Lab returns room 206 and 3rd floor based on source record", () => {
        const query = "Where is the VFX lab?";
        const target = extractQueryTarget(query);
        assert.strictEqual(target.targetEntity, "vfx lab");

        const records = parseChunkRecords(multiRecordChunk);
        assert.strictEqual(records.length >= 4, true);

        const vfxRec = findBestMatchingRecord(records, target.targetEntity, target.entityTokens);
        assert.ok(vfxRec, "Should find VFX record");
        assert.strictEqual(vfxRec.room, "206");
        assert.strictEqual(vfxRec.floor, "3rd floor");
        assert.strictEqual(vfxRec.building, "Building I");

        const grounded = groundEntityResponse({
            question: query,
            targetEntity: target.targetEntity,
            bestRecord: vfxRec,
            attributes: target.attributes
        });
        assert.ok(grounded.includes("206"), "Should state Room 206");
        assert.ok(grounded.toLowerCase().includes("3rd floor"), "Should state 3rd floor");
        assert.strictEqual(grounded.includes("205"), false, "Must NOT contain room 205");
    });

    // Test 2: Photography Lab returns room 205 without borrowing the VFX Lab's floor.
    await test(2, "Photography Lab returns room 205 without borrowing VFX Lab's floor", () => {
        const query = "What is the room number of Photography Lab?";
        const target = extractQueryTarget(query);
        assert.strictEqual(target.targetEntity, "photography lab");

        const records = parseChunkRecords(multiRecordChunk);
        const photoRec = findBestMatchingRecord(records, target.targetEntity, target.entityTokens);
        assert.ok(photoRec, "Should find Photography Lab record");
        assert.strictEqual(photoRec.room, "205");
        assert.strictEqual(photoRec.floor, null, "Photography lab has no floor in record");

        const grounded = groundEntityResponse({
            question: query,
            targetEntity: target.targetEntity,
            bestRecord: photoRec,
            attributes: target.attributes
        });
        assert.ok(grounded.includes("205"), "Should state Room 205");
        assert.strictEqual(grounded.includes("206"), false, "Must NOT contain Room 206");
        assert.strictEqual(grounded.toLowerCase().includes("3rd floor"), false, "Must NOT borrow 3rd floor from VFX");
    });

    // Test 3: A building is included only when verified by an appropriate source.
    await test(3, "A building is included only when verified by an appropriate source", () => {
        // Case A: Building established in source
        const queryA = "Which building is the VFX lab in?";
        const targetA = extractQueryTarget(queryA);
        const recordsA = parseChunkRecords(multiRecordChunk);
        const vfxRec = findBestMatchingRecord(recordsA, targetA.targetEntity, targetA.entityTokens);
        const ansA = groundEntityResponse({
            question: queryA,
            targetEntity: targetA.targetEntity,
            bestRecord: vfxRec,
            attributes: targetA.attributes
        });
        assert.ok(ansA.includes("Building I"), "Should state Building I when verified");

        // Case B: Building NOT established in source
        const unverifiedChunk = {
            id: "chunk-unverified",
            content: "105 Advanced Robotics Lab",
            metadata: {
                originalName: "Equipment_List.txt",
                documentId: "doc-equip",
                pageNumber: 1
            }
        };
        const queryB = "Which building is the Advanced Robotics Lab in?";
        const targetB = extractQueryTarget(queryB);
        const recordsB = parseChunkRecords(unverifiedChunk);
        const robotRec = findBestMatchingRecord(recordsB, targetB.targetEntity, targetB.entityTokens);
        const ansB = groundEntityResponse({
            question: queryB,
            targetEntity: targetB.targetEntity,
            bestRecord: robotRec,
            attributes: targetB.attributes
        });
        assert.ok(ansB.toLowerCase().includes("not specified"), "Must state building is not specified when unverified");
        assert.strictEqual(ansB.includes("Building I"), false, "Must not hallucinate Building I");
    });

    // Test 4: Unrelated chunks cannot override an exact entity match.
    await test(4, "Unrelated chunks cannot override an exact entity match", async () => {
        const query = "Where is the VFX lab?";
        const chunks = [
            {
                id: "irrelevant-high-score",
                content: "General University Campus Overview and Administration policies across departments.",
                metadata: { originalName: "Handbook.pdf", heading: "General Overview" },
                score: 0.88
            },
            {
                id: "exact-vfx-chunk",
                content: "206 3D and VFX lab 3rd floor Building I",
                metadata: { originalName: "Building I.txt", heading: "Building I Labs" },
                score: 0.70
            }
        ];
        const reranked = await rerankChunks(query, chunks);
        assert.strictEqual(reranked[0].id, "exact-vfx-chunk", "Exact entity chunk must rank first");
    });

    // Test 5: Duplicate room numbers belonging to different departments are handled correctly.
    await test(5, "Duplicate room numbers belonging to different departments are handled correctly", () => {
        const psychologyChunk = {
            id: "c-psych",
            content: "101 HOD of Department of Psychology\n102 Faculty cabin",
            metadata: { originalName: "Building_A.txt", department: "Psychology" }
        };
        const commerceChunk = {
            id: "c-comm",
            content: "101 HOD of Department of Commerce\n102 Commerce Staff",
            metadata: { originalName: "Building_B.txt", department: "Commerce" }
        };

        const targetPsych = extractQueryTarget("Who is the HOD of Psychology?");
        const targetComm = extractQueryTarget("Who is the HOD of Commerce?");

        const allRecords = [
            ...parseChunkRecords(psychologyChunk),
            ...parseChunkRecords(commerceChunk)
        ];

        const bestPsych = findBestMatchingRecord(allRecords, targetPsych.targetEntity, targetPsych.entityTokens);
        assert.strictEqual(bestPsych.room, "101");
        assert.strictEqual(bestPsych.chunkId, "c-psych");

        const bestComm = findBestMatchingRecord(allRecords, targetComm.targetEntity, targetComm.entityTokens);
        assert.strictEqual(bestComm.room, "101");
        assert.strictEqual(bestComm.chunkId, "c-comm");
    });

    // Test 6: Missing or conflicting facts produce an honest uncertainty response.
    await test(6, "Missing or conflicting facts produce an honest uncertainty response", () => {
        const records = parseChunkRecords(multiRecordChunk);
        const target = extractQueryTarget("Where is the Astronomy Lab?");
        const match = findBestMatchingRecord(records, target.targetEntity, target.entityTokens);
        assert.strictEqual(match, null, "Should return null for non-existent entity");

        const response = groundEntityResponse({
            question: "Where is the Astronomy Lab?",
            targetEntity: target.targetEntity,
            bestRecord: match,
            attributes: target.attributes
        });
        assert.strictEqual(response, null);
    });

    // Test 7: Raw <think> markup and duplicate fallback messages never appear in the final response.
    await test(7, "Raw <think> markup and duplicate fallback messages never appear in final response", () => {
        // Case A: Model outputs closed thinking block
        const raw1 = "<think>\nThinking about the VFX lab room number...\n</think>\n\nThe 3D and VFX lab is in Room 206.";
        assert.strictEqual(stripQwenThinking(raw1), "The 3D and VFX lab is in Room 206.");

        // Case B: Model ran out of tokens before </think>
        const raw2 = "<think>\nLet me see where the photography lab is located, the user wants room 205";
        assert.strictEqual(stripQwenThinking(raw2), "", "Incomplete thinking block must not leak raw thoughts");

        // Case C: Orphaned closing tag from assistant prefill
        const raw3 = "</think>\n\nThe room number is 205.";
        assert.strictEqual(stripQwenThinking(raw3), "The room number is 205.");

        // Case D: Fallback message never contains think tag
        const clean = stripQwenThinking("<think>broken</think>I couldn't find matching information.");
        assert.strictEqual(clean.includes("<think>"), false);
        assert.strictEqual(clean.includes("</think>"), false);
    });

    // Test 8: Citations support the actual answer.
    await test(8, "Citations support the actual answer", () => {
        const citations = [
            {
                documentId: "doc-1",
                documentTitle: "Building I.txt",
                snippet: "205 Photography Lab",
                pageNumber: 1
            },
            {
                documentId: "doc-2",
                documentTitle: "Building I.txt",
                snippet: "206 3D and VFX lab 3rd floor",
                pageNumber: 1
            }
        ];

        const vfxAnswer = "The 3D and VFX lab is located in Room 206 on the 3rd floor.";
        const filteredVFX = filterSupportingCitations(citations, vfxAnswer, "Where is the VFX lab?");
        assert.strictEqual(filteredVFX.length, 1);
        assert.ok(filteredVFX[0].snippet.includes("206"), "Citation must support Room 206");

        const photoAnswer = "The room number for Photography Lab is 205.";
        const filteredPhoto = filterSupportingCitations(citations, photoAnswer, "What is the room number of Photography Lab?");
        assert.strictEqual(filteredPhoto.length, 1);
        assert.ok(filteredPhoto[0].snippet.includes("205"), "Citation must support Room 205");
    });

    // Test 9: General questions return no irrelevant citations.
    await test(9, "General questions return no irrelevant citations", () => {
        const citations = [
            {
                documentId: "doc-bca",
                documentTitle: "University Prospectus.pdf",
                snippet: "Department of Computer Science BCA admission guidelines",
                pageNumber: 12
            }
        ];
        const generalAnswer = "Bachelor of Computer Applications (BCA) is a 3-year undergraduate course covering software development, database management, and programming languages.";
        const filtered = filterSupportingCitations(citations, generalAnswer, "What is BCA?");
        assert.strictEqual(filtered.length, 0, "General question must return empty citations array");
    });

    // Test 10: Mixed questions include citations for supported university-specific facts.
    await test(10, "Mixed questions include citations for supported university-specific facts", () => {
        const citations = [
            {
                documentId: "doc-fee-table",
                documentTitle: "Course_Fees_2024.pdf",
                snippet: "BCA tuition fee structure: ₹45,000 per semester",
                pageNumber: 4
            },
            {
                documentId: "doc-unrelated",
                documentTitle: "Hostel_Rules.pdf",
                snippet: "Hostel curfew timing is 9:00 PM for all residents",
                pageNumber: 2
            }
        ];
        const mixedAnswer = "BCA is a 3-year undergraduate degree in computer applications. At your university, the BCA tuition fee is ₹45,000 per semester.";
        const filtered = filterSupportingCitations(citations, mixedAnswer, "What is BCA and what are its fees at my university?");
        assert.strictEqual(filtered.length, 1);
        assert.strictEqual(filtered[0].documentId, "doc-fee-table");
    });

    // Test 11: Follow-up questions resolve against the correct active conversation branch.
    await test(11, "Follow-up questions resolve against the correct active conversation branch", () => {
        // Step 1: User asks "Where is the VFX lab?" -> verified entity stored in branch context
        const branchContext = {
            lastVerifiedEntity: {
                entity: "3D and VFX lab",
                room: "206",
                floor: "3rd floor",
                building: "Building I"
            }
        };

        // Step 2: User asks follow-up "Which building?"
        const resolvedBuilding = resolveReferences("Which building?", branchContext);
        assert.ok(resolvedBuilding.toLowerCase().includes("vfx lab"), "Follow-up 'Which building?' must resolve with target entity");

        // Step 3: User asks follow-up "Which floor?"
        const resolvedFloor = resolveReferences("Which floor?", branchContext);
        assert.ok(resolvedFloor.toLowerCase().includes("vfx lab"), "Follow-up 'Which floor?' must resolve with target entity");

        // Step 4: Degree follow-up "What about MCA?"
        const feeContext = {
            currentTopic: "BCA",
            currentIntent: "fees",
            previousQuery: "What are BCA fees?"
        };
        const resolvedDegree = resolveReferences("What about MCA?", feeContext);
        assert.ok(resolvedDegree.toLowerCase().includes("mca"), "Must identify MCA");
        assert.ok(resolvedDegree.toLowerCase().includes("fee"), "Must carry forward fee intent");
    });

    // Test 12: A new chat cannot inherit another chat's entity context.
    await test(12, "A new chat cannot inherit another chat's entity context", () => {
        const freshContext = {
            currentTopic: null,
            currentEntity: null,
            lastVerifiedEntity: null
        };
        const resolved = resolveReferences("Which building?", freshContext);
        assert.strictEqual(resolved.toLowerCase().includes("vfx"), false, "Fresh chat must not inherit VFX lab context");
        assert.strictEqual(resolved.toLowerCase().includes("photography"), false, "Fresh chat must not inherit Photography Lab context");
    });

    // Test 13: Thousands of synthetic chunks do not cause unbounded retrieval or oversized prompts.
    await test(13, "Thousands of synthetic chunks do not cause unbounded retrieval or oversized prompts", async () => {
        const syntheticChunks = [];
        for (let i = 1; i <= 5000; i++) {
            syntheticChunks.push({
                id: `synth-chunk-${i}`,
                content: `Synthetic chunk ${i}: Room ${100 + (i % 800)} Lab ${i} details for administrative operations.`,
                metadata: {
                    documentId: `doc-${i % 50}`,
                    pageNumber: (i % 20) + 1,
                    originalName: `Document_${i % 50}.pdf`
                },
                score: 0.50 + ((i % 100) / 1000)
            });
        }

        // Add 1 exact match
        const exactTargetChunk = {
            id: "exact-target-chunk",
            content: "206 3D and VFX lab 3rd floor Building I",
            metadata: {
                documentId: "doc-target",
                pageNumber: 1,
                originalName: "Building I.txt"
            },
            score: 0.75
        };

        // Combine exact match into the 5,000 synthetic chunks
        const largeCandidatePool = [exactTargetChunk, ...syntheticChunks];

        // 1. Reranking should handle large candidate pool of 5,000+ chunks and place exact match at top
        const reranked = await rerankChunks("Where is the VFX lab?", largeCandidatePool);
        assert.strictEqual(reranked[0].id, "exact-target-chunk", "Exact entity match must rank #1 even among 5,000 chunks");

        // 2. Context builder should respect adaptive budget and never exceed 400 tokens for small factual
        const context = buildSmartContext(reranked.slice(0, 20), { question: "Where is the VFX lab?" });
        assert.ok(context.length > 0);
        assert.ok(context.length < 3000, "Context must remain tightly bounded for factual question");
    });

    // Test 14: General, university-specific, and mixed queries retain their correct routing after optimization.
    await test(14, "General, university-specific, and mixed queries retain their correct routing", () => {
        const qGeneral = classifyQuestionType("What is BCA?");
        assert.strictEqual(qGeneral, QUESTION_TYPES.GENERAL_KNOWLEDGE);

        const qUni = classifyQuestionType("Where is the VFX lab?");
        assert.strictEqual(qUni, QUESTION_TYPES.UNIVERSITY_SPECIFIC);

        const qMixed = classifyQuestionType("What is BCA and what are its fees at my university?");
        assert.strictEqual(qMixed, QUESTION_TYPES.HYBRID);
    });

    console.log("\n================================================================================");
    console.log(` Regression Suite Results: ${passed} Passed, ${failed} Failed`);
    console.log("================================================================================\n");

    if (failed > 0) {
        process.exit(1);
    }
}

if (require.main === module) {
    runRegressionSuite().catch(err => {
        console.error("Test execution failed:", err);
        process.exit(1);
    });
}

module.exports = { runRegressionSuite };
