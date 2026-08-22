const path = require("path");
const queryRewriterService = require("../server/ai/services/queryRewriterService");
const { decide } = require("../server/services/decisionEngine");

async function main() {
    const question = "give the eligibility for BBA";
    console.log(`Original Question: "${question}"`);

    const analysisResult = await queryRewriterService.analyzeQuery({
        question,
        historyText: "",
        conversationContext: {},
        user: { institution: "all" }
    });

    console.log("\n--- Analysis Result ---");
    console.log("Rewritten Query:", analysisResult.rewrittenQuery);
    console.log("Intent:", JSON.stringify(analysisResult.intent));
    console.log("Entities:", JSON.stringify(analysisResult.entities));

    const primaryIntent = Array.isArray(analysisResult.intent) 
        ? analysisResult.intent[0] 
        : analysisResult.intent;

    const decision = decide({ 
        intent: primaryIntent, 
        question: analysisResult.rewrittenQuery 
    });

    console.log("\n--- Routing Decision ---");
    console.log("Decision:", JSON.stringify(decision, null, 2));
}

main().catch(console.error);
