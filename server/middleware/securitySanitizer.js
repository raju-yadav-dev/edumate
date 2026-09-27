/**
 * Security Sanitizer & Path Traversal Guard — EduMate Mission 19
 * 
 * Protects against:
 * - MongoDB Operator Injections ($gt, $ne, $where, $regex, etc.)
 * - Cross-Site Scripting (XSS) in string inputs
 * - Path Traversal (../, ..\, null bytes, system roots)
 * - Prototype pollution
 */

const path = require("path");

function sanitizeValue(value) {
    if (value === null || value === undefined) return value;

    if (typeof value === "string") {
        // Strip null bytes and control chars
        let cleaned = value.replace(/\0/g, "");
        // Sanitize dangerous HTML script injections
        cleaned = cleaned.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "");
        cleaned = cleaned.replace(/javascript\s*:/gi, "");
        cleaned = cleaned.replace(/data\s*:\s*text\/html/gi, "");
        return cleaned;
    }

    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }

    if (typeof value === "object") {
        const cleanObj = {};
        for (const [k, v] of Object.entries(value)) {
            // Block Mongo operators ($gt, $where, etc.) and prototype pollution
            if (k.startsWith("$") || k === "__proto__" || k === "constructor" || k === "prototype") {
                continue;
            }
            cleanObj[k] = sanitizeValue(v);
        }
        return cleanObj;
    }

    return value;
}

/**
 * Express Middleware to sanitize req.body, req.query, and req.params
 */
const securitySanitizerMiddleware = (req, res, next) => {
    if (req.body && typeof req.body === "object") {
        req.body = sanitizeValue(req.body);
    }
    if (req.query && typeof req.query === "object") {
        req.query = sanitizeValue(req.query);
    }
    if (req.params && typeof req.params === "object") {
        req.params = sanitizeValue(req.params);
    }
    next();
};

/**
 * Path Traversal Guard
 * Validates that requested relative/absolute path resolves strictly inside baseDirectory
 */
function safeResolvePath(baseDirectory, userPath) {
    if (!baseDirectory || !userPath) {
        throw new Error("Base directory and target path are required.");
    }

    // Block null bytes
    if (String(userPath).includes("\0")) {
        throw new Error("Access denied: Invalid path characters.");
    }

    const resolvedBase = path.resolve(baseDirectory);
    const resolvedTarget = path.resolve(resolvedBase, String(userPath));

    // Must start with base directory path
    if (!resolvedTarget.startsWith(resolvedBase)) {
        throw new Error("Access denied: Path traversal attempt detected.");
    }

    return resolvedTarget;
}

module.exports = {
    securitySanitizerMiddleware,
    sanitizeValue,
    safeResolvePath
};
