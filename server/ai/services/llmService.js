const groqProviderManager = require("../../services/groqProviderManager");

/**
 * Unified completion handler calling Groq with automated API key rotation.
 * @param {Array<Object>} messages - Array of { role, content }
 * @param {Object} [options={}] - Optional parameter overrides
 * @returns {Promise<string>}
 */
const generateCompletion = async (messages, options = {}) => {
    console.log("[LLM Service] Requesting completion via Groq provider manager...");
    const timeoutMs = options.timeoutMs || 25000;
    
    const result = await groqProviderManager.generateCompletion({
        messages,
        timeoutMs
    });

    if (!result.success) {
        const errorMsg = result.failures && result.failures.length > 0
            ? result.failures.map(f => `[${f.provider}] Attempt ${f.attempt}: ${f.message} (Status: ${f.statusCode})`).join("; ")
            : "No working Groq API keys available.";
        throw new Error(`Groq Completion Failed: ${errorMsg}`);
    }

    return result.content;
};

const generateStream = async (messages, onChunk, options = {}) => {
    console.log("[LLM Service] Requesting streaming completion via Groq provider manager...");
    const timeoutMs = options.timeoutMs || 25000;
    const signal = options.signal;

    const result = await groqProviderManager.generateStream({
        messages,
        onChunk,
        timeoutMs,
        signal
    });

    if (!result.success) {
        const errorMsg = result.failures && result.failures.length > 0
            ? result.failures.map(f => `[${f.provider}] Attempt ${f.attempt}: ${f.message} (Status: ${f.statusCode})`).join("; ")
            : "No working Groq API keys available.";
        throw new Error(`Groq Completion Failed: ${errorMsg}`);
    }

    return result.content;
};

module.exports = {
    generateCompletion,
    generateStream
};
