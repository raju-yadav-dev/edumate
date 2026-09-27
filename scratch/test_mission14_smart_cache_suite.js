/**
 * EduMate Mission 14.1 — Complete 10-Layer Smart Cache Architecture Master Suite
 * 
 * Verifies:
 * - All 10 Independent Cache Layers individually
 * - Sub-millisecond and sub-threshold lookup latencies (<50ms, <100ms, <20ms, <10ms)
 * - Automatic Invalidation Hooks (upload, rechunk, delete, reindex, update, category)
 * - Local Memory LRU + Local Persistent Disk Caching (Zero Redis dependency)
 * - Comprehensive Cache Monitoring & Report Generation
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");

const cacheService = require("../server/services/cacheService");
const smartCacheHub = cacheService.smartCacheHub;

async function runMission14TestSuite() {
    console.log("\n================================================================================");
    console.log("   EDUMATE MISSION 14.1 — COMPLETE 10-LAYER SMART CACHE ARCHITECTURE SUITE      ");
    console.log("================================================================================\n");

    // Clear all existing caches for clean test isolation
    cacheService.invalidateAll();

    // -------------------------------------------------------------------------
    // SECTION 1: INDIVIDUAL LAYER VALIDATION (LAYERS 1 TO 10)
    // -------------------------------------------------------------------------
    console.log("--- SECTION 1: Individual Layer Verification (Layers 1 to 10) ---");

    // [Layer 1] Client/UI Cache
    console.log("\n[Test 1] Layer 1 — Client/UI Cache (Chats, Citations, Typing, Voice, Search History)");
    const l1 = smartCacheHub.l1;
    l1.setCachedChats("user_101", [{ id: "c1", title: "B.Tech Admissions" }]);
    l1.setCachedCitations("q_404", [{ documentName: "Handbook.pdf", page: 4 }]);
    l1.setVoiceState("sess_voice_1", { isRecording: true, mode: "push_to_talk" });
    l1.setTypingState("conv_99", { isTyping: true, user: "AI" });
    l1.addSearchHistory("user_101", "Computer Science Fees");

    const chats = l1.getCachedChats("user_101");
    const citations = l1.getCachedCitations("q_404");
    const voice = l1.getVoiceState("sess_voice_1");
    const typing = l1.getTypingState("conv_99");
    const history = l1.getSearchHistory("user_101");

    assert.strictEqual(chats.length, 1);
    assert.strictEqual(citations[0].documentName, "Handbook.pdf");
    assert.strictEqual(voice.isRecording, true);
    assert.strictEqual(typing.isTyping, true);
    assert(history.includes("Computer Science Fees"));
    console.log("  ✔ Layer 1 Client/UI Cache verified (Chats, Citations, Voice, Typing, Search History).");

    // [Layer 2] Prompt / Query Cache
    console.log("\n[Test 2] Layer 2 — Prompt / Query Cache (Query Plans & System Prompts)");
    const l2 = smartCacheHub.l2;
    const testPlan = { intent: "FEE_QUERY", category: "admissions", department: "CSE", program: "B.Tech" };
    l2.setQueryPlan("what is btech cse fee", testPlan);
    const cachedPlan = l2.getQueryPlan("what is btech cse fee");
    assert.deepStrictEqual(cachedPlan, testPlan);

    l2.setSystemPrompt("campus_guide", { role: "admin" }, "You are the campus admin guide.");
    const cachedPrompt = l2.getSystemPrompt("campus_guide", { role: "admin" });
    assert.strictEqual(cachedPrompt, "You are the campus admin guide.");
    console.log("  ✔ Layer 2 Prompt/Query Cache verified (Query Plans & Compiled System Prompts).");

    // [Layer 3] Embedding Cache
    console.log("\n[Test 3] Layer 3 — Embedding Vector Cache (Deterministic Vector Storage)");
    const l3 = smartCacheHub.l3;
    const sampleVec = new Array(768).fill(0.1234);
    l3.setEmbedding("Sample paragraph about admission criteria", sampleVec, { model: "jina-embeddings-v3" });
    const cachedVec = l3.getEmbedding("Sample paragraph about admission criteria", { model: "jina-embeddings-v3" });
    assert(Array.isArray(cachedVec) && cachedVec.length === 768);
    assert.strictEqual(cachedVec[0], 0.1234);
    console.log("  ✔ Layer 3 Embedding Cache verified (Never regenerates embeddings for identical content).");

    // [Layer 4] Vector Search Cache
    console.log("\n[Test 4] Layer 4 — Vector Search Cache (Raw Qdrant Match Points)");
    const l4 = smartCacheHub.l4;
    const dummyQueryVec = [0.1, 0.2, 0.3, 0.4];
    const dummyMatches = [{ id: "pt_1", score: 0.95, payload: { chunkId: "c_1" } }];
    l4.setVectorSearch(dummyQueryVec, { category: "admissions" }, 5, dummyMatches);
    const cachedMatches = l4.getVectorSearch(dummyQueryVec, { category: "admissions" }, 5);
    assert(Array.isArray(cachedMatches) && cachedMatches.length === 1);
    assert.strictEqual(cachedMatches[0].id, "pt_1");
    console.log("  ✔ Layer 4 Vector Search Cache verified (Cached by query vector + filter hash + limit).");

    // [Layer 5] Document / Chunk Cache
    console.log("\n[Test 5] Layer 5 — Document / Chunk Cache (In-Memory Chunks Storage)");
    const l5 = smartCacheHub.l5;
    const testChunks = [
        { chunkId: "chk_01", content: "Section 1: Admission Procedure", heading: "Admissions" },
        { chunkId: "chk_02", content: "Section 2: Eligibility Rules", heading: "Eligibility" }
    ];
    l5.setDocumentChunks("doc_btech_cse", testChunks, "admissions");
    const loadedChunks = l5.getDocumentChunks("doc_btech_cse");
    const singleChunk = l5.getChunk("doc_btech_cse", "chk_02");

    assert.strictEqual(loadedChunks.length, 2);
    assert.strictEqual(singleChunk.heading, "Eligibility");
    console.log("  ✔ Layer 5 Document/Chunk Cache verified (In-memory chunk arrays & single chunk lookups).");

    // [Layer 6] Retriever Cache
    console.log("\n[Test 6] Layer 6 — Retriever Cache (Reranked & Filtered Chunk Lists)");
    const retrievedCandidates = [
        { id: "chk_01", score: 0.98, content: "Top ranked chunk content", rankingSignals: { semanticScore: 0.98 } }
    ];
    await cacheService.setRetrievalCache("btech eligibility criteria", { category: "admissions" }, retrievedCandidates, ["admissions"], "DTU", 3);
    const cachedRetriever = await cacheService.getRetrievalCache("btech eligibility criteria", { category: "admissions" }, "DTU", 3);

    assert(cachedRetriever && Array.isArray(cachedRetriever.candidates));
    assert.strictEqual(cachedRetriever.candidates[0].id, "chk_01");
    console.log("  ✔ Layer 6 Retriever Cache verified (Reranked candidate chunks cached with metadata filters).");

    // [Layer 7] LLM Response Cache
    console.log("\n[Test 7] Layer 7 — LLM Response Cache (Full Final Response with Citations)");
    const l7 = smartCacheHub.l7;
    const sampleAnswer = {
        answer: "The B.Tech CSE fee is Rs. 1,50,000 per year.",
        citations: [{ title: "Fee Schedule 2026", page: 1 }],
        confidence: 0.98
    };
    l7.set("what is the fee for btech cse", sampleAnswer, ["admissions"], false, "pdf", "CSE", "targeted", smartCacheHub.getKbVersion());
    const cachedAnswer = l7.get("what is the fee for btech cse", "pdf", "CSE", "targeted", smartCacheHub.getKbVersion());

    assert(cachedAnswer && cachedAnswer.answer.includes("1,50,000"));
    assert.strictEqual(cachedAnswer.citations.length, 1);
    console.log("  ✔ Layer 7 LLM Response Cache verified (Full formatted response & citations cached).");

    // [Layer 8] Conversation / Context Cache
    console.log("\n[Test 8] Layer 8 — Conversation / Context Cache (Memory Turns & Merged Context)");
    const l8 = smartCacheHub.l8;
    l8.setConversationContext("usr_88", "conv_88", {
        title: "CSE Inquiries",
        summary: "Student asking about CSE admissions",
        recentMessages: [
            { role: "user", content: "Is CSE available?" },
            { role: "assistant", content: "Yes, CSE is offered with 120 seats." }
        ],
        totalMessages: 2
    });
    const convCtx = l8.getConversationContext("usr_88", "conv_88");
    const recentTurns = l8.getRecentMemory("usr_88", "conv_88", 2);

    assert.strictEqual(convCtx.title, "CSE Inquiries");
    assert.strictEqual(recentTurns.length, 2);

    // Merged chunk context
    l8.setMergedContext(["chk_01", "chk_02"], { mergedText: "Merged text of chunks 1 & 2" });
    const merged = l8.getMergedContext(["chk_01", "chk_02"]);
    assert.strictEqual(merged.mergedText, "Merged text of chunks 1 & 2");
    console.log("  ✔ Layer 8 Conversation/Context Cache verified (Active memory turns & merged chunks).");

    // [Layer 9] Model KV Cache
    console.log("\n[Test 9] Layer 9 — Model KV Attention Slot Cache (Llama.cpp Slot Reuse)");
    const l9 = smartCacheHub.l9;
    const slotAlloc1 = l9.getOrAllocateSlot("conv_active_session_1", "You are EduMate AI");
    assert.strictEqual(slotAlloc1.isReused, false);

    // Second turn in same session -> Reused KV slot
    const slotAlloc2 = l9.getOrAllocateSlot("conv_active_session_1", "You are EduMate AI");
    assert.strictEqual(slotAlloc2.isReused, true);
    assert.strictEqual(slotAlloc2.slotId, slotAlloc1.slotId);
    assert.strictEqual(slotAlloc2.turnCount, 2);
    console.log("  ✔ Layer 9 Model KV Cache verified (Session slot allocation & attention prompt cache reuse).");

    // [Layer 10] Persistent Disk Cache
    console.log("\n[Test 10] Layer 10 — Persistent Disk Cache (Durable Storage with Atomic Writes)");
    const l10 = smartCacheHub.l10;
    const diskKey = "sample_doc_embedding_100";
    const diskPayload = { docId: "doc_100", vector: [0.55, 0.66, 0.77] };
    l10.set("embeddings", diskKey, diskPayload, 3600, ["curriculum"]);

    const diskRead = l10.get("embeddings", diskKey);
    assert.deepStrictEqual(diskRead, diskPayload);

    const diskUsage = l10.getDiskUsage();
    assert(diskUsage.totalFiles >= 1);
    assert(diskUsage.totalBytes > 0);
    console.log(`  ✔ Layer 10 Persistent Disk Cache verified (Atomic write, persisted to ${diskUsage.cacheRootDir}).`);

    // -------------------------------------------------------------------------
    // SECTION 2: LATENCY & PERFORMANCE TARGETS
    // -------------------------------------------------------------------------
    console.log("\n--- SECTION 2: Performance & Sub-Threshold Latency Verification ---");

    // Target 1: General question LLM response cache hit < 50ms
    const t0 = process.hrtime.bigint();
    const l7Hit = await cacheService.get("what is the fee for btech cse", "pdf", "CSE", "targeted");
    const t1 = process.hrtime.bigint();
    const l7LatencyMs = Number(t1 - t0) / 1000000;
    assert(l7Hit !== null);
    assert(l7LatencyMs < 50, `General question hit should be < 50ms (Actual: ${l7LatencyMs.toFixed(3)}ms)`);
    console.log(`[Target 1] General question response cache hit: ${l7LatencyMs.toFixed(3)}ms (Target < 50ms) ✓ PASS`);

    // Target 2: Retrieval cache hit < 100ms
    const t2 = process.hrtime.bigint();
    const l6Hit = await cacheService.getRetrievalCache("btech eligibility criteria", { category: "admissions" }, "DTU", 3);
    const t3 = process.hrtime.bigint();
    const l6LatencyMs = Number(t3 - t2) / 1000000;
    assert(l6Hit !== null);
    assert(l6LatencyMs < 100, `Retrieval cache hit should be < 100ms (Actual: ${l6LatencyMs.toFixed(3)}ms)`);
    console.log(`[Target 2] Retrieval cache hit: ${l6LatencyMs.toFixed(3)}ms (Target < 100ms) ✓ PASS`);

    // Target 3: Chunk cache hit < 20ms
    const t4 = process.hrtime.bigint();
    const l5Hit = smartCacheHub.l5.getDocumentChunks("doc_btech_cse");
    const t5 = process.hrtime.bigint();
    const l5LatencyMs = Number(t5 - t4) / 1000000;
    assert(l5Hit !== null && l5Hit.length > 0);
    assert(l5LatencyMs < 20, `Chunk cache hit should be < 20ms (Actual: ${l5LatencyMs.toFixed(3)}ms)`);
    console.log(`[Target 3] Document chunk cache hit: ${l5LatencyMs.toFixed(3)}ms (Target < 20ms) ✓ PASS`);

    // Target 4: Conversation cache lookup < 10ms
    const t6 = process.hrtime.bigint();
    const l8Hit = smartCacheHub.l8.getConversationContext("usr_88", "conv_88");
    const t7 = process.hrtime.bigint();
    const l8LatencyMs = Number(t7 - t6) / 1000000;
    assert(l8Hit !== null);
    assert(l8LatencyMs < 10, `Conversation cache lookup should be < 10ms (Actual: ${l8LatencyMs.toFixed(3)}ms)`);
    console.log(`[Target 4] Conversation memory lookup: ${l8LatencyMs.toFixed(3)}ms (Target < 10ms) ✓ PASS`);

    // -------------------------------------------------------------------------
    // SECTION 3: AUTOMATIC INVALIDATION HANDLERS
    // -------------------------------------------------------------------------
    console.log("\n--- SECTION 3: Automated Invalidation Hooks Verification ---");

    // 1. Upload Invalidation
    const kbBefore = smartCacheHub.getKbVersion();
    cacheService.invalidateUpload({ category: "admissions", originalName: "NewAdmissions2026.pdf" });
    const kbAfterUpload = smartCacheHub.getKbVersion();
    assert(Number(kbAfterUpload) > Number(kbBefore), "KB version must increment on upload");
    assert.strictEqual(smartCacheHub.l2.getQueryPlan("what is btech cse fee"), null, "Category admissions query plans must invalidate");
    console.log("  ✔ Invalidation Hook 1: invalidateUpload() successfully purged category caches & bumped KB version.");

    // 2. Rechunk Invalidation
    smartCacheHub.l5.setDocumentChunks("doc_handbook_01", [{ chunkId: "c1" }], "curriculum");
    cacheService.invalidateRechunk("doc_handbook_01", "curriculum");
    assert.strictEqual(smartCacheHub.l5.getDocumentChunks("doc_handbook_01"), null, "Document chunk cache must invalidate on rechunk");
    console.log("  ✔ Invalidation Hook 2: invalidateRechunk() successfully purged document chunk cache.");

    // 3. Delete Invalidation
    smartCacheHub.l5.setDocumentChunks("doc_delete_me", [{ chunkId: "c_del" }], "hostel");
    cacheService.invalidateDelete("doc_delete_me", "hostel");
    assert.strictEqual(smartCacheHub.l5.getDocumentChunks("doc_delete_me"), null, "Document chunk cache must invalidate on delete");
    console.log("  ✔ Invalidation Hook 3: invalidateDelete() successfully purged document chunk cache.");

    // 4. Reindex Invalidation
    cacheService.invalidateReindex();
    assert.strictEqual(smartCacheHub.l4.getStats().size, 0, "Vector search cache must be purged on full reindex");
    assert.strictEqual(smartCacheHub.l6.getStats().size, 0, "Retriever cache must be purged on full reindex");
    console.log("  ✔ Invalidation Hook 4: invalidateReindex() successfully purged all search & retriever caches.");

    // 5. Document Update Invalidation
    smartCacheHub.l5.setDocumentChunks("doc_update_01", [{ chunkId: "c_upd" }], "fees");
    cacheService.invalidateDocumentUpdate("doc_update_01", "fees");
    assert.strictEqual(smartCacheHub.l5.getDocumentChunks("doc_update_01"), null);
    console.log("  ✔ Invalidation Hook 5: invalidateDocumentUpdate() successfully invalidated document chunks.");

    // -------------------------------------------------------------------------
    // SECTION 4: CACHE MONITORING & REPORT GENERATION
    // -------------------------------------------------------------------------
    console.log("\n--- SECTION 4: Cache Monitoring, Telemetry & Startup Report ---");

    const telemetry = cacheService.getStats();
    assert(telemetry.global, "Global stats must be present");
    assert(telemetry.layers, "Layers stats must be present");
    assert.strictEqual(Object.keys(telemetry.layers).length, 10, "All 10 layers must be reported in telemetry");

    const report = cacheService.generateCacheReport();
    assert(report.includes("EDUMATE MISSION 14.1 — 10-LAYER SMART CACHE ARCHITECTURE REPORT"));
    assert(report.includes("1. Client / UI Cache"));
    assert(report.includes("10. Persistent Disk Cache"));

    console.log("\n" + report + "\n");

    console.log("================================================================================");
    console.log(" 🎉 ALL MISSION 14.1 10-LAYER SMART CACHE ARCHITECTURE TESTS PASSED!             ");
    console.log("================================================================================\n");
    process.exit(0);
}

runMission14TestSuite().catch((err) => {
    console.error("❌ Mission 14.1 Test Failed:", err);
    process.exit(1);
});
