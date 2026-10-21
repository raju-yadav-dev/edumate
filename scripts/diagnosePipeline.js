const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const chatService = require("../server/ai/services/chatService");
const SearchManager = require("../server/knowledge/SearchManager");
const RankingEngine = require("../server/knowledge/RankingEngine");
const { planQuery } = require("../server/ai/utils/queryPlanner");
const { normalizeQueryText, detectIntent } = require("../server/ai/utils/queryParser");

const testQueries = [
    "Where is the VFX lab?",
    "What is the room number of Photography Lab?",
    "Which building is the VFX lab in?",
    "What is the room number and floor of the VFX lab?",
    "Who is the HOD of Psychology?",
    "What is BCA?",
    "What is BCA and what are its fees at my university?"
];

async function runDiagnosis() {
    console.log("================================================================================");
    console.log("       EDUMATE PIPELINE DIAGNOSTIC: COMPLETE QUERY TRACE");
    console.log("================================================================================\n");

    await mongoose.connect(process.env.MONGODB_URI);

    const testUser = {
        _id: new mongoose.Types.ObjectId(),
        role: "student",
        institution: "Brainware University",
        fullName: "Diagnostic User"
    };

    for (let i = 0; i < testQueries.length; i++) {
        const q = testQueries[i];
        console.log(`\n================================================================================`);
        console.log(`[QUERY ${i+1}/${testQueries.length}]: "${q}"`);
        console.log(`================================================================================`);

        const norm = normalizeQueryText(q);
        const intent = detectIntent(norm);
        const plan = planQuery(norm, { intent, user: testUser });
        console.log(`- Normalized Query: "${norm}"`);
        console.log(`- Detected Intent: ${intent}`);
        console.log(`- Plan Route: ${plan.route} | Mode: ${plan.mode} | SkipRag: ${plan.skipRag}`);

        // Qdrant retrieval & reranking if not skipRag
        if (!plan.skipRag) {
            const rawChunks = await SearchManager.searchLocalPdfs(norm, testUser, 6);
            console.log(`- Qdrant Raw Chunks Retrieved: ${rawChunks.length}`);
            rawChunks.forEach((c, idx) => {
                console.log(`    [Raw ${idx+1}] ID: ${c.id} | Score: ${c.score} | File: ${c.metadata?.filename || c.metadata?.originalName} | Heading: "${c.metadata?.heading}"`);
                console.log(`      Snippet: ${String(c.content || "").slice(0, 150).replace(/\n/g, " ")}`);
            });

            const ranked = await RankingEngine.rerankCandidates(norm, rawChunks, testUser);
            console.log(`- Reranked Order:`);
            ranked.forEach((c, idx) => {
                console.log(`    [Rank ${idx+1}] ID: ${c.id} | Score: ${c.score} | EntityScore: ${c.rankingSignals?.entityScore} | Heading: "${c.metadata?.heading}"`);
            });
        }

        // Live ChatService run with timing
        const t0 = Date.now();
        try {
            const conversationId = new mongoose.Types.ObjectId().toString();
            const res = await chatService.askQuestion({
                user: testUser,
                question: q,
                conversationId
            });
            const totalMs = Date.now() - t0;

            console.log(`\n- Live Result:`);
            console.log(`    Answer: "${res.message || res.answer}"`);
            console.log(`    Sources Count: ${res.sources?.length || 0}`);
            if (res.sources && res.sources.length > 0) {
                res.sources.forEach((s, idx) => {
                    console.log(`      [Source ${idx+1}] Title: ${s.title || s.documentTitle} | Ref: ${s.reference} | Section: ${s.sectionHeading || s.section}`);
                });
            }
            console.log(`    Confidence: ${res.confidence}`);
            console.log(`    SourceLabel: ${res.sourceLabel}`);
            console.log(`    Latency: ${totalMs}ms`);
        } catch (err) {
            console.error(`- Live Ask Error:`, err.message);
        }
    }

    await mongoose.disconnect();
    console.log("\n================================================================================");
    console.log("       DIAGNOSIS COMPLETE");
    console.log("================================================================================");
}

runDiagnosis().catch(err => {
    console.error("Diagnosis Fatal Error:", err);
    process.exit(1);
});
