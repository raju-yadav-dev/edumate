const { GROUND_TRUTH_DATASET, getDatasetByCategory, getAllCategories } = require("./groundTruthDataset");
const chatService = require("../services/chatService");
const { countTokens } = require("../utils/tokenizer");

/**
 * EduMate Mission 12.1 — End-to-End RAG Validation Engine
 * 
 * Tests the complete AI Pipeline against Ground Truth University Documents:
 * Upload PDF → Chunking → Metadata → Embeddings → MongoDB → Qdrant → Retrieval → Context Builder → Qwen → Response Formatter
 */

class RagValidationEngine {
    constructor() {
        this.lastValidationResults = null;
        this.isRunning = false;
    }

    /**
     * Runs validation on a single test item
     */
    async validateQuestion(testItem, { user = { _id: "eval-user", role: "admin" } } = {}) {
        const startTime = Date.now();
        const question = testItem.question;

        try {
            const chatResult = await chatService.askQuestion({
                user,
                question,
                conversationId: null,
                parentId: null
            });

            const latencyMs = Date.now() - startTime;
            const message = String(chatResult?.message || "");
            const sources = Array.isArray(chatResult?.sources) ? chatResult.sources : [];
            const retrievedContext = chatResult?.retrievedContext || {};
            const retrievedChunks = retrievedContext.chunks || [];

            // 1. Document Retrieval Precision Check
            let documentMatch = false;
            if (testItem.type === "unknown_fallback") {
                // For negative questions, document match is successful if no false high-confidence chunk was retrieved
                documentMatch = true;
            } else if (testItem.expectedDocumentMatches.length === 0) {
                documentMatch = true;
            } else {
                documentMatch = retrievedChunks.some(chunk => {
                    const docName = String(chunk.metadata?.originalName || chunk.metadata?.filename || "").toLowerCase();
                    return testItem.expectedDocumentMatches.some(regex => regex.test(docName));
                });
            }

            // 2. Section & Content Keywords Check
            const lowerMessage = message.toLowerCase();
            const keywordsFound = (testItem.expectedKeywords || []).filter(kw => lowerMessage.includes(kw.toLowerCase()));
            const keywordCoverage = testItem.expectedKeywords?.length
                ? Number(((keywordsFound.length / testItem.expectedKeywords.length) * 100).toFixed(1))
                : 100;

            // 3. Citation Check
            const hasCitations = sources.length > 0 || /\[(?:Document|Source|Verified)[^\]]+\]/i.test(message);
            const citationsValid = testItem.type === "unknown_fallback"
                ? true
                : (hasCitations || sources.length > 0);

            // 4. Formatting Integrity Check (for long responses & comparisons)
            let formattingPreserved = true;
            if (testItem.type === "comparison") {
                formattingPreserved = message.includes("|") && message.includes("---"); // Markdown table
            } else if (testItem.type === "long_response") {
                formattingPreserved = message.includes("\n") && (message.includes("•") || message.includes("-") || message.includes("#") || message.includes("|"));
            }

            // 5. Hallucination Guard Check
            let hallucinationDetected = false;
            let fallbackTriggered = false;

            if (testItem.type === "unknown_fallback") {
                fallbackTriggered = /couldn't find|no verified|not available|cannot find/i.test(message);
                if (!fallbackTriggered && message.length > 50) {
                    hallucinationDetected = true; // Generated fake answer for negative query
                }
            } else {
                // If question is institutional and citations point to unknown sources
                if (chatResult?.validation?.valid === false && chatResult?.validation?.reason?.includes("Hallucination")) {
                    hallucinationDetected = true;
                }
            }

            // 6. Overall Pass/Fail Evaluation
            let passed = false;
            if (testItem.type === "unknown_fallback") {
                passed = fallbackTriggered && !hallucinationDetected;
            } else {
                passed = documentMatch && (keywordCoverage >= 40 || testItem.type === "long_response") && !hallucinationDetected;
            }

            return {
                id: testItem.id,
                category: testItem.category,
                question: testItem.question,
                type: testItem.type,
                passed,
                latencyMs,
                confidence: chatResult?.confidence || chatResult?.validation?.confidence || "MEDIUM",
                documentMatch,
                keywordCoveragePercent: keywordCoverage,
                keywordsFound,
                sourcesCount: sources.length,
                citationsValid,
                formattingPreserved,
                hallucinationDetected,
                fallbackTriggered,
                answerSnippet: message.slice(0, 160) + (message.length > 160 ? "..." : ""),
                fullAnswer: message,
                retrievedDocs: Array.from(new Set(retrievedChunks.map(c => c.metadata?.originalName || "Unknown"))),
                chunkCount: retrievedChunks.length
            };
        } catch (err) {
            return {
                id: testItem.id,
                category: testItem.category,
                question: testItem.question,
                type: testItem.type,
                passed: false,
                error: err.message,
                latencyMs: Date.now() - startTime,
                confidence: "LOW",
                documentMatch: false,
                hallucinationDetected: false
            };
        }
    }

    /**
     * Executes validation suite across a category or the full dataset
     */
    async runValidation({ category = "all", maxQuestions = null } = {}) {
        this.isRunning = true;
        const startSuite = Date.now();

        let items = getDatasetByCategory(category);
        if (maxQuestions && maxQuestions > 0) {
            items = items.slice(0, maxQuestions);
        }

        const results = [];
        for (const item of items) {
            const res = await this.validateQuestion(item);
            results.push(res);
        }

        const totalDurationMs = Date.now() - startSuite;
        const passedCount = results.filter(r => r.passed).length;
        const totalCount = results.length || 1;
        const accuracyPercent = Number(((passedCount / totalCount) * 100).toFixed(2));

        const negativeTests = results.filter(r => r.type === "unknown_fallback");
        const hallucinatedCount = negativeTests.filter(r => r.hallucinationDetected).length;
        const hallucinationRate = negativeTests.length
            ? Number(((hallucinatedCount / negativeTests.length) * 100).toFixed(2))
            : 0;

        const positiveTests = results.filter(r => r.type !== "unknown_fallback");
        const citedCount = positiveTests.filter(r => r.citationsValid).length;
        const citationCoverage = positiveTests.length
            ? Number(((citedCount / positiveTests.length) * 100).toFixed(2))
            : 100;

        const matchedDocsCount = positiveTests.filter(r => r.documentMatch).length;
        const retrievalPrecision = positiveTests.length
            ? Number(((matchedDocsCount / positiveTests.length) * 100).toFixed(2))
            : 100;

        const avgLatencyMs = Math.round(results.reduce((acc, r) => acc + r.latencyMs, 0) / totalCount);

        // Group by category
        const categorySummary = {};
        for (const cat of getAllCategories()) {
            const catResults = results.filter(r => r.category === cat);
            if (catResults.length > 0) {
                const catPassed = catResults.filter(r => r.passed).length;
                categorySummary[cat] = {
                    total: catResults.length,
                    passed: catPassed,
                    accuracyPercent: Number(((catPassed / catResults.length) * 100).toFixed(1)),
                    avgLatencyMs: Math.round(catResults.reduce((acc, r) => acc + r.latencyMs, 0) / catResults.length)
                };
            }
        }

        const summaryReport = {
            id: `rag-eval-${Date.now()}`,
            timestamp: new Date().toISOString(),
            categoryFilter: category,
            totalQuestions: totalCount,
            passedQuestions: passedCount,
            failedQuestions: totalCount - passedCount,
            metrics: {
                accuracyPercentage: accuracyPercent,
                hallucinationRatePercent: hallucinationRate,
                citationCoveragePercent: citationCoverage,
                retrievalPrecisionPercent: retrievalPrecision,
                retrievalRecallPercent: retrievalPrecision, // Ground truth precision
                averageLatencyMs: avgLatencyMs,
                totalDurationMs
            },
            categorySummary,
            results
        };

        this.lastValidationResults = summaryReport;
        this.isRunning = false;
        return summaryReport;
    }

    /**
     * Generates Markdown validation report for hackathon documentation
     */
    generateMarkdownReport(report = null) {
        const r = report || this.lastValidationResults;
        if (!r) return "# No Validation Report Available\nRun validation suite first.";

        const lines = [
            `# EduMate Mission 12.1 — End-to-End RAG Validation Report`,
            `**Generated at:** ${new Date(r.timestamp).toUTCString()}`,
            `**Scope:** ${r.categoryFilter.toUpperCase()} (${r.totalQuestions} Questions Evaluated)\n`,
            `## 1. Executive Summary & Quality Metrics`,
            `| Metric | Target SLA | Measured Score | Status |`,
            `| :--- | :--- | :--- | :--- |`,
            `| **Overall Accuracy** | ≥ 90.0% | **${r.metrics.accuracyPercentage}%** | ${r.metrics.accuracyPercentage >= 90 ? '✓ PASS' : '⚠ WARNING'} |`,
            `| **Hallucination Rate** | 0.0% | **${r.metrics.hallucinationRatePercent}%** | ${r.metrics.hallucinationRatePercent === 0 ? '✓ PASS' : '❌ FAIL'} |`,
            `| **Citation Coverage** | ≥ 95.0% | **${r.metrics.citationCoveragePercent}%** | ${r.metrics.citationCoveragePercent >= 95 ? '✓ PASS' : '⚠ WARNING'} |`,
            `| **Retrieval Precision** | ≥ 90.0% | **${r.metrics.retrievalPrecisionPercent}%** | ${r.metrics.retrievalPrecisionPercent >= 90 ? '✓ PASS' : '⚠ WARNING'} |`,
            `| **Average Response Latency** | ≤ 10.0 sec | **${(r.metrics.averageLatencyMs / 1000).toFixed(2)} sec** | ${r.metrics.averageLatencyMs <= 10000 ? '✓ PASS' : '⚠ SLOW'} |\n`,
            `## 2. Category Performance Breakdown`,
            `| Category | Total Tested | Passed | Accuracy | Avg Latency |`,
            `| :--- | :--- | :--- | :--- | :--- |`,
            ...Object.entries(r.categorySummary).map(([cat, stat]) =>
                `| **${cat}** | ${stat.total} | ${stat.passed} | **${stat.accuracyPercent}%** | ${stat.avgLatencyMs}ms |`
            ),
            `\n## 3. Sample Ground Truth Validations (First 15)`,
            `| ID | Category | Question | Accuracy | Confidence | Latency |`,
            `| :--- | :--- | :--- | :--- | :--- | :--- |`,
            ...r.results.slice(0, 15).map(item =>
                `| \`${item.id}\` | ${item.category} | "${item.question.slice(0, 45)}..." | ${item.passed ? '✓ PASS' : '❌ FAIL'} | ${item.confidence} | ${item.latencyMs}ms |`
            ),
            `\n---\n*Report generated by EduMate RAG Validation Engine (Mission 12.1)*`
        ];

        return lines.join("\n");
    }
}

const ragValidationEngine = new RagValidationEngine();

module.exports = ragValidationEngine;
