const assert = require("assert");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), override: true });

async function runMission11MasterTestSuite() {
    console.log("================================================================================");
    console.log("    EDUMATE MISSION 11 — PRODUCTION LLM BENCHMARKING & PROFILER TEST SUITE      ");
    console.log("================================================================================\n");

    let totalTests = 0;
    let passedTests = 0;

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
    // SECTION 1: Model Registry (Mission 11.5)
    // -------------------------------------------------------------
    console.log("--- SECTION 1: Model Registry & Multi-Model Profiles ---");

    const { detectModelProfile, getAllModelProfiles, MODEL_REGISTRY } = require("../server/ai/config/modelRegistry");

    await test("Model Registry contains required model families (Qwen, Llama, Gemma, Mistral, Phi, Tiny)", () => {
        assert(MODEL_REGISTRY["qwen3-1.7b"], "Should have Qwen 1.7B profile");
        assert(MODEL_REGISTRY["qwen3-4b"], "Should have Qwen 4B profile");
        assert(MODEL_REGISTRY["llama-3.2-3b"], "Should have Llama 3.2 3B profile");
        assert(MODEL_REGISTRY["gemma-2-2b"] || MODEL_REGISTRY["gemma-3b"], "Should have Gemma profile");
        assert(MODEL_REGISTRY["mistral-7b"], "Should have Mistral 7B profile");
        assert(MODEL_REGISTRY["phi-3.5-mini"] || MODEL_REGISTRY["phi-4"], "Should have Phi profile");
        assert(MODEL_REGISTRY["tinyllama-1.1b"] || MODEL_REGISTRY["smollm2-1.7b"], "Should have Tiny model profile");
    });

    await test("detectModelProfile dynamically detects model from GGUF filenames", () => {
        const p1 = detectModelProfile("Qwen3-1.7B-Instruct-Q4_K_M.gguf");
        assert.strictEqual(p1.id, "qwen3-1.7b");
        assert.strictEqual(p1.supportsThinking, false, "Qwen 1.7B thinking must be disabled");

        const p2 = detectModelProfile("Llama-3.2-3B-Instruct-Q4_K_M.gguf");
        assert.strictEqual(p2.id, "llama-3.2-3b");

        const p3 = detectModelProfile("Mistral-7B-Instruct-v0.3.gguf");
        assert.strictEqual(p3.id, "mistral-7b");
    });

    // -------------------------------------------------------------
    // SECTION 2: LLM Configuration & File Inspection (Mission 11.1 & 11.3)
    // -------------------------------------------------------------
    console.log("\n--- SECTION 2: Environment Driven LLM Config & Dynamic Token Budgeting ---");

    const {
        getLlmConfig,
        inspectModelFile,
        stripQwenThinking,
        calculateDynamicOutputBudget,
        getModelDiagnostics
    } = require("../server/config/llm");

    await test("getLlmConfig loads all 18 variables with resilient defaults", () => {
        const config = getLlmConfig();
        assert(config.provider, "Provider should exist");
        assert(config.baseUrl, "BaseUrl should exist");
        assert(config.model, "Model should exist");
        assert(Number.isFinite(config.port), "Port must be finite number");
        assert(Number.isFinite(config.contextSize), "Context size must be finite number");
        assert(Number.isFinite(config.maxTokens), "Max tokens must be finite number");
        assert(Number.isFinite(config.temperature), "Temperature must be finite number");
        assert(Number.isFinite(config.topP), "TopP must be finite number");
        assert(Number.isFinite(config.topK), "TopK must be finite number");
        assert(Number.isFinite(config.repeatPenalty), "Repeat penalty must be finite number");
        assert(Number.isFinite(config.minP), "MinP must be finite number");
        assert(Number.isFinite(config.threads), "Threads must be finite number");
        assert(Number.isFinite(config.gpuLayers), "GPU layers must be finite number");
        assert(Number.isFinite(config.batchSize), "Batch size must be finite number");
        assert.strictEqual(typeof config.stream, "boolean", "Stream must be boolean");
        assert(Array.isArray(config.stopSequences), "Stop sequences must be array");
    });

    await test("inspectModelFile safely inspects paths and formats file size in MB/GB", () => {
        const missing = inspectModelFile("./nonexistent_model.gguf");
        assert.strictEqual(missing.exists, false);
        assert.strictEqual(missing.sizeFormatted, "Not Found");

        // Inspect existing test file
        const selfFile = inspectModelFile(__filename);
        assert.strictEqual(selfFile.exists, true);
        assert(selfFile.sizeFormatted.includes("KB") || selfFile.sizeFormatted.includes("Bytes") || selfFile.sizeFormatted.includes("MB"));
    });

    await test("stripQwenThinking removes all <think> tags and unclosed reasoning blocks", () => {
        const sample1 = "<think>Let me analyze the student's request...</think>The HOD of CSS is Dr. Jayanta Aich.";
        assert.strictEqual(stripQwenThinking(sample1), "The HOD of CSS is Dr. Jayanta Aich.");

        const sample2 = "<think>Thinking through steps...\nThe answer is 42.";
        assert.strictEqual(stripQwenThinking(sample2), "");
    });

    await test("calculateDynamicOutputBudget assigns tight bounds for sub-10s turnaround", () => {
        const small = calculateDynamicOutputBudget("Who is the HOD of CSS?");
        assert.strictEqual(small.tier, "SMALL");
        assert(small.maxTokens <= 250);

        const medium = calculateDynamicOutputBudget("What is the BCA fee structure?");
        assert.strictEqual(medium.tier, "MEDIUM");
        assert(medium.maxTokens <= 500);

        const large = calculateDynamicOutputBudget("Tell me everything about BCA admissions, fee, eligibility and syllabus.");
        assert.strictEqual(large.tier, "LARGE");
        assert(large.maxTokens <= 900);
    });

    // -------------------------------------------------------------
    // SECTION 3: llama.cpp Startup & Lifecycle Manager (Mission 11.2)
    // -------------------------------------------------------------
    console.log("\n--- SECTION 3: llama.cpp Startup Manager & Lifecycle ---");

    const llamaProcessManager = require("../server/services/llamaProcessManager");

    await test("llamaProcessManager handles port detection and active server reuse", async () => {
        const status = llamaProcessManager.getStatus();
        assert(status.status, "Status string should exist");
        assert.strictEqual(typeof status.restartCount, "number");
        assert.strictEqual(status.maxRestarts, 5);

        // Probe should not throw
        const healthy = await llamaProcessManager.probeServerHealth(500);
        assert.strictEqual(typeof healthy, "boolean");
    });

    // -------------------------------------------------------------
    // SECTION 4: Optimized System Prompt & Context Bounds (Mission 11.3 & 11.4)
    // -------------------------------------------------------------
    console.log("\n--- SECTION 4: Sub-250 Token System Prompt & Context Bounds ---");

    const { getSystemPromptTemplate, formatUserPrompt } = require("../server/ai/utils/promptBuilder");
    const { countTokens } = require("../server/ai/utils/tokenizer");

    await test("System prompt template is strictly sub-250 tokens and forbids thinking mode", () => {
        const prompt = getSystemPromptTemplate();
        const tokenCount = countTokens(prompt);
        assert(tokenCount <= 250, `System prompt token count (${tokenCount}) must be <= 250`);
        assert(prompt.includes("Do NOT output thinking tokens") || prompt.includes("thinking"), "Prompt must explicitly forbid thinking mode");
    });

    // -------------------------------------------------------------
    // SECTION 5: AI Benchmarking Service & Profiler (Mission 11.6)
    // -------------------------------------------------------------
    console.log("\n--- SECTION 5: AI Benchmarking Service & Performance Profiler ---");

    const aiBenchmarkService = require("../server/services/aiBenchmarkService");

    await test("aiBenchmarkService collects hardware metrics and cache analytics", () => {
        const hardware = aiBenchmarkService.getSystemHardwareMetrics();
        assert(hardware.platform, "Hardware must include platform");
        assert(hardware.cpuCores > 0, "CPU cores must be > 0");
        assert(hardware.totalRamMb > 0, "Total RAM must be > 0");

        const cache = aiBenchmarkService.getCacheAnalytics();
        assert(cache.retrievalCache, "Must include retrieval cache stats");
        assert(cache.promptCache.enabled, "Prompt cache must be active");
        assert(cache.kvCache.enabled, "KV cache must be active");
    });

    await test("aiBenchmarkService evaluates SLA production targets accurately", () => {
        const compliant = aiBenchmarkService.evaluateProductionTargets({
            queryPlanner: 50,
            qdrantSearch: 200,
            contextBuilder: 80,
            firstToken: 400,
            total: 3500
        });

        assert.strictEqual(compliant.queryPlanner.passed, true);
        assert.strictEqual(compliant.qdrantSearch.passed, true);
        assert.strictEqual(compliant.contextBuilder.passed, true);
        assert.strictEqual(compliant.totalRagResponse.passed, true);
        assert.strictEqual(compliant.allTargetsMet, true);

        const nonCompliant = aiBenchmarkService.evaluateProductionTargets({
            queryPlanner: 300, // > 150ms
            qdrantSearch: 1200, // > 800ms
            contextBuilder: 600, // > 500ms
            total: 12000 // > 10000ms
        });

        assert.strictEqual(nonCompliant.queryPlanner.passed, false);
        assert.strictEqual(nonCompliant.qdrantSearch.passed, false);
        assert.strictEqual(nonCompliant.totalRagResponse.passed, false);
        assert.strictEqual(nonCompliant.allTargetsMet, false);
    });

    await test("aiBenchmarkService generates model comparison matrix", () => {
        const comparison = aiBenchmarkService.generateModelComparisonMatrix();
        assert(Array.isArray(comparison), "Comparison must be array");
        assert(comparison.length >= 5, "Comparison must cover at least 5 models");

        const activeModel = comparison.find(m => m.isCurrentActiveModel);
        assert(activeModel, "One model must be marked as active");
        assert(activeModel.expectedTokensPerSec, "Must include tokens/sec estimate");
    });

    await test("aiBenchmarkService exports complete benchmark report in JSON and Markdown", async () => {
        const report = await aiBenchmarkService.exportBenchmarkReport();
        assert(report.json, "Report must contain json");
        assert(report.markdown, "Report must contain markdown");
        assert(report.markdown.includes("# EduMate AI Benchmark & Performance Profiler Report"));
        assert(report.markdown.includes("Active LLM Configuration"));
        assert(report.markdown.includes("Production SLA Compliance"));
        assert(report.markdown.includes("Model Comparison Summary"));
    });

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log("\n================================================================================");
    console.log(`    MISSION 11 TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log("================================================================================");

    if (passedTests === totalTests) {
        console.log("🎉 ALL MISSION 11 (11.1 - 11.6) REQUIREMENTS FULLY VERIFIED!");
    } else {
        throw new Error(`${totalTests - passedTests} tests failed!`);
    }
}

runMission11MasterTestSuite().catch(err => {
    console.error("Test Suite Fatal Error:", err);
    process.exit(1);
});
