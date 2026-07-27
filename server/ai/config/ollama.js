const fetch = (() => {
    try {
        return require("node-fetch");
    } catch {
        return global.fetch;
    }
})();
const { spawn } = require("child_process");

/**
 * Pings the Ollama daemon to check if it is running
 * @param {string} baseUrl
 * @returns {Promise<boolean>}
 */
const pingOllama = async (baseUrl) => {
    try {
        const response = await fetch(`${baseUrl}/api/tags`);
        return response.ok;
    } catch (e) {
        return false;
    }
};

/**
 * Launches the local Ollama background service on Windows/OS
 * @returns {boolean}
 */
const startOllamaService = () => {
    try {
        console.log("\n[Ollama Configuration] Ollama service not running. Attempting auto-start ('ollama serve')...");
        const child = spawn("ollama", ["serve"], {
            detached: true,
            stdio: "ignore",
            shell: true
        });
        child.unref();
        return true;
    } catch (e) {
        console.error("[Ollama Configuration] Failed to start Ollama background process automatically:", e.message);
        return false;
    }
};

/**
 * Generate embedding for a single text using Ollama
 * @param {string} text
 * @returns {Promise<Array<number>>}
 */
const generateEmbedding = async (text) => {
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const model = process.env.OLLAMA_EMBEDDING_MODEL || process.env.OLLAMA_MODEL || "llama3.2:3b";

    try {
        const response = await fetch(`${baseUrl}/api/embed`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model,
                input: text
            })
        });

        if (response.ok) {
            const payload = await response.json();
            if (payload.embeddings && payload.embeddings[0]) {
                return payload.embeddings[0];
            }
        }
    } catch (e) {
        // Fall back to /api/embeddings if /api/embed fails
    }

    const response = await fetch(`${baseUrl}/api/embeddings`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model,
            prompt: text
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Ollama Embedding API error status ${response.status}: ${errText || "Unknown error"}`);
    }

    const payload = await response.json();
    if (!payload.embedding || !Array.isArray(payload.embedding)) {
        throw new Error("Ollama Embedding response did not return a valid embedding vector.");
    }
    return payload.embedding;
};

/**
 * Generate embeddings for multiple texts using Ollama
 * @param {Array<string>} texts
 * @returns {Promise<Array<Array<number>>>}
 */
const generateEmbeddingsBatch = async (texts) => {
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const model = process.env.OLLAMA_EMBEDDING_MODEL || process.env.OLLAMA_MODEL || "llama3.2:3b";

    try {
        const response = await fetch(`${baseUrl}/api/embed`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model,
                input: texts
            })
        });

        if (response.ok) {
            const payload = await response.json();
            if (payload.embeddings && Array.isArray(payload.embeddings)) {
                return payload.embeddings;
            }
        }
    } catch (e) {
        // Fall back to sequential processing
    }

    const results = [];
    for (const text of texts) {
        const emb = await generateEmbedding(text);
        results.push(emb);
    }
    return results;
};

/**
 * Verifies connection to Ollama and checks if the model is pulled
 * @returns {Promise<boolean>}
 */
const verifyConnection = async () => {
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const model = process.env.OLLAMA_MODEL || "llama3.2:3b";

    let isRunning = await pingOllama(baseUrl);
    if (!isRunning) {
        startOllamaService();
        // Wait and poll up to 5 times for service startup
        for (let i = 0; i < 5; i++) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            isRunning = await pingOllama(baseUrl);
            if (isRunning) {
                console.log("[Ollama Configuration] Ollama service detected successfully after auto-start.");
                break;
            }
        }
    }

    if (!isRunning) {
        throw new Error(`Ollama service at ${baseUrl} is unreachable. Please make sure Ollama is installed and running.`);
    }

    const response = await fetch(`${baseUrl}/api/tags`);
    const payload = await response.json();
    const models = (payload.models || []).map((m) => m.name);

    const modelExists = models.some(
        (m) => m === model || m.startsWith(model + ":") || model.startsWith(m + ":")
    );

    if (!modelExists) {
        console.warn(`\n⚠️ WARNING: Ollama model '${model}' was not found in local models: ${models.join(", ")}`);
        console.log(`💡 To pull it, run: ollama pull ${model}\n`);
    }

    return true;
};

module.exports = {
    generateEmbedding,
    generateEmbeddingsBatch,
    verifyConnection
};
