const path = require("path");
const mongoose = require("mongoose");

// Load .env from project root
const projectRoot = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(projectRoot, ".env") });

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully!");

    const User = require(path.join(projectRoot, "models", "User"));
    const Chat = require(path.join(projectRoot, "models", "Chat"));
    const chatService = require(path.join(projectRoot, "ai", "services", "chatService"));

    let user = await User.findOne();
    if (!user) {
        console.error("No users found in database to run test.");
        await mongoose.disconnect();
        return;
    }

    // 1. Create a dummy chat thread
    console.log("Creating dummy chat thread...");
    const userMsgId = `msg-user-${Date.now()}`;
    const assistantMsgId = `msg-assistant-${Date.now()}`;
    
    const chat = await Chat.create({
        title: "Test Regenerate Chat",
        user: user._id,
        institution: "Brainware University",
        messages: [
            {
                id: userMsgId,
                parentId: "root",
                role: "user",
                content: "Tell me about B.Sc. Digital Media Science & Journalism.",
                intent: "courses",
                provider: "user"
            },
            {
                id: assistantMsgId,
                parentId: userMsgId,
                role: "assistant",
                content: "B.Sc. Digital Media Science & Journalism is a course.",
                intent: "courses",
                provider: "groq"
            }
        ]
    });

    console.log(`Created chat ID: ${chat._id}`);

    // 2. Trigger regenerateResponse
    console.log("\nCalling regenerateResponse...");
    const result = await chatService.regenerateResponse({
        user,
        conversationId: chat._id
    });

    console.log("\n=== Regenerate result ===");
    console.log("Response message:", result.message);
    console.log("Sources:", result.sources);

    // Clean up
    await Chat.deleteOne({ _id: chat._id });
    console.log("\nCleaned up dummy chat thread.");

    await mongoose.disconnect();
}

run().catch(err => {
    console.error("Regenerate test failed:", err);
    mongoose.disconnect();
});
