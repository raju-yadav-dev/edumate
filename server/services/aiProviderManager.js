const llamaCppProvider = require("./llamaCppProvider");
const geminiProviderManager = require("./geminiProviderManager");
const groqProviderManager = require("./groqProviderManager");
const { getLlmConfig } = require("../config/llm");

/**
 * High-Availability Multi-Provider AI Orchestrator
 * Supports llama.cpp, Groq, Gemini, and Ollama with seamless streaming & failover.
 */

const getActiveProviderName = (options = {}) => {
    return (options.provider || process.env.LLM_PROVIDER || process.env.LLAMA_PROVIDER || "llama").toLowerCase().trim();
};

/**
 * Unified generation entry point with streaming and failover support.
 */
const generateAIResponse = async (messages, onChunk = null, options = {}) => {
    const activeProvider = getActiveProviderName(options);
    const maxTokens = options.maxTokens || options.max_tokens || 512;
    const timeoutMs = options.timeoutMs || options.timeout || Number(process.env.LLM_TIMEOUT) || 60000;

    // 1. Route to requested provider
    if (activeProvider === "groq") {
        try {
            if (onChunk) {
                const res = await groqProviderManager.generateStream({ messages, onChunk, timeoutMs, maxOutputTokens: maxTokens, signal: options.signal });
                if (res.success && res.content) return res.content;
            } else {
                const res = await groqProviderManager.generateCompletion({ messages, timeoutMs, maxOutputTokens: maxTokens });
                if (res.success && res.content) return res.content;
            }
        } catch (err) {
            console.warn(`[AI Provider Manager] Groq generation failed (${err.message}). Checking failover options...`);
        }
    } else if (activeProvider === "gemini") {
        try {
            if (onChunk) {
                const res = await geminiProviderManager.generateStream({ messages, onChunk, timeoutMs, maxOutputTokens: maxTokens, signal: options.signal });
                if (res.success && res.content) return res.content;
            } else {
                const res = await geminiProviderManager.generateCompletion({ messages, timeoutMs, maxOutputTokens: maxTokens });
                if (res.success && res.content) return res.content;
            }
        } catch (err) {
            console.warn(`[AI Provider Manager] Gemini generation failed (${err.message}). Checking failover options...`);
        }
    } else {
        // Default: llama.cpp
        try {
            return await llamaCppProvider.generateCompletion(messages, onChunk, options);
        } catch (llamaErr) {
            console.warn(`[AI Provider Manager] llama.cpp is offline or error (${llamaErr.message}). Checking configured fallback providers...`);
            
            // Check if Groq is configured
            if (process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_1) {
                try {
                    console.log("[AI Provider Manager] Failing over to Groq...");
                    if (onChunk) {
                        const res = await groqProviderManager.generateStream({ messages, onChunk, timeoutMs, maxOutputTokens: maxTokens, signal: options.signal });
                        if (res.success && res.content) return res.content;
                    } else {
                        const res = await groqProviderManager.generateCompletion({ messages, timeoutMs, maxOutputTokens: maxTokens });
                        if (res.success && res.content) return res.content;
                    }
                } catch (groqErr) {
                    console.warn(`[AI Provider Manager] Groq failover failed: ${groqErr.message}`);
                }
            }

            // Check if Gemini is configured
            if (process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1) {
                try {
                    console.log("[AI Provider Manager] Failing over to Gemini...");
                    if (onChunk) {
                        const res = await geminiProviderManager.generateStream({ messages, onChunk, timeoutMs, maxOutputTokens: maxTokens, signal: options.signal });
                        if (res.success && res.content) return res.content;
                    } else {
                        const res = await geminiProviderManager.generateCompletion({ messages, timeoutMs, maxOutputTokens: maxTokens });
                        if (res.success && res.content) return res.content;
                    }
                } catch (geminiErr) {
                    console.warn(`[AI Provider Manager] Gemini failover failed: ${geminiErr.message}`);
                }
            }

            throw llamaErr;
        }
    }

    return "";
};

/**
 * Returns formatted status objects for each provider without exposing API keys.
 */
const getAiProviderStatuses = async () => {
    const { getLlmConfig, getLlmHealthStatus } = require("../config/llm");
    const health = await getLlmHealthStatus(1000);
    const config = getLlmConfig();

    const statuses = [
        {
            name: `llama.cpp (${config.model})`,
            provider: "llama",
            status: health.online ? "Available" : "Unavailable",
            displayStatus: health.status,
            endpoint: config.baseUrl,
            failureReason: health.reason,
            cooldownUntil: null
        }
    ];

    // Append Gemini key statuses
    try {
        const geminiStatuses = geminiProviderManager.getKeyStatuses();
        geminiStatuses.forEach(k => {
            statuses.push({
                name: k.name,
                provider: "gemini",
                status: k.status,
                displayStatus: k.status,
                endpoint: "https://generativelanguage.googleapis.com",
                failureReason: k.failureReason,
                cooldownUntil: k.cooldownUntil
            });
        });
    } catch (_) {}

    // Append Groq key statuses
    try {
        const groqStatuses = groqProviderManager.getKeyStatuses();
        groqStatuses.forEach(k => {
            statuses.push({
                name: k.name,
                provider: "groq",
                status: k.status,
                displayStatus: k.status,
                endpoint: "https://api.groq.com",
                failureReason: k.failureReason,
                cooldownUntil: k.cooldownUntil
            });
        });
    } catch (_) {}

    return statuses;
};

module.exports = {
    generateAIResponse,
    getAiProviderStatuses,
    providers: []
};

