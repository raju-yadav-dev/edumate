const assert = require("assert");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), override: true });

async function runMission12MasterTestSuite() {
    console.log("================================================================================");
    console.log("    EDUMATE MISSION 12 (12.1 - 12.6) — MASTER ACCURACY & READINESS SUITE        ");
    console.log("================================================================================\n");

    let totalTests = 0;
    let passedTests = 0;

    let mongoose = null;
    try {
        mongoose = require("mongoose");
        if (process.env.MONGODB_URI) {
            await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 2500 });
        }
    } catch (_) {}

    const test = async (name, fn) => {
        totalTests++;
        process.stdout.write(`[TEST ${totalTests}] ${name}... `);
        try {
            await fn();
            passedTests++;
            console.log("✓ PASS");
        } catch (err) {
            console.log(`❌ FAIL\n  Error: ${err.message}`);
        }
    };

    // -------------------------------------------------------------
    // SECTION 1: Ground Truth Dataset (Mission 12.1)
    // -------------------------------------------------------------
    console.log("--- SECTION 1: Ground Truth Dataset (110+ Questions) ---");

    const { GROUND_TRUTH_DATASET, getDatasetByCategory, getAllCategories } = require("../server/ai/evaluation/groundTruthDataset");

    await test("Ground Truth Dataset contains at least 100 questions across 11 categories", () => {
        assert(GROUND_TRUTH_DATASET.length >= 100, `Dataset must have >= 100 questions (has ${GROUND_TRUTH_DATASET.length})`);
        const categories = getAllCategories();
        assert(categories.length >= 10, "Must have at least 10 categories");
        assert(categories.includes("Admissions"), "Must contain Admissions");
        assert(categories.includes("Fees"), "Must contain Fees");
        assert(categories.includes("Faculty"), "Must contain Faculty");
        assert(categories.includes("HOD"), "Must contain HOD");
        assert(categories.includes("Syllabus"), "Must contain Syllabus");
        assert(categories.includes("Hostel"), "Must contain Hostel");
        assert(categories.includes("Scholarships"), "Must contain Scholarships");
        assert(categories.includes("Negative Controls"), "Must contain Negative Controls");
    });

    await test("getDatasetByCategory filters dataset cleanly", () => {
        const feeQuestions = getDatasetByCategory("Fees");
        assert.strictEqual(feeQuestions.length, 10);
        assert(feeQuestions.every(q => q.category === "Fees"));

        const negQuestions = getDatasetByCategory("Negative Controls");
        assert.strictEqual(negQuestions.length, 10);
        assert(negQuestions.every(q => q.type === "unknown_fallback"));
    });

    // -------------------------------------------------------------
    // SECTION 2: AI Accuracy, Confidence & Hallucination Guard (Mission 12.2)
    // -------------------------------------------------------------
    console.log("\n--- SECTION 2: Multi-Factor Confidence & Hallucination Guard ---");

    const confidenceGuard = require("../server/ai/services/confidenceGuard");
    const { validateResponse } = require("../server/services/responseValidator");

    await test("confidenceGuard calculates multi-factor confidence (HIGH / MEDIUM / LOW)", () => {
        // High confidence scenario
        const highConf = confidenceGuard.calculateConfidence({
            question: "What is BCA fee?",
            retrievedChunks: [
                { score: 0.88, metadata: { department: "Computational Sciences", category: "Courses/UG_doc" } },
                { score: 0.82, metadata: { department: "Computational Sciences", category: "Courses/UG_doc" } }
            ],
            sources: [{ title: "BCA Course Details.pdf", page: 1 }]
        });
        assert.strictEqual(highConf.confidence, "HIGH");
        assert(highConf.score >= 0.75);

        // Low confidence scenario
        const lowConf = confidenceGuard.calculateConfidence({
            question: "Aerospace Mars campus",
            retrievedChunks: [],
            sources: []
        });
        assert.strictEqual(lowConf.confidence, "LOW");
        assert.strictEqual(lowConf.recommendedAction, "TRIGGER_FALLBACK");
    });

    await test("confidenceGuard removes duplicate facts across merged chunks", () => {
        const textWithDups = [
            "BCA duration is 3 years.",
            "Eligibility is 10+2 with mathematics.",
            "BCA duration is 3 years.", // Duplicate
            "Eligibility is 10+2 with mathematics." // Duplicate
        ].join("\n");

        const cleaned = confidenceGuard.stripDuplicateFacts(textWithDups);
        assert(!cleaned.includes("BCA duration is 3 years.\nEligibility is 10+2 with mathematics.\nBCA duration is 3 years."));
        assert.strictEqual(cleaned.split("\n").length, 2);
    });

    await test("confidenceGuard applies partial information warning on MEDIUM confidence", () => {
        const text = "BCA eligibility requires passing 10+2 with recognized board.";
        const warned = confidenceGuard.applyPartialInfoWarning(text, "MEDIUM");
        assert(warned.includes("Note: This response is synthesized from partially matching university records"));
    });

    await test("validateResponse enforces strict fallback on ungrounded questions", () => {
        const ungroundedRes = validateResponse({
            question: "Mars campus fee",
            retrievedContext: { chunks: [] },
            sources: [],
            questionType: "university_specific"
        });

        assert.strictEqual(ungroundedRes.valid, false);
        assert.strictEqual(ungroundedRes.confidence, "LOW");
        assert(ungroundedRes.groundedAnswer.includes("couldn't find matching information"));
    });

    // -------------------------------------------------------------
    // SECTION 3: Knowledge Analytics & CSV Export (Mission 12.4)
    // -------------------------------------------------------------
    console.log("\n--- SECTION 3: Knowledge Base & AI Analytics ---");

    const knowledgeAnalyticsService = require("../server/services/knowledgeAnalyticsService");

    await test("knowledgeAnalyticsService aggregates knowledge base stats and AI telemetry", async () => {
        const analytics = await knowledgeAnalyticsService.getCompleteAnalytics();
        assert(analytics.knowledgeBase, "Must contain knowledgeBase section");
        assert(analytics.aiPerformance, "Must contain aiPerformance section");
        assert(analytics.healthStatus, "Must contain healthStatus section");
        assert(Array.isArray(analytics.popularQueries), "Must contain popularQueries array");
    });

    await test("knowledgeAnalyticsService exports clean CSV report", async () => {
        const csv = await knowledgeAnalyticsService.exportCsvReport();
        assert(typeof csv === "string", "CSV must be string");
        assert(csv.includes("SECTION,METRIC,VALUE") || csv.includes('"SECTION","METRIC","VALUE"'));
        assert(csv.includes("Total Documents") || csv.includes('"Total Documents"'));
    });

    // -------------------------------------------------------------
    // SECTION 4: Production Deployment & Startup Automation (Mission 12.5)
    // -------------------------------------------------------------
    console.log("\n--- SECTION 4: Production Deployment, Environment & Loggers ---");

    const { validateEnvironment } = require("../server/config/envValidator");
    const loggerService = require("../server/services/loggerService");

    await test("validateEnvironment checks critical variables without crashing", () => {
        const envResult = validateEnvironment();
        assert(typeof envResult.valid === "boolean");
    });

    await test("loggerService writes to structured log files safely", () => {
        loggerService.logServer("info", "Test server startup verification", { test: true });
        loggerService.logRetrieval("info", "Test Qdrant retrieval lookup", { latencyMs: 45 });

        assert(fs.existsSync(loggerService.logStreams.server), "server.log should exist");
        assert(fs.existsSync(loggerService.logStreams.retrieval), "retrieval.log should exist");
    });

    // -------------------------------------------------------------
    // SECTION 5: Hackathon Demo Mode & Readiness Certificate (Mission 12.6)
    // -------------------------------------------------------------
    console.log("\n--- SECTION 5: Hackathon Demo Dataset & Readiness Certificate ---");

    const { DEMO_SHOWCASE_QUESTIONS } = require("../server/ai/evaluation/demoDataset");
    const hackathonChecklistService = require("../server/services/hackathonChecklistService");

    await test("DEMO_SHOWCASE_QUESTIONS contains 30 curated demo questions", () => {
        assert.strictEqual(DEMO_SHOWCASE_QUESTIONS.length, 30);
        assert(DEMO_SHOWCASE_QUESTIONS.some(q => q.group === "Admissions"));
        assert(DEMO_SHOWCASE_QUESTIONS.some(q => q.group === "Fees"));
        assert(DEMO_SHOWCASE_QUESTIONS.some(q => q.group === "CSS Department"));
        assert(DEMO_SHOWCASE_QUESTIONS.some(q => q.group === "Negative Control"));
    });

    await test("hackathonChecklistService generates readiness audit and Markdown certificate", async () => {
        const audit = await hackathonChecklistService.generateReadinessAudit();
        assert(audit.checklist.length === 8, "Must verify all 8 pillars");
        assert(audit.readinessScorePercent > 0, "Readiness score must be > 0");

        const cert = await hackathonChecklistService.generateMarkdownCertificate();
        assert(cert.includes("# 🏆 EduMate Hackathon Production Readiness Certificate"));
        assert(cert.includes("Active AI Model:"));
        assert(cert.includes("Production Checklist Verification"));
    });

    if (mongoose?.connection) {
        await mongoose.disconnect();
    }

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log("\n================================================================================");
    console.log(`    MISSION 12 MASTER TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log("================================================================================");

    if (passedTests === totalTests) {
        console.log("🎉 ALL MISSION 12 (12.1 - 12.6) REQUIREMENTS FULLY VERIFIED & HACKATHON READY!");
    } else {
        throw new Error(`${totalTests - passedTests} tests failed!`);
    }
}

runMission12MasterTestSuite().catch(err => {
    console.error("Test Suite Fatal Error:", err);
    process.exit(1);
});
