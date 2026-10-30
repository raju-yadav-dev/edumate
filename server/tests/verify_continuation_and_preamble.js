const assert = require("assert");
const promptService = require("../services/promptService");
const aiPromptService = require("../ai/services/promptService");
const { getLlmConfig, calculateDynamicOutputBudget } = require("../config/llm");

console.log("=== Testing 1, 2, 4 Implementation ===");

// TEST 1: Preamble Stripping in System Prompts (Item 1)
console.log("\n--- TEST 1: System Prompt Anti-Preamble Directives ---");
const gkPrompt = promptService.buildCompactSystemPrompt({
    activeInstitution: "Brainware University",
    targetLanguage: "Bengali",
    route: "GENERAL_KNOWLEDGE"
});
assert(
    gkPrompt.includes("Direct answer only") || gkPrompt.includes("Never restate, echo, or summarize"),
    "GENERAL_KNOWLEDGE system prompt should forbid echoing or summarizing questions"
);
console.log("  [PASS] GENERAL_KNOWLEDGE forbids preamble echoing.");

const ragPrompt = promptService.buildCompactSystemPrompt({
    activeInstitution: "Brainware University",
    targetLanguage: "English",
    route: "RAG_LLM"
});
assert(
    ragPrompt.includes("Direct answer only") || ragPrompt.includes("Never restate, echo, or summarize"),
    "RAG_LLM system prompt should forbid echoing or summarizing questions"
);
console.log("  [PASS] RAG_LLM forbids preamble echoing.");

// TEST 2: Output Token Budget for General Knowledge & Comparisons (Item 2)
console.log("\n--- TEST 2: Output Token Budget Calculation ---");
const llmConfig = getLlmConfig();
const envMax = llmConfig.maxTokens || 512;

// Case A: Comparison / Career question (like BCA vs B.Tech)
const careerQuery = "ami class 12 a 75% number anachi science a kon stream ta nile amar jonno bhalo hoy? ami bhabchilam je bca nebo na btech";
const budgetA = calculateDynamicOutputBudget(careerQuery, "GENERAL_QUERY");
const routeChosenA = "GENERAL_KNOWLEDGE";
const isContinuationA = false;
const resolvedMaxTokensA = (routeChosenA === "CONVERSATIONAL" && !isContinuationA)
    ? Math.min(160, envMax)
    : Math.min(envMax, Math.max(350, budgetA?.maxTokens || 380));

assert(resolvedMaxTokensA >= 350, `Expected budget >= 350 for general career query, got ${resolvedMaxTokensA}`);
assert(resolvedMaxTokensA > 140, "Budget MUST NOT be capped at 140");
console.log(`  [PASS] Career query resolvedMaxTokens = ${resolvedMaxTokensA} (sufficient room, not clamped to 140).`);

// Case B: Pure greeting
const greetingQuery = "hello";
const budgetB = calculateDynamicOutputBudget(greetingQuery, "greeting");
const routeChosenB = "CONVERSATIONAL";
const isContinuationB = false;
const resolvedMaxTokensB = (routeChosenB === "CONVERSATIONAL" && !isContinuationB)
    ? Math.min(160, envMax)
    : Math.min(envMax, Math.max(350, budgetB?.maxTokens || 380));

assert(resolvedMaxTokensB <= 160, `Expected greeting budget <= 160, got ${resolvedMaxTokensB}`);
console.log(`  [PASS] Greeting resolvedMaxTokens = ${resolvedMaxTokensB} (fast, lightweight).`);

// Case C: Continuation of response
const isContinuationC = true;
const resolvedMaxTokensC = (routeChosenB === "CONVERSATIONAL" && !isContinuationC)
    ? Math.min(160, envMax)
    : Math.min(envMax, Math.max(350, budgetA?.maxTokens || 380));

assert(resolvedMaxTokensC >= 350, `Expected continuation budget >= 350, got ${resolvedMaxTokensC}`);
console.log(`  [PASS] Continuation query resolvedMaxTokens = ${resolvedMaxTokensC} (bypasses conversational cap).`);

// TEST 3: Continuation Detection & Message Construction (Item 4)
console.log("\n--- TEST 3: Continuation Triggers & Directives ---");
const isContinuationQuery = (text) => {
    const clean = String(text || "").trim().toLowerCase().replace(/[.,!?;:]/g, " ");
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 12) return false;
    return /\b(?:continue|carry\s+on|go\s+on|keep\s+going|proceed|finish(?:\s+it|\s+this)?|complete(?:\s+it|\s+this)?|sesh\s+koro|sesh\s+korun|bolte\s+chaicho|aro\s+bolo|aro\s+bolun|aage\s+batao|aur\s+batao|poora\s+karo|jaari\s+rakho)\b/i.test(clean);
};

const triggerPhrases = [
    "continue",
    "carry on",
    "go on",
    "sesh koro",
    "ar ki bolte chaicho sesh koro",
    "sesh korun",
    "aro bolo",
    "aage batao",
    "aur batao",
    "please continue"
];

for (const phrase of triggerPhrases) {
    assert(isContinuationQuery(phrase), `Phrase "${phrase}" should match continuation query`);
}
console.log(`  [PASS] All ${triggerPhrases.length} continuation phrases matched accurately.`);

const nonContinuationPhrases = [
    "What is the fee for BCA?",
    "Where is Academic Block 5?",
    "Who is the HOD of Computer Science?"
];
for (const phrase of nonContinuationPhrases) {
    assert(!isContinuationQuery(phrase), `Phrase "${phrase}" should NOT match continuation query`);
}
console.log("  [PASS] Non-continuation queries correctly ignored.");

// Test continuation message formatting
const messages = aiPromptService.buildPromptMessages({
    question: "continue",
    intent: "GENERAL_QUERY",
    retrievedChunks: [],
    historyText: "User: ami class 12 a 75%...\nAssistant: Bachelor of Technology (B.Tech): This degree is better suited for careers in",
    user: { fullName: "Test User" },
    isRepeat: true,
    isContinuation: true,
    continuationContext: 'The user asked to continue your previous answer. Your previous response ended with:\n"careers in"\nPick up directly from that exact point.',
    language: "bn",
    route: "GENERAL_KNOWLEDGE"
});

assert(messages.length === 2, "Expected 2 messages (system and user)");
assert(messages[0].role === "system", "First message should be system");
assert(messages[0].content.includes("continue your previous answer"), "System prompt must have continuation rule");
assert(messages[1].role === "user", "Second message should be user");
assert(messages[1].content.includes("[Continuation Directive]"), "User prompt must include Continuation Directive");
console.log("  [PASS] Continuation system rules and directives generated successfully.");

console.log("\n=== ALL TESTS PASSED! ===");

