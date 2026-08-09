const path = require("path");
const mongoose = require("mongoose");

// Load .env from project root
const projectRoot = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(projectRoot, ".env") });

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully!");

    const chatService = require(path.join(projectRoot, "ai", "services", "chatService"));
    const SearchManager = require(path.join(projectRoot, "knowledge", "SearchManager"));
    const RankingEngine = require(path.join(projectRoot, "knowledge", "RankingEngine"));

    const user = {
        _id: new mongoose.Types.ObjectId(),
        fullName: "Raju Yadav",
        role: "student"
    };

    const query = "give details of bba llb";
    console.log(`\nTesting Query: "${query}"`);

    // Let's run askQuestion
    const result = await chatService.askQuestion({
        user,
        question: query
    });

    console.log(`\n=== EduMate Answer ===`);
    console.log(result.message);
    console.log(`Sources:`, result.sources);

    await mongoose.disconnect();
}

run().catch(console.error);
