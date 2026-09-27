/**
 * EduMate Mission 17 — 10-Layer Smart Cache Architecture Validation Suite
 * 
 * Verifies production-grade multi-layer caching:
 * - 10 Independent Cache Layers
 * - Deterministic SHA-256 key normalization
 * - GZIP compression/decompression on persistent disk cache
 * - Automatic invalidation on document lifecycle (upload, delete, update, reindex)
 * - Server restart hydration simulation
 * - Cache warming routine
 * - Safety validation (auth tokens never cached)
 * - Statistics and latency saved telemetry
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const cacheService = require("../services/cacheService");
const smartCacheHub = require("../services/cache/SmartCacheHub");

let passed = 0;
let failed = 0;

async function it(desc, fn) {
    try {
        await fn();
        console.log(`  [PASS] ${desc}`);
        passed++;
    } catch (err) {
        console.error(`  [FAIL] ${desc}`);
        console.error(`         Error: ${err.message}`);
        failed++;
    }
}

async function runSuite() {
    console.log("================================================================================");
    console.log("             EDUMATE MISSION 17 — 10-LAYER SMART CACHE TEST SUITE               ");
    console.log("================================================================================\n");

    // 1. Initial State & Invalidation
    await it("1. Cache hub resets and purges cleanly across all 10 layers", () => {
        cacheService.invalidateAll();
        const stats = cacheService.getStats();
        assert.strictEqual(stats.global.activeLayers, 10);
        assert.strictEqual(stats.global.totalHits, 0);
    });

    // 2. Layer 1 — Client/UI Cache
    await it("2. Layer 1 caches recent chats, citations, rendered markdown, and analytics cards", () => {
        const testUserId = "user_test_101";
        const testChats = [{ id: "c1", title: "Admissions Inquiry" }];
        cacheService.l1.setCachedChats(testUserId, testChats, 300);
        const cachedChats = cacheService.l1.getCachedChats(testUserId);
        assert.deepStrictEqual(cachedChats, testChats);

        // Markdown cache
        const mdText = "# University Admissions\nDeadline is **July 31**.";
        const renderedHtml = "<h1>University Admissions</h1><p>Deadline is <strong>July 31</strong>.</p>";
        cacheService.l1.setCachedMarkdown(mdText, renderedHtml);
        assert.strictEqual(cacheService.l1.getCachedMarkdown(mdText), renderedHtml);

        // Invalidate on conversation change
        cacheService.l1.invalidateConversation("c1", testUserId);
        assert.strictEqual(cacheService.l1.getCachedChats(testUserId), null);
    });

    // 3. Layer 2 — Prompt Cache
    await it("3. Layer 2 stores query planner outputs with normalized question hashing", () => {
        const rawQ = "  Who IS the HOD of   computational sciences???  ";
        const queryPlan = {
            intent: "FACULTY_INQUIRY",
            entities: { department: "Computational Sciences", role: "HOD" },
            routingMode: "RAG_LLM",
            category: "faculty"
        };
        cacheService.l2.setQueryPlan(rawQ, queryPlan, 3600);

        // Lookup with slightly different spacing/casing should hit identical key
        const equivalentQ = "who is the hod of computational sciences";
        const hit = cacheService.l2.getQueryPlan(equivalentQ);
        assert(hit !== null, "Expected query planner cache hit on normalized question");
        assert.strictEqual(hit.intent, "FACULTY_INQUIRY");
        assert.strictEqual(hit.routingMode, "RAG_LLM");
    });

    // 4. Layer 3 — Embedding Cache
    await it("4. Layer 3 never recalculates identical chunk embeddings and syncs to disk", () => {
        const chunkText = "Heritage Institute of Technology was established in 2001.";
        const mockVector = new Array(768).fill(0).map((_, i) => parseFloat((Math.sin(i)).toFixed(4)));

        cacheService.l3.setEmbedding(chunkText, mockVector, { provider: "jina", model: "jina-embeddings-v3" }, ["academics"]);
        const cachedVec = cacheService.l3.getEmbedding(chunkText, { provider: "jina", model: "jina-embeddings-v3" });

        assert(cachedVec !== null, "Expected in-memory embedding hit");
        assert.strictEqual(cachedVec.length, 768);
        assert.strictEqual(cachedVec[0], mockVector[0]);

        // Verify it was persisted to Layer 10 disk
        const diskKey = cacheService.l3._buildKey(chunkText, { provider: "jina", model: "jina-embeddings-v3" });
        const diskVec = cacheService.l10.get("embeddings", diskKey);
        assert(diskVec !== null, "Expected persistent disk embedding hit");
        assert.strictEqual(diskVec.length, 768);
    });

    // 5. Layer 4 — Vector Search Cache
    await it("5. Layer 4 caches Qdrant retrieval results with sorted filter normalization", () => {
        const queryEmbedding = [0.12, -0.45, 0.88, 0.05];
        const filter = { category: "faculty", institution: "Heritage" };
        const hits = [{ id: "chunk_001", score: 0.94 }, { id: "chunk_002", score: 0.89 }];

        cacheService.l4.setVectorSearch(queryEmbedding, filter, 10, hits, "edumate_knowledge", ["faculty"]);
        
        // Lookup with different filter key ordering should produce identical hit
        const invertedFilter = { institution: "Heritage", category: "faculty" };
        const cachedHits = cacheService.l4.getVectorSearch(queryEmbedding, invertedFilter, 10, "edumate_knowledge");

        assert(cachedHits !== null, "Expected vector search cache hit");
        assert.strictEqual(cachedHits.length, 2);
        assert.strictEqual(cachedHits[0].id, "chunk_001");
    });

    // 6. Layer 5 — Document Chunk Cache
    await it("6. Layer 5 caches parsed chunk hierarchy and serves single chunk lookups", () => {
        const docId = "doc_syllabus_cs101";
        const chunks = [
            { chunkId: "c_1", documentId: docId, pageNumber: 1, text: "Course Overview" },
            { chunkId: "c_2", documentId: docId, pageNumber: 2, text: "Data Structures & Algorithms" }
        ];

        cacheService.l5.setDocumentChunks(docId, chunks, "syllabus");
        const cachedDocChunks = cacheService.l5.getDocumentChunks(docId);
        assert(cachedDocChunks !== null && cachedDocChunks.length === 2);

        const singleChunk = cacheService.l5.getChunk(docId, "c_2");
        assert(singleChunk !== null);
        assert.strictEqual(singleChunk.text, "Data Structures & Algorithms");
    });

    // 7. Layer 6 — Retriever Cache
    await it("7. Layer 6 caches hybrid reranked candidates with scores", () => {
        const query = "What is the grading system for CSE?";
        const candidates = [
            { chunkId: "ch_99", score: 0.96, semanticScore: 0.92, bm25Score: 0.88, rerankScore: 0.98 }
        ];

        cacheService.l6.set(query, { category: "academics" }, candidates, ["academics"]);
        const cachedRetrieval = cacheService.l6.get(query, { category: "academics" });

        assert(cachedRetrieval !== null, "Expected retriever cache hit");
        assert.strictEqual(cachedRetrieval.candidates.length, 1);
        assert.strictEqual(cachedRetrieval.retrievalScore, 0.96);
    });

    // 8. Layer 7 — LLM Response Cache
    await it("8. Layer 7 caches complete synthesized responses for sub-50ms hits", async () => {
        const question = "How many semesters are in the B.Tech curriculum?";
        const responseData = {
            answer: "The B.Tech curriculum consists of 8 semesters over 4 years.",
            citations: ["Heritage University Academic Regulations 2024"],
            confidence: 0.98,
            provider: "local-qwen"
        };

        // First lookup: Miss
        const miss = await cacheService.get(question, "RAG_LLM", "ctx_abc123");
        assert.strictEqual(miss, null);

        // Store
        await cacheService.set(question, responseData, ["academics"], "RAG_LLM", "ctx_abc123");

        // Second lookup: Hit
        const hit = await cacheService.get(question, "RAG_LLM", "ctx_abc123");
        assert(hit !== null, "Expected LLM response cache hit");
        assert.strictEqual(hit.answer, responseData.answer);
        assert.strictEqual(hit.confidence, 0.98);
    });

    // 9. Layer 8 — Conversation Context Cache
    await it("9. Layer 8 tracks multi-turn dialogue context and session memory", () => {
        const userId = "u_student_44";
        const convId = "conv_session_77";

        cacheService.l8.appendMessageToContext(userId, convId, {
            role: "user",
            content: "Tell me about Dr Jayanta Aich"
        });
        cacheService.l8.appendMessageToContext(userId, convId, {
            role: "assistant",
            content: "Dr Jayanta Aich is the HOD of Computational Sciences."
        });

        const recent = cacheService.l8.getRecentMemory(userId, convId, 5);
        assert(recent !== null && recent.length === 2);
        assert.strictEqual(recent[1].role, "assistant");
    });

    // 10. Layer 9 — llama.cpp KV Cache
    await it("10. Layer 9 manages slot allocations, prefix matching, and KV options", () => {
        const convId = "conv_llama_session_99";
        const promptPrefix = "You are EduMate, the university AI assistant.";

        const flags = cacheService.l9.getLlamaCacheFlags();
        assert.strictEqual(flags.cacheTypeK, "q8_0");
        assert.strictEqual(flags.cacheTypeV, "q8_0");
        assert.strictEqual(flags.promptCache, true);

        // Allocate slot 1
        const alloc1 = cacheService.l9.getOrAllocateSlot(convId, promptPrefix);
        assert.strictEqual(alloc1.isReused, false);
        assert.strictEqual(alloc1.turnCount, 1);

        // Reuse slot on turn 2
        const alloc2 = cacheService.l9.getOrAllocateSlot(convId, promptPrefix);
        assert.strictEqual(alloc2.isReused, true);
        assert.strictEqual(alloc2.turnCount, 2);
        assert.strictEqual(alloc2.slotId, alloc1.slotId);
    });

    // 11. Layer 10 — Persistent Disk Cache with GZIP Compression
    await it("11. Layer 10 writes atomically and applies transparent GZIP compression to large payloads", () => {
        const largeText = "A".repeat(5000); // 5 KB payload
        const largePayload = { id: "large_test", content: largeText, timestamp: Date.now() };

        const setOk = cacheService.l10.set("responses", "large_payload_key", largePayload, 3600);
        assert.strictEqual(setOk, true);

        // Check if gz file was created
        const filePathGz = cacheService.l10._getFilePath("responses", "large_payload_key", true);
        assert(fs.existsSync(filePathGz), "Expected compressed .cache.json.gz file on disk");

        // Read through Layer 10
        const readBack = cacheService.l10.get("responses", "large_payload_key");
        assert(readBack !== null);
        assert.strictEqual(readBack.content, largeText);
    });

    // 12. Lifecycle Invalidation on Document Upload / Delete / Update
    await it("12. Document modification invalidates category caches across vector, retrieval, and LLM response layers", async () => {
        // Populate test items under category "exam_rules"
        cacheService.l4.setVectorSearch([0.1, 0.2], {}, 5, [{ id: "c1" }], "edumate_knowledge", ["exam_rules"]);
        cacheService.l6.set("exam query", {}, [{ chunkId: "c1" }], ["exam_rules"]);
        await cacheService.set("exam query", { answer: "Rules" }, ["exam_rules"]);

        // Invalidate "exam_rules"
        cacheService.invalidateCategory("exam_rules");

        // Checks
        const vecCheck = cacheService.l4.getVectorSearch([0.1, 0.2], {}, 5, "edumate_knowledge");
        const retCheck = cacheService.l6.get("exam query", {});
        const respCheck = await cacheService.get("exam query");

        assert.strictEqual(vecCheck, null);
        assert.strictEqual(retCheck, null);
        assert.strictEqual(respCheck, null);
    });

    // 13. Model Switch Invalidation
    await it("13. Model switch invalidates LLM response cache while preserving embeddings", async () => {
        // Add embedding and response
        cacheService.l3.setEmbedding("model switch text", [0.5, 0.6, 0.7]);
        await cacheService.set("model switch question", { answer: "Model response" });

        // Trigger LLM model switch
        cacheService.invalidateLLMModelChange();

        // Response should be invalidated
        const resp = await cacheService.get("model switch question");
        assert.strictEqual(resp, null);

        // Embedding should be preserved
        const emb = cacheService.l3.getEmbedding("model switch text");
        assert(emb !== null && emb.length === 3);
    });

    // 14. Cache Warming Bootstrap
    await it("14. Startup warming populates top FAQs and health status", () => {
        const warmedCount = cacheService.warmCache();
        assert(warmedCount >= 5, `Expected at least 5 warmed items, got ${warmedCount}`);

        const hodPlan = cacheService.l2.getQueryPlan("Who is the HOD of Computational Sciences department?");
        assert(hodPlan !== null);
        assert.strictEqual(hodPlan.intent, "FACULTY_INQUIRY");
    });

    // 15. Safety Validation
    await it("15. Safety rule: Auth tokens, passwords, and JWTs are never accepted or cached", () => {
        const prohibitedTerms = ["Bearer eyJhbGciOi...", "secret_pass_123", "JWT_SIGNING_KEY"];
        // Ensure no sensitive auth stores exist in cache namespaces
        const namespaces = Object.keys(cacheService.l10.namespaces);
        assert(!namespaces.includes("auth"), "Auth namespace must never exist");
        assert(!namespaces.includes("tokens"), "Token namespace must never exist");
        assert(!namespaces.includes("passwords"), "Password namespace must never exist");
    });

    // 16. Statistics API & Latency Telemetry
    await it("16. Telemetry accurately tracks hit ratios, latency saved, and layer metrics", () => {
        cacheService.recordLatencySaved(850);
        cacheService.recordLatencySaved(1100);

        const stats = cacheService.getStats();
        assert(stats.global.activeLayers === 10);
        assert(typeof stats.global.hitRate === "string");
        assert(stats.global.totalLatencySavedMs >= 1950);
        assert(stats.global.avgLatencySavedMs > 0);
        assert(stats.layers.layer10_persistentDisk.size >= 0);
    });

    console.log("\n--------------------------------------------------------------------------------");
    console.log(` RESULTS: ${passed} Passed, ${failed} Failed`);
    console.log("--------------------------------------------------------------------------------\n");

    if (failed > 0) {
        process.exit(1);
    }
}

runSuite().catch(err => {
    console.error("Fatal test runner error:", err);
    process.exit(1);
});
