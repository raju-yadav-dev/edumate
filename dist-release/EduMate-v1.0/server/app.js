const expressInitStart = Date.now();
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

// Request Cleanup Middleware (Requirement 3)
app.use((req, res, next) => {
    const cleanup = () => {
        if (req.file) {
            if (req.file.buffer) req.file.buffer = null;
            req.file = null;
        }
        if (req.files) {
            if (Array.isArray(req.files)) {
                req.files.forEach(f => {
                    if (f.buffer) f.buffer = null;
                });
            } else if (typeof req.files === "object") {
                Object.keys(req.files).forEach(key => {
                    if (Array.isArray(req.files[key])) {
                        req.files[key].forEach(f => {
                            if (f.buffer) f.buffer = null;
                        });
                    }
                });
            }
            req.files = null;
        }
        if (req.body) {
            req.body = null;
        }
        if (global.gc) {
            try {
                global.gc();
            } catch (gcErr) {}
        }
    };
    res.on("finish", cleanup);
    res.on("close", cleanup);
    next();
});

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

const { securitySanitizerMiddleware } = require("./middleware/securitySanitizer");
const { chatRateLimiter, uploadRateLimiter, loginRateLimiter, healthRateLimiter } = require("./middleware/rateLimiters");
const securityRoutes = require("./routes/securityRoutes");

app.use(securitySanitizerMiddleware);

if (global.startupTimer) {
    global.startupTimer.log("Express initialised", Date.now() - expressInitStart);
}
const routesInitStart = Date.now();

app.use("/api/v1", apiRoutes);

// Backward compatible route aliases while the frontend migrates to /api/v1.
app.use("/api/auth/login", loginRateLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRateLimiter, chatRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/admin/security", securityRoutes);
app.use("/api/security", securityRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/storage", storageRoutes);
app.use("/api/upload", uploadRateLimiter, uploadRoutes);
app.use("/api/map", mapRoutes);
const crawlerRoutes = require("./crawler/routes/crawlerRoutes");
app.use("/api/crawler", crawlerRoutes);
const knowledgeRoutes = require("./knowledge/knowledgeRoutes");
app.use("/api/knowledge", knowledgeRoutes);
const benchmarkRoutes = require("./routes/benchmarkRoutes");
app.use("/api/benchmark", benchmarkRoutes);
const analyticsRoutes = require("./routes/analyticsRoutes");
app.use("/api/analytics", analyticsRoutes);
const validationRoutes = require("./routes/validationRoutes");
app.use("/api/validation", validationRoutes);
const demoRoutes = require("./routes/demoRoutes");
app.use("/api/demo", demoRoutes);
const cacheRoutes = require("./routes/cacheRoutes");
app.use("/api/cache", cacheRoutes);

const { getSystemHealth } = require("./controllers/systemController");
app.get("/api/system/health", healthRateLimiter, getSystemHealth);
app.get("/api/health", healthRateLimiter, getSystemHealth);
app.get("/health", healthRateLimiter, getSystemHealth);

if (global.startupTimer) {
    global.startupTimer.log("Routes registered", Date.now() - routesInitStart);
}

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

app.get("/api/debug-docs", async (req, res) => {
    try {
        const Document = require("./models/Document");
        const counts = await Document.aggregate([
            { $group: { _id: "$embeddingStatus", count: { $sum: 1 } } }
        ]);
        const docs = await Document.find({}, { originalName: 1, embeddingStatus: 1, "metadata.error": 1 }).sort({ updatedAt: -1 }).limit(50);
        
        let qdrantStatus = "unknown";
        try {
            const { client } = require("./ai/config/qdrant");
            const collections = await client.getCollections();
            qdrantStatus = { collections };
        } catch (e) {
            qdrantStatus = { error: e.message };
        }

        res.json({ counts, docs, qdrantStatus });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/verify-hod-css", async (req, res) => {
    try {
        const User = require("./models/User");
        const chatService = require("./ai/services/chatService");

        let user = await User.findOne();
        if (!user) {
            user = await User.create({
                fullName: "Test Student",
                email: `test-${Date.now()}@heritageit.edu`,
                password: "Password123",
                role: "student",
                institution: "Brainware University",
                department: "Computational Sciences"
            });
        }

        const queries = [
            "who is the HOD of CSS department?",
            "who is the HOD of CSS?",
            "who is the head of department of computational sciences?",
            "Dr Jayanta Aich",
            "Professor and HoD Department of Computational Sciences"
        ];

        const results = [];
        for (const q of queries) {
            try {
                const result = await chatService.askQuestion({
                    user,
                    question: q,
                    conversationId: null,
                    parentId: null
                });

                results.push({
                    query: q,
                    message: result.message,
                    sources: result.sources,
                    intent: result.intent
                });
            } catch (e) {
                results.push({
                    query: q,
                    error: e.message
                });
            }
        }
        res.json({ success: true, results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/debug-faculty-chunks", async (req, res) => {
    try {
        const localChunkManager = require("./storage/localChunkManager");
        const Document = require("./models/Document");
        const doc = await Document.findOne({ originalName: /Computational Sciences/i }).lean();
        if (!doc) {
            return res.status(404).json({ error: "Document not found" });
        }
        const chunks = await localChunkManager.getDocumentChunks(doc._id);
        res.json({ doc, chunks });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/search-all-db-chunks", async (req, res) => {
    try {
        const localChunkManager = require("./storage/localChunkManager");
        const Document = require("./models/Document");
        const queryStr = req.query.q || "Jayanta";
        const results = await localChunkManager.searchLocalChunks(queryStr, { limit: 20 });
        const enriched = [];
        for (const c of results) {
            const doc = await Document.findById(c.documentId).lean();
            enriched.push({ chunk: c, doc });
        }
        res.json({ count: results.length, query: queryStr, results: enriched });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
