require("dotenv").config();
const mongoose = require("mongoose");
const chatService = require("../server/ai/services/chatService");

async function run() {
    if (process.env.MONGODB_URI) {
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 }).catch(e => console.log("Mongo connect skipped:", e.message));
    }

    const testQueries = [
        "Full form of BCA.",
        "What is Python?",
        "What is the admission procedure for BCA?",
        "Hello."
    ];

    console.log("=== STARTING MISSION 14.2 PIPELINE DEBUGGING ===");

    for (const q of testQueries) {
        console.log(`\n==============================================`);
        console.log(`TESTING QUERY: "${q}"`);
        console.log(`==============================================`);

        let streamedTokens = [];
        let statuses = [];

        try {
            const result = await chatService.askQuestion({
                question: q,
                user: { _id: "660000000000000000000001", fullName: "Test User", role: "student" },
                conversationId: null,
                onChunk: (chunk) => {
                    streamedTokens.push(chunk);
                    process.stdout.write(chunk);
                },
                onStatus: (status, stage, extra) => {
                    statuses.push({ status, stage, extra });
                    console.log(`[STATUS EVENT] Stage: ${stage} | Status: ${status}`);
                }
            });

            console.log(`\n\n--- FINAL RESULT ---`);
            console.log("Message:", result.message);
            console.log("Confidence:", result.confidence);
            console.log("SourceLabel:", result.sourceLabel);
            console.log("Sources count:", result.sources?.length || 0);
            console.log("Total Streamed Chunks:", streamedTokens.length);
        } catch (err) {
            console.error(`\n[ERROR for "${q}"]:`, err);
        }
    }

    if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
    }
}

run().catch(console.error);
