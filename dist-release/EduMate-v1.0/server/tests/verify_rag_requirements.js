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
            fullName: "Raju Yadav",
            email: `raju-${Date.now()}@heritageit.edu`,
            password: "Password123",
            role: "student",
            institution: "Brainware University",
            department: "Computational Sciences"
        });
    }

    console.log(`Using Test User: ${user.fullName} (${user.email})`);
    console.log(`Scoped University: ${user.institution}`);

    const queries = [
        { name: "CSS HOD", query: "Who is the HOD of CSS?" },
        { name: "CSS faculty", query: "List some faculty members of CSS department" },
        { name: "BCA fee", query: "What is the fee structure for the BCA course?" },
        { name: "BCA faculty", query: "Who is the BCA faculty?" },
        { name: "eligibility", query: "What is the eligibility criteria for the BCA course?" },
        { name: "cross-document query", query: "Who is the head of Computational Sciences and what is the fee for BCA?" }
    ];

    for (let i = 0; i < queries.length; i++) {
        const item = queries[i];
        console.log(`\n==================================================`);
        console.log(`[TEST ${i + 1}/${queries.length}] Query: "${item.query}" (${item.name})`);
        console.log(`==================================================`);

        try {
            const result = await chatService.askQuestion({
                user,
                question: item.query,
                conversationId: null,
                parentId: null
            });

            console.log(`\nEduMate Response:\n${result.message}`);
            console.log(`\nSources:`, result.sources.map(s => `${s.type} - ${s.title} (${s.reference})`));
            console.log(`Resolved Intent: ${result.intent}`);
        } catch (e) {
            console.error(`Error during query execution:`, e);
        }

        if (i < queries.length - 1) {
            console.log(`\nSleeping for 40 seconds to reset Groq rate limits...`);
            await new Promise(resolve => setTimeout(resolve, 40000));
        }
    }

    await mongoose.disconnect();
    console.log("\nAll tests completed!");
}

run().catch(err => {
    console.error("Test execution failed:", err);
    mongoose.disconnect();
});
