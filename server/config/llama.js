const OpenAI = require("openai");
const { AsyncLocalStorage } = require("async_hooks");

global.chatLocalStorage = global.chatLocalStorage || new AsyncLocalStorage();

const rawLlama = new OpenAI({
  apiKey: "local",
  baseURL: "http://127.0.0.1:8080/v1",
});

const llama = {
  ...rawLlama,
  chat: {
    completions: {
      create: async (body, options = {}) => {
        const store = global.chatLocalStorage?.getStore();
        const onChunk = store?.onChunk;
        
        // Dynamically require llmService to avoid circular dependency
        const llmService = require("../ai/services/llmService");
        
        const fullText = await llmService.fetchLlamaCompletion(body.messages, onChunk);
        
        return {
          choices: [
            {
              message: {
                content: fullText
              }
            }
          ]
        };
      }
    }
  }
};

module.exports = llama;
