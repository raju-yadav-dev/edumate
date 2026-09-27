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
            institution: "Brainware University",
            department: "Computational Sciences"
        });
    }

    console.log(`Using Test User: ${user.fullName} (${user.email})`);

    const queries = [
        "who is the HOD of CSS department?",
        "who is the HOD of CSS?",
        "who is the head of department of computational sciences?",
        "Dr Jayanta Aich",
        "Professor and HoD Department of Computational Sciences"
    ];

    for (const q of queries) {
        console.log(`\n==================================================`);
        console.log(`TEST QUERY: "${q}"`);
        console.log(`==================================================`);
        
        try {
            const result = await chatService.askQuestion({
                user,
                question: q,
                conversationId: null,
                parentId: null
            });

            console.log(`\nEduMate Response:\n${result.message}`);
            console.log(`\nSources Used:`, result.sources.map(s => `${s.type} - ${s.title} (${s.reference})`));
            console.log(`Resolved Intent: ${result.intent}`);
            
            const lowerAnswer = result.message.toLowerCase();
            const pass = lowerAnswer.includes("jayanta") || lowerAnswer.includes("aich");
            console.log(`TEST STATUS: ${pass ? "PASS" : "FAILED"}`);
        } catch (e) {
            console.error(`Error during query execution:`, e);
        }

        // Sleep to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    await mongoose.disconnect();
    console.log("\nAll tests completed!");
}

run().catch(err => {
    console.error("Test execution failed:", err);
    mongoose.disconnect();
});
