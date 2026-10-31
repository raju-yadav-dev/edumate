const assert = require('assert');
const { calculateDynamicOutputBudget, getLlmConfig } = require('../config/llm');
const responseFormatter = require('../services/responseFormatter');
const promptService = require('../services/promptService');

function testStepByStepProcedureBudget() {
    console.log("=== Testing Step-by-Step Procedural Token Budget & Anti-Clipping ===");

    // TEST 1: Procedural dynamic budget
    const proceduralQueries = [
        "Can you explain the complete admission procedure step by step?",
        "how to apply step by step",
        "complete admission process",
        "detailed admission procedure",
        "steps for admission"
    ];

    proceduralQueries.forEach(q => {
        const budget = calculateDynamicOutputBudget(q, "ADMISSION_QUERY");
        assert.strictEqual(budget.tier, "PROCEDURAL", `Query "${q}" should have tier PROCEDURAL`);
        assert(budget.maxTokens >= 650, `Query "${q}" budget must be >= 650 tokens, got ${budget.maxTokens}`);
        console.log(`  [PASS] "${q}" -> tier: ${budget.tier}, maxTokens: ${budget.maxTokens}`);
    });

    // TEST 2: Fast lightweight queries remain uninflated
    const factBudget = calculateDynamicOutputBudget("which room is hod css", "LOCATION_QUERY");
    assert.strictEqual(factBudget.tier, "SMALL_FACTUAL");
    assert(factBudget.maxTokens <= 140, "Direct fact queries must remain <= 140 tokens");
    console.log(`  [PASS] Direct factual queries remain fast and lightweight (${factBudget.maxTokens} tokens)`);

    const convBudget = calculateDynamicOutputBudget("hello", "CONVERSATIONAL");
    assert(convBudget.maxTokens <= 200, "Greeting queries must remain <= 200 tokens");
    console.log(`  [PASS] Greetings remain fast and lightweight (${convBudget.maxTokens} tokens)`);

    // TEST 3: Preamble stripping in responseFormatter
    const testWithPreamble = "Here is a detailed explanation of the complete admission procedure for Brainware University in the 2026-27 academic session:\n\nStep-by-Step Admission Procedure\nStep 1: Select a Programme";
    const formattedPreamble = responseFormatter.formatAnswer({
        answer: testWithPreamble,
        confidence: "high",
        question: "Can you explain the complete admission procedure step by step?"
    });
    assert(!formattedPreamble.answer.startsWith("Here is a detailed explanation"), "Introductory preamble must be stripped");
    assert(formattedPreamble.answer.startsWith("Step-by-Step Admission Procedure"), "Answer must begin directly with substantive heading");
    console.log("  [PASS] Introductory preambles stripped cleanly");

    // TEST 4: Dangling broken tail cleaning
    const testWithDanglingTail = "Step 4: Appear for BET\n- Most candidates must appear for BET.\n\nStep 5: Submit Documents\n- Send self-";
    const formattedTail = responseFormatter.formatAnswer({
        answer: testWithDanglingTail,
        confidence: "high",
        question: "Can you explain the complete admission procedure step by step?"
    });
    assert(!formattedTail.answer.includes("- Send self-"), "Dangling incomplete bullet line must be cleanly trimmed");
    assert(formattedTail.answer.endsWith("Step 5: Submit Documents"), "Clean previous step preserved");
    console.log("  [PASS] Dangling truncated fragment trimmed cleanly");

    // TEST 5: System prompt anti-preamble directive
    const messages = promptService.buildMessages({
        question: "Can you explain the complete admission procedure step by step?",
        intent: "ADMISSION_QUERY",
        retrievedChunks: [],
        route: "UNIVERSITY_SPECIFIC"
    });
    const systemPrompt = messages[0].content;
    assert(systemPrompt.includes("Never output conversational preambles"), "System prompt must forbid preambles");
    console.log("  [PASS] System prompt includes strict anti-preamble directive");

    console.log("\nALL STEP-BY-STEP PROCEDURE & ANTI-CLIPPING CHECKS PASSED!");
}

testStepByStepProcedureBudget();

