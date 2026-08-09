const path = require("path");
const mongoose = require("mongoose");

// Load .env from project root
const projectRoot = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(projectRoot, ".env") });

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully!");

    const SearchManager = require(path.join(projectRoot, "knowledge", "SearchManager"));
    const RankingEngine = require(path.join(projectRoot, "knowledge", "RankingEngine"));

    const query = "give details of bba llb";
    console.log(`\nQuery: "${query}"`);

    // Search Qdrant
    const docChunks = await SearchManager.searchLocalPdfs(query, { role: "student" }, 5);
    console.log(`\nRetrieved ${docChunks.length} chunks from Qdrant:`);
    
    docChunks.forEach((c, idx) => {
        console.log(`\n--- Chunk ${idx + 1} (Score: ${c.score.toFixed(4)}) ---`);
        console.log(`Doc: ${c.metadata?.originalName}, Page: ${c.metadata?.pageNumber}`);
        console.log(`Content:\n${c.content.slice(0, 400)}...`);
    });

    const ranked = await RankingEngine.rerankCandidates(query, docChunks);
    console.log(`\nReranked chunks:`);
    ranked.forEach((c, idx) => {
        console.log(`- Chunk ${idx + 1}: Score: ${c.score.toFixed(4)}, Doc: ${c.metadata?.originalName}`);
    });

    await mongoose.disconnect();
}

run().catch(console.error);
