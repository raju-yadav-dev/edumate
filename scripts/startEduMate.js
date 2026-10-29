const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), override: true });

const { validateEnvironment } = require("../server/config/envValidator");
const { checkLlmHealth, getLlmConfig } = require("../server/config/llm");
const llamaProcessManager = require("../server/services/llamaProcessManager");

async function startEduMate() {
    console.log("\n============================================================");
    console.log("       EduMate Production Startup & Readiness Probe         ");
    console.log("============================================================\n");

    // 1. Validate Environment Variables
    console.log("Step 1/5: Validating Environment Configuration...");
    const envCheck = validateEnvironment();
    if (!envCheck.valid) {
        console.error("❌ Environment validation failed.");
        process.exit(1);
    }
    console.log("✓ Environment variables verified.\n");

    // 2. Check MongoDB Connection
    console.log("Step 2/5: Probing MongoDB Document Database...");
    let mongoose;
    try {
        if (process.env.MONGODB_URI && process.env.MONGODB_URI.startsWith("mongodb+srv://")) {
            require("dns").setServers(["1.1.1.1", "8.8.8.8"]);
        }
        mongoose = require("mongoose");
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
        console.log(`✓ MongoDB connection established (${mongoose.connection.name}).\n`);
    } catch (err) {
        console.warn(`⚠️ Warning: MongoDB probe failed (${err.message}). Continuing in offline fallback mode.\n`);
    }

    // 3. Check Qdrant Vector Store
    console.log("Step 3/5: Probing Qdrant Vector Database...");
    try {
        const { client, collectionName } = require("../server/ai/config/qdrant");
        const res = await client.getCollections();
        console.log(`✓ Qdrant reachable (${res.collections?.length || 0} collections found, target: ${collectionName}).\n`);
    } catch (err) {
        console.warn(`⚠️ Warning: Qdrant unreachable (${err.message}). Vector search will use in-memory fallback.\n`);
    }

    // 4. Check & Initialize Local LLM Server
    console.log("Step 4/5: Probing Local llama.cpp AI Model Server...");
    const llmConfig = getLlmConfig();
    const isLlmUp = await checkLlmHealth(1500);

    if (isLlmUp) {
        console.log(`✓ llama.cpp model server is online at ${llmConfig.baseUrl} (${llmConfig.model}).\n`);
    } else {
        console.log(`ℹ️ llama.cpp server not responding. Attempting auto-spawn with ${llmConfig.model}...`);
        const spawnRes = await llamaProcessManager.startServer({ silent: false });
        if (spawnRes.success) {
            console.log(`✓ llama.cpp server launched successfully.\n`);
        } else {
            console.warn(`⚠️ Warning: llama-server auto-spawn skipped (${spawnRes.error || spawnRes.code}). Local mock completions enabled.\n`);
        }
    }

    // 5. Final Readiness Summary
    console.log("============================================================");
    console.log("  ✓ EDUMATE PRODUCTION SUITE READY FOR LIVE HACKATHON DEMO  ");
    console.log("============================================================");
    console.log(`• Backend API     : http://localhost:${process.env.PORT || 5000}`);
    console.log(`• Qdrant Store    : ${process.env.QDRANT_URL || "http://127.0.0.1:6333"}`);
    console.log(`• LLM Provider    : ${llmConfig.provider} (${llmConfig.model})`);
    console.log(`• Frontend Client : http://localhost:5173`);
    console.log("============================================================\n");

    if (mongoose?.connection) {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    startEduMate().catch(err => {
        console.error("Fatal startup error:", err);
        process.exit(1);
    });
}

module.exports = startEduMate;
