const http = require("http");

const BASE_URL = "http://127.0.0.1:5000";

const testQueries = [
    { name: "1. Full form of BCA", message: "Full form of BCA.", expectedType: "general" },
    { name: "2. What is Python?", message: "What is Python?", expectedType: "general" },
    { name: "3. BCA Admission Procedure", message: "What is the admission procedure for BCA?", expectedType: "rag" },
    { name: "4. Search Faculty Members", message: "Search for faculty members.", expectedType: "rag" },
    { name: "5. Hello", message: "Hello.", expectedType: "general" }
];

async function checkHealth() {
    console.log("=== Checking Local AI & Backend Health ===");
    try {
        const res = await fetch(`${BASE_URL}/api/system/health`);
        const data = await res.json();
        console.log("Health status:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.log("Health check fetch error:", e.message);
    }
}

function streamChat(query) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            question: query.message,
            message: query.message,
            conversationId: "mission14_3_test_" + Date.now(),
            stream: true
        });

        const url = new URL(`${BASE_URL}/api/chat/ask`);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload)
            }
        };

        const startTime = Date.now();
        let firstTokenTime = null;
        let tokenCount = 0;
        let fullText = "";
        let events = [];

        const req = http.request(options, (res) => {
            res.setEncoding("utf8");

            let buffer = "";

            res.on("data", (chunk) => {
                buffer += chunk;
                const lines = buffer.split("\n");
                buffer = lines.pop(); // keep incomplete line

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const raw = line.slice(6).trim();
                        if (raw === "[DONE]") continue;
                        try {
                            const parsed = JSON.parse(raw);
                            events.push(parsed.type || parsed.event || "unknown");

                            if (parsed.type === "chunk" || parsed.event === "stream_token") {
                                const text = parsed.content || parsed.token || "";
                                if (text) {
                                    if (!firstTokenTime) {
                                        firstTokenTime = Date.now() - startTime;
                                    }
                                    tokenCount++;
                                    fullText += text;
                                }
                            } else if (parsed.type === "done" || parsed.event === "completed") {
                                if (parsed.message && !fullText) {
                                    fullText = parsed.message;
                                }
                            } else if (parsed.type === "error") {
                                console.log(`      [SSE Error Event]:`, parsed.message || parsed.error);
                            }
                        } catch (err) {
                            // not json
                        }
                    }
                }
            });

            res.on("end", () => {
                const totalDuration = Date.now() - startTime;
                const tps = tokenCount > 0 && totalDuration > 0 ? ((tokenCount / (totalDuration / 1000))).toFixed(1) : "N/A";
                resolve({
                    query: query.name,
                    statusCode: res.statusCode,
                    firstTokenTimeMs: firstTokenTime,
                    totalDurationMs: totalDuration,
                    tokenCount,
                    tps,
                    events: [...new Set(events)],
                    fullText: fullText.trim()
                });
            });
        });

        req.on("error", (err) => {
            reject(err);
        });

        req.write(payload);
        req.end();
    });
}

async function runAll() {
    await checkHealth();

    console.log("\n==================================================");
    console.log("Starting Mission 14.3 Verification Tests (5 Questions)");
    console.log("==================================================\n");

    const results = [];

    for (const q of testQueries) {
        console.log(`\n--- Testing: ${q.name} [Query: "${q.message}"] ---`);
        try {
            const res = await streamChat(q);
            console.log(`Status: HTTP ${res.statusCode}`);
            console.log(`TTFT (First Token): ${res.firstTokenTimeMs}ms`);
            console.log(`Total Duration: ${res.totalDurationMs}ms`);
            console.log(`Token Count: ${res.tokenCount} (Speed: ${res.tps} tok/sec)`);
            console.log(`Events Received: ${res.events.join(", ")}`);
            console.log(`Response Snippet:\n"${res.fullText.substring(0, 200)}..."\n`);

            const pass = res.statusCode === 200 && res.fullText.length > 10 && !res.fullText.includes("Local AI model unavailable") && !res.fullText.includes("Unable to generate response");
            results.push({ ...res, pass });
        } catch (err) {
            console.error(`FAILED for ${q.name}:`, err.message);
            results.push({ query: q.name, pass: false, error: err.message });
        }
    }

    console.log("\n==================================================");
    console.log("                 TEST SUMMARY");
    console.log("==================================================");
    let allPassed = true;
    for (const r of results) {
        const mark = r.pass ? "[PASS]" : "[FAIL]";
        if (!r.pass) allPassed = false;
        console.log(`${mark} ${r.query} -> TTFT: ${r.firstTokenTimeMs || 'N/A'}ms, Total: ${r.totalDurationMs || 'N/A'}ms, Tokens: ${r.tokenCount || 0}`);
        if (!r.pass && r.error) console.log(`       Error: ${r.error}`);
    }
    console.log("==================================================");
    console.log(`OVERALL RESULT: ${allPassed ? "ALL 5 TESTS PASSED SUCCESSFULLY!" : "SOME TESTS FAILED"}`);
}

runAll();
