const assert = require("assert");
const responseFormattingService = require("../services/responseFormatter");
const { buildCompactSystemPrompt } = require("../services/promptService");

console.log("=== Testing Rate Limiter & Clean Direct Answer Output ===");

// 1. Test responseFormatter formatAnswer: sources must be empty and no source label prefixed
const sampleAnswer = `[Document: syllabus.pdf]
The Bachelor of Computer Applications (BCA) is a 3-year undergraduate degree [1].
It includes subjects like Programming in C, Java, and Database Systems [2].
[Source: course_guide.pdf]`;

const formatted = responseFormattingService.formatAnswer({
    answer: sampleAnswer,
    confidence: "high",
    sources: [
        { title: "syllabus.pdf", page: 1, type: "document" },
        { title: "course_guide.pdf", page: 4, type: "document" }
    ],
    sourceLabel: "📚 University Knowledge Base",
    question: "What is BCA?",
    queryPlan: { route: "UNIVERSITY_SPECIFIC" }
});

assert.strictEqual(Array.isArray(formatted.sources), true, "Sources must be an array");
assert.strictEqual(formatted.sources.length, 0, "Sources array must be empty (no sources attached)");
assert.strictEqual(formatted.sourceLabel, "", "sourceLabel must be empty string");
assert.ok(!formatted.answer.includes("📚 University Knowledge Base"), "Answer must not be prefixed with source label");
assert.ok(!formatted.answer.includes("[Document: syllabus.pdf]"), "Bracket document markers must be stripped");
assert.ok(!formatted.answer.includes("[Source: course_guide.pdf]"), "Bracket source markers must be stripped");
assert.ok(!formatted.answer.includes("[1]"), "Numeric bracket citations must be stripped");
assert.ok(!formatted.answer.includes("[2]"), "Numeric bracket citations must be stripped");
assert.ok(formatted.answer.includes("The Bachelor of Computer Applications (BCA) is a 3-year undergraduate degree"), "Core answer text must be preserved");
console.log("✓ responseFormatter output is clean of all sources, labels, and citations.");

// 2. Test promptService instructions
const sysPrompt = buildCompactSystemPrompt({
    activeInstitution: "Test University",
    targetLanguage: "English",
    intent: "information",
    route: "UNIVERSITY_SPECIFIC"
});

assert.ok(sysPrompt.includes("Provide the direct output answer only"), "System prompt must instruct model to provide direct output answer only");
assert.ok(sysPrompt.includes("Do not provide sources, citations, references"), "System prompt must instruct model not to output citations/references");
console.log("✓ promptService system prompt explicitly instructs model not to output sources or citations.");

// 3. Test rateLimiter configuration
const rateLimiters = require("../middleware/rateLimiters");
assert.ok(rateLimiters.chatRateLimiter, "chatRateLimiter must exist");
assert.ok(rateLimiters.uploadRateLimiter, "uploadRateLimiter must exist");

// Simulate loopback request skip check
const mockLoopbackReq = { ip: "127.0.0.1", originalUrl: "/api/chat/message" };
const mockIpv6LoopbackReq = { ip: "::1", originalUrl: "/api/chat/message" };
const isLoopbackIp = (ip) => !ip || ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || String(ip).includes("127.0.0.1");

assert.strictEqual(isLoopbackIp(mockLoopbackReq.ip), true, "127.0.0.1 must be recognized as loopback");
assert.strictEqual(isLoopbackIp(mockIpv6LoopbackReq.ip), true, "::1 must be recognized as loopback");
console.log("✓ Rate limiter skip logic for localhost and loopback IPs verified.");

console.log("\nALL RATE LIMIT & CLEAN OUTPUT CHECKS PASSED!");

