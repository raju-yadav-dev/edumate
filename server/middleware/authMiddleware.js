const User = require("../models/User");
const { verifyAccessToken } = require("../utils/tokenizer");
const { sendError } = require("../utils/response");

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || "";
        const [scheme, token] = authHeader.split(" ");

        if (scheme !== "Bearer" || !token) {
            return sendError(res, 401, "Authentication token is required.");
        }

        const decoded = verifyAccessToken(token);
        const user = await User.findById(decoded.id).select("-password");

        if (!user) {
            return sendError(res, 401, "Authenticated user no longer exists.");
        }

        req.user = user;
        return next();
    } catch (error) {
        console.error(error);
        return sendError(res, 401, "Invalid or expired authentication token.");
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
