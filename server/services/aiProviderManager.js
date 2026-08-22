// ===== Disabled: Gemini Provider =====
// const geminiProviderManager = require("./geminiProviderManager");

// ===== Disabled: Groq Provider =====
// const groqProviderManager = require("./groqProviderManager");

const llama = require("../config/llama");

/**
 * Unified generation entry point with rate limit/temporary error failover and load balancing.
 */
function parseLlamaContent(content) {
    if (typeof content !== "string") return content;

    const trimmed = content.trim();

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            return JSON.parse(trimmed);
        } catch {
            return trimmed;
        }
    }

    return trimmed;
}

const generateAIResponse = async (messages, onChunk, options = {}) => {
    // Commented out Groq and Gemini selection logic:
    /*
    const primaryProvider = (process.env.LLM_PROVIDER || "groq").toLowerCase().trim();
    const order = [];
    if (primaryProvider === "gemini") {
        order.push("gemini", "groq");
    } else {
        order.push("groq", "gemini");
    }
    const failures = [];
    for (const provider of order) {
        if (provider === "groq") {
            const groqConfigured = await groqProviderManager.getConfiguredProviders();
            ...
        }
    }
    */

    // llama.cpp local call integration:
    const prompt = messages && messages.length > 1 ? messages[1].content : (messages && messages[0] ? messages[0].content : "");
    const completion = await llama.chat.completions.create({
      model: "Qwen3-4B-Instruct-Q4_K_M",
      messages: [
        {
          role: "system",
          content: "You are EduMate AI, a university assistant."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 512,
    });

    let reply = "";
    if (completion && completion.choices && completion.choices[0] && completion.choices[0].message) {
        reply = completion.choices[0].message.content;
    } else if (completion && completion.data && completion.data.choices && completion.data.choices[0] && completion.data.choices[0].message) {
        reply = completion.data.choices[0].message.content;
    } else {
        const parsed = parseLlamaContent(completion);
        if (parsed && parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
            reply = parsed.choices[0].message.content;
        } else if (parsed && parsed.data && parsed.data.choices && parsed.data.choices[0] && parsed.data.choices[0].message) {
            reply = parsed.data.choices[0].message.content;
        } else {
            reply = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
        }
    }

    if (onChunk) {
        onChunk(reply);
    }
    return reply;
};

/**
 * Returns formatted status objects for each provider without exposing API keys.
 */
const getAiProviderStatuses = () => {
    // Commented out Groq/Gemini key check:
    /*
    const groqStatuses = groqProviderManager.getKeyStatuses();
    const geminiStatuses = geminiProviderManager.getKeyStatuses();
    return [...groqStatuses, ...geminiStatuses];
    */
    return [
        {
            name: "Llama.cpp (Local Qwen)",
            status: "Available",
            failureReason: null,
            cooldownUntil: null
        }
    ];
};

module.exports = {
    generateAIResponse,
    getAiProviderStatuses,
    providers: []
};
