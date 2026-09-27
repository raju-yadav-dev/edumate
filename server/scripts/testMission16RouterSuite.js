/**
 * EduMate Mission 16 — Intelligent Hybrid Router Validation Suite
 * 
 * Verifies:
 * 1. Mode A: LLM_ONLY for General Knowledge, Coding, Math, and Acronyms.
 * 2. Mode B: RAG_LLM for University Knowledge & Administrative queries.
 * 3. Mode B Mixed: RAG_LLM (isMixed: true) for dual general + university queries.
 * 4. Mode C: RAG_ONLY for Document and Circular lookup.
 * 5. Mode D: LLM_TOOLS for Summarization and Document comparison.
 * 6. Retrieval skipped (0ms retrieval latency) on general queries.
 * 7. Sub-20ms routing execution.
 * 8. Router Analytics accumulation.
 */

const {
    ROUTER_MODES,
    INTENT_CATEGORIES,
    routeHybridQuery,
    getRouterAnalytics,
    resetRouterAnalytics
} = require("../ai/routing/queryRouter");

function assert(condition, message) {
    if (!condition) {
        throw new Error(`❌ Assertion Failed: ${message}`);
    }
}

async function runValidationSuite() {
    console.log("=================================================================");
    console.log(" 🧪 Running EduMate Mission 16 Hybrid Router Validation Suite");
    console.log("=================================================================\n");

    resetRouterAnalytics();
    let passedTests = 0;
    let totalTests = 0;

    const testCases = [
        // ==========================================
        // 1. LLM-ONLY TEST CASES (Mode A)
        // ==========================================
        {
            category: "LLM_ONLY (General Knowledge)",
            query: "What is AI?",
            expectedMode: ROUTER_MODES.LLM_ONLY,
            expectedSkipRag: true,
            expectedIntent: INTENT_CATEGORIES.GENERAL_KNOWLEDGE
        },
        {
            category: "LLM_ONLY (Programming)",
            query: "What is Java?",
            expectedMode: ROUTER_MODES.LLM_ONLY,
            expectedSkipRag: true,
            expectedIntent: INTENT_CATEGORIES.PROGRAMMING
        },
        {
            category: "LLM_ONLY (Acronym Definition)",
            query: "Full form of CPU.",
            expectedMode: ROUTER_MODES.LLM_ONLY,
            expectedSkipRag: true,
            expectedIntent: INTENT_CATEGORIES.GENERAL_KNOWLEDGE
        },
        {
            category: "LLM_ONLY (Coding / Algorithm)",
            query: "Explain recursion and write a quicksort algorithm in Python.",
            expectedMode: ROUTER_MODES.LLM_ONLY,
            expectedSkipRag: true,
            expectedIntent: INTENT_CATEGORIES.PROGRAMMING
        },
        {
            category: "LLM_ONLY (Conversational)",
            query: "Hello! Who are you and what can you do?",
            expectedMode: ROUTER_MODES.LLM_ONLY,
            expectedSkipRag: true,
            expectedIntent: INTENT_CATEGORIES.CONVERSATION
        },

        // ==========================================
        // 2. RAG + LLM TEST CASES (Mode B)
        // ==========================================
        {
            category: "RAG_LLM (Admission)",
            query: "BCA admission process.",
            expectedMode: ROUTER_MODES.RAG_LLM,
            expectedSkipRag: false,
            expectedIntent: INTENT_CATEGORIES.ADMINISTRATIVE
        },
        {
            category: "RAG_LLM (Faculty)",
            query: "CSS faculty list.",
            expectedMode: ROUTER_MODES.RAG_LLM,
            expectedSkipRag: false,
            expectedIntent: INTENT_CATEGORIES.UNIVERSITY_KNOWLEDGE
        },
        {
            category: "RAG_LLM (Fees)",
            query: "Hostel fee.",
            expectedMode: ROUTER_MODES.RAG_LLM,
            expectedSkipRag: false,
            expectedIntent: INTENT_CATEGORIES.ADMINISTRATIVE
        },
        {
            category: "RAG_LLM (HOD Inquiry)",
            query: "Who is the HOD of Computer Science department?",
            expectedMode: ROUTER_MODES.RAG_LLM,
            expectedSkipRag: false,
            expectedIntent: INTENT_CATEGORIES.ADMINISTRATIVE
        },

        // ==========================================
        // 3. MIXED QUERY TEST CASES (Mode B Mixed)
        // ==========================================
        {
            category: "MIXED (Python + Brainware BCA Syllabus)",
            query: "Explain Python and Brainware BCA Python syllabus.",
            expectedMode: ROUTER_MODES.RAG_LLM,
            expectedSkipRag: false,
            expectedIsMixed: true,
            expectedIntent: INTENT_CATEGORIES.MIXED_INTENT
        },
        {
            category: "MIXED (AI + AI Lab at Brainware)",
            query: "What is AI and AI lab at Brainware?",
            expectedMode: ROUTER_MODES.RAG_LLM,
            expectedSkipRag: false,
            expectedIsMixed: true,
            expectedIntent: INTENT_CATEGORIES.MIXED_INTENT
        },

        // ==========================================
        // 4. RAG-ONLY DOCUMENT LOOKUP TEST CASES (Mode C)
        // ==========================================
        {
            category: "RAG_ONLY (Notice Lookup)",
            query: "Show notice dated 10 July.",
            expectedMode: ROUTER_MODES.RAG_ONLY,
            expectedSkipRag: false,
            expectedIntent: INTENT_CATEGORIES.DOCUMENT_LOOKUP
        },
        {
            category: "RAG_ONLY (Syllabus Download)",
            query: "Download syllabus for MCA.",
            expectedMode: ROUTER_MODES.RAG_ONLY,
            expectedSkipRag: false,
            expectedIntent: INTENT_CATEGORIES.DOCUMENT_LOOKUP
        },

        // ==========================================
        // 5. LLM + TOOLS TEST CASES (Mode D)
        // ==========================================
        {
            category: "LLM_TOOLS (PDF Summarization)",
            query: "Summarize this uploaded pdf document.",
            expectedMode: ROUTER_MODES.LLM_TOOLS,
            expectedSkipRag: false,
            expectedIntent: INTENT_CATEGORIES.TOOL_INVOCATION
        },
        {
            category: "LLM_TOOLS (Document Comparison)",
            query: "Compare the two syllabuses for BCA and MCA.",
            expectedMode: ROUTER_MODES.LLM_TOOLS,
            expectedSkipRag: false,
            expectedIntent: INTENT_CATEGORIES.TOOL_INVOCATION
        }
    ];

    for (const tc of testCases) {
        totalTests++;
        const plan = routeHybridQuery(tc.query);

        try {
            assert(plan.mode === tc.expectedMode, `Expected mode ${tc.expectedMode} but got ${plan.mode}`);
            assert(plan.skipRag === tc.expectedSkipRag, `Expected skipRag ${tc.expectedSkipRag} but got ${plan.skipRag}`);
            assert(plan.routingLatencyMs < 20, `Routing latency ${plan.routingLatencyMs}ms exceeded 20ms threshold`);

            if (tc.expectedIntent) {
                assert(plan.intentCategory === tc.expectedIntent, `Expected intent ${tc.expectedIntent} but got ${plan.intentCategory}`);
            }
            if (tc.expectedIsMixed !== undefined) {
                assert(Boolean(plan.isMixed) === tc.expectedIsMixed, `Expected isMixed ${tc.expectedIsMixed} but got ${plan.isMixed}`);
            }

            console.log(` ✅ PASS [${tc.category}]: "${tc.query}"`);
            console.log(`    Mode: ${plan.mode} | Intent: ${plan.intentCategory} | SkipRAG: ${plan.skipRag} | Latency: ${plan.routingLatencyMs}ms`);
            passedTests++;
        } catch (err) {
            console.error(` ❌ FAIL [${tc.category}]: "${tc.query}" -> ${err.message}`);
        }
    }

    // 6. Test Context-Aware Follow-up Memory
    totalTests++;
    try {
        console.log("\n --- Testing Conversation Memory Context Inheritance ---");
        const followUpQuery = "What is its eligibility?";
        const followUpPlan = routeHybridQuery(followUpQuery, {
            conversationHistory: "User: Tell me about BCA course\nAssistant: BCA is a 3-year undergraduate course."
        });

        assert(followUpPlan.mode === ROUTER_MODES.RAG_LLM, `Expected RAG_LLM on follow-up but got ${followUpPlan.mode}`);
        assert(followUpPlan.skipRag === false, `Expected skipRag: false on follow-up`);
        console.log(` ✅ PASS [Context-Aware Follow-up]: "${followUpQuery}" with prior BCA context -> Mode: ${followUpPlan.mode}`);
        passedTests++;
    } catch (err) {
        console.error(` ❌ FAIL [Context-Aware Follow-up]: ${err.message}`);
    }

    // 7. Verify Telemetry & Analytics
    totalTests++;
    try {
        console.log("\n --- Testing Router Analytics Tracking ---");
        const stats = getRouterAnalytics();
        assert(stats.totalRequests >= totalTests - 1, `Total requests ${stats.totalRequests} mismatch`);
        assert(stats.llmOnlyRequests >= 5, `LLM Only requests counter mismatch (${stats.llmOnlyRequests})`);
        assert(stats.ragRequests >= 6, `RAG requests counter mismatch (${stats.ragRequests})`);
        assert(stats.mixedRequests >= 2, `Mixed requests counter mismatch (${stats.mixedRequests})`);
        assert(stats.retrievalSkippedCount >= 5, `Retrieval skipped counter mismatch (${stats.retrievalSkippedCount})`);
        assert(stats.retrievalLatencySavedMs > 0, `Retrieval latency saved should be > 0ms`);
        assert(stats.avgRoutingLatencyMs < 20, `Average routing latency (${stats.avgRoutingLatencyMs}ms) should be < 20ms`);

        console.log(" ✅ PASS [Router Analytics Summary]:", {
            totalRequests: stats.totalRequests,
            llmOnlyRequests: stats.llmOnlyRequests,
            ragRequests: stats.ragRequests,
            mixedRequests: stats.mixedRequests,
            ragOnlyRequests: stats.ragOnlyRequests,
            toolRequests: stats.toolRequests,
            retrievalSkippedCount: stats.retrievalSkippedCount,
            avgRoutingLatencyMs: stats.avgRoutingLatencyMs,
            retrievalLatencySavedMs: `${stats.retrievalLatencySavedMs}ms`
        });
        passedTests++;
    } catch (err) {
        console.error(` ❌ FAIL [Router Analytics]: ${err.message}`);
    }

    console.log("\n=================================================================");
    console.log(` 🎉 Validation Results: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
    console.log("=================================================================\n");

    if (passedTests === totalTests) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runValidationSuite().catch((e) => {
    console.error("Fatal test error:", e);
    process.exit(1);
});
