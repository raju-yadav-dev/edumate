const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const chatService = require("../ai/services/chatService");

async function traceQueries() {
    console.log("=== TRACING PSYCHOLOGY HOD QUERIES ===");
    await mongoose.connect(process.env.MONGODB_URI);
    
    const user = {
        _id: new mongoose.Types.ObjectId(),
        role: "student",
        institution: "Brainware University",
        fullName: "Test User"
    };

    const conversationId = new mongoose.Types.ObjectId().toString();

    const q1 = "What is the room number of HOD-psychology?";
    console.log(`\n======================================================`);
    console.log(`QUERY 1: "${q1}"`);
    console.log(`======================================================`);
    
    const res1 = await chatService.askQuestion({
        user,
        question: q1,
        conversationId,
        parentId: null
    });

    console.log("\n[RES 1] Answer:\n", res1.message || res1.answer);
    console.log("\n[RES 1] Sources:", JSON.stringify(res1.sources, null, 2));
    console.log("\n[RES 1] Intent / routing:", res1.intent);

    const q2 = "What is the room number and building of HOD-psychology?";
    console.log(`\n======================================================`);
    console.log(`QUERY 2: "${q2}"`);
    console.log(`======================================================`);

    const res2 = await chatService.askQuestion({
        user,
        question: q2,
        conversationId, // Same conversation for follow-up
        parentId: res1.chatId || null
    });

    console.log("\n[RES 2] Answer:\n", res2.message || res2.answer);
    console.log("\n[RES 2] Sources:", JSON.stringify(res2.sources, null, 2));
    console.log("\n[RES 2] Intent / routing:", res2.intent);

    await mongoose.disconnect();
    process.exit(0);
}

traceQueries().catch(err => {
    console.error("Tracing error:", err);
    process.exit(1);
});
