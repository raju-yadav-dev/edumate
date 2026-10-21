const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const chatService = require("../ai/services/chatService");

const QUERIES = [
    {
        query: "What is BCA?",
        expectedRoute: "GENERAL_KNOWLEDGE",
        expectedCitations: false,
        validate: (ans) => /bachelor of computer applications/i.test(ans) && !/limited information/i.test(ans)
    },
    {
        query: "What is MCA?",
        expectedRoute: "GENERAL_KNOWLEDGE",
        expectedCitations: false,
        validate: (ans) => /master of computer applications/i.test(ans) && !/limited information/i.test(ans)
    },
    {
        query: "What is Java?",
        expectedRoute: "GENERAL_KNOWLEDGE",
        expectedCitations: false,
        validate: (ans) => /programming language/i.test(ans) && !/limited information/i.test(ans)
    },
    {
        query: "Give the room number of HOD of Cyber Security.",
        expectedRoute: "UNIVERSITY_SPECIFIC",
        expectedCitations: true,
        validate: (ans) => /109/i.test(ans) && !/couldn'?t find/i.test(ans)
    },
    {
        query: "What is BCA, and what are its fees at my university?",
        expectedRoute: "MIXED",
        expectedCitations: false,
        validate: (ans) => (ans.length > 30) && !/limited information/i.test(ans)
    }
];

const NUM_RUNS = 5;

async function runBenchmark() {
    console.log("================================================================================");
    console.log("         EDUMATE PERFORMANCE & RAG REGRESSION BENCHMARK (5 RUNS EACH)           ");
    console.log("================================================================================\n");

    if (!mongoose.connection.readyState) {
        await mongoose.connect(process.env.MONGODB_URI);
    }

    const testUser = {
        _id: new mongoose.Types.ObjectId(),
        fullName: "Performance Benchmark User",
        email: "benchmark@edumate.ai",
        role: "student",
        institution: "Brainware University",
        department: "Computational Sciences"
    };

    const overallResults = [];

    for (let qIdx = 0; qIdx < QUERIES.length; qIdx++) {
        const item = QUERIES[qIdx];
        console.log(`\n================================================================================`);
        console.log(`[QUERY ${qIdx + 1}/${QUERIES.length}] "${item.query}"`);
        console.log(`Expected Route: ${item.expectedRoute}`);
        console.log(`================================================================================`);

        const runStats = [];

        for (let run = 1; run <= NUM_RUNS; run++) {
            const isCold = run === 1;
            const startTime = Date.now();

            const res = await chatService.askQuestion({
                user: testUser,
                question: item.query,
                conversationId: new mongoose.Types.ObjectId().toString(),
                language: "en"
            });

            const latencyMs = Date.now() - startTime;
            const route = res.route || (res.sourceLabel?.includes("General") ? "GENERAL_KNOWLEDGE" : (res.sourceLabel?.includes("University") ? "UNIVERSITY_SPECIFIC" : "MIXED"));
            const citationsCount = (res.sources || []).length;
            const answer = String(res.message || res.answer || "").trim();
            const valid = item.validate(answer);

            runStats.push({
                run,
                type: isCold ? "COLD" : "WARM",
                latencyMs,
                route,
                citationsCount,
                provider: res.provider || "llama.cpp",
                valid,
                preview: answer.slice(0, 100).replace(/\n/g, " ") + "..."
            });

            console.log(`  Run ${run} (${isCold ? "COLD" : "WARM"}): ${latencyMs}ms | Route: ${route} | Citations: ${citationsCount} | Valid: ${valid ? "PASS" : "FAIL"}`);
        }

        const coldLatency = runStats[0].latencyMs;
        const warmLatencies = runStats.slice(1).map(r => r.latencyMs);
        const avgWarmLatency = Math.round(warmLatencies.reduce((a, b) => a + b, 0) / warmLatencies.length);
        const allValid = runStats.every(r => r.valid);

        overallResults.push({
            query: item.query,
            expectedRoute: item.expectedRoute,
            coldLatencyMs: coldLatency,
            avgWarmLatencyMs: avgWarmLatency,
            minWarmLatencyMs: Math.min(...warmLatencies),
            maxWarmLatencyMs: Math.max(...warmLatencies),
            citationsCount: runStats[0].citationsCount,
            passed: allValid,
            preview: runStats[0].preview
        });
    }

    console.log("\n================================================================================");
    console.log("                           FINAL BENCHMARK REPORT                               ");
    console.log("================================================================================");
    console.table(overallResults.map(r => ({
        Query: r.query.length > 35 ? r.query.slice(0, 32) + "..." : r.query,
        Route: r.expectedRoute,
        "Cold (ms)": r.coldLatencyMs,
        "Avg Warm (ms)": r.avgWarmLatencyMs,
        "Min Warm (ms)": r.minWarmLatencyMs,
        Citations: r.citationsCount,
        Status: r.passed ? "PASS" : "FAIL"
    })));

    const allPassed = overallResults.every(r => r.passed);
    console.log(`\nOverall Benchmark Result: ${allPassed ? "ALL 5 QUERIES PASSED ACROSS 5 RUNS" : "SOME RUNS FAILED"}`);

    await mongoose.disconnect();
    process.exit(allPassed ? 0 : 1);
}

runBenchmark().catch(err => {
    console.error("Benchmark error:", err);
    process.exit(1);
});
