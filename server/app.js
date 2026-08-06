const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const documentRoutes = require("./routes/documentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const apiRoutes = require("./routes/apiRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const uploadRoutes = require("./routes/uploadRoutes");
const storageRoutes = require("./routes/storageRoutes");
const mapRoutes = require("./routes/mapRoutes");

const app = express();

const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

function isAllowedOrigin(origin) {
    if (!origin) {
        return true;
    }

    if (allowedOrigins.length === 0) {
        return true;
    }

    if (allowedOrigins.includes(origin)) {
        return true;
    }

    return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);
}

// ==============================
// Middlewares
// ==============================

app.use(helmet());
app.use(compression());

app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    optionsSuccessStatus: 200,
    credentials: true
}));

app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.API_RATE_LIMIT_MAX || 300),
    standardHeaders: true,
    legacyHeaders: false
}));

app.use(express.json({
    limit: "1mb"
}));

app.use(express.urlencoded({
    extended: true,
    limit: "1mb"
}));

app.use(cookieParser());

app.use("/api/v1", apiRoutes);

// Backward compatible route aliases while the frontend migrates to /api/v1.
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/storage", storageRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/map", mapRoutes);
const crawlerRoutes = require("./crawler/routes/crawlerRoutes");
app.use("/api/crawler", crawlerRoutes);
const knowledgeRoutes = require("./knowledge/knowledgeRoutes");
app.use("/api/knowledge", knowledgeRoutes);

// ==============================
// Test Route
// ==============================

app.get("/", (req, res) => {

    res.status(200).json({

        success: true,

        message: "EduMate Backend Running",
        data: {
            apiVersion: "v1",
            health: "/api/v1/health"
        },
        errors: null

    });

});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
