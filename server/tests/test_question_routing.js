const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const chatService = require("../ai/services/chatService");
const { planQuery } = require("../ai/utils/queryPlanner");

const TEST_CASES = [
    {
        query: "What is BCA?",
        expectedRoute: "GENERAL_KNOWLEDGE",
        expectedSkipRag: true,
        expectedIsMixed: false
    },
    {
        query: "What is MCA?",
        expectedRoute: "GENERAL_KNOWLEDGE",
        expectedSkipRag: true,
        expectedIsMixed: false
    },
    {
        query: "What is Java?",
        expectedRoute: "GENERAL_KNOWLEDGE",
        expectedSkipRag: true,
        expectedIsMixed: false
    },
    {
        query: "Who is the HOD of Cyber Security?",
        expectedRoute: "UNIVERSITY_SPECIFIC",
        expectedSkipRag: false,
        expectedIsMixed: false
    },
    {
        query: "What is BCA, and what are its fees at my university?",
        expectedRoute: "MIXED",
        expectedSkipRag: false,
        expectedIsMixed: true
    }
];

async function runRegressionSuite() {
    console.log("================================================================================");
    console.log("             EDUMATE QUESTION ROUTING REGRESSION TEST SUITE                      ");
    console.log("================================================================================\n");

    if (!mongoose.connection.readyState) {
        await mongoose.connect(process.env.MONGODB_URI);
    }

    const testUser = {
        _id: new mongoose.Types.ObjectId(),
        fullName: "Engineering Test Student",
        email: "test.student@edumate.ai",
        role: "student",
        institution: "Brainware University",
        department: "Computational Sciences"
    };

    const results = [];

    for (let i = 0; i < TEST_CASES.length; i++) {
        const tc = TEST_CASES[i];
        console.log(`\n--------------------------------------------------------------------------------`);
        console.log(`[TEST ${i + 1}/${TEST_CASES.length}] Query: "${tc.query}"`);
        console.log(`--------------------------------------------------------------------------------`);

        // 1. Planner routing check
        const plan = planQuery(tc.query, { user: testUser });
        console.log(`[Query Plan] Route: ${plan.route} | Mode: ${plan.mode} | SkipRag: ${plan.skipRag} | isMixed: ${plan.isMixed}`);

        // 2. End-to-end Chat pipeline execution
        const startTime = Date.now();
        let stagesSkipped = [];
        if (plan.skipRag) {
            stagesSkipped.push("Qdrant Search", "Embedding Generation", "Context Reranking", "Document Citations");
        }

        const response = await chatService.askQuestion({
            user: testUser,
            question: tc.query,
            language: "en"
        });
        const durationMs = Date.now() - startTime;

        const routeCorrect = plan.route === tc.expectedRoute;
        const skipRagCorrect = plan.skipRag === tc.expectedSkipRag;
        const mixedCorrect = plan.isMixed === tc.expectedIsMixed;
        const hasWarning = (response.message || "").includes("available university documents contain limited information");
        const hasUnexpectedCitations = plan.skipRag && response.sources && response.sources.length > 0;
        const answerCorrect = !hasWarning && !hasUnexpectedCitations && (response.message || "").length > 20;

        const passed = routeCorrect && skipRagCorrect && mixedCorrect && answerCorrect;

        results.push({
            query: tc.query,
            expectedRoute: tc.expectedRoute,
            selectedRoute: plan.route,
            mode: plan.mode,
            skipRag: plan.skipRag,
            isMixed: plan.isMixed,
            stagesSkipped: stagesSkipped.length > 0 ? stagesSkipped.join(", ") : "None (Full RAG executed)",
            latencyMs: durationMs,
            sourcesCount: response.sources ? response.sources.length : 0,
            hasWarning,
            passed,
            preview: (response.message || "").slice(0, 150).replace(/\n/g, " ") + "..."
        });

        console.log(`[Latency] ${durationMs}ms`);
        console.log(`[Stages Skipped] ${stagesSkipped.length > 0 ? stagesSkipped.join(", ") : "None"}`);
        console.log(`[Sources Count] ${response.sources ? response.sources.length : 0}`);
        console.log(`[Warning Attached] ${hasWarning ? "YES (FAIL)" : "NO (CLEAN)"}`);
        console.log(`[Answer Preview] ${results[results.length - 1].preview}`);
        console.log(`[Result] ${passed ? "✅ PASS" : "❌ FAIL"}`);
    }

    console.log("\n================================================================================");
    console.log("                           SUMMARY REPORT                                       ");
    console.log("================================================================================");
    console.table(results.map(r => ({
        Query: r.query,
        Route: r.selectedRoute,
        SkipRag: r.skipRag,
        isMixed: r.isMixed,
        Latency: `${r.latencyMs}ms`,
        Citations: r.sourcesCount,
        Pass: r.passed ? "PASS" : "FAIL"
    })));

    const allPassed = results.every(r => r.passed);
    console.log(`\nOverall Status: ${allPassed ? "✅ ALL 5 REGRESSION TESTS PASSED" : "❌ SOME TESTS FAILED"}\n`);

    await mongoose.disconnect();
    return { allPassed, results };
}

if (require.main === module) {
    runRegressionSuite()
        .then(({ allPassed }) => {
            process.exit(allPassed ? 0 : 1);
        })
        .catch(err => {
            console.error("Test Suite Execution Failed:", err);
            process.exit(1);
        });
}

module.exports = { runRegressionSuite };
