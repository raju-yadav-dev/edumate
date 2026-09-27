const settingsService = require("./settingsService");

const { fetchWithTimeoutAndRetry } = require("../utils/fetchHelper");

const sleep = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

const getCooldownDuration = () => {
    return Number(process.env.AI_PROVIDER_KEY_COOLDOWN_MS) || 60000;
};

class KeySlot {
    constructor(name, envVarName) {
        this.name = name;
        this.envVarName = envVarName;
        this.status = "available"; // "available" | "cooldown" | "error"
        this.cooldownUntil = null;
        this.failureReason = null;
        this.failedAt = null;
    }

    getApiKey() {
        return process.env[this.envVarName]?.trim() || "";
    }

    isConfigured() {
        return !!this.getApiKey();
    }

    isAvailable(cooldownDurationMs = 60000) {
        if (this.status === "cooldown") {
            if (this.cooldownUntil && Date.now() >= this.cooldownUntil) {
                console.log(`[AI Provider] Cooldown expired for ${this.name}. Resetting status to available.`);
                this.status = "available";
                this.cooldownUntil = null;
                this.failureReason = null;
                return true;
            }
            return false;
        }
        if (this.status === "error") {
            return false;
        }
        return this.isConfigured();
    }

    setCooldown(reason, durationMs) {
        this.status = "cooldown";
        this.cooldownUntil = Date.now() + durationMs;
        this.failureReason = reason;
        this.failedAt = new Date().toISOString();
    }

    setError(reason) {
        this.status = "error";
        this.failureReason = reason;
        this.failedAt = new Date().toISOString();
    }
}

// Initialize the 2 Gemini slots
// Fallback to legacy GEMINI_API_KEY if GEMINI_API_KEY_1 is not set
if (!process.env.GEMINI_API_KEY_1 && process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY_1 = process.env.GEMINI_API_KEY;
}

const geminiKeys = [
    new KeySlot("Gemini #1", "GEMINI_API_KEY_1"),
    new KeySlot("Gemini #2", "GEMINI_API_KEY_2")
];

let currentGeminiIndex = 0;

const getNextGeminiKey = () => {
    const configuredKeys = geminiKeys.filter(k => k.isConfigured());
    if (configuredKeys.length === 0) return null;

    const cooldownMs = getCooldownDuration();
    for (let i = 0; i < configuredKeys.length; i++) {
        const index = (currentGeminiIndex + i) % configuredKeys.length;
        const key = configuredKeys[index];
        if (key.isAvailable(cooldownMs)) {
            currentGeminiIndex = (index + 1) % configuredKeys.length;
            return key;
        }
    }
    
    // Fallback: if all are on cooldown, round-robin anyway to avoid complete blocking
    const fallbackKey = configuredKeys[currentGeminiIndex % configuredKeys.length];
    currentGeminiIndex = (currentGeminiIndex + 1) % configuredKeys.length;
    return fallbackKey;
};

const peekNextGeminiKey = () => {
    const configuredKeys = geminiKeys.filter(k => k.isConfigured());
    if (configuredKeys.length === 0) return null;

    const cooldownMs = getCooldownDuration();
    for (let i = 0; i < configuredKeys.length; i++) {
        const index = (currentGeminiIndex + i) % configuredKeys.length;
        const key = configuredKeys[index];
        if (key.isAvailable(cooldownMs)) {
            return key;
        }
    }
    return configuredKeys[currentGeminiIndex % configuredKeys.length];
};

const getConfiguredProviders = async () => {
    const providers = [];
    geminiKeys.forEach((keySlot) => {
        if (keySlot.isConfigured()) {
            providers.push({
                id: keySlot.envVarName,
                apiKey: keySlot.getApiKey(),
                status: keySlot.status === "available" ? "healthy" : keySlot.status
            });
        }
    });
    return providers;
};

const getKeyStatuses = () => {
    const cooldownMs = getCooldownDuration();
    return geminiKeys.map(k => {
        k.isAvailable(cooldownMs); // trigger cooldown expiry check
        let displayStatus = "Error";
        if (k.status === "available" && k.isConfigured()) {
            displayStatus = "Available";
        } else if (k.status === "cooldown") {
            displayStatus = "Cooldown";
        } else if (!k.isConfigured()) {
            displayStatus = "Error"; // unconfigured
        }

        return {
            name: k.name,
            status: displayStatus,
            failureReason: k.failureReason,
            cooldownUntil: k.cooldownUntil
        };
    });
};

const isAuthOrConfigError = (statusCode, message) => {
    const msg = String(message || "").toLowerCase();
    const status = Number(statusCode);
    
    return status === 401 || 
           status === 403 || 
           msg.includes("api key") || 
           msg.includes("auth") || 
           msg.includes("unauthorized") || 
           msg.includes("invalid key");
};

const isRateLimitOrTemporaryError = (statusCode, message) => {
    const msg = String(message || "").toLowerCase();
    const status = Number(statusCode);
    
    const isRateLimit = status === 429 || 
                        msg.includes("rate limit") || 
                        msg.includes("tpm limit") || 
                        msg.includes("rpm limit") || 
                        msg.includes("quota error") || 
                        msg.includes("quota exceeded") || 
                        msg.includes("429") || 
                        msg.includes("limit exceeded");
                        
    const isTemporary = status >= 500 || 
                        status === 0 || 
                        msg.includes("timeout") || 
                        msg.includes("abort") || 
                        msg.includes("fetch") ||
                        msg.includes("network") ||
                        msg.includes("econnrefused") ||
                        msg.includes("econnreset");
                        
    return isRateLimit || isTemporary;
};

const getActiveModel = () => {
    const configured = process.env.GEMINI_COMPLETION_MODEL;
    if (!configured || configured === "gemini-2.5-flash") {
        return "gemini-3.5-flash";
    }
    return configured;
};

const requestCompletion = async ({ apiKey, messages, timeoutMs, maxOutputTokens }) => {
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
            maxOutputTokens: Number(maxOutputTokens) || Number(process.env.LLM_MAX_OUTPUT_TOKENS) || 500
        }
    };
    
    if (systemInstruction) {
        requestBody.systemInstruction = {
            parts: [{ text: systemInstruction }]
        };
    }
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        const response = await fetchWithTimeoutAndRetry(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            const error = new Error(payload.error?.message || `Gemini Completion failed with status ${response.status}`);
            error.statusCode = response.status;
            throw error;
        }

        return {
            content: payload.candidates?.[0]?.content?.parts?.[0]?.text || ""
        };
    } finally {
        clearTimeout(timeout);
    }
};

const generateCompletion = async ({ messages, timeoutMs = 20000, maxOutputTokens = 500 }) => {
    const configuredKeys = geminiKeys.filter(k => k.isConfigured());
    const failures = [];

    if (configuredKeys.length === 0) {
        return {
            success: false,
            content: "",
            provider: "none",
            failures: ["No Gemini provider API keys are configured."]
        };
    }

    const maxAttempts = configuredKeys.length;
    let attempts = 0;

    while (attempts < maxAttempts) {
        const keySlot = getNextGeminiKey();
        if (!keySlot) {
            break;
        }

        const keyIndex = keySlot.envVarName.split("_").pop();
        console.log(`[Gemini] Key #${keyIndex} selected`);

        try {
            const completion = await requestCompletion({ 
                apiKey: keySlot.getApiKey(), 
                messages, 
                timeoutMs, 
                maxOutputTokens 
            });

            return {
                success: true,
                content: completion.content,
                provider: keySlot.envVarName,
                failures
            };
        } catch (error) {
            const status = error.statusCode || 0;
            const message = error.message || "Unknown error";

            failures.push({
                provider: keySlot.envVarName,
                message,
                statusCode: status
            });

            if (isAuthOrConfigError(status, message)) {
                keySlot.setError(message);
            } else {
                console.warn(`[Gemini] Key #${keyIndex} quota exceeded`);
                keySlot.setCooldown(message, getCooldownDuration());
            }

            attempts++;
            if (attempts < maxAttempts) {
                const nextKey = peekNextGeminiKey();
                if (nextKey) {
                    const nextIndex = nextKey.envVarName.split("_").pop();
                    console.log(`[Gemini] Switching to Key #${nextIndex}`);
                }
            }
        }
    }

    return {
        success: false,
        content: "",
        provider: "none",
        failures
    };
};

const requestStream = async ({ apiKey, messages, onChunk, timeoutMs, signal, maxOutputTokens }) => {
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
            maxOutputTokens: Number(maxOutputTokens) || Number(process.env.LLM_MAX_OUTPUT_TOKENS) || 500
        }
    };
    
    if (systemInstruction) {
        requestBody.systemInstruction = {
            parts: [{ text: systemInstruction }]
        };
    }
    
    const controller = new AbortController();
    if (signal) {
        signal.addEventListener("abort", () => controller.abort());
        if (signal.aborted) {
            controller.abort();
        }
    }
    
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`;

    try {
        const response = await fetchWithTimeoutAndRetry(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            const error = new Error(payload.error?.message || `Gemini stream request failed with status ${response.status}`);
            error.statusCode = response.status;
            throw error;
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
                            // ignore JSON parse boundary issues
                        }
                        buffer = buffer.slice(i + 1);
                        i = -1; // reset index to scan new buffer
                    }
                }
            }
        }

        return {
            content: fullText
        };
    } finally {
        clearTimeout(timeout);
    }
};

const generateStream = async ({ messages, onChunk, timeoutMs = 20000, signal, maxOutputTokens = 500 }) => {
    const configuredKeys = geminiKeys.filter(k => k.isConfigured());
    const failures = [];

    if (configuredKeys.length === 0) {
        return {
            success: false,
            content: "",
            provider: "none",
            failures: ["No Gemini provider API keys are configured."]
        };
    }

    const maxAttempts = configuredKeys.length;
    let attempts = 0;

    while (attempts < maxAttempts) {
        const keySlot = getNextGeminiKey();
        if (!keySlot) {
            break;
        }

        const keyIndex = keySlot.envVarName.split("_").pop();
        console.log(`[Gemini] Key #${keyIndex} selected`);

        try {
            const completion = await requestStream({ 
                apiKey: keySlot.getApiKey(), 
                messages, 
                onChunk, 
                timeoutMs, 
                signal, 
                maxOutputTokens 
            });

            return {
                success: true,
                content: completion.content,
                provider: keySlot.envVarName,
                failures
            };
        } catch (error) {
            const status = error.statusCode || 0;
            const message = error.message || "Unknown error";

            failures.push({
                provider: keySlot.envVarName,
                message,
                statusCode: status
            });

            if (isAuthOrConfigError(status, message)) {
                keySlot.setError(message);
            } else {
                console.warn(`[Gemini] Key #${keyIndex} quota exceeded`);
                keySlot.setCooldown(message, getCooldownDuration());
            }

            attempts++;
            if (attempts < maxAttempts) {
                const nextKey = peekNextGeminiKey();
                if (nextKey) {
                    const nextIndex = nextKey.envVarName.split("_").pop();
                    console.log(`[Gemini] Switching to Key #${nextIndex}`);
                }
            }
        }
    }

    return {
        success: false,
        content: "",
        provider: "none",
        failures
    };
};

module.exports = {
    generateCompletion,
    generateStream,
    getConfiguredProviders,
    getKeyStatuses
};
