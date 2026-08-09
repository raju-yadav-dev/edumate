const groqProviderManager = require("../../services/groqProviderManager");

// Secure fetch selection to support both Node global fetch and node-fetch package
const fetch = (() => {
    try {
        return require("node-fetch");
    } catch {
        return global.fetch;
    }
})();

/**
 * Call Google Gemini generateContent API
 */
const callGeminiCompletion = async (messages, options = {}) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set.");
    }
    const model = process.env.GEMINI_COMPLETION_MODEL || "gemini-3.5-flash";
    
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
            maxOutputTokens: 900
        }
    };
    
    if (systemInstruction) {
        requestBody.systemInstruction = {
            parts: [{ text: systemInstruction }]
        };
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
    });
    
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error?.message || `Gemini Completion failed with status ${response.status}`);
    }
    
    return payload.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

/**
 * Call Google Gemini streamGenerateContent API
 */
const callGeminiStream = async (messages, onChunk, options = {}) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set.");
    }
    const model = process.env.GEMINI_COMPLETION_MODEL || "gemini-3.5-flash";
    
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
            maxOutputTokens: 900
        }
    };
    
    if (systemInstruction) {
        requestBody.systemInstruction = {
            parts: [{ text: systemInstruction }]
        };
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

/**
 * Call local Ollama chat API
 */
const callOllamaCompletion = async (messages, options = {}) => {
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const model = process.env.OLLAMA_MODEL || "llama3.2:3b";
    
    const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model,
            messages,
            stream: false,
            options: {
                temperature: 0.2
            }
        })
    });
    
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Ollama failed with status ${response.status}: ${errText}`);
    }
    
    const payload = await response.json();
    return payload.message?.content || "";
};

/**
 * Call local Ollama streaming chat API
 */
const callOllamaStream = async (messages, onChunk, options = {}) => {
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const model = process.env.OLLAMA_MODEL || "llama3.2:3b";
    
    const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model,
            messages,
            stream: true,
            options: {
                temperature: 0.2
            }
        })
    });
    
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Ollama stream failed with status ${response.status}: ${errText}`);
    }
    
    const decoder = new (require("util").TextDecoder || global.TextDecoder)("utf-8");
    let buffer = "";
    let fullText = "";
    
    for await (const chunk of response.body) {
        const text = typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
        buffer += text;
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
                const parsed = JSON.parse(trimmed);
                const content = parsed.message?.content || "";
                if (content) {
                    fullText += content;
                    onChunk(content);
                }
            } catch (err) {}
        }
    }
    return fullText;
};

/**
 * Unified completion handler calling Groq with fallback to Gemini and Ollama.
 * @param {Array<Object>} messages - Array of { role, content }
 * @param {Object} [options={}] - Optional parameter overrides
 * @returns {Promise<string>}
 */
const generateCompletion = async (messages, options = {}) => {
    const timeoutMs = options.timeoutMs || 25000;
    const provider = process.env.LLM_PROVIDER || "groq";
    
    console.log(`[LLM Service] Requesting completion via primary provider: ${provider}...`);
    
    const errors = [];
    
    // Ordered providers list based on primary selection
    const providersToTry = [provider];
    if (provider !== "groq") providersToTry.push("groq");
    if (provider !== "gemini") providersToTry.push("gemini");
    if (provider !== "ollama") providersToTry.push("ollama");

    for (const activeProvider of providersToTry) {
        try {
            if (activeProvider === "groq") {
                const result = await groqProviderManager.generateCompletion({ messages, timeoutMs });
                if (result.success) {
                    return result.content;
                }
                const errorMsg = result.failures && result.failures.length > 0
                    ? result.failures.map(f => `[${f.provider}] Attempt ${f.attempt}: ${f.message}`).join("; ")
                    : "No working Groq API keys available.";
                throw new Error(errorMsg);
            } else if (activeProvider === "gemini") {
                return await callGeminiCompletion(messages, options);
            } else if (activeProvider === "ollama") {
                return await callOllamaCompletion(messages, options);
            }
        } catch (err) {
            console.warn(`[LLM Service] Provider '${activeProvider}' failed: ${err.message}. Trying next available provider...`);
            errors.push({ provider: activeProvider, message: err.message });
        }
    }

    const combinedError = errors.map(e => `[${e.provider}]: ${e.message}`).join(" | ");
    throw new Error(`LLM Service failed all providers. Details: ${combinedError}`);
};

const generateStream = async (messages, onChunk, options = {}) => {
    const timeoutMs = options.timeoutMs || 25000;
    const signal = options.signal;
    const provider = process.env.LLM_PROVIDER || "groq";

    console.log(`[LLM Service] Requesting streaming completion via primary provider: ${provider}...`);
    
    const errors = [];
    
    const providersToTry = [provider];
    if (provider !== "groq") providersToTry.push("groq");
    if (provider !== "gemini") providersToTry.push("gemini");
    if (provider !== "ollama") providersToTry.push("ollama");

    for (const activeProvider of providersToTry) {
        try {
            if (activeProvider === "groq") {
                const result = await groqProviderManager.generateStream({ messages, onChunk, timeoutMs, signal });
                if (result.success) {
                    return result.content;
                }
                const errorMsg = result.failures && result.failures.length > 0
                    ? result.failures.map(f => `[${f.provider}] Attempt ${f.attempt}: ${f.message}`).join("; ")
                    : "No working Groq API keys available.";
                throw new Error(errorMsg);
            } else if (activeProvider === "gemini") {
                return await callGeminiStream(messages, onChunk, options);
            } else if (activeProvider === "ollama") {
                return await callOllamaStream(messages, onChunk, options);
            }
        } catch (err) {
            console.warn(`[LLM Service] Streaming provider '${activeProvider}' failed: ${err.message}. Trying next available provider...`);
            errors.push({ provider: activeProvider, message: err.message });
        }
    }

    const combinedError = errors.map(e => `[${e.provider}]: ${e.message}`).join(" | ");
    throw new Error(`LLM Service streaming failed all providers. Details: ${combinedError}`);
};

module.exports = {
    generateCompletion,
    generateStream
};
