const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const settingsService = require("./settingsService");

// Secure fetch selection to support both Node global fetch and node-fetch package
const fetch = (() => {
    try {
        return require("node-fetch");
    } catch {
        return global.fetch;
    }
})();

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

// Initialize the 10 Groq slots
// Fallback to legacy GROQ_API_KEY if GROQ_API_KEY_1 is not set
if (!process.env.GROQ_API_KEY_1 && process.env.GROQ_API_KEY) {
    process.env.GROQ_API_KEY_1 = process.env.GROQ_API_KEY;
}

const groqKeys = [];
for (let i = 1; i <= 10; i++) {
    groqKeys.push(new KeySlot(`Groq #${i}`, `GROQ_API_KEY_${i}`));
}

let currentGroqIndex = 0;

const getNextGroqKey = () => {
    const configuredKeys = groqKeys.filter(k => k.isConfigured());
    if (configuredKeys.length === 0) return null;

    const cooldownMs = getCooldownDuration();
    for (let i = 0; i < configuredKeys.length; i++) {
        const index = (currentGroqIndex + i) % configuredKeys.length;
        const key = configuredKeys[index];
        if (key.isAvailable(cooldownMs)) {
            currentGroqIndex = (index + 1) % configuredKeys.length;
            return key;
        }
    }
    
    // Fallback: if all are on cooldown, round-robin anyway to avoid complete blocking
    const fallbackKey = configuredKeys[currentGroqIndex % configuredKeys.length];
    currentGroqIndex = (currentGroqIndex + 1) % configuredKeys.length;
    return fallbackKey;
};

const peekNextGroqKey = () => {
    const configuredKeys = groqKeys.filter(k => k.isConfigured());
    if (configuredKeys.length === 0) return null;

    const cooldownMs = getCooldownDuration();
    for (let i = 0; i < configuredKeys.length; i++) {
        const index = (currentGroqIndex + i) % configuredKeys.length;
        const key = configuredKeys[index];
        if (key.isAvailable(cooldownMs)) {
            return key;
        }
    }
    return configuredKeys[currentGroqIndex % configuredKeys.length];
};

const getConfiguredProviders = async () => {
    const providers = [];
    groqKeys.forEach((keySlot) => {
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
    return groqKeys.map(k => {
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

const requestCompletion = async ({ apiKey, messages, timeoutMs, maxOutputTokens }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
                messages,
                temperature: 0.2,
                max_tokens: Number(maxOutputTokens) || Number(process.env.LLM_MAX_OUTPUT_TOKENS) || 500
            }),
            signal: controller.signal
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            const error = new Error(payload.error?.message || "Groq provider request failed.");
            error.statusCode = response.status;
            throw error;
        }

        return {
            content: payload.choices?.[0]?.message?.content || "",
            rawUsage: payload.usage || null
        };
    } finally {
        clearTimeout(timeout);
    }
};

const generateCompletion = async ({ messages, timeoutMs = 20000, maxOutputTokens = 500 }) => {
    const configuredKeys = groqKeys.filter(k => k.isConfigured());
    const failures = [];

    if (configuredKeys.length === 0) {
        return {
            success: false,
            content: "",
            provider: "none",
            failures: ["No Groq provider API keys are configured."]
        };
    }

    const maxAttempts = configuredKeys.length;
    let attempts = 0;

    while (attempts < maxAttempts) {
        const keySlot = getNextGroqKey();
        if (!keySlot) {
            break;
        }

        const keyIndex = keySlot.envVarName.split("_").pop();
        console.log(`[Groq] Key #${keyIndex} selected`);

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
                rawUsage: completion.rawUsage,
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
                console.warn(`[Groq] Key #${keyIndex} rate limited`);
                keySlot.setCooldown(message, getCooldownDuration());
            }

            attempts++;
            if (attempts < maxAttempts) {
                const nextKey = peekNextGroqKey();
                if (nextKey) {
                    const nextIndex = nextKey.envVarName.split("_").pop();
                    console.log(`[Groq] Switching to Key #${nextIndex}`);
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

async function* readLines(stream) {
    let buffer = "";
    const decoder = new (require("util").TextDecoder || global.TextDecoder)("utf-8");

    for await (const chunk of stream) {
        const text = typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
        buffer += text;
        const lines = buffer.split("\n");
        buffer = lines.pop(); // save the partial line
        for (const line of lines) {
            yield line;
        }
    }

    if (buffer) {
        yield buffer;
    }
}

const requestStream = async ({ apiKey, messages, onChunk, timeoutMs, signal, maxOutputTokens }) => {
    const controller = new AbortController();
    
    if (signal) {
        signal.addEventListener("abort", () => controller.abort());
        if (signal.aborted) {
            controller.abort();
        }
    }
    
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
                messages,
                temperature: 0.2,
                max_tokens: Number(maxOutputTokens) || Number(process.env.LLM_MAX_OUTPUT_TOKENS) || 500,
                stream: true
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            const error = new Error(payload.error?.message || "Groq provider request failed.");
            error.statusCode = response.status;
            throw error;
        }

        let fullText = "";
        for await (const line of readLines(response.body)) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const dataStr = trimmed.slice(6);
            if (dataStr === "[DONE]") continue;

            try {
                const parsed = JSON.parse(dataStr);
                const content = parsed.choices?.[0]?.delta?.content || "";
                if (content) {
                    fullText += content;
                    onChunk(content);
                }
            } catch (err) {
                // Ignore partial JSON parsing errors
            }
        }

        return {
            content: fullText,
            rawUsage: null
        };
    } finally {
        clearTimeout(timeout);
    }
};

const generateStream = async ({ messages, onChunk, timeoutMs = 20000, signal, maxOutputTokens = 500 }) => {
    const configuredKeys = groqKeys.filter(k => k.isConfigured());
    const failures = [];

    if (configuredKeys.length === 0) {
        return {
            success: false,
            content: "",
            provider: "none",
            failures: ["No Groq provider API keys are configured."]
        };
    }

    const maxAttempts = configuredKeys.length;
    let attempts = 0;

    while (attempts < maxAttempts) {
        const keySlot = getNextGroqKey();
        if (!keySlot) {
            break;
        }

        const keyIndex = keySlot.envVarName.split("_").pop();
        console.log(`[Groq] Key #${keyIndex} selected`);

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
                console.warn(`[Groq] Key #${keyIndex} rate limited`);
                keySlot.setCooldown(message, getCooldownDuration());
            }

            attempts++;
            if (attempts < maxAttempts) {
                const nextKey = peekNextGroqKey();
                if (nextKey) {
                    const nextIndex = nextKey.envVarName.split("_").pop();
                    console.log(`[Groq] Switching to Key #${nextIndex}`);
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
