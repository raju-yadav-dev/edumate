// const groqProviderManager = require("../../services/groqProviderManager");

const { fetchWithTimeoutAndRetry } = require("../../utils/fetchHelper");

const getActiveModel = () => {
    const configured = process.env.GEMINI_COMPLETION_MODEL;
    if (!configured || configured === "gemini-2.5-flash") {
        return "gemini-3.5-flash";
    }
    return configured;
};

/*
 * Call Google Gemini generateContent API
const callGeminiCompletion = async (messages, options = {}) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set.");
    }
    const model = getActiveModel();
    
    const contents = [];
    let systemInstruction = "";
    
    for (const msg of messages) {
        if (msg.role === "system") {
            systemInstruction += (systemInstruction ? "\n" : "") + msg.content;
        } else {
            contents.push({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }]
            });
        }
    }
    
    const requestBody = {
        contents,
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: Number(options.maxOutputTokens) || Number(process.env.LLM_MAX_OUTPUT_TOKENS) || 500
        }
    };
    
    if (systemInstruction) {
        requestBody.systemInstruction = {
            parts: [{ text: systemInstruction }]
        };
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const response = await fetchWithTimeoutAndRetry(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
        },
        body: JSON.stringify(requestBody)
    });
    
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error?.message || `Gemini Completion failed with status ${response.status}`);
    }
    
    return payload.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

 * Call Google Gemini streamGenerateContent API
const callGeminiStream = async (messages, onChunk, options = {}) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set.");
    }
    const model = getActiveModel();
    
    const contents = [];
    let systemInstruction = "";
    
    for (const msg of messages) {
        if (msg.role === "system") {
            systemInstruction += (systemInstruction ? "\n" : "") + msg.content;
        } else {
            contents.push({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }]
            });
        }
    }
    
    const requestBody = {
        contents,
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: Number(options.maxOutputTokens) || Number(process.env.LLM_MAX_OUTPUT_TOKENS) || 500
        }
    };
    
    if (systemInstruction) {
        requestBody.systemInstruction = {
            parts: [{ text: systemInstruction }]
        };
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`;
    const response = await fetchWithTimeoutAndRetry(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
        },
        body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error?.message || `Gemini Stream failed with status ${response.status}`);
    }
    
    let fullText = "";
    let buffer = "";
    const decoder = new (require("util").TextDecoder || global.TextDecoder)("utf-8");
    
    for await (const chunk of response.body) {
        const text = typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
        buffer += text;
        
        let braceCount = 0;
        let startIdx = -1;
        for (let i = 0; i < buffer.length; i++) {
            if (buffer[i] === '{') {
                if (braceCount === 0) {
                    startIdx = i;
                }
                braceCount++;
            } else if (buffer[i] === '}') {
                braceCount--;
                if (braceCount === 0 && startIdx !== -1) {
                    const objStr = buffer.slice(startIdx, i + 1);
                    try {
                        const parsed = JSON.parse(objStr);
                        const textVal = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
                        if (textVal) {
                            fullText += textVal;
                            onChunk(textVal);
                        }
                    } catch (err) {
                        // Ignored: partial JSON blocks
                    }
                    buffer = buffer.slice(i + 1);
                    i = -1; // reset index to scan new buffer
                }
            }
        }
    }
    
    return fullText;
};
*/

const aiProviderManager = require("../../services/aiProviderManager");

// Ensure fallback API keys for legacy modules accessing process.env directly
if (!process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY_2 || "";
}
if (!process.env.GROQ_API_KEY) {
    process.env.GROQ_API_KEY = process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY_2 || "";
}

/**
 * Unified completion handler routing to the active LLM provider.
 * @param {Array<Object>} messages - Array of { role, content }
 * @param {Object} [options={}] - Optional parameter overrides
 * @returns {Promise<string>}
 */
function parseLlamaContent(content) {
    if (typeof content !== "string") return content;

    let trimmed = content.trim();
    
    // Clean markdown blocks if any
    trimmed = trimmed.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();

    // Extract JSON object/array boundaries defensively if it contains text before/after
    const startIdx = trimmed.indexOf("{");
    const endIdx = trimmed.lastIndexOf("}");
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        trimmed = trimmed.substring(startIdx, endIdx + 1);
    } else {
        const startArrIdx = trimmed.indexOf("[");
        const endArrIdx = trimmed.lastIndexOf("]");
        if (startArrIdx !== -1 && endArrIdx !== -1 && endArrIdx > startArrIdx) {
            trimmed = trimmed.substring(startArrIdx, endArrIdx + 1);
        }
    }

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            return JSON.parse(trimmed);
        } catch {
            return trimmed;
        }
    }

    return trimmed;
}

const fetch = (() => {
    try { return require("node-fetch"); } catch { return global.fetch; }
})();

// 5. Lightweight Health Check
async function checkLlamaHealth() {
    try {
        const res = await Promise.race([
            fetch("http://127.0.0.1:8080/v1/models"),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 500))
        ]);
        return res.ok;
    } catch (e) {
        return false;
    }
}

async function fetchLlamaCompletion(messages, onChunk) {
    const startTime = Date.now();
    
    const isHealthy = await checkLlamaHealth();
    if (!isHealthy) {
        throw {
            success: false,
            code: "LLAMA_TIMEOUT",
            message: "Local AI model did not respond in time."
        };
    }
    
    const controller = new AbortController();
    const prompt = messages && messages.length > 1 ? messages[1].content : (messages && messages[0] ? messages[0].content : "");
    
    const requestBody = {
        model: "Qwen3-4B-Instruct-Q4_K_M",
        messages: [
            { role: "system", content: "You are EduMate AI, a helpful university assistant." },
            { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 512,
        stream: true
    };

    let firstTokenReceived = false;
    let timeoutId = null;

    const sendRequest = async () => {
        const res = await fetch("http://127.0.0.1:8080/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        
        if (!res.ok) {
            throw new Error(`LLama returned status ${res.status}`);
        }
        
        return res;
    };

    try {
        const response = await sendRequest();
        
        // 30 seconds timeout
        timeoutId = setTimeout(() => {
            if (!firstTokenReceived) {
                console.log("[LLAMA] Stalled generation: Aborting request.");
                controller.abort();
            }
        }, 30000);

        let fullText = "";
        
        if (response.body && typeof response.body.getReader === "function") {
            const reader = response.body.getReader();
            const decoder = new (require("util").TextDecoder || global.TextDecoder)("utf-8");
            let buffer = "";
            
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }
                    
                    const text = decoder.decode(value, { stream: true });
                    buffer += text;
                    
                    const lines = buffer.split("\n");
                    buffer = lines.pop();
                    
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed === "data: [DONE]") continue;
                        
                        if (trimmed.startsWith("data: ")) {
                            const jsonStr = trimmed.slice(6);
                            try {
                                const parsed = JSON.parse(jsonStr);
                                const token = parsed.choices?.[0]?.delta?.content || "";
                                if (token) {
                                    if (!firstTokenReceived) {
                                        firstTokenReceived = true;
                                        clearTimeout(timeoutId);
                                        console.log(`[LLAMA] First Token: ${Date.now() - startTime}ms`);
                                    }
                                    fullText += token;
                                    if (onChunk) {
                                        onChunk(token);
                                    }
                                }
                            } catch (e) {}
                        }
                    }
                }
            } finally {
                try { reader.releaseLock(); } catch (e) {}
            }
        } else if (response.body && typeof response.body.on === "function") {
            const decoder = new (require("util").TextDecoder || global.TextDecoder)("utf-8");
            await new Promise((resolve, reject) => {
                response.body.on("data", (chunk) => {
                    const text = decoder.decode(chunk, { stream: true });
                    const lines = text.split("\n");
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed === "data: [DONE]") continue;
                        if (trimmed.startsWith("data: ")) {
                            try {
                                const parsed = JSON.parse(trimmed.slice(6));
                                const token = parsed.choices?.[0]?.delta?.content || "";
                                if (token) {
                                    if (!firstTokenReceived) {
                                        firstTokenReceived = true;
                                        clearTimeout(timeoutId);
                                        console.log(`[LLAMA] First Token: ${Date.now() - startTime}ms`);
                                    }
                                    fullText += token;
                                    if (onChunk) {
                                        onChunk(token);
                                    }
                                }
                            } catch (e) {}
                        }
                    }
                });
                response.body.on("end", () => resolve());
                response.body.on("error", (err) => reject(err));
            });
        } else {
            const text = await response.text();
            try {
                const parsed = JSON.parse(text);
                fullText = parsed.choices?.[0]?.message?.content || text;
            } catch (e) {
                fullText = text;
            }
            if (onChunk && fullText) {
                onChunk(fullText);
            }
        }

        clearTimeout(timeoutId);
        console.log(`[LLAMA] Complete: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
        console.log(`[TOTAL]: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
        
        return fullText;
    } catch (e) {
        clearTimeout(timeoutId);
        console.error("[LLAMA] Error or Timeout during generation:", e.message || e);
        throw {
            success: false,
            code: "LLAMA_TIMEOUT",
            message: "Local AI model did not respond in time."
        };
    }
}

const generateCompletion = async (messages, options = {}) => {
    return aiProviderManager.generateAIResponse(messages, null, options);
};

const generateStream = async (messages, onChunk, options = {}) => {
    return aiProviderManager.generateAIResponse(messages, onChunk, options);
};

module.exports = {
    generateCompletion,
    generateStream,
    parseLlamaContent,
    fetchLlamaCompletion
};
