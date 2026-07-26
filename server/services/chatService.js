const chatService = require("../ai/services/chatService");

module.exports = {
    askQuestion: chatService.askQuestion,
    listChats: chatService.listChats,
    getChatDetails: chatService.getChatDetails,
    renameChat: chatService.renameChat,
    deleteChat: chatService.deleteChat,
    regenerateResponse: chatService.regenerateResponse,
    getSuggestedQuestions: chatService.getSuggestedQuestions
};
