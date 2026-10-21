const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const SearchManager = require("../knowledge/SearchManager");
const RankingEngine = require("../knowledge/RankingEngine");
const promptService = require("../services/promptService");
const responseValidator = require("../services/responseValidator");
const responseFormattingService = require("../ai/services/responseFormattingService");
const chatService = require("../ai/services/chatService");
const llama = require("../config/llama");
const { getLlmConfig } = require("../config/llm");

async function diagnose() {
    console.log("=== PHASE 1 DIAGNOSTIC: ROOM 109 HOD CYBER SECURITY ===");
    await mongoose.connect(process.env.MONGODB_URI);
    
    const query = "Give the room number of HOD of Cyber Security";
    const user = { _id: new mongoose.Types.ObjectId(), role: "student", institution: "Brainware University" };
    
    // 1. Raw Qdrant / SearchManager search
    console.log("\n--- STEP 1: SearchManager.searchLocalPdfs ---");
    const rawChunks = await SearchManager.searchLocalPdfs(query, user, 6);
    console.log(`Found ${rawChunks.length} raw chunks.`);
    rawChunks.forEach((c, i) => {
        console.log(`[Chunk ${i+1}] ID: ${c.id} | Score: ${c.score} | OriginalName: ${c.metadata?.originalName || c.metadata?.source} | Heading: ${c.metadata?.heading}`);
        console.log(`Snippet: ${String(c.content || "").slice(0, 200).replace(/\n/g, " ")}...\n`);
    });

    // 2. Reranking
    console.log("\n--- STEP 2: RankingEngine.rerankCandidates ---");
    const rankedChunks = await RankingEngine.rerankCandidates(query, rawChunks, user);
    console.log(`Ranked ${rankedChunks.length} chunks.`);
    rankedChunks.forEach((c, i) => {
        console.log(`[Ranked ${i+1}] ID: ${c.id} | Score: ${c.score} | OriginalName: ${c.metadata?.originalName || c.metadata?.source}`);
    });

    // Check if "109" or "cyber" is in any chunk
    const matchingChunk = rawChunks.find(c => String(c.content).includes("109"));
    if (matchingChunk) {
        console.log("\n>>> FOUND CHUNK WITH 109! Full content:\n", matchingChunk.content);
    } else {
        console.log("\n>>> WARNING: No chunk contains '109' in raw search results!");
    }

    // 3. Test askQuestion live run
    console.log("\n--- STEP 3: Live chatService.askQuestion ---");
    const startMs = Date.now();
    const liveResult = await chatService.askQuestion({
        user,
        question: query,
        conversationId: new mongoose.Types.ObjectId().toString()
    });
    const totalLatency = Date.now() - startMs;

    console.log("\n--- STEP 4: Live Result Details ---");
    console.log("Total Latency:", totalLatency + "ms");
    console.log("Answer:", liveResult.message || liveResult.answer);
    console.log("Sources count:", (liveResult.sources || []).length);
    console.log("Sources:", liveResult.sources);
    console.log("Confidence:", liveResult.confidence);
    console.log("Source Label:", liveResult.sourceLabel);

    await mongoose.disconnect();
    process.exit(0);
}

diagnose().catch(err => {
    console.error("Diagnosis error:", err);
    process.exit(1);
});
