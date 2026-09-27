/**
 * EduMate Task 11 — Unified Model Registry & Configuration Profiles
 * 
 * Central registry of all supported local GGUF models.
 * Switching models requires only updating .env (LLM_MODEL) and reloading.
 */

const MODEL_REGISTRY = Object.freeze({
    // --- Qwen Family ---
    "qwen3-1.7b": {
        id: "qwen3-1.7b",
        displayName: "Qwen 3 1.7B Instruct",
        filenameMatch: /qwen.*1\.7b/i,
        provider: "llama.cpp",
        family: "qwen",
        contextSize: 4096,
        recommendedMaxTokens: 512,
        recommendedTemperature: 0.2,
        recommendedTopP: 0.9,
        recommendedTopK: 40,
        recommendedRepeatPenalty: 1.1,
        recommendedMinP: 0.05,
        recommendedThreads: 4,
        recommendedBatchSize: 512,
        recommendedGpuLayers: 0,
        supportsStreaming: true,
        supportsThinking: false, // Explicitly disabled for ultra-fast RAG
        supportsVision: false,
        stopSequences: ["<|im_end|>", "<|endoftext|>", "<|im_start|>"],
        description: "Ultra-fast lightweight reasoning model optimized for 5-10s EduMate RAG responses on CPU."
    },
    "qwen3-4b": {
        id: "qwen3-4b",
        displayName: "Qwen 3 4B Instruct",
        filenameMatch: /qwen.*4b/i,
        provider: "llama.cpp",
        family: "qwen",
        contextSize: 8192,
        recommendedMaxTokens: 768,
        recommendedTemperature: 0.3,
        recommendedTopP: 0.9,
        recommendedTopK: 40,
        recommendedRepeatPenalty: 1.1,
        recommendedMinP: 0.05,
        recommendedThreads: 6,
        recommendedBatchSize: 512,
        recommendedGpuLayers: 16,
        supportsStreaming: true,
        supportsThinking: false,
        supportsVision: false,
        stopSequences: ["<|im_end|>", "<|endoftext|>", "<|im_start|>"],
        description: "Balanced capability and speed for complex academic syntheses."
    },
    "qwen2.5-3b": {
        id: "qwen2.5-3b",
        displayName: "Qwen 2.5 3B Instruct",
        filenameMatch: /qwen.*2\.5.*3b/i,
        provider: "llama.cpp",
        family: "qwen",
        contextSize: 8192,
        recommendedMaxTokens: 640,
        recommendedTemperature: 0.25,
        recommendedTopP: 0.9,
        recommendedTopK: 40,
        recommendedRepeatPenalty: 1.1,
        recommendedMinP: 0.05,
        recommendedThreads: 6,
        recommendedBatchSize: 512,
        recommendedGpuLayers: 12,
        supportsStreaming: true,
        supportsThinking: false,
        supportsVision: false,
        stopSequences: ["<|im_end|>", "<|endoftext|>", "<|im_start|>"],
        description: "High-accuracy compact Qwen model with multilingual proficiency."
    },
    "qwen2.5-7b": {
        id: "qwen2.5-7b",
        displayName: "Qwen 2.5 7B Instruct",
        filenameMatch: /qwen.*2\.5.*7b/i,
        provider: "llama.cpp",
        family: "qwen",
        contextSize: 8192,
        recommendedMaxTokens: 1024,
        recommendedTemperature: 0.3,
        recommendedTopP: 0.9,
        recommendedTopK: 40,
        recommendedRepeatPenalty: 1.1,
        recommendedMinP: 0.05,
        recommendedThreads: 8,
        recommendedBatchSize: 512,
        recommendedGpuLayers: 24,
        supportsStreaming: true,
        supportsThinking: false,
        supportsVision: false,
        stopSequences: ["<|im_end|>", "<|endoftext|>", "<|im_start|>"],
        description: "High-precision university research grade assistant."
    },

    // --- Llama Family ---
    "llama-3.2-1b": {
        id: "llama-3.2-1b",
        displayName: "Llama 3.2 1B Instruct",
        filenameMatch: /llama.*3\.2.*1b/i,
        provider: "llama.cpp",
        family: "llama",
        contextSize: 4096,
        recommendedMaxTokens: 512,
        recommendedTemperature: 0.2,
        recommendedTopP: 0.9,
        recommendedTopK: 40,
        recommendedRepeatPenalty: 1.1,
        recommendedMinP: 0.05,
        recommendedThreads: 4,
        recommendedBatchSize: 512,
        recommendedGpuLayers: 0,
        supportsStreaming: true,
        supportsThinking: false,
        supportsVision: false,
        stopSequences: ["<|eot_id|>", "<|end_of_text|>"],
        description: "Ultra-compact edge model with sub-second response capabilities."
    },
    "llama-3.2-3b": {
        id: "llama-3.2-3b",
        displayName: "Llama 3.2 3B Instruct",
        filenameMatch: /llama.*3\.2.*3b/i,
        provider: "llama.cpp",
        family: "llama",
        contextSize: 8192,
        recommendedMaxTokens: 768,
        recommendedTemperature: 0.2,
        recommendedTopP: 0.9,
        recommendedTopK: 40,
        recommendedRepeatPenalty: 1.1,
        recommendedMinP: 0.05,
        recommendedThreads: 6,
        recommendedBatchSize: 512,
        recommendedGpuLayers: 12,
        supportsStreaming: true,
        supportsThinking: false,
        supportsVision: false,
        stopSequences: ["<|eot_id|>", "<|end_of_text|>"],
        description: "Meta's efficient lightweight model for fast on-device queries."
    },
    "llama-3.1-8b": {
        id: "llama-3.1-8b",
        displayName: "Llama 3.1 8B Instruct",
        filenameMatch: /llama.*3\.1.*8b/i,
        provider: "llama.cpp",
        family: "llama",
        contextSize: 8192,
        recommendedMaxTokens: 1024,
        recommendedTemperature: 0.2,
        recommendedTopP: 0.9,
        recommendedTopK: 40,
        recommendedRepeatPenalty: 1.1,
        recommendedMinP: 0.05,
        recommendedThreads: 8,
        recommendedBatchSize: 512,
        recommendedGpuLayers: 28,
        supportsStreaming: true,
        supportsThinking: false,
        supportsVision: false,
        stopSequences: ["<|eot_id|>", "<|end_of_text|>"],
        description: "Flagship open weights model for detailed institutional answers."
    },

    // --- Gemma Family ---
    "gemma-2-2b": {
        id: "gemma-2-2b",
        displayName: "Gemma 2 2B Instruct",
        filenameMatch: /gemma.*2.*2b|gemma.*2b/i,
        provider: "llama.cpp",
        family: "gemma",
        contextSize: 4096,
        recommendedMaxTokens: 512,
        recommendedTemperature: 0.2,
        recommendedTopP: 0.9,
        recommendedTopK: 40,
        recommendedRepeatPenalty: 1.1,
        recommendedMinP: 0.05,
        recommendedThreads: 4,
        recommendedBatchSize: 512,
        recommendedGpuLayers: 0,
        supportsStreaming: true,
        supportsThinking: false,
        supportsVision: false,
        stopSequences: ["<end_of_turn>", "<eos>"],
        description: "Google's high-efficiency lightweight Gemma architecture."
    },
    "gemma-3b": {
        id: "gemma-3b",
        displayName: "Gemma 3B Instruct",
        filenameMatch: /gemma.*3b/i,
        provider: "llama.cpp",
        family: "gemma",
        contextSize: 8192,
        recommendedMaxTokens: 768,
        recommendedTemperature: 0.2,
        recommendedTopP: 0.9,
        recommendedTopK: 40,
        recommendedRepeatPenalty: 1.1,
        recommendedMinP: 0.05,
        recommendedThreads: 6,
        recommendedBatchSize: 512,
        recommendedGpuLayers: 12,
        supportsStreaming: true,
        supportsThinking: false,
        supportsVision: false,
        stopSequences: ["<end_of_turn>", "<eos>"],
        description: "Optimized Gemma variant for classroom and tutoring assistance."
    },

    // --- Mistral Family ---
    "mistral-7b": {
        id: "mistral-7b",
        displayName: "Mistral 7B Instruct v0.3",
        filenameMatch: /mistral.*7b/i,
        provider: "llama.cpp",
        family: "mistral",
        contextSize: 8192,
        recommendedMaxTokens: 1024,
        recommendedTemperature: 0.25,
        recommendedTopP: 0.9,
        recommendedTopK: 40,
        recommendedRepeatPenalty: 1.1,
        recommendedMinP: 0.05,
        recommendedThreads: 8,
        recommendedBatchSize: 512,
        recommendedGpuLayers: 24,
        supportsStreaming: true,
        supportsThinking: false,
        supportsVision: false,
        stopSequences: ["</s>", "[/INST]"],
        description: "High reasoning capacity with sliding window attention."
    },
    "mistral-3b": {
        id: "mistral-3b",
        displayName: "Ministral 3B Instruct",
        filenameMatch: /ministral.*3b|mistral.*3b/i,
        provider: "llama.cpp",
        family: "mistral",
        contextSize: 4096,
        recommendedMaxTokens: 640,
        recommendedTemperature: 0.2,
        recommendedTopP: 0.9,
        recommendedTopK: 40,
        recommendedRepeatPenalty: 1.1,
        recommendedMinP: 0.05,
        recommendedThreads: 6,
        recommendedBatchSize: 512,
        recommendedGpuLayers: 10,
        supportsStreaming: true,
        supportsThinking: false,
        supportsVision: false,
        stopSequences: ["</s>", "[/INST]"],
        description: "Fast sub-4B Mistral variant for snappy edge answers."
    },

    // --- Phi Family ---
    "phi-3.5-mini": {
        id: "phi-3.5-mini",
        displayName: "Phi 3.5 Mini Instruct",
        filenameMatch: /phi.*3\.5.*mini|phi.*3.*mini/i,
        provider: "llama.cpp",
        family: "phi",
        contextSize: 4096,
        recommendedMaxTokens: 640,
        recommendedTemperature: 0.2,
        recommendedTopP: 0.9,
        recommendedTopK: 40,
        recommendedRepeatPenalty: 1.1,
        recommendedMinP: 0.05,
        recommendedThreads: 6,
        recommendedBatchSize: 512,
        recommendedGpuLayers: 10,
        supportsStreaming: true,
        supportsThinking: false,
        supportsVision: false,
        stopSequences: ["<|end|>", "<|user|>", "<|assistant|>"],
        description: "Microsoft's high reasoning density small model."
    },
    "phi-4": {
        id: "phi-4",
        displayName: "Phi 4 Instruct",
        filenameMatch: /phi.*4/i,
        provider: "llama.cpp",
        family: "phi",
        contextSize: 8192,
        recommendedMaxTokens: 1024,
        recommendedTemperature: 0.2,
        recommendedTopP: 0.9,
        recommendedTopK: 40,
        recommendedRepeatPenalty: 1.1,
        recommendedMinP: 0.05,
        recommendedThreads: 8,
        recommendedBatchSize: 512,
        recommendedGpuLayers: 24,
        supportsStreaming: true,
        supportsThinking: false,
        supportsVision: false,
        stopSequences: ["<|im_end|>", "<|endoftext|>"],
        description: "Next-gen small language model with state of the art STEM comprehension."
    },

    // --- Tiny Models ---
    "tinyllama-1.1b": {
        id: "tinyllama-1.1b",
        displayName: "TinyLlama 1.1B Chat",
        filenameMatch: /tinyllama/i,
        provider: "llama.cpp",
        family: "tinyllama",
        contextSize: 2048,
        recommendedMaxTokens: 256,
        recommendedTemperature: 0.2,
        recommendedTopP: 0.9,
        recommendedTopK: 40,
        recommendedRepeatPenalty: 1.1,
        recommendedMinP: 0.05,
        recommendedThreads: 4,
        recommendedBatchSize: 256,
        recommendedGpuLayers: 0,
        supportsStreaming: true,
        supportsThinking: false,
        supportsVision: false,
        stopSequences: ["</s>", "<|im_end|>"],
        description: "Ultra-compact 1B model for extreme low-power embedded deployment."
    },
    "smollm2-1.7b": {
        id: "smollm2-1.7b",
        displayName: "SmolLM2 1.7B Instruct",
        filenameMatch: /smollm/i,
        provider: "llama.cpp",
        family: "smollm",
        contextSize: 4096,
        recommendedMaxTokens: 512,
        recommendedTemperature: 0.2,
        recommendedTopP: 0.9,
        recommendedTopK: 40,
        recommendedRepeatPenalty: 1.1,
        recommendedMinP: 0.05,
        recommendedThreads: 4,
        recommendedBatchSize: 512,
        recommendedGpuLayers: 0,
        supportsStreaming: true,
        supportsThinking: false,
        supportsVision: false,
        stopSequences: ["<|im_end|>", "<|endoftext|>"],
        description: "Hugging Face's compact high-efficiency student assistant model."
    }
});

/**
 * Detect model profile based on model filename or configured string.
 * @param {string} modelString - Model filename or model ID
 * @returns {Object} Matching model profile with fallback defaults
 */
const detectModelProfile = (modelString = "") => {
    const raw = String(modelString || "").trim();
    if (!raw) return MODEL_REGISTRY["qwen3-1.7b"];

    // 1. Direct ID match
    const lower = raw.toLowerCase();
    if (MODEL_REGISTRY[lower]) {
        return MODEL_REGISTRY[lower];
    }

    // 2. Regex pattern match across known models
    for (const [key, profile] of Object.entries(MODEL_REGISTRY)) {
        if (profile.filenameMatch && profile.filenameMatch.test(raw)) {
            return profile;
        }
    }

    // 3. Fallback generic profile
    return {
        id: "custom-gguf",
        displayName: raw.replace(/\.gguf$/i, ""),
        filenameMatch: /.*/,
        provider: "llama.cpp",
        family: "generic",
        contextSize: 4096,
        recommendedMaxTokens: 512,
        recommendedTemperature: 0.2,
        recommendedTopP: 0.9,
        recommendedTopK: 40,
        recommendedRepeatPenalty: 1.1,
        recommendedMinP: 0.05,
        recommendedThreads: 4,
        recommendedBatchSize: 512,
        recommendedGpuLayers: 0,
        supportsStreaming: true,
        supportsThinking: false,
        supportsVision: false,
        stopSequences: ["<|im_end|>", "<|endoftext|>", "</s>"],
        description: "Generic GGUF local model."
    };
};

/**
 * Lists all supported model profiles in the registry.
 */
const getAllModelProfiles = () => Object.values(MODEL_REGISTRY);

module.exports = {
    MODEL_REGISTRY,
    detectModelProfile,
    getAllModelProfiles
};
