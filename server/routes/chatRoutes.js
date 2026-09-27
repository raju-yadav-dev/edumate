const express = require("express");
const authenticate = require("../middleware/authMiddleware");
const { optionalAuthenticate } = authenticate;
const {
    askQuestion,
    listChats,
    getChatDetails,
    renameChat,
    deleteChat,
    searchChats,
    regenerateResponse,
    getSuggestedQuestions
} = require("../controllers/chatController");

const router = express.Router();

// Public / Guest optional chat endpoint
router.post("/ask", optionalAuthenticate, askQuestion);

// Get suggested questions for guest or user
router.get("/:id/suggested-questions", optionalAuthenticate, getSuggestedQuestions);

// Search chat history (must come before /:id)
router.get("/search", authenticate, searchChats);

// Authenticated user chat history endpoints
router.get("/", authenticate, listChats);
router.get("/:id", authenticate, getChatDetails);
router.put("/:id/rename", authenticate, renameChat);
router.delete("/:id", authenticate, deleteChat);
router.post("/:id/regenerate", authenticate, regenerateResponse);

module.exports = router;
