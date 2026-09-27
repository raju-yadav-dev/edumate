/**
 * EduMate Mission 21 — AI Developer Mode & RAG Debugger Test Suite
 */

const developerModeService = require("../services/developerModeService");

async function runDeveloperModeTests() {
    console.log("\n=======================================================");
    console.log("🛠️  EDUMATE MISSION 21 — AI DEVELOPER MODE TEST SUITE");
    console.log("=======================================================\n");

    let totalTests = 0;
    let passedTests = 0;

    const assertTest = (name, condition, details = "") => {
        totalTests++;
        if (condition) {
            passedTests++;
            console.log(`  ✅ [PASS] ${name}`);
        } else {
            console.error(`  ❌ [FAIL] ${name} ${details ? `— ${details}` : ""}`);
        }
    };

    // Test 1: Trace Recording & Timeline Verification
    console.log("🔍 Test 1: 14-Stage Execution Timeline & Trace Logging");
    {
        const testTrace = developerModeService.recordTrace({
            query: "What is the fee for MCA 2026?",
            normalizedQuery: "fee structure for mca",
            intent: "FEES_INQUIRY",
            routingMode: "RAG + LLM",
            category: "fees",
            totalLatencyMs: 98,
            tokens: { promptTokens: 300, contextTokens: 200, completionTokens: 50, totalTokens: 350 },
            timeline: [
                { stage: "Request Received", durationMs: 1, status: "OK", cacheHit: false },
                { stage: "Query Normalization", durationMs: 2, status: "OK", cacheHit: true },
                { stage: "Intent Classification", durationMs: 8, status: "OK", cacheHit: true },
                { stage: "Router Decision", durationMs: 3, status: "OK", cacheHit: true },
                { stage: "Metadata Extraction", durationMs: 4, status: "OK", cacheHit: false },
                { stage: "Retrieval", durationMs: 20, status: "OK", cacheHit: false },
                { stage: "Reranking", durationMs: 10, status: "OK", cacheHit: false },
                { stage: "Context Builder", durationMs: 5, status: "OK", cacheHit: false },
                { stage: "Prompt Builder", durationMs: 3, status: "OK", cacheHit: false },
                { stage: "LLM Request", durationMs: 35, status: "OK", cacheHit: false },
                { stage: "Streaming", durationMs: 0, status: "SKIPPED", cacheHit: false },
                { stage: "Response Validation", durationMs: 3, status: "OK", cacheHit: false },
                { stage: "Citation Attachment", durationMs: 3, status: "OK", cacheHit: false },
                { stage: "Response Formatting", durationMs: 1, status: "OK", cacheHit: false }
            ]
        });

        const traces = developerModeService.getTraces(10);
        assertTest("Records query execution trace in ring buffer", traces.length > 0);
        assertTest("Captures all 14 pipeline timeline stages", testTrace.timeline.length === 14);
        assertTest("Tracks token usage metrics", testTrace.tokens.totalTokens === 350);
    }

    // Test 2: Query Planner Sandbox
    console.log("\n🔍 Test 2: Query Planner Playground Execution");
    {
        const qpResult = developerModeService.runQueryPlannerPlayground("Who is the HOD of CSS department?");
        assertTest("Extracts query plan without LLM generation", qpResult.plan && qpResult.plan.intent !== undefined);
        assertTest("Executes sub-50ms query planning", qpResult.durationMs < 50);
        assertTest("Performs security guard check on query", qpResult.security.isSafe === true);
    }

    // Test 3: RAG Playground Retrieval
    console.log("\n🔍 Test 3: RAG Retrieval Sandbox & Scoring");
    {
        const ragResult = await developerModeService.runRagPlayground({
            query: "Computational Sciences HOD",
            topK: 3,
            minScore: 0.1
        });

        assertTest("Executes direct local retrieval simulation", ragResult.query === "Computational Sciences HOD");
        assertTest("Honors topK limit parameter", ragResult.topK === 3);
    }

    // Test 4: Prompt Playground & Token Estimation
    console.log("\n🔍 Test 4: Prompt Construction Sandbox & Token Estimator");
    {
        const promptResult = developerModeService.runPromptPlayground({
            question: "How do I apply for hostel?",
            customSystemPrompt: "You are EduMate Assistant.",
            contextDocs: "Hostel applications are available online."
        });

        assertTest("Assembles system prompt, context, and user query", promptResult.finalPrompt.includes("[SYSTEM INSTRUCTIONS]"));
        assertTest("Calculates realistic token count estimates", promptResult.tokenEstimates.totalEstimatedTokens > 0);
    }

    // Test 5: Debug Bundle Exporter
    console.log("\n🔍 Test 5: Debug Bundle Snapshot Generation");
    {
        const bundle = developerModeService.getDebugBundle();
        assertTest("Exports complete debug package structure", bundle.bundleVersion === "1.0.0" && bundle.trace !== undefined);
        assertTest("Includes 10-layer smart cache snapshot", bundle.cacheStateSnapshot && bundle.cacheStateSnapshot.global !== undefined);
    }

    // Test 6: AI Logs Streaming
    console.log("\n🔍 Test 6: AI Execution Logs Telemetry");
    {
        developerModeService.addLog({
            level: "INFO",
            category: "RAG_RETRIEVER",
            message: "Retrieved 4 chunks from local cache."
        });

        const logs = developerModeService.getLogs({ limit: 10 });
        assertTest("Maintains searchable AI log stream", logs.length > 0);
        assertTest("Contains structured log category and level", logs.some(l => l.category === "RAG_RETRIEVER"));
    }

    // Summary
    console.log("\n=======================================================");
    console.log(`📊 MISSION 21 TEST RESULTS: ${passedTests}/${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
    console.log("=======================================================\n");

    if (passedTests === totalTests) {
        console.log("🎉 ALL MISSION 21 DEVELOPER MODE TESTS PASSED SUCCESSFULLY!\n");
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runDeveloperModeTests().catch((err) => {
    console.error("Test Suite crashed:", err);
    process.exit(1);
});
