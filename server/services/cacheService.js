/**
 * EduMate Mission 17 — 10-Layer Smart Cache Service (Production Grade)
 * 
 * High-performance multi-layer caching architecture accelerating:
 * - LLM generation, RAG retrieval, embeddings, chunk loading,
 * - prompt construction, conversation memory, and repeated responses.
 * 
 * Entirely local (Windows filesystem + in-memory LRU; zero Redis).
 */

const smartCacheHub = require("./cache/SmartCacheHub");

const RETRIEVAL_CACHE_TTL = Number(process.env.RETRIEVAL_CACHE_TTL || 900);
const CONTEXT_CACHE_TTL = Number(process.env.CONTEXT_CACHE_TTL || 3600 * 24);
const CACHE_STATIC_TTL = Number(process.env.CACHE_STATIC_TTL || 1800);
const CACHE_DYNAMIC_TTL = Number(process.env.CACHE_DYNAMIC_TTL || 60);

// =========================================================================
// LAYER 7 (LLM RESPONSE CACHE) API
// =========================================================================

const get = async (query, routingMode = "RAG_LLM", contextHash = "nocontext", documentType = "all", department = "all") => {
    const kbVersion = smartCacheHub.getKbVersion();
    return smartCacheHub.l7.get(query, routingMode, contextHash, documentType, department, kbVersion);
};

const set = async (query, value, categories = [], routingMode = "RAG_LLM", contextHash = "nocontext", documentType = "all", department = "all", customTtl = null) => {
    const kbVersion = smartCacheHub.getKbVersion();
    return smartCacheHub.l7.set(query, value, categories, routingMode, contextHash, documentType, department, kbVersion, customTtl);
};

const del = async (query, routingMode = "RAG_LLM", contextHash = "nocontext", documentType = "all", department = "all") => {
    const kbVersion = smartCacheHub.getKbVersion();
    return smartCacheHub.l7.del(query, routingMode, contextHash, documentType, department, kbVersion);
};

// =========================================================================
// LAYER 6 (RETRIEVAL CACHE) API
// =========================================================================

const getRetrievalCache = async (query, metadataFilters = {}, institution = "all", topK = null) => {
    const kbVersion = smartCacheHub.getKbVersion();
    return smartCacheHub.l6.get(query, metadataFilters, kbVersion, institution, topK);
};

const setRetrievalCache = async (query, metadataFilters = {}, candidates = [], categories = [], institution = "all", topK = null, ttl = null) => {
    const kbVersion = smartCacheHub.getKbVersion();
    return smartCacheHub.l6.set(query, metadataFilters, candidates, categories, kbVersion, institution, topK, ttl);
};

// =========================================================================
// LAYER 8 (CONTEXT CACHE) API
// =========================================================================

const getContextCache = async (chunkIds = []) => {
    const kbVersion = smartCacheHub.getKbVersion();
    return smartCacheHub.l8.getMergedContext(chunkIds, kbVersion);
};

const setContextCache = async (chunkIds = [], mergedContext = null, ttl = null) => {
    const kbVersion = smartCacheHub.getKbVersion();
    return smartCacheHub.l8.setMergedContext(chunkIds, mergedContext, kbVersion, ttl);
};

// =========================================================================
// KNOWLEDGE BASE VERSIONING & INVALIDATION
// =========================================================================

const getKbVersion = async () => {
    return smartCacheHub.getKbVersion();
};

const incrementKbVersion = async () => {
    return smartCacheHub.incrementKbVersion();
};

const invalidateCategory = async (category) => {
    return smartCacheHub.invalidateCategory(category);
};

const invalidateAll = async () => {
    return smartCacheHub.invalidateAll();
};

// Lifecycle Invalidation Hooks
const invalidateUpload = (document) => smartCacheHub.invalidateUpload(document);
const invalidateRechunk = (documentId, category) => smartCacheHub.invalidateRechunk(documentId, category);
const invalidateDelete = (documentId, category) => smartCacheHub.invalidateDelete(documentId, category);
const invalidateReindex = (category) => smartCacheHub.invalidateReindex(category);
const invalidateDocumentUpdate = (documentId, category) => smartCacheHub.invalidateDocumentUpdate(documentId, category);
const invalidateEmbeddingModelChange = () => smartCacheHub.invalidateEmbeddingModelChange();
const invalidateLLMModelChange = () => smartCacheHub.invalidateLLMModelChange();

// Cache Warming
const warmCache = () => smartCacheHub.warmStartupCache();
const recordLatencySaved = (savedMs) => smartCacheHub.recordLatencySaved(savedMs);

// =========================================================================
// METRICS & TELEMETRY MONITORING
// =========================================================================

const getStats = () => {
    const fullStats = smartCacheHub.getStats();
    const l7Stats = fullStats.layers.layer7_llmResponses;
    const l6Stats = fullStats.layers.layer6_retriever;
    const l8Stats = fullStats.layers.layer8_conversationContext;

    return {
        hits: l7Stats.hits,
        misses: l7Stats.misses,
        hitRate: l7Stats.hitRate,
        retrievalHits: l6Stats.hits,
        retrievalMisses: l6Stats.misses,
        retrievalHitRate: l6Stats.hitRate,
        contextHits: l8Stats.hits,
        contextMisses: l8Stats.misses,
        llmCallsAvoided: l7Stats.llmCallsAvoided,
        totalResponseTime: fullStats.global.avgLookupTimeMs,
        totalRequestsCount: fullStats.global.totalHits + fullStats.global.totalMisses,
        global: fullStats.global,
        layers: fullStats.layers
    };
};

const getCacheSize = () => {
    const stats = smartCacheHub.getStats();
    return stats.global.totalEntries || 0;
};

const generateCacheReport = () => {
    return smartCacheHub.generateCacheReport();
};

module.exports = {
    // LLM Response & Retrieval API
    get,
    set,
    del,
    getRetrievalCache,
    setRetrievalCache,
    getContextCache,
    setContextCache,
    invalidateCategory,
    invalidateAll,
    getKbVersion,
    incrementKbVersion,
    getStats,
    getCacheSize,
    warmCache,
    recordLatencySaved,
    RETRIEVAL_CACHE_TTL,
    CONTEXT_CACHE_TTL,
    CACHE_STATIC_TTL,
    CACHE_DYNAMIC_TTL,

    // Lifecycle Invalidation
    invalidateUpload,
    invalidateRechunk,
    invalidateDelete,
    invalidateReindex,
    invalidateDocumentUpdate,
    invalidateEmbeddingModelChange,
    invalidateLLMModelChange,

    // Hub and Layer Access
    smartCacheHub,
    generateCacheReport,
    l1: smartCacheHub.l1,
    l2: smartCacheHub.l2,
    l3: smartCacheHub.l3,
    l4: smartCacheHub.l4,
    l5: smartCacheHub.l5,
    l6: smartCacheHub.l6,
    l7: smartCacheHub.l7,
    l8: smartCacheHub.l8,
    l9: smartCacheHub.l9,
    l10: smartCacheHub.l10
};
