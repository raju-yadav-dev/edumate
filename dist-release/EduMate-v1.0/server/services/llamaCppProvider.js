const http = require("http");
const https = require("https");
const { URL } = require("url");
const { getLlmConfig, checkLlmHealth, stripQwenThinking, calculateDynamicOutputBudget } = require("../config/llm");
const { llmCircuitBreaker } = require("./circuitBreaker");

/**
 * EduMate Task 11 / Mission 14.3 — Production llama.cpp Provider & Generation Pipeline
 * 
 * Capabilities:
 * - Environment driven via getLlmConfig() (reads only from .env)
 * - Single reusable keep-alive HTTP / HTTPS client
 * - Real-time SSE streaming with sub-second TTFT (Time-to-first-token)
 * - Structured error handling with explicit codes:
 *   - LLAMACPP_OFFLINE / ECONNREFUSED
 *   - LLAMACPP_TIMEOUT
 *   - INVALID_JSON
 *   - STREAM_INTERRUPTED
 *   - MODEL_NOT_FOUND
 *   - PROMPT_TOO_LARGE
 * - Dynamic token budgeting based on query tier
 * - Automatic single retry for transient socket errors
 * - Strict zero-cloud fallback guarantee
 */

// Reusable Keep-Alive HTTP and HTTPS Agents
const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 60000
});

const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 60000
});

/**
 * Structured Error class for llama.cpp failures
 */
class LlamaCppError extends Error {
    constructor(message, { code = "LLAMACPP_ERROR", statusCode = 500, details = {} } = {}) {
        super(message);
        this.name = "LlamaCppError";
        this.code = code;
        this.statusCode = statusCode;
        this.success = false;
        this.details = {
            provider: "llama.cpp",
            ...details
        };
    }
}

/**
 * Checks if a network/HTTP error is transient and eligible for 1 retry
 */
const isTransientError = (err, statusCode = null) => {
    if (statusCode && [502, 503, 504, 429].includes(statusCode)) {
        return true;
    }
    const msg = String(err?.message || "").toLowerCase();
    const code = String(err?.code || "").toUpperCase();
    return (
        code === "ECONNRESET" ||
        code === "ECONNREFUSED" ||
        code === "ETIMEDOUT" ||
        code === "EPIPE" ||
        msg.includes("socket hang up") ||
        msg.includes("connection reset") ||
        msg.includes("network error") ||
        msg.includes("econnrefused")
    );
};

/**
 * Native Node.js HTTP/HTTPS Client for llama.cpp API
 */
const makeHttpRequest = ({ url, method = "POST", headers = {}, body = null, timeoutMs = 30000, signal = null, onData = null }) => {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            return reject(new LlamaCppError("llama.cpp request cancelled by client", {
                code: "REQUEST_ABORTED",
                statusCode: 499
            }));
        }

        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === "https:";
        const agent = isHttps ? httpsAgent : httpAgent;
        const lib = isHttps ? https : http;

        const options = {
            protocol: parsedUrl.protocol,
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + (parsedUrl.search || ""),
            method,
            agent,
            headers: {
                "Connection": "keep-alive",
                ...headers
            }
        };

        if (body) {
            options.headers["Content-Length"] = Buffer.byteLength(body);
        }

        let isSettled = false;
        const req = lib.request(options);

        // Timeout handler
        req.setTimeout(timeoutMs, () => {
            if (!isSettled) {
                isSettled = true;
                req.destroy();
                reject(new LlamaCppError(`llama.cpp request timed out after ${timeoutMs / 1000}s`, {
                    code: "LLAMACPP_TIMEOUT",
                    statusCode: 504,
                    details: { url, timeoutMs }
                }));
            }
        });

        // AbortSignal listener
        const onAbort = () => {
            if (!isSettled) {
                isSettled = true;
                req.destroy();
                reject(new LlamaCppError("llama.cpp request cancelled by user", {
                    code: "REQUEST_ABORTED",
                    statusCode: 499,
                    details: { url }
                }));
            }
        };

        if (signal) {
            signal.addEventListener("abort", onAbort, { once: true });
        }

        req.on("error", (err) => {
            if (signal) signal.removeEventListener("abort", onAbort);
            if (isSettled) return;
            isSettled = true;

            const code = String(err.code || "").toUpperCase();
            let structuredCode = "LLAMACPP_OFFLINE";
            let message = `llama.cpp connection error (${err.message})`;

            if (code === "ECONNREFUSED") {
                structuredCode = "ECONNREFUSED";
                message = "llama.cpp server is offline or connection refused on configured port.";
            } else if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT") {
                structuredCode = "LLAMACPP_TIMEOUT";
                message = "llama.cpp connection timed out.";
            }

            reject(new LlamaCppError(message, {
                code: structuredCode,
                statusCode: 503,
                details: { url, originalError: err.message, code }
            }));
        });

        req.on("response", (res) => {
            res.setEncoding("utf8");

            if (typeof onData === "function") {
                // Streaming mode
                res.on("data", (chunk) => {
                    const result = onData(chunk);
                    if (result && result.done) {
                        if (signal) signal.removeEventListener("abort", onAbort);
                        if (!isSettled) {
                            isSettled = true;
                            try { res.destroy(); } catch {}
                            resolve({ statusCode: res.statusCode, headers: res.headers });
                        }
                    }
                });

                res.on("end", () => {
                    if (signal) signal.removeEventListener("abort", onAbort);
                    if (isSettled) return;
                    isSettled = true;
                    resolve({ statusCode: res.statusCode, headers: res.headers });
                });

                res.on("error", (streamErr) => {
                    if (signal) signal.removeEventListener("abort", onAbort);
                    if (isSettled) return;
                    isSettled = true;
                    reject(new LlamaCppError(`llama.cpp streaming interrupted: ${streamErr.message}`, {
                        code: "STREAM_INTERRUPTED",
                        statusCode: 502,
                        details: { url, originalError: streamErr.message }
                    }));
                });
            } else {
                // Non-streaming buffering mode
                let responseText = "";
                res.on("data", (chunk) => {
                    responseText += chunk;
                });

                res.on("end", () => {
                    if (signal) signal.removeEventListener("abort", onAbort);
                    if (isSettled) return;
                    isSettled = true;
                    resolve({ statusCode: res.statusCode, headers: res.headers, body: responseText });
                });

                res.on("error", (err) => {
                    if (signal) signal.removeEventListener("abort", onAbort);
                    if (isSettled) return;
                    isSettled = true;
                    reject(new LlamaCppError(`llama.cpp response error: ${err.message}`, {
                        code: "LLAMACPP_ERROR",
                        statusCode: 502,
                        details: { url, originalError: err.message }
                    }));
                });
            }
        });

        if (body) {
            req.write(body);
        }
        req.end();
    });
};

/**
 * Generates completion or streaming response from llama.cpp
 * 
 * @param {Array<Object>|string} messages - Array of { role, content } or question string
 * @param {Function} [onChunk] - Streaming callback for incoming token chunks
 * @param {Object} [options={}] - Override parameters from .env defaults
 * @returns {Promise<Object|string>} - Complete generated response text or telemetry object
 */
const generateCompletion = async (messages, onChunk = null, options = {}) => {
    // 1. Circuit Breaker Fast-Fail Check (with auto-heal probe)
    if (!llmCircuitBreaker.canExecute()) {
        const isHealthy = await checkLlmHealth(1000).catch(() => false);
        if (isHealthy) {
            llmCircuitBreaker.reset();
        } else {
            throw new LlamaCppError("Local AI model unavailable.", {
                code: "LLAMACPP_OFFLINE",
                statusCode: 503,
                details: { circuitBreaker: llmCircuitBreaker.getStatus() }
            });
        }
    }

    const startTime = Date.now();
    let firstTokenTime = null;
    const config = getLlmConfig();

    const baseUrl = (options.baseUrl || config.baseUrl).replace(/\/$/, "");
    const model = options.model || config.model;
    const temperature = options.temperature !== undefined ? Number(options.temperature) : config.temperature;
    const topP = options.topP !== undefined ? Number(options.topP) : config.topP;
    const topK = options.topK !== undefined ? Number(options.topK) : config.topK;
    const repeatPenalty = options.repeatPenalty !== undefined ? Number(options.repeatPenalty) : config.repeatPenalty;
    const minP = options.minP !== undefined ? Number(options.minP) : config.minP;
    
    // Dynamic token budgeting
    let maxTokens = config.maxTokens;
    if (options.maxTokens !== undefined) {
        maxTokens = Number(options.maxTokens);
    } else if (options.maxOutputTokens !== undefined) {
        maxTokens = Number(options.maxOutputTokens);
    } else if (options.question) {
        const dynamicBudget = calculateDynamicOutputBudget(options.question, options.intent);
        maxTokens = dynamicBudget.maxTokens;
    }

    const timeoutMs = options.timeout !== undefined ? Number(options.timeout) : config.timeout;
    const isStream = options.stream !== undefined ? Boolean(options.stream) : Boolean(onChunk && config.stream);
    const signal = options.signal || null;

    // Format messages
    const formattedMessages = Array.isArray(messages) && messages.length > 0
        ? messages
        : [
            { role: "system", content: "You are EduMate AI, a helpful, strict university assistant." },
            { role: "user", content: typeof messages === "string" ? messages : "" }
        ];

    // Request Payload
    const requestBody = {
        model,
        messages: formattedMessages,
        temperature,
        top_p: topP,
        top_k: topK,
        repeat_penalty: repeatPenalty,
        min_p: minP,
        max_tokens: maxTokens,
        stream: isStream,
        cache_prompt: true,
        stop: config.stopSequences || [
            "<|im_end|>",
            "<|endoftext|>",
            "<|im_start|>"
        ]
    };

    if (config.contextSize) {
        requestBody.n_ctx = config.contextSize;
    }

    const endpoint = `${baseUrl}/v1/chat/completions`;
    const payloadStr = JSON.stringify(requestBody);

    let fullText = "";
    let reasoningBuffer = "";
    let tokenCount = 0;
    let insideThinking = false;

    // Helper to process SSE data lines
    const processChunkLine = (line) => {
        const trimmed = line.trim();
        if (!trimmed) return { done: false };
        if (trimmed === "data: [DONE]") return { done: true };

        if (trimmed.startsWith("data: ")) {
            try {
                const parsed = JSON.parse(trimmed.slice(6));
                const deltaContent = parsed.choices?.[0]?.delta?.content || "";
                const deltaReasoning = parsed.choices?.[0]?.delta?.reasoning_content || "";

                if (!firstTokenTime && (deltaContent || deltaReasoning)) {
                    firstTokenTime = Date.now();
                    if (typeof options.onFirstToken === "function") {
                        options.onFirstToken(firstTokenTime - startTime);
                    }
                }

                if (deltaReasoning) {
                    reasoningBuffer += deltaReasoning;
                }

                let currentDelta = deltaContent;
                if (!currentDelta) return { done: false };

                tokenCount++;

                // Filter out Qwen <think> reasoning in stream
                if (insideThinking) {
                    if (currentDelta.includes("</think>")) {
                        insideThinking = false;
                        currentDelta = currentDelta.split("</think>")[1] || "";
                    } else {
                        return { done: false };
                    }
                }

                if (currentDelta.includes("<think>")) {
                    if (currentDelta.includes("</think>")) {
                        currentDelta = currentDelta.replace(/<think>[\s\S]*?<\/think>/gi, "");
                    } else {
                        insideThinking = true;
                        currentDelta = currentDelta.split("<think>")[0] || "";
                    }
                }

                if (!currentDelta) return { done: false };

                fullText += currentDelta;
                if (onChunk) {
                    onChunk(currentDelta);
                }
            } catch {
                // Ignore partial JSON blocks in SSE stream
            }
        }
        return { done: false };
    };

    let lastError = null;

    // Execute with single retry for transient socket errors
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            if (isStream) {
                let streamBuffer = "";
                const res = await makeHttpRequest({
                    url: endpoint,
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: payloadStr,
                    timeoutMs,
                    signal,
                    onData: (chunk) => {
                        streamBuffer += chunk;
                        const lines = streamBuffer.split("\n");
                        streamBuffer = lines.pop();
                        for (const line of lines) {
                            const chunkResult = processChunkLine(line);
                            if (chunkResult && chunkResult.done) {
                                return { done: true };
                            }
                        }
                        return { done: false };
                    }
                });

                if (streamBuffer) {
                    processChunkLine(streamBuffer);
                }

                if (res.statusCode !== 200) {
                    throw new LlamaCppError(`llama.cpp returned HTTP ${res.statusCode}`, {
                        code: res.statusCode === 404 ? "MODEL_NOT_FOUND" : (res.statusCode === 400 ? "PROMPT_TOO_LARGE" : "LLAMACPP_ERROR"),
                        statusCode: res.statusCode,
                        details: { baseUrl, model, endpoint }
                    });
                }

                // If content was empty in stream but reasoning was captured, emit cleaned reasoning text
                if (!fullText.trim() && reasoningBuffer.trim()) {
                    const cleanedReasoning = stripQwenThinking(reasoningBuffer);
                    if (cleanedReasoning) {
                        fullText = cleanedReasoning;
                        if (onChunk) {
                            onChunk(cleanedReasoning);
                        }
                    }
                }

                llmCircuitBreaker.recordSuccess();
                break;
            } else {
                // Non-streaming execution
                const res = await makeHttpRequest({
                    url: endpoint,
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: payloadStr,
                    timeoutMs,
                    signal
                });

                if (res.statusCode !== 200) {
                    throw new LlamaCppError(`llama.cpp returned HTTP ${res.statusCode}: ${res.body}`, {
                        code: res.statusCode === 404 ? "MODEL_NOT_FOUND" : (res.statusCode === 400 ? "PROMPT_TOO_LARGE" : "LLAMACPP_ERROR"),
                        statusCode: res.statusCode,
                        details: { baseUrl, model, endpoint, errorBody: res.body }
                    });
                }

                let parsed;
                try {
                    parsed = JSON.parse(res.body);
                } catch {
                    throw new LlamaCppError("Failed to parse JSON response from llama.cpp", {
                        code: "INVALID_JSON",
                        statusCode: 502,
                        details: { baseUrl, model, rawResponse: res.body }
                    });
                }

                firstTokenTime = Date.now();
                if (typeof options.onFirstToken === "function") {
                    options.onFirstToken(firstTokenTime - startTime);
                }

                fullText = parsed.choices?.[0]?.message?.content || 
                           parsed.choices?.[0]?.message?.reasoning_content || 
                           parsed.content || "";

                if (onChunk && fullText) {
                    onChunk(fullText);
                }

                llmCircuitBreaker.recordSuccess();
                break;
            }
        } catch (err) {
            lastError = err;
            const transient = isTransientError(err, err.statusCode);

            if (transient && attempt === 1 && !signal?.aborted) {
                console.warn(`[llama.cpp Provider] Transient error on attempt 1 (${err.message}). Retrying in 500ms...`);
                await new Promise(r => setTimeout(r, 500));
                continue;
            }

            llmCircuitBreaker.recordFailure(err);
            throw err;
        }
    }

    // Clean output
    const cleanOutput = stripQwenThinking(fullText);

    if (options.includeTelemetry) {
        const durationMs = Date.now() - startTime;
        const ttft = firstTokenTime ? (firstTokenTime - startTime) : durationMs;
        const estimatedTokens = Math.round(cleanOutput.length / 4);
        const tokensPerSec = durationMs > 0 ? Number(((estimatedTokens / (durationMs / 1000))).toFixed(1)) : 0;

        return {
            content: cleanOutput,
            telemetry: {
                ttftMs: ttft,
                durationMs,
                tokensPerSec,
                estimatedTokens,
                model,
                provider: config.provider
            }
        };
    }

    return cleanOutput;
};

/**
 * Streaming completion wrapper for aiProviderManager
 */
const generateStreamingCompletion = async (messages, onChunk, options = {}) => {
    return generateCompletion(messages, onChunk, { ...options, stream: true });
};

module.exports = {
    generateCompletion,
    generateStreamingCompletion,
    makeHttpRequest,
    executeLlamaRequest: makeHttpRequest,
    isTransientError,
    LlamaCppError,
    checkLlmHealth,
    getLlmConfig
};
