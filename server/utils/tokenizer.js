const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || "7d";

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_TOKEN_SECRET;

    if (secret) {
        return secret;
    }

    if (process.env.NODE_ENV === "production") {
        throw new Error("JWT_SECRET is not configured.");
    }

    return "edumate-development-secret";
};

const generateAccessToken = (user) => {
    return jwt.sign(
        {
            id: user._id.toString(),
            role: user.role
        },
        getJwtSecret(),
        {
            expiresIn: ACCESS_TOKEN_EXPIRES_IN
        }
    );
};

const verifyAccessToken = (token) => {
    return jwt.verify(token, getJwtSecret());
};

module.exports = {
    generateAccessToken,
    verifyAccessToken
};
