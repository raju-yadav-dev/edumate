const mongoose = require("mongoose");
const path = require("path");
const queryRewriterService = require("../server/ai/services/queryRewriterService");
const retrievalService = require("../server/ai/services/retrievalService");
const { decide } = require("../server/services/decisionEngine");

require("dotenv").config({ path: path.join(__dirname, "../server/.env") });

async function debugQuery(question) {
    console.log(`\n==================================================`);
    console.log(`DEBUGGING QUERY: "${question}"`);
    console.log(`==================================================`);

    // 1. Intent & Rewriting
    const analysis = await queryRewriterService.analyzeQuery({
        question,
        historyText: "",
        conversationContext: {},
        user: { institution: "Brainware University" }
    });

    console.log("\n[A] Query Analysis:");
    console.log("  - Rewritten Query:", analysis.rewrittenQuery);
    console.log("  - Detected Intent:", JSON.stringify(analysis.intent));
    console.log("  - Subqueries:", JSON.stringify(analysis.subqueries));
    console.log("  - Entities:", JSON.stringify(analysis.entities));

    // 2. Decision Routing
    const primaryIntent = Array.isArray(analysis.intent) ? analysis.intent[0] : analysis.intent;
    const decision = decide({ intent: primaryIntent, question: analysis.rewrittenQuery });
    console.log("\n[B] Decision Routing:");
    console.log("  - Decision service:", decision.service);

    // 3. Retrieval
    console.log("\n[C] Retrieving Chunks (Simulating RAG Retrieval)...");
    try {
        const results = await retrievalService.retrieve({
            question: analysis.rewrittenQuery,
            user: { institution: "Brainware University", role: "student" },
            limit: 5
        });

        console.log(`\n[D] Retrieved Candidate count: ${results.length}`);
        results.forEach((chunk, index) => {
            console.log(`  [Candidate ${index + 1}]`);
            console.log(`    - Score: ${chunk.score}`);
            console.log(`    - Document Name: ${chunk.metadata?.originalName || chunk.metadata?.filename}`);
            console.log(`    - Document ID: ${chunk.metadata?.documentId}`);
            console.log(`    - Document Type: ${chunk.metadata?.documentType}`);
            console.log(`    - Category: ${chunk.metadata?.category}`);
            console.log(`    - Source Type: ${chunk.metadata?.sourceType}`);
            console.log(`    - Content Preview: "${chunk.content.substring(0, 150).replace(/\n/g, " ")}..."`);
        });
    } catch (err) {
        console.error("  - Retrieval failed:", err);
    }
}

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    await debugQuery("what is the eligibility for btech");
    await debugQuery("tell me about bca");

    await mongoose.disconnect();
}

main().catch(console.error);
