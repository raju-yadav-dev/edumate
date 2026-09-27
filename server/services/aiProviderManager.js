// ===== Disabled: Gemini Provider =====
// const geminiProviderManager = require("./geminiProviderManager");

// ===== Disabled: Groq Provider =====
// const groqProviderManager = require("./groqProviderManager");

const llamaCppProvider = require("./llamaCppProvider");
const { getLlmConfig } = require("../config/llm");

/**
 * Unified generation entry point routing to production llama.cpp provider.
 */
const generateAIResponse = async (messages, onChunk, options = {}) => {
    return llamaCppProvider.generateCompletion(messages, onChunk, options);
};

/**
 * Returns formatted status objects for each provider without exposing API keys.
 */
const getAiProviderStatuses = async () => {
    const { getLlmConfig, getLlmHealthStatus } = require("../config/llm");
    const health = await getLlmHealthStatus(1000);
    const config = getLlmConfig();
    return [
        {
            name: `${config.provider} (${config.model})`,
            status: health.online ? "Available" : "Unavailable",
            displayStatus: health.status,
            endpoint: config.baseUrl,
            failureReason: health.reason,
            cooldownUntil: null
        }
    ];
};

module.exports = {
    generateAIResponse,
    getAiProviderStatuses,
    providers: []
};

