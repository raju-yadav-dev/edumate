const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

async function runLiveTest() {
    console.log("Connecting to MongoDB...");
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected.");

    const chatService = require("../ai/services/chatService");

    const queries = [
        { label: "Query A", q: "What is the room number of Photography Lab?" },
        { label: "Query B", q: "What is the room number of Linux lab?" },
        { label: "Query C", q: "What is the room number of HOD of Cyber Science & Technology?" }
    ];

    console.log("\n=======================================================");
    console.log(" 🚀 Testing 3 Original Queries Through Live Backend");
    console.log("=======================================================\n");

    for (const item of queries) {
        console.log(`\n>>> Executing ${item.label}: "${item.q}"`);
        const start = Date.now();
        try {
            const result = await chatService.askQuestion({
                question: item.q,
                user: { _id: new mongoose.Types.ObjectId(), role: "student", fullName: "Test Student" }
            });
            const elapsed = Date.now() - start;
            console.log(`[Result] Status: SUCCESS (${elapsed}ms)`);
            console.log(`[Answer]: ${result.message}`);
            console.log(`[Confidence]: ${result.confidence}`);
            console.log(`[Source Label]: ${result.sourceLabel}`);
            console.log(`[Sources Count]: ${result.sources?.length || 0}`);
            if (result.sources && result.sources.length > 0) {
                result.sources.forEach((s, idx) => {
                    console.log(`  Source ${idx + 1}: ${s.title || s.name || s.documentName} (Page: ${s.pageNumber || s.page || 1})`);
                });
            }
        } catch (err) {
            console.error(`[Result] FAILED:`, err.message);
        }
    }

    await mongoose.disconnect();
    console.log("\nLive backend test finished.");
}

runLiveTest().catch(console.error);
