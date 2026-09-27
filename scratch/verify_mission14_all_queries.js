require("dotenv").config();
const mongoose = require("mongoose");
const chatService = require("../server/ai/services/chatService");

async function verifyAll() {
    if (process.env.MONGODB_URI) {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB.");
    }

    const testQueries = [
        "Full form of BCA.",
        "What is Python?",
        "What is the admission procedure for BCA?",
        "Hello."
    ];

    const results = [];

    for (const q of testQueries) {
        console.log(`\n==============================================`);
        console.log(`TESTING QUERY: "${q}"`);
        console.log(`==============================================`);

        let streamedChunks = 0;
        let streamedChars = 0;

        const res = await chatService.askQuestion({
            question: q,
            user: { _id: "660000000000000000000001", fullName: "Test Student", role: "student", institution: "Brainware University" },
            onChunk: (chunk) => {
                streamedChunks++;
                streamedChars += chunk.length;
            }
        });

        console.log(`\n>>> RESULT FOR: "${q}" <<<`);
        console.log(`Answer: ${res.message}`);
        console.log(`Confidence: ${res.confidence}`);
        console.log(`SourceLabel: ${res.sourceLabel}`);
        console.log(`Sources Count: ${res.sources?.length || 0}`);
        console.log(`Streamed Chunks: ${streamedChunks}, Streamed Chars: ${streamedChars}`);
        console.log(`Response Time: ${res.responseTimeMs}ms`);

        results.push({
            query: q,
            answer: res.message,
            confidence: res.confidence,
            sourcesCount: res.sources?.length || 0,
            streamedChunks,
            valid: Boolean(res.message && res.message.trim().length > 0)
        });
    }

    console.log("\n==============================================");
    console.log("SUMMARY OF ALL 4 TEST QUESTIONS:");
    console.log("==============================================");
    results.forEach((r, idx) => {
        console.log(`\n[Test ${idx + 1}] "${r.query}"`);
        console.log(`Valid Answer: ${r.valid ? '✅ YES' : '❌ NO'}`);
        console.log(`Confidence: ${r.confidence}`);
        console.log(`Sources: ${r.sourcesCount}`);
        console.log(`Preview: ${r.answer.slice(0, 150)}...`);
    });

    if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
    }
}

verifyAll().catch(console.error);
