const AI_CONSTANTS = require("../constants/aiConstants");

// Secure fetch selection to support both Node global fetch and node-fetch package
const fetch = (() => {
    try {
        return require("node-fetch");
    } catch {
        return global.fetch;
    }
})();

const getGeminiApiKey = () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.warn("WARNING: GEMINI_API_KEY environment variable is not set.");
    }
    return key;
};

/**
 * Generate completions via Google Gemini API
 * @param {Array<Object>} messages - Array of { role, content }
 * @param {Object} [options={}] - Optional parameter overrides
 * @returns {Promise<string>}
 */
const generateGeminiCompletion = async (messages, options = {}) => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set.");
    }

    const modelName = process.env.GEMINI_COMPLETION_MODEL || AI_CONSTANTS.COMPLETION_MODEL || "gemini-3.5-flash";
    let systemInstruction = "";
    const contents = [];

    // Map role tags to Gemini's expected format (user/model)
    for (const msg of messages) {
        if (msg.role === "system") {
            systemInstruction += (systemInstruction ? "\n" : "") + msg.content;
        } else {
            const geminiRole = msg.role === "assistant" ? "model" : "user";
            contents.push({
                role: geminiRole,
                parts: [{ text: msg.content }]
            });
        }
    }

    if (contents.length === 0) {
        contents.push({ role: "user", parts: [{ text: "Hello" }] });
    }

    const body = {
        contents,
        generationConfig: {
            temperature: options.temperature !== undefined ? options.temperature : 0.2,
            maxOutputTokens: options.maxOutputTokens || 1000
        }
    };

    if (systemInstruction) {
        body.systemInstruction = {
            parts: [{ text: systemInstruction }]
        };
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.error?.message || `Gemini Completion API error: ${response.status}`);
    }

    return payload.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

/**
 * Generate completions via Ollama chat API
 * @param {Array<Object>} messages - Array of { role, content }
 * @param {Object} [options={}] - Optional parameter overrides
 * @returns {Promise<string>}
 */
const generateOllamaCompletion = async (messages, options = {}) => {
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const model = process.env.OLLAMA_MODEL || "llama3.2:3b";

    const formattedMessages = messages.map(msg => ({
        role: msg.role === "system" ? "system" : msg.role === "assistant" ? "assistant" : "user",
        content: msg.content
    }));

    const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model,
            messages: formattedMessages,
            stream: false,
            options: {
                temperature: options.temperature !== undefined ? options.temperature : 0.2,
                num_predict: options.maxOutputTokens || 1000
            }
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Ollama API error status ${response.status}: ${errText || "Unknown error"}`);
    }

    const payload = await response.json();
    return payload.message?.content || "";
};

/**
 * Unified completion handler supporting configured providers with automated fallback.
 * @param {Array<Object>} messages
 * @param {Object} [options={}]
 * @returns {Promise<string>}
 */
const generateCompletion = async (messages, options = {}) => {
    const provider = process.env.LLM_PROVIDER || "gemini";

    if (provider === "ollama") {
        try {
            console.log(`[LLM Service] Attempting completion via Ollama (Model: ${process.env.OLLAMA_MODEL || "llama3.2:3b"})...`);
            return await generateOllamaCompletion(messages, options);
        } catch (error) {
            console.error(`[LLM Service] Ollama generation failed/unavailable: "${error.message}".`);
            if (process.env.GEMINI_API_KEY) {
                console.log("[LLM Service] Automatically falling back to Gemini...");
                return await generateGeminiCompletion(messages, options);
            } else {
                throw new Error(`Ollama generation failed: ${error.message}. Gemini fallback skipped because GEMINI_API_KEY is not set.`);
            }
        }
    } else {
        console.log(`[LLM Service] Attempting completion via Gemini (Model: ${process.env.GEMINI_COMPLETION_MODEL || AI_CONSTANTS.COMPLETION_MODEL || "gemini-3.5-flash"})...`);
        return await generateGeminiCompletion(messages, options);
    }
};

module.exports = {
    generateCompletion,
    generateOllamaCompletion,
    generateGeminiCompletion
};
