const path = require("path");
const mongoose = require("mongoose");

// Load .env from project root
const projectRoot = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(projectRoot, ".env") });

// Set environment to development to output debug logs
process.env.NODE_ENV = "development";

async function run() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully!");

    const User = require(path.join(projectRoot, "models", "User"));
    const chatService = require(path.join(projectRoot, "ai", "services", "chatService"));

    // Find a test user or create a temporary one
    let user = await User.findOne();
    if (!user) {
        user = await User.create({
            fullName: "Test Student",
            email: `test-${Date.now()}@heritageit.edu`,
            password: "Password123",
            role: "student",
            institution: "Heritage Institute of Technology",
            department: "Computer Science"
        });
    }

    console.log(`Using Test User: ${user.fullName} (${user.email})`);

    const DocumentModel = require(path.join(projectRoot, "models", "Document"));
    const allDocs = await DocumentModel.find({ status: "active" }).lean();
    console.log(`\nActive Documents in DB: ${allDocs.length}`);
    allDocs.forEach(d => {
        console.log(`- ID: ${d._id}, Name: ${d.originalName}, Category: ${d.category}, UploadedFrom: ${d.metadata?.uploadedFrom || "api"}, SourceURL: ${d.metadata?.sourceUrl || "None"}`);
    });

    const KnowledgeSourceModel = require(path.join(projectRoot, "models", "KnowledgeSource"));
    const sourcesList = await KnowledgeSourceModel.find().lean();
    console.log(`\nKnowledge Sources:`);
    sourcesList.forEach(s => {
        console.log(`- Type: ${s.type}, Name: ${s.name}, Enabled: ${s.isEnabled}, URL: ${s.url || "None"}`);
    });

    // Let's run Scenario 1:
    // - "Tell me about B.Pharm."
    // - "What is the fee?"
    // - "What about eligibility?"
    // - "Documents?"
    console.log("\n==================================================");
    console.log("RUNNING SCENARIO 1: B.Pharm Flow");
    console.log("==================================================");

    let conversationId = null;
    let parentId = null;

    const queries = [
        "Tell me about B.Sc. Digital Media Science & Journalism.",
        "What is the fee?",
        "What about eligibility?",
        "Documents?"
    ];

    for (const q of queries) {
        console.log(`\n--------------------------------------------------`);
        console.log(`User: "${q}"`);
        console.log(`--------------------------------------------------`);
        
        const result = await chatService.askQuestion({
            user,
            question: q,
            conversationId,
            parentId
        });

        conversationId = result.conversationId;
        console.log(`EduMate Response:\n${result.message.slice(0, 300)}...`);
        console.log(`Sources Used:`, result.sources.map(s => `${s.type} - ${s.title} (${s.reference})`));
        console.log(`Resolved Intent: ${result.intent}`);
        
        // Find the last assistant message ID to chain the next follow-up
        const Chat = require(path.join(projectRoot, "models", "Chat"));
        const chat = await Chat.findById(conversationId);
        if (chat && chat.messages.length > 0) {
            parentId = chat.messages[chat.messages.length - 1].id;
        }

        // Sleep to avoid rate limit (TPM)
        await new Promise(resolve => setTimeout(resolve, 1200));
    }

    // Let's run Scenario 3 (Topic Switching):
    // - "B.Pharm" -> "Eligibility?" -> "What about BCA?" -> "Duration?"
    console.log("\n==================================================");
    console.log("RUNNING SCENARIO 3: Topic Switching");
    console.log("==================================================");
    
    let conversationId2 = null;
    let parentId2 = null;

    const queries2 = [
        "B.Pharm",
        "Eligibility?",
        "What about BCA?",
        "Duration?"
    ];

    for (const q of queries2) {
        console.log(`\n--------------------------------------------------`);
        console.log(`User: "${q}"`);
        console.log(`--------------------------------------------------`);
        
        const result = await chatService.askQuestion({
            user,
            question: q,
            conversationId: conversationId2,
            parentId: parentId2
        });

        conversationId2 = result.conversationId;
        console.log(`EduMate Response:\n${result.message.slice(0, 300)}...`);
        console.log(`Sources Used:`, result.sources.map(s => `${s.type} - ${s.title} (${s.reference})`));
        console.log(`Resolved Intent: ${result.intent}`);

        const Chat = require(path.join(projectRoot, "models", "Chat"));
        const chat = await Chat.findById(conversationId2);
        if (chat && chat.messages.length > 0) {
            parentId2 = chat.messages[chat.messages.length - 1].id;
        }

        // Sleep to avoid rate limit (TPM)
        await new Promise(resolve => setTimeout(resolve, 1200));
    }

    await mongoose.disconnect();
    console.log("\nDone!");
}

run().catch(err => {
    console.error("Test failed with error:", err);
    mongoose.disconnect();
});
