const AI_CONSTANTS = Object.freeze({
    // Models
    COMPLETION_MODEL: "gemini-3.5-flash",
    EMBEDDING_MODEL: "gemini-embedding-001",

    // Document Ingestion Chunking
    CHUNK_SIZE: 800,
    CHUNK_OVERLAP: 150,
    CHUNK_SEPARATORS: ["\n\n", "\n", " ", ""],

    // Vector Similarity Search
    SIMILARITY_THRESHOLD: 0.50,
    DEFAULT_RETRIEVAL_LIMIT: 6,
    MAX_RAG_CHUNKS: 4,
    MAX_RAG_CHUNKS_PER_INTENT: 3,
    MAX_CHUNK_CHARS: 4500,
    MAX_HISTORY_TOKENS: 500,
    MAX_OUTPUT_TOKENS: 500,

    // RAG fallback response
    FALLBACK_RESPONSE: "I am sorry, but that information could not be found in the uploaded university documents.",

    // Token Estimators
    CHARS_PER_TOKEN: 4,
    MAX_CONTEXT_TOKENS: 1200
});

module.exports = AI_CONSTANTS;
