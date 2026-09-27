const http = require("http");

const requestBody = {
    model: "qwen3-1.7b-instruct-q4_k_m.gguf",
    messages: [
        { role: "system", content: "You are EduMate AI." },
        { role: "user", content: "Full form of BCA." }
    ],
    temperature: 0.2,
    max_tokens: 150,
    stream: true
};

const payload = JSON.stringify(requestBody);

const startTime = Date.now();
let firstTokenTime = null;
let fullText = "";
let reasoning = "";

const req = http.request({
    hostname: "127.0.0.1",
    port: 8080,
    path: "/v1/chat/completions",
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "Connection": "keep-alive"
    }
}, (res) => {
    console.log("Connected to llama-server, status:", res.statusCode);
    res.setEncoding("utf8");

    let buffer = "";
    res.on("data", (chunk) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]") continue;
            if (trimmed.startsWith("data: ")) {
                try {
                    const parsed = JSON.parse(trimmed.slice(6));
                    const deltaContent = parsed.choices?.[0]?.delta?.content || "";
                    const deltaReasoning = parsed.choices?.[0]?.delta?.reasoning_content || "";

                    if (!firstTokenTime && (deltaContent || deltaReasoning)) {
                        firstTokenTime = Date.now() - startTime;
                        console.log(`\n[FIRST TOKEN LATENCY]: ${firstTokenTime}ms\n`);
                    }

                    if (deltaReasoning) {
                        reasoning += deltaReasoning;
                        process.stdout.write(".");
                    }

                    if (deltaContent) {
                        fullText += deltaContent;
                        process.stdout.write(deltaContent);
                    }
                } catch (e) {}
            }
        }
    });

    res.on("end", () => {
        const totalDuration = Date.now() - startTime;
        console.log(`\n\n[TOTAL TIME]: ${totalDuration}ms`);
        console.log("Full text length:", fullText.length);
        console.log("Reasoning length:", reasoning.length);
    });
});

req.on("error", (err) => {
    console.error("HTTP error:", err);
});

req.write(payload);
req.end();
