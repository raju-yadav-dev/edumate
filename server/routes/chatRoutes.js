const express = require("express");

const { optionalAuthenticate } = require("../middleware/authMiddleware");
const { askQuestion } = require("../controllers/chatController");

const router = express.Router();

router.post("/ask", optionalAuthenticate, askQuestion);

module.exports = router;
