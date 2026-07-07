const express = require("express");

const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const chatRoutes = require("./chatRoutes");
const documentRoutes = require("./documentRoutes");
const adminRoutes = require("./adminRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/chat", chatRoutes);
router.use("/documents", documentRoutes);
router.use("/admin", adminRoutes);

router.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "EduMate API healthy",
        data: {
            service: "edumate-api",
            version: "v1",
            timestamp: new Date().toISOString()
        },
        errors: null
    });
});

module.exports = router;
