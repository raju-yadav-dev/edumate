/**
 * Cache Controller — Production 10-Layer Smart Cache Endpoints
 * EduMate Mission 17
 */

const cacheService = require("../services/cacheService");
const { sendSuccess, sendError } = require("../utils/responseUtil");

/**
 * GET /api/cache/stats
 * Returns complete 10-layer telemetry, hit ratios, memory, disk usage, evictions, etc.
 */
const getCacheStats = async (req, res) => {
    try {
        const stats = cacheService.getStats();
        return sendSuccess(res, 200, "Cache statistics retrieved successfully.", stats);
    } catch (err) {
        return sendError(res, 500, `Failed to retrieve cache stats: ${err.message}`);
    }
};

/**
 * POST /api/cache/clear
 * Clears all cache layers or a specific layer
 */
const clearCache = async (req, res) => {
    try {
        const { layer, category } = req.body || {};

        if (category) {
            const count = cacheService.invalidateCategory(category);
            return sendSuccess(res, 200, `Category '${category}' cache invalidated across all layers.`, { count });
        }

        if (layer !== undefined && layer !== null) {
            const layerNum = Number(layer);
            let clearedCount = 0;
            switch (layerNum) {
                case 1: clearedCount = cacheService.l1.clear(); break;
                case 2: clearedCount = cacheService.l2.clear(); break;
                case 3: clearedCount = cacheService.l3.clear(); break;
                case 4: clearedCount = cacheService.l4.clear(); break;
                case 5: clearedCount = cacheService.l5.clear(); break;
                case 6: clearedCount = cacheService.l6.clear(); break;
                case 7: clearedCount = cacheService.l7.clear(); break;
                case 8: clearedCount = cacheService.l8.clear(); break;
                case 9: clearedCount = cacheService.l9.clear(); break;
                case 10: clearedCount = cacheService.l10.clear(); break;
                default:
                    return sendError(res, 400, `Invalid layer number: ${layer}. Expected 1-10.`);
            }
            return sendSuccess(res, 200, `Layer ${layerNum} cache cleared successfully.`, { layer: layerNum, clearedCount });
        }

        await cacheService.invalidateAll();
        return sendSuccess(res, 200, "All 10 cache layers purged successfully.", { allCleared: true });
    } catch (err) {
        return sendError(res, 500, `Failed to clear cache: ${err.message}`);
    }
};

/**
 * POST /api/cache/warm
 * Triggers startup warming routine for FAQs and analytics
 */
const warmCache = async (req, res) => {
    try {
        const warmedCount = cacheService.warmCache();
        return sendSuccess(res, 200, `Cache warming completed successfully.`, { warmedEntries: warmedCount });
    } catch (err) {
        return sendError(res, 500, `Failed to warm cache: ${err.message}`);
    }
};

/**
 * POST /api/cache/invalidate
 * Invalidates specific category, document, or model
 */
const invalidateCache = async (req, res) => {
    try {
        const { category, documentId, target } = req.body || {};

        if (target === "embeddings") {
            cacheService.invalidateEmbeddingModelChange();
            return sendSuccess(res, 200, "Embedding caches invalidated successfully.");
        }

        if (target === "llm") {
            cacheService.invalidateLLMModelChange();
            return sendSuccess(res, 200, "LLM Response and KV caches invalidated successfully.");
        }

        if (documentId) {
            cacheService.invalidateDelete(documentId, category || "");
            return sendSuccess(res, 200, `Document ${documentId} cache invalidated successfully.`);
        }

        if (category) {
            const count = cacheService.invalidateCategory(category);
            return sendSuccess(res, 200, `Category '${category}' invalidated successfully.`, { count });
        }

        return sendError(res, 400, "Please provide category, documentId, or target to invalidate.");
    } catch (err) {
        return sendError(res, 500, `Failed to invalidate cache: ${err.message}`);
    }
};

module.exports = {
    getCacheStats,
    clearCache,
    warmCache,
    invalidateCache
};
