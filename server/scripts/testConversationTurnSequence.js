const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

async function runTurnTest() {
    console.log("Connecting to MongoDB...");
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected.");

    const chatService = require("../ai/services/chatService");

    const testUser = {
        _id: new mongoose.Types.ObjectId(),
        role: "student",
        fullName: "Multi-Turn Student"
    };

    console.log("\n=======================================================");
    console.log(" 🚀 Testing Multi-Turn Dialogue Sequence");
    console.log("=======================================================\n");

    let conversationId = null;

    // Turn 1: Ask about HOD-Cyber
    console.log(">>> Turn 1: 'What is the room number of HOD of Cyber Science & Technology?'");
    const t1 = await chatService.askQuestion({
        user: testUser,
        question: "What is the room number of HOD of Cyber Science & Technology?",
        conversationId
    });
    conversationId = t1.conversationId;
    console.log(`[Turn 1 Answer]: ${t1.message}`);

    // Turn 2: Genuine Follow-up "Which building?"
    console.log("\n>>> Turn 2 (Follow-up): 'Which building?'");
    const t2 = await chatService.askQuestion({
        user: testUser,
        question: "Which building?",
        conversationId
    });
    console.log(`[Turn 2 Answer]: ${t2.message}`);

    // Turn 3: Explicit Entity Switching to Photography Lab
    console.log("\n>>> Turn 3 (Entity Switch): 'What is the room number of Photography Lab?'");
    const t3 = await chatService.askQuestion({
        user: testUser,
        question: "What is the room number of Photography Lab?",
        conversationId
    });
    console.log(`[Turn 3 Answer]: ${t3.message}`);

    // Turn 4: Genuine Follow-up to Photography Lab "Which floor?"
    console.log("\n>>> Turn 4 (Follow-up to Photography Lab): 'Which floor?'");
    const t4 = await chatService.askQuestion({
        user: testUser,
        question: "Which floor?",
        conversationId
    });
    console.log(`[Turn 4 Answer]: ${t4.message}`);

    // Turn 5: Explicit Entity Switching to Linux Lab
    console.log("\n>>> Turn 5 (Entity Switch): 'What is the room number of Linux lab?'");
    const t5 = await chatService.askQuestion({
        user: testUser,
        question: "What is the room number of Linux lab?",
        conversationId
    });
    console.log(`[Turn 5 Answer]: ${t5.message}`);

    // Assertions
    const assert = require("assert");
    assert(t1.message.includes("109"), "Turn 1 must be Room 109");
    assert(t1.message.toLowerCase().includes("cyber"), "Turn 1 must be Cyber Science");
    assert(t2.message.toLowerCase().includes("building i") || t2.message.toLowerCase().includes("building"), "Turn 2 must answer building for HOD-cyber");
    assert(t3.message.includes("205"), "Turn 3 must be Room 205 (Photography Lab)");
    assert(!t3.message.includes("109"), "Turn 3 must NOT be Room 109");
    assert(t3.message.toLowerCase().includes("photography"), "Turn 3 must answer Photography Lab");
    assert(t4.message.toLowerCase().includes("2nd floor") || t4.message.toLowerCase().includes("second floor") || t4.message.toLowerCase().includes("205") || t4.message.toLowerCase().includes("photography"), "Turn 4 must resolve to Photography Lab floor");
    assert(!t4.message.toLowerCase().includes("cyber"), "Turn 4 must NOT resolve to Cyber Science");
    assert(t5.message.includes("102"), "Turn 5 must be Room 102 (Linux Lab)");
    assert(!t5.message.includes("109"), "Turn 5 must NOT be Room 109");
    assert(!t5.message.includes("205"), "Turn 5 must NOT be Room 205");

    console.log("\n🎉 ALL 5 DIALOGUE TURNS VERIFIED WITH ZERO CROSS-ENTITY BLEED!");

    await mongoose.disconnect();
}

runTurnTest().catch(console.error);
