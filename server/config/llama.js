const { AsyncLocalStorage } = require("async_hooks");
const { getLlmConfig } = require("./llm");

global.chatLocalStorage = global.chatLocalStorage || new AsyncLocalStorage();

const llama = {
  chat: {
    completions: {
      create: async (body, options = {}) => {
        const store = global.chatLocalStorage?.getStore();
        const onChunk = store?.onChunk || options.onChunk || body.onChunk;
        const config = getLlmConfig();
        
        // Dynamically require llmService to avoid circular dependency
        const llmService = require("../ai/services/llmService");
        const signal = store?.signal || options.signal || body.signal || null;

        
        const mergedOptions = {
          model: body.model || config.model,
          temperature: body.temperature !== undefined ? body.temperature : config.temperature,
          topP: body.top_p !== undefined ? body.top_p : (body.topP !== undefined ? body.topP : config.topP),
          maxTokens: body.max_tokens !== undefined ? body.max_tokens : (body.maxTokens !== undefined ? body.maxTokens : config.maxTokens),
          stream: body.stream !== undefined ? body.stream : Boolean(onChunk && config.stream),
          signal,
          ...options
        };


        const fullText = await llmService.fetchLlamaCompletion(body.messages, onChunk, mergedOptions);
        
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
