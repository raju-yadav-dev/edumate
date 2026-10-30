/**
 * Route-Specific Rate Limiters — EduMate Mission 19
 * 
 * Configures exact rate-limiting tiers:
 * - Chat API: 120 requests/min
 * - Uploads / Ingestion: 2000 uploads/hour
 * - Auth / Login: 15 attempts/15 min
 * - Health APIs: 600 requests/min
 * - Admin APIs: 300 requests/min
 * - Standard APIs: 3000 requests/15 min
 */

const rateLimit = require("express-rate-limit");
const auditLogger = require("../services/auditLogger");

const isLoopbackIp = (ip) => {
    return !ip || ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || String(ip).includes("127.0.0.1");
};

const createLimiter = (options) => {
    return rateLimit({
        windowMs: options.windowMs,
        max: options.max,
        standardHeaders: true,
        legacyHeaders: false,
        statusCode: 429,
        skip: (req) => {
            if (process.env.NODE_ENV !== "production" || isLoopbackIp(req.ip)) {
                return true;
            }
            if (typeof options.skip === "function") {
                return options.skip(req);
            }
            return false;
        },
        handler: (req, res) => {
            const retryAfterSec = Math.ceil(options.windowMs / 1000);
            res.setHeader("Retry-After", retryAfterSec);

            // Record rate limit violation to security audit
            try {
                auditLogger.logEvent({
                    action: "RATE_LIMIT_EXCEEDED",
                    resourceType: options.resourceName || "API",
                    ipAddress: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
                    userAgent: req.headers["user-agent"] || "",
                    email: req.user?.email || req.body?.email || "anonymous",
                    role: req.user?.role || "guest",
                    success: false,
                    errorCode: "429_TOO_MANY_REQUESTS",
                    metadata: {
                        path: req.originalUrl,
                        limit: options.max,
                        windowMs: options.windowMs
                    }
                });
            } catch (_) {}

            return res.status(429).json({
                success: false,
                code: "RATE_LIMIT_EXCEEDED",
                message: options.message || "Too many requests. Please try again later.",
                retryAfterSeconds: retryAfterSec
            });
        }
    });
};

const chatRateLimiter = createLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: Number(process.env.RATE_LIMIT_CHAT_MAX || 120),
    resourceName: "CHAT_API",
    message: "Chat rate limit exceeded. Max 120 questions per minute."
});

const uploadRateLimiter = createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: Number(process.env.RATE_LIMIT_UPLOAD_MAX || 2000),
    resourceName: "DOCUMENT_UPLOAD",
    message: "Upload rate limit exceeded. Please try again later."
});

const loginRateLimiter = createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: Number(process.env.RATE_LIMIT_LOGIN_MAX || 15),
    resourceName: "AUTH_LOGIN",
    message: "Too many failed login attempts. Please try again after 15 minutes."
});

const healthRateLimiter = createLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: Number(process.env.RATE_LIMIT_HEALTH_MAX || 600),
    resourceName: "HEALTH_API",
    message: "Health API rate limit exceeded."
});

const adminRateLimiter = createLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: Number(process.env.RATE_LIMIT_ADMIN_MAX || 300),
    resourceName: "ADMIN_API",
    message: "Admin API rate limit exceeded."
});

const standardApiLimiter = createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: Number(process.env.API_RATE_LIMIT_MAX || 3000),
    resourceName: "GENERAL_API",
    message: "API rate limit exceeded. Please slow down."
});

module.exports = {
    chatRateLimiter,
    uploadRateLimiter,
    loginRateLimiter,
    healthRateLimiter,
    adminRateLimiter,
    standardApiLimiter
};
