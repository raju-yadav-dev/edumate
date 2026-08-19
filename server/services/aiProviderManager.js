const groqProviderManager = require("./groqProviderManager");
const geminiProviderManager = require("./geminiProviderManager");

/**
 * Unified generation entry point with rate limit/temporary error failover and load balancing.
 */
const generateAIResponse = async (messages, onChunk, options = {}) => {
    // Determine the primary provider from settings (gemini or groq, default is groq)
    const primaryProvider = (process.env.LLM_PROVIDER || "groq").toLowerCase().trim();
    
    // We will establish the order: [Primary, Secondary]
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
            if (groqConfigured.length === 0) {
                continue;
            }
            
            try {
                let result;
                if (onChunk) {
                    result = await groqProviderManager.generateStream({ messages, onChunk, ...options });
                } else {
                    result = await groqProviderManager.generateCompletion({ messages, ...options });
                }
                
                if (result.success) {
                    return result.content;
                } else {
                    failures.push(...(result.failures || []));
                }
            } catch (err) {
                failures.push({ provider: "groq", message: err.message });
            }
        } else if (provider === "gemini") {
            const geminiConfigured = await geminiProviderManager.getConfiguredProviders();
            if (geminiConfigured.length === 0) {
                continue;
            }
            
            try {
                let result;
                if (onChunk) {
                    result = await geminiProviderManager.generateStream({ messages, onChunk, ...options });
                } else {
                    result = await geminiProviderManager.generateCompletion({ messages, ...options });
                }
                
                if (result.success) {
                    return result.content;
                } else {
                    failures.push(...(result.failures || []));
                }
            } catch (err) {
                failures.push({ provider: "gemini", message: err.message });
            }
        }
    }
    
    const errSummary = failures.map(f => `[${f.provider || "Provider"}] ${f.message}`).join("; ");
    throw new Error(`All available LLM providers failed: ${errSummary || "No keys configured"}`);
};

/**
 * Returns formatted status objects for each provider without exposing API keys.
 */
const getAiProviderStatuses = () => {
    const groqStatuses = groqProviderManager.getKeyStatuses();
    const geminiStatuses = geminiProviderManager.getKeyStatuses();
    return [...groqStatuses, ...geminiStatuses];
};

module.exports = {
    generateAIResponse,
    getAiProviderStatuses,
    providers: []
};
