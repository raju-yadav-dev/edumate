const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const getAccessSecret = () => {
    return process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || "edumate-access-jwt-secret-dev";
};

const getRefreshSecret = () => {
    return process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_TOKEN_SECRET || "edumate-refresh-jwt-secret-dev";
};

const getAccessExpiresIn = () => {
    return process.env.JWT_ACCESS_EXPIRES || process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || "15m";
};

const getRefreshExpiresIn = () => {
    return process.env.JWT_REFRESH_EXPIRES || process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || "7d";
};

const hashToken = (token) => {
    if (!token) return "";
    return crypto.createHash("sha256").update(String(token)).digest("hex");
};

const generateAccessToken = (user) => {
    const id = user._id ? user._id.toString() : String(user.id || user.userId);
    const payload = {
        id,
        userId: id,
        role: user.role,
        email: user.email,
        department: user.department || "",
        institution: user.institution || ""
    };

    return jwt.sign(payload, getAccessSecret(), {
        expiresIn: getAccessExpiresIn()
    });
};

const generateRefreshToken = (user, sessionId = null) => {
    const id = user._id ? user._id.toString() : String(user.id || user.userId);
    const activeSessionId = sessionId || crypto.randomUUID();
    const payload = {
        id,
        userId: id,
        sessionId: activeSessionId,
        role: user.role,
        type: "refresh"
    };

    const token = jwt.sign(payload, getRefreshSecret(), {
        expiresIn: getRefreshExpiresIn()
    });

    return {
        token,
        sessionId: activeSessionId
    };
};

const verifyAccessToken = (token) => {
    return jwt.verify(token, getAccessSecret());
};

const verifyRefreshToken = (token) => {
    const rawToken = typeof token === "object" && token?.token ? token.token : token;
    const decoded = jwt.verify(rawToken, getRefreshSecret());
    if (decoded.type !== "refresh") {
        const error = new Error("Invalid token type. Expected refresh token.");
        error.name = "JsonWebTokenError";
        throw error;
    }
    return decoded;
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    hashToken,
    getAccessExpiresIn,
    getRefreshExpiresIn
};
