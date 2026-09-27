const express = require("express");

const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const chatRoutes = require("./chatRoutes");
const documentRoutes = require("./documentRoutes");
const adminRoutes = require("./adminRoutes");
const crawlerRoutes = require("../crawler/routes/crawlerRoutes");
const knowledgeRoutes = require("../knowledge/knowledgeRoutes");
const cacheRoutes = require("./cacheRoutes");
const securityRoutes = require("./securityRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/chat", chatRoutes);
router.use("/documents", documentRoutes);
router.use("/admin", adminRoutes);
router.use("/crawler", crawlerRoutes);
router.use("/knowledge", knowledgeRoutes);
router.use("/cache", cacheRoutes);
router.use("/security", securityRoutes);

const { getSystemHealth } = require("../controllers/systemController");

router.get("/health", getSystemHealth);

module.exports = router;

