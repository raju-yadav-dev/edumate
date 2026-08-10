const groqProviderManager = require("../../services/groqProviderManager");

// Secure fetch selection to support both Node global fetch and node-fetch package
const fetch = (() => {
    try {
        return require("node-fetch");
    } catch {
        return global.fetch;
    }
})();

const getActiveModel = () => {
    const configured = process.env.GEMINI_COMPLETION_MODEL;
    if (!configured || configured === "gemini-2.5-flash") {
        return "gemini-3.5-flash";
    }
    return configured;
};

/**
 * Call Google Gemini generateContent API
 */
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
            maxOutputTokens: 900
        }
    };
    
    if (systemInstruction) {
        requestBody.systemInstruction = {
            parts: [{ text: systemInstruction }]
        };
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const response = await fetch(url, {
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

/**
 * Call Google Gemini streamGenerateContent API
 */
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
            maxOutputTokens: 900
        }
    };
    
    if (systemInstruction) {
        requestBody.systemInstruction = {
            parts: [{ text: systemInstruction }]
        };
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`;
    const response = await fetch(url, {
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

/**
 * Unified completion handler calling Gemini.
 * @param {Array<Object>} messages - Array of { role, content }
 * @param {Object} [options={}] - Optional parameter overrides
 * @returns {Promise<string>}
 */
const generateCompletion = async (messages, options = {}) => {
    const model = getActiveModel();
    const apiKey = process.env.GEMINI_API_KEY;
    const authStatus = apiKey ? "API key configured" : "API key missing";
    
    try {
        const result = await callGeminiCompletion(messages, options);
        console.log(`Provider: gemini`);
        console.log(`Model: ${model}`);
        console.log(`Authentication: ${authStatus}`);
        console.log(`Request: SUCCESS`);
        return result;
    } catch (err) {
        console.log(`Provider: gemini`);
        console.log(`Model: ${model}`);
        console.log(`Authentication: ${authStatus}`);
        console.log(`Request: FAILED`);
        throw err;
    }
};

const generateStream = async (messages, onChunk, options = {}) => {
    const model = getActiveModel();
    const apiKey = process.env.GEMINI_API_KEY;
    const authStatus = apiKey ? "API key configured" : "API key missing";
    
    try {
        const result = await callGeminiStream(messages, onChunk, options);
        console.log(`Provider: gemini`);
        console.log(`Model: ${model}`);
        console.log(`Authentication: ${authStatus}`);
        console.log(`Request: SUCCESS`);
        return result;
    } catch (err) {
        console.log(`Provider: gemini`);
        console.log(`Model: ${model}`);
        console.log(`Authentication: ${authStatus}`);
        console.log(`Request: FAILED`);
        throw err;
    }
};

module.exports = {
    generateCompletion,
    generateStream
};
