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

const getConfiguredProviders = async () => {
    const providers = [];

    // 1. Check GROQ_API_KEY environment variable (supports comma-separated list)
    if (process.env.GROQ_API_KEY) {
        const keys = process.env.GROQ_API_KEY.split(",")
            .map(k => k.trim())
            .filter(Boolean);
        keys.forEach((key, index) => {
            providers.push({
                id: `groq_env_${index + 1}`,
                apiKey: key,
                status: "healthy"
            });
        });
    }

    // 2. Check numbered environment variables GROQ_API_KEY_1, GROQ_API_KEY_2, etc.
    for (let i = 1; i <= 10; i++) {
        const key = process.env[`GROQ_API_KEY_${i}`];
        if (key) {
            const trimmed = key.trim();
            if (trimmed && !providers.some(p => p.apiKey === trimmed)) {
                providers.push({
                    id: `groq_env_numbered_${i}`,
                    apiKey: trimmed,
                    status: "healthy"
                });
            }
        }
    }

    // 3. Check settings from database if no environment keys are defined
    if (providers.length === 0) {
        try {
            const settings = await settingsService.getApiKeys();
            if (settings && settings.groqApiKeys) {
                settings.groqApiKeys
                    .map(k => k.trim())
                    .filter(Boolean)
                    .forEach((apiKey, index) => {
                        providers.push({
                            id: `groq_admin_${index + 1}`,
                            apiKey,
                            status: "healthy"
                        });
                    });
            }
        } catch (err) {
            console.error("[Groq Provider Manager] Failed to load API keys from settings:", err.message);
        }
    }

    return providers;
};

const requestCompletion = async ({ provider, messages, timeoutMs }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${provider.apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
                messages,
                temperature: 0.2,
                max_tokens: 900
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
            provider: provider.id,
            rawUsage: payload.usage || null
        };
    } finally {
        clearTimeout(timeout);
    }
};

const generateCompletion = async ({ messages, maxAttemptsPerProvider = 2, timeoutMs = 20000 }) => {
    const providers = await getConfiguredProviders();
    const failures = [];

    if (providers.length === 0) {
        return {
            success: false,
            content: "",
            provider: "none",
            failures: ["No Groq provider API keys are configured."]
        };
    }

    for (const provider of providers) {
        for (let attempt = 1; attempt <= maxAttemptsPerProvider; attempt += 1) {
            try {
                const completion = await requestCompletion({ provider, messages, timeoutMs });

                return {
                    success: true,
                    ...completion,
                    failures
                };
            } catch (error) {
                failures.push({
                    provider: provider.id,
                    attempt,
                    message: error.message,
                    statusCode: error.statusCode || null
                });

                // Immediately failover on rate limits (429) or invalid auth error codes (400, 401, 403)
                if (error.statusCode === 429 || error.statusCode === 401 || error.statusCode === 403 || error.statusCode === 400) {
                    console.warn(`[Groq Provider Manager] Provider ${provider.id} failed with status ${error.statusCode}. Rotating immediately...`);
                    break;
                }

                await sleep(250 * attempt);
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
    getConfiguredProviders
};
