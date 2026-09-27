const chatService = require("../server/ai/services/chatService");

const testQueries = [
    { name: "1. Full form of BCA", question: "Full form of BCA." },
    { name: "2. What is Python?", question: "What is Python?" },
    { name: "3. BCA Admission Procedure", question: "What is the admission procedure for BCA?" },
    { name: "4. Search Faculty Members", question: "Search for faculty members." },
    { name: "5. Hello", question: "Hello." }
];

async function runDirectTest() {
    console.log("=== Testing chatService.askQuestion directly ===");
    for (const t of testQueries) {
        console.log(`\n\n>>>>>>>>>> RUNNING TEST: ${t.name} <<<<<<<<<<`);
        const startTime = Date.now();
        let chunkCount = 0;
        let streamedChars = 0;

        try {
            const result = await chatService.askQuestion({
                question: t.question,
                conversationId: "test_direct_" + Date.now(),
                onChunk: (token) => {
                    chunkCount++;
                    streamedChars += token.length;
                    process.stdout.write(token);
                },
                onStatus: (status, stage, extra) => {
                    console.log(`\n[Status: ${stage}] ${status}`);
                }
            });

            console.log(`\n\n--- Result for ${t.name} ---`);
            console.log("Time:", (Date.now() - startTime), "ms");
            console.log("Chunks streamed:", chunkCount, "Total Chars:", streamedChars);
            console.log("Confidence:", result.confidence);
            console.log("Sources count:", result.sources ? result.sources.length : 0);
            console.log("Answer snippet:", (result.message || "").substring(0, 150));
        } catch (err) {
            console.error(`\nFAILED ${t.name}:`, err.message, err.stack);
        }
    }
}

runDirectTest();
