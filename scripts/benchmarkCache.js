const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const chatService = require("../server/ai/services/chatService");

async function runCacheBenchmark() {
    console.log("================================================================================");
    console.log(" EduMate: Cold-Cache vs Warm-Cache Latency Benchmark");
    console.log("================================================================================\n");

    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log("Connected to MongoDB successfully.\n");

    const user = {
        _id: new mongoose.Types.ObjectId("6ad6f3b87e3a96aa76e63583"),
        email: "benchmark@brainware.ac.in",
        role: "student"
    };

    const benchmarkQueries = [
        "What is the room number of Photography Lab?",
        "Where is the VFX lab?",
        "What is BCA?"
    ];

    const results = [];

    for (const query of benchmarkQueries) {
        console.log(`Testing query: "${query}"`);
        const convId1 = new mongoose.Types.ObjectId().toString();
        const convId2 = new mongoose.Types.ObjectId().toString();

        // Run 1: Cold Cache (or set)
        const t1Start = Date.now();
        const res1 = await chatService.askQuestion({
            user,
            question: query,
            conversationId: convId1
        });
        const t1Duration = Date.now() - t1Start;

        // Run 2: Warm Cache (instant retrieval without LLM call)
        const t2Start = Date.now();
        const res2 = await chatService.askQuestion({
            user,
            question: query,
            conversationId: convId2
        });
        const t2Duration = Date.now() - t2Start;

        const speedup = ((t1Duration - t2Duration) / t1Duration * 100).toFixed(1);

        console.log(`  - Cold Cache Latency: ${t1Duration}ms | LLM Provider: ${res1.provider || 'llama'}`);
        console.log(`  - Warm Cache Latency: ${t2Duration}ms | LLM Provider: ${res2.provider || 'cache'}`);
        console.log(`  - Latency Reduction: ${speedup}%\n`);

        results.push({
            query,
            coldMs: t1Duration,
            warmMs: t2Duration,
            speedup: `${speedup}%`,
            answer: (res2.answer || "").slice(0, 70) + "..."
        });
    }

    console.table(results);
    await mongoose.disconnect();
    console.log("\nBenchmark Complete!");
}

if (require.main === module) {
    runCacheBenchmark().catch(err => {
        console.error("Cache benchmark error:", err);
        process.exit(1);
    });
}

module.exports = { runCacheBenchmark };
