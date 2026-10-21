/**
 * EduMate Repair — Part 2 Automated Regression Test Suite
 * 
 * Verifies all 5 required acceptance scenarios:
 * 1. Explicit entity switching (HOD-Cyber -> Photography Lab -> Linux Lab)
 * 2. Genuine follow-ups ("Which building?", "Which floor?", pronouns)
 * 3. Cache correctness (no cross-entity cache hits, dialogue-turn scoping, poisoned entry invalidation)
 * 4. Typographical errors and grounding (fuzzy matching, no cross-record attribution, honest uncertainty)
 * 5. Existing functionality (General Knowledge "What is BCA?", Mixed queries, Qwen3 <think> tag stripping)
 */

const assert = require("assert");
const { resolveReferences, hasExplicitEntity } = require("../ai/services/queryOptimizationService");
const { planQuery } = require("../ai/utils/queryPlanner");
const { analyzeQuery } = require("../ai/services/queryRewriterService");
const {
    extractQueryTarget,
    parseChunkRecords,
    findBestMatchingRecord,
    groundEntityResponse
} = require("../ai/services/entityGroundingService");
const cacheService = require("../services/cacheService");
const { stripQwenThinking } = require("../config/llm");
const citationService = require("../ai/services/citationService");
const responseValidator = require("../services/responseValidator");

let passed = 0;
let total = 0;

function runTest(name, fn) {
    total++;
    try {
        fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     Error: ${err.message}`);
        throw err;
    }
}

async function runAsyncTest(name, fn) {
    total++;
    try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     Error: ${err.message}`);
        throw err;
    }
}

async function runPart2TestSuite() {
    console.log("=================================================================");
    console.log(" 🧪 EduMate Repair — Part 2 Regression Test Suite");
    console.log("=================================================================\n");

    // =========================================================================
    // SCENARIO 1: Explicit Entity Switching
    // =========================================================================
    console.log("--- 1. Explicit Entity Switching Tests ---");

    runTest("Explicit question detects own entity via hasExplicitEntity", () => {
        assert.strictEqual(hasExplicitEntity("What is the room number of Photography Lab?"), true);
        assert.strictEqual(hasExplicitEntity("What is the room number of Linux lab?"), true);
        assert.strictEqual(hasExplicitEntity("Who is the HOD of Cyber Science?"), true);
        assert.strictEqual(hasExplicitEntity("Where is the VFX lab?"), true);
        assert.strictEqual(hasExplicitEntity("Which building?"), false);
        assert.strictEqual(hasExplicitEntity("Which floor?"), false);
        assert.strictEqual(hasExplicitEntity("What about its fees?"), false);
    });

    runTest("Switching from HOD-Cyber to Photography Lab preserves Photography Lab", () => {
        const context = {
            currentTopic: "Cyber Science",
            currentDepartment: "Cyber Science",
            mentionedDepartment: "Cyber Science",
            lastVerifiedEntity: {
                entity: "HOD-cyber",
                name: "HOD-cyber",
                room: "109",
                department: "Cyber Science"
            }
        };

        const resolved = resolveReferences("What is the room number of Photography Lab?", context);
        assert(!resolved.toLowerCase().includes("hod-cyber"), `Must not contain HOD-cyber, got: ${resolved}`);
        assert(resolved.toLowerCase().includes("photography"), `Must retain photography, got: ${resolved}`);
    });

    runTest("Switching from HOD-Cyber to Linux Lab preserves Linux Lab", () => {
        const context = {
            currentTopic: "Cyber Science",
            currentDepartment: "Cyber Science",
            mentionedDepartment: "Cyber Science",
            lastVerifiedEntity: {
                entity: "HOD-cyber",
                name: "HOD-cyber",
                room: "109",
                department: "Cyber Science"
            }
        };

        const resolved = resolveReferences("What is the room number of Linux lab?", context);
        assert(!resolved.toLowerCase().includes("hod-cyber"), `Must not contain HOD-cyber, got: ${resolved}`);
        assert(resolved.toLowerCase().includes("linux"), `Must retain linux, got: ${resolved}`);
    });

    runTest("QueryPlanner does not leak primaryDept when query has explicit entity", () => {
        const plan = planQuery("What is the room number of Photography Lab?", {
            conversationHistory: "User: Who is HOD of Cyber Science?\nAssistant: Room 109.",
            historyText: "Cyber Science HOD is in Room 109",
            activeTopic: "Cyber Science"
        });

        // The query is about Photography Lab, which has its own entity; primaryDept should NOT be Cyber Science
        assert.notStrictEqual(plan.department, "Cyber Science", `Department must not leak from history to explicit entity question`);
    });

    // =========================================================================
    // SCENARIO 2: Genuine Follow-ups
    // =========================================================================
    console.log("\n--- 2. Genuine Follow-up Resolution Tests ---");

    runTest("Elliptical follow-up: 'Where is the VFX lab?' followed by 'Which building?'", () => {
        const context = {
            lastVerifiedEntity: {
                entity: "VFX Lab",
                room: "302",
                building: "Main Academic Block"
            }
        };

        const resolved = resolveReferences("Which building?", context);
        assert(resolved.toLowerCase().includes("vfx lab"), `Must resolve to VFX Lab, got: ${resolved}`);
        assert(resolved.toLowerCase().includes("which building"), `Must ask which building, got: ${resolved}`);
    });

    runTest("Elliptical follow-up: 'What is the room number of Photography Lab?' followed by 'Which floor?'", () => {
        const context = {
            lastVerifiedEntity: {
                entity: "Photography Lab",
                room: "205",
                floor: "2nd Floor"
            }
        };

        const resolved = resolveReferences("Which floor?", context);
        assert(resolved.toLowerCase().includes("photography lab"), `Must resolve to Photography Lab, got: ${resolved}`);
        assert(resolved.toLowerCase().includes("which floor"), `Must ask which floor, got: ${resolved}`);
    });

    runTest("Pronoun follow-up: 'What about its fees?' resolves to topic when no explicit entity", () => {
        const context = {
            currentTopic: "BCA",
            currentIntent: "courses"
        };

        const resolved = resolveReferences("What about its fees?", context);
        assert(resolved.toLowerCase().includes("bca"), `Pronoun 'its' must resolve to BCA, got: ${resolved}`);
        assert(resolved.toLowerCase().includes("fee"), `Must include fee, got: ${resolved}`);
    });

    // =========================================================================
    // SCENARIO 3: Cache Correctness & Poisoning Prevention
    // =========================================================================
    console.log("\n--- 3. Cache Correctness & Poisoning Prevention Tests ---");

    await runAsyncTest("Cached HOD-Cyber response cannot be returned for Photography Lab", async () => {
        const hodQuery = "what is the room number of hod cyber";
        const photoQuery = "what is the room number of photography lab";

        // Store response for HOD-Cyber
        const hodResponse = {
            answer: "The room number for HOD-cyber is 109.",
            confidence: "high",
            sources: [{ title: "Faculty Directory.pdf", page: 1 }],
            metadata: { targetEntity: "HOD-cyber" }
        };
        await cacheService.set(hodQuery, hodResponse, ["directory"], "targeted", "standalone", "all", "all");

        // Query cache for photography lab with standalone key
        const photoHit = await cacheService.get(photoQuery, "targeted", "standalone", "all", "all");
        assert.strictEqual(photoHit, null, "Photography Lab must NOT hit HOD-Cyber cache entry");
    });

    await runAsyncTest("Separate conversations do not share elliptical follow-up answers", async () => {
        const followUpQuery = "which floor";
        const conv1ContextHash = "ctx_conv1001";
        const conv2ContextHash = "ctx_conv2002";

        const resp1 = {
            answer: "The VFX Lab is on the 3rd floor.",
            confidence: "high",
            metadata: { targetEntity: "VFX Lab", contextScope: "dialogue_turn" }
        };

        // Cache for Conv 1
        await cacheService.set(followUpQuery, resp1, ["campus"], "targeted", conv1ContextHash, "all", "all");

        // Lookup for Conv 2
        const conv2Hit = await cacheService.get(followUpQuery, "targeted", conv2ContextHash, "all", "all");
        assert.strictEqual(conv2Hit, null, "Conv 2 must NOT receive Conv 1's context-dependent answer");

        // Also verify shared nocontext lookup yields null
        const sharedHit = await cacheService.get(followUpQuery, "targeted", "standalone", "all", "all");
        assert.strictEqual(sharedHit, null, "Elliptical query must not exist in shared standalone cache");
    });

    await runAsyncTest("Poisoned cache entry is discarded and invalidated on cache hit", async () => {
        const testPoisonedQuery = "what is the room number of test synthetic lab";
        const poisonedPayload = {
            answer: "The room number for HOD-cyber is 109.",
            confidence: "high",
            metadata: { targetEntity: "HOD-cyber" }
        };

        // Artificially insert a poisoned entry
        await cacheService.set(testPoisonedQuery, poisonedPayload, ["campus"], "targeted", "standalone", "all", "all");

        // Simulate chatService cache hit validation logic
        let cached = await cacheService.get(testPoisonedQuery, "targeted", "standalone", "all", "all");
        assert(cached !== null, "Entry should exist initially in cache");

        const queryTarget = extractQueryTarget(testPoisonedQuery);
        const cachedAnswerLower = String(cached.answer || "").toLowerCase();
        const cachedTarget = String(cached.metadata?.targetEntity || "").toLowerCase();
        const tokenMatch = queryTarget.entityTokens.some(t =>
            cachedAnswerLower.includes(t) || (cachedTarget && cachedTarget.includes(t))
        );

        assert.strictEqual(tokenMatch, false, "Token match must fail for poisoned entry");

        // Invalidate on hit
        await cacheService.del(testPoisonedQuery, "targeted", "standalone", "all", "all");
        const afterDel = await cacheService.get(testPoisonedQuery, "targeted", "standalone", "all", "all");
        assert.strictEqual(afterDel, null, "Poisoned entry must be cleanly removed");
    });

    // =========================================================================
    // SCENARIO 4: Typographical Errors and Grounding
    // =========================================================================
    console.log("\n--- 4. Typographical Errors and Grounding Tests ---");

    const sampleMockChunks = [
        {
            id: "chunk_campus_map_p2",
            content: "2nd Floor:\nRoom 205: Photography Lab\nRoom 206: Sound Studio\nRoom 207: Editing Suite",
            metadata: {
                originalName: "Campus_Map.pdf",
                filename: "Campus_Map.pdf",
                pageNumber: 2,
                heading: "Floor Plan - 2nd Floor"
            }
        },
        {
            id: "chunk_campus_map_p1",
            content: "1st Floor:\nRoom 102: Linux Lab\nRoom 103: Programming Lab\nRoom 109: HOD-cyber",
            metadata: {
                originalName: "Campus_Map.pdf",
                filename: "Campus_Map.pdf",
                pageNumber: 1,
                heading: "Floor Plan - 1st Floor"
            }
        }
    ];

    runTest("Typo in query: 'What is the room nuber of phtogrhaphy lab?' correctly grounds to Room 205", () => {
        const query = "What is the room nuber of phtogrhaphy lab?";
        const queryTarget = extractQueryTarget(query);

        assert.strictEqual(queryTarget.attributes.asksRoom, true, "Should recognize room attribute despite typo");

        const allRecords = [];
        for (const chunk of sampleMockChunks) {
            allRecords.push(...parseChunkRecords(chunk));
        }

        const bestRecord = findBestMatchingRecord(allRecords, queryTarget.targetEntity, queryTarget.entityTokens);
        assert(bestRecord !== null, "Must find matching record for misspelled query");
        assert.strictEqual(bestRecord.room, "205", `Must ground to Room 205, got ${bestRecord?.room}`);
        assert(bestRecord.entity.toLowerCase().includes("photography"), `Record entity must be Photography Lab`);

        const grounded = groundEntityResponse({
            question: query,
            targetEntity: queryTarget.targetEntity,
            bestRecord,
            attributes: queryTarget.attributes
        });
        assert(grounded.includes("205"), `Answer must contain 205: ${grounded}`);
        assert(grounded.toLowerCase().includes("photography"), `Answer must mention Photography Lab: ${grounded}`);
        assert(!grounded.includes("102"), "Answer must NEVER contain Room 102");
        assert(!grounded.includes("109"), "Answer must NEVER contain Room 109");
    });

    runTest("Linux lab grounds to Room 102 and NEVER Room 205", () => {
        const query = "What is the room number of Linux lab?";
        const queryTarget = extractQueryTarget(query);

        const allRecords = [];
        for (const chunk of sampleMockChunks) {
            allRecords.push(...parseChunkRecords(chunk));
        }

        const bestRecord = findBestMatchingRecord(allRecords, queryTarget.targetEntity, queryTarget.entityTokens);
        assert(bestRecord !== null, "Must find matching record for Linux lab");
        assert.strictEqual(bestRecord.room, "102", `Linux Lab must be Room 102, got ${bestRecord?.room}`);
        assert.notStrictEqual(bestRecord.room, "205", "Linux Lab must NEVER be assigned Room 205");

        const grounded = groundEntityResponse({
            question: query,
            targetEntity: queryTarget.targetEntity,
            bestRecord,
            attributes: queryTarget.attributes
        });
        assert(grounded.includes("102"), `Answer must contain 102: ${grounded}`);
        assert(!grounded.includes("205"), "Answer must NEVER contain Room 205");
    });

    runTest("Unsupported attribute produces honest uncertainty instead of hallucinated facts", () => {
        const query = "Which building is the Photography Lab in?";
        const queryTarget = extractQueryTarget(query);

        const allRecords = [];
        for (const chunk of sampleMockChunks) {
            allRecords.push(...parseChunkRecords(chunk));
        }

        const bestRecord = findBestMatchingRecord(allRecords, queryTarget.targetEntity, queryTarget.entityTokens);
        assert(bestRecord !== null, "Record found");

        // The chunk does not contain building info
        const grounded = groundEntityResponse({
            question: query,
            targetEntity: queryTarget.targetEntity,
            bestRecord,
            attributes: queryTarget.attributes
        });

        assert(
            grounded.includes("not specified in the official documents") ||
            grounded.includes("not specified in the official university records"),
            `Must express honest uncertainty for unspecified building: ${grounded}`
        );
    });

    // =========================================================================
    // SCENARIO 5: Existing Functionality Intact
    // =========================================================================
    console.log("\n--- 5. Existing Functionality Tests ---");

    runTest("General-knowledge question 'What is BCA?' routes to GENERAL_KNOWLEDGE / LLM_ONLY", () => {
        const plan = planQuery("What is BCA?", {});
        assert(plan.skipRag === true, "Must skip RAG for general knowledge definition");
        assert(plan.route === "GENERAL_KNOWLEDGE" || plan.mode === "LLM_ONLY", `Route must be GENERAL_KNOWLEDGE / LLM_ONLY, got ${plan.route}/${plan.mode}`);
    });

    runTest("Mixed question 'What is BCA and what are its fees at my university?' routes to MIXED", () => {
        const plan = planQuery("What is BCA and what are its fees at my university?", {});
        assert.strictEqual(plan.skipRag, false, "Must NOT skip RAG for mixed query asking about university fees");
        assert(plan.isMixed === true || plan.route === "MIXED", `Must be detected as MIXED, got route=${plan.route}, isMixed=${plan.isMixed}`);
    });

    runTest("Qwen3 <think> reasoning tags are cleanly stripped", () => {
        const rawModelOutput = "<think>\nThinking about the user query...\nDetermining room number\n</think>\nThe room number for Photography Lab is 205.";
        const cleaned = stripQwenThinking(rawModelOutput);
        assert.strictEqual(cleaned, "The room number for Photography Lab is 205.");
        assert(!cleaned.includes("<think>"), "Must not contain <think>");
        assert(!cleaned.includes("Thinking about"), "Must not contain thinking tokens");
    });

    runTest("Citations maintain claim-support precision", () => {
        const sampleChunks = [
            {
                id: "c1",
                content: "Room 205 is the Photography Lab located on the second floor.",
                metadata: { originalName: "Campus_Map.pdf", pageNumber: 2 }
            },
            {
                id: "c2",
                content: "The cafeteria serves breakfast from 8 AM to 10 AM.",
                metadata: { originalName: "Hostel_Rules.pdf", pageNumber: 1 }
            }
        ];

        const citations = citationService.formatCitations(
            sampleChunks,
            [],
            [],
            "The room number for Photography Lab is 205.",
            "What is the room number of Photography Lab?"
        );

        assert(citations.length > 0, "Must generate citations for supported chunk");
        assert(citations.some(c => c.title === "Campus_Map.pdf"), "Must cite Campus_Map.pdf");
        assert(!citations.some(c => c.title === "Hostel_Rules.pdf"), "Must NOT cite unrelated Hostel_Rules.pdf");
    });

    console.log("\n=================================================================");
    console.log(` 🎉 ALL TESTS PASSED: ${passed}/${total} test assertions verified.`);
    console.log("=================================================================\n");
}

runPart2TestSuite()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("\n❌ Test suite execution failed:", err);
        process.exit(1);
    });
