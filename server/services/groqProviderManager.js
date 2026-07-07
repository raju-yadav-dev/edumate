const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const settingsService = require("./settingsService");

const sleep = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

const getConfiguredProviders = async () => {
    const envProviders = [1, 2, 3].map((index) => ({
        id: `groq_${index}`,
        apiKey: process.env[`GROQ_API_KEY_${index}`],
        status: "healthy"
    }))
        .filter((provider) => Boolean(provider.apiKey));

    if (envProviders.length > 0) {
        return envProviders;
    }

    const settings = await settingsService.getApiKeys();

    return (settings.groqApiKeys || []).map((apiKey, index) => ({
        id: `groq_admin_${index + 1}`,
        apiKey,
        status: "healthy"
    }));
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
                model: process.env.GROQ_MODEL || "llama-3.1-70b-versatile",
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
