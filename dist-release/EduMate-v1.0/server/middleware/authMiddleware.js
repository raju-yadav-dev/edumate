const User = require("../models/User");
const { verifyAccessToken } = require("../utils/tokenizer");

const authenticate = async (req, res, next) => {
    try {
        let token = "";
        const authHeader = req.headers.authorization || "";
        if (authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        } else if (req.query && req.query.token) {
            token = req.query.token;
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                code: "MISSING_TOKEN",
                message: "Authentication token is required."
            });
        }

        let decoded;
        try {
            decoded = verifyAccessToken(token);
        } catch (error) {
            if (error.name === "TokenExpiredError") {
                return res.status(401).json({
                    success: false,
                    code: "TOKEN_EXPIRED",
                    message: "Access token has expired."
                });
            }
            return res.status(401).json({
                success: false,
                code: "INVALID_TOKEN",
                message: "Invalid access token."
            });
        }

        const user = await User.findById(decoded.id).select("-password");

        if (!user) {
            return res.status(401).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Authenticated user no longer exists."
            });
        }

        if (user.isLocked && user.isLocked()) {
            return res.status(403).json({
                success: false,
                code: "ACCOUNT_LOCKED",
                message: "Your account is temporarily locked due to repeated failed attempts. Please try again later."
            });
        }

        req.user = user;
        return next();
    } catch (error) {
        console.error(`[Auth] Authentication middleware error: ${error.message}`);
        return res.status(401).json({
            success: false,
            code: "INVALID_TOKEN",
            message: "Authentication failed."
        });
    }
};

const optionalAuthenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || "";
        const [scheme, token] = authHeader.split(" ");

        if (scheme !== "Bearer" || !token) {
            req.user = null;
            return next();
        }

        const decoded = verifyAccessToken(token);
        const user = await User.findById(decoded.id).select("-password");

        req.user = user || null;
        return next();
    } catch (error) {
        req.user = null;
        return next();
    }
};

module.exports = authenticate;
module.exports.optionalAuthenticate = optionalAuthenticate;
