const fetch = (() => {
    try {
        return require("node-fetch");
    } catch {
        return global.fetch;
    }
})();

/**
 * Promise-level timeout and retry wrapper.
 */
const withTimeoutAndRetry = async (fn, timeoutMs = 20000, retries = 3, delay = 1000, operationName = "Operation") => {
    let lastErr;
    for (let i = 0; i < retries; i++) {
        try {
            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs);
            });
            const result = await Promise.race([fn(), timeoutPromise]).finally(() => clearTimeout(timeoutId));
            return result;
        } catch (err) {
            lastErr = err;
            console.warn(`[RETRY] ${operationName} failed (attempt ${i + 1}/${retries}): ${err.message}`);
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastErr;
};

/**
 * Fetch HTTP wrapper with timeout and retry support.
 */
const fetchWithTimeoutAndRetry = async (url, options = {}, timeoutMs = 30000, retries = 3, delay = 1000) => {
    return withTimeoutAndRetry(
        () => fetch(url, options),
        timeoutMs,
        retries,
        delay,
        `HTTP Request to ${url}`
    );
};

module.exports = {
    withTimeoutAndRetry,
    fetchWithTimeoutAndRetry
};
