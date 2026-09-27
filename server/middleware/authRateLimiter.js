const rateLimit = require("express-rate-limit");

const createAuthLimiter = (options = {}) => {
    return rateLimit({
        windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes default
        max: options.max || 10, // 10 attempts default
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            const retryAfterSeconds = Math.ceil((options.windowMs || 15 * 60 * 1000) / 1000);
            return res.status(429).json({
                success: false,
                code: "RATE_LIMIT_EXCEEDED",
                message: options.message || "Too many attempts. Please try again later.",
                retryAfterSeconds
            });
        }
    });
};

const loginLimiter = createAuthLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many login attempts. Please wait 15 minutes before trying again."
});

const signupLimiter = createAuthLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: "Too many accounts created from this IP. Please try again in an hour."
});

const refreshLimiter = createAuthLimiter({
    windowMs: 15 * 60 * 1000,
    max: 60, // 60 refresh requests per 15 minutes
    message: "Too many token refresh requests. Please re-authenticate."
});

module.exports = {
    loginLimiter,
    signupLimiter,
    refreshLimiter,
    createAuthLimiter
};
