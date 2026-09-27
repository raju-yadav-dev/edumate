/**
 * EduMate Mission 14.1 — Complete 10-Layer Smart Cache Service
 * 
 * High-performance multi-layer caching system utilizing local in-memory LRU
 * and local persistent disk cache (No Redis dependency required).
 */

const smartCacheHub = require("./cache/SmartCacheHub");

const RETRIEVAL_CACHE_TTL = Number(process.env.RETRIEVAL_CACHE_TTL || 600);
const CONTEXT_CACHE_TTL = Number(process.env.CONTEXT_CACHE_TTL || 600);
const CACHE_STATIC_TTL = Number(process.env.CACHE_STATIC_TTL || 86400);
const CACHE_DYNAMIC_TTL = Number(process.env.CACHE_DYNAMIC_TTL || 60);

// =========================================================================
// LAYER 7 (LLM RESPONSE CACHE) BACKWARD COMPATIBILITY
// =========================================================================

const get = async (query, documentType = "all", department = "all", queryMode = "targeted") => {
    const kbVersion = smartCacheHub.getKbVersion();
    const result = smartCacheHub.l7.get(query, documentType, department, queryMode, kbVersion);
    return result;
};

const set = async (query, value, categories = [], isDynamic = false, documentType = "all", department = "all", queryMode = "targeted", customTtl = null) => {
    const kbVersion = smartCacheHub.getKbVersion();
    return smartCacheHub.l7.set(query, value, categories, isDynamic, documentType, department, queryMode, kbVersion, customTtl);
};

const del = async (query, documentType = "all", department = "all", queryMode = "targeted") => {
    const kbVersion = smartCacheHub.getKbVersion();
    return smartCacheHub.l7.del(query, documentType, department, queryMode, kbVersion);
};

// =========================================================================
// LAYER 6 (RETRIEVAL CACHE) BACKWARD COMPATIBILITY
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
// LAYER 8 (CONTEXT CACHE) BACKWARD COMPATIBILITY
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

// Mission 14.1 Lifecycle Invalidation Hooks
const invalidateUpload = (document) => smartCacheHub.invalidateUpload(document);
const invalidateRechunk = (documentId, category) => smartCacheHub.invalidateRechunk(documentId, category);
const invalidateDelete = (documentId, category) => smartCacheHub.invalidateDelete(documentId, category);
const invalidateReindex = (category) => smartCacheHub.invalidateReindex(category);
const invalidateDocumentUpdate = (documentId, category) => smartCacheHub.invalidateDocumentUpdate(documentId, category);

// =========================================================================
// METRICS & TELEMETRY MONITORING
// =========================================================================

const getStats = () => {
    const fullStats = smartCacheHub.getStats();
    const l7Stats = fullStats.layers.layer7_llmResponses;
    const l6Stats = fullStats.layers.layer6_retriever;
    const l8Stats = fullStats.layers.layer8_conversationContext;

    // Backward-compatible fields
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
    let total = 0;
    for (const l of Object.values(stats.layers)) {
        total += (l.size || 0);
    }
    return total;
};

const generateCacheReport = () => {
    return smartCacheHub.generateCacheReport();
};

module.exports = {
    // Legacy API surface
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
    RETRIEVAL_CACHE_TTL,
    CONTEXT_CACHE_TTL,
    CACHE_STATIC_TTL,
    CACHE_DYNAMIC_TTL,

    // Mission 14.1 Lifecycle Invalidation
    invalidateUpload,
    invalidateRechunk,
    invalidateDelete,
    invalidateReindex,
    invalidateDocumentUpdate,

    // Mission 14.1 Architecture & Layers
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
