/**
 * Layer 8 — Conversation / Context Cache
 * EduMate Mission 14.1
 * 
 * Responsibilities:
 * - Keep active conversation summaries, titles, and recent message turns in server memory
 * - Eliminate repeated MongoDB queries during conversational multi-turn dialogue
 * - Cache merged document chunk context arrays by chunk IDs signature
 */

const crypto = require("crypto");
const BaseLRUCache = require("./BaseLRUCache");

class Layer8_ConversationContextCache {
    constructor() {
        const ttl = Number(process.env.CACHE_LAYER8_TTL || process.env.CONTEXT_CACHE_TTL || 600); // 10 minutes
        const maxEntries = Number(process.env.CACHE_LAYER8_MAX || 300);

        this.conversationCache = new BaseLRUCache({
            name: "Layer8_ConversationContext",
            maxEntries,
            defaultTtlSeconds: ttl
        });

        this.mergedContextCache = new BaseLRUCache({
            name: "Layer8_MergedContext",
            maxEntries: maxEntries * 2,
            defaultTtlSeconds: ttl
        });
    }

    // --- Conversation & Recent Turns Memory ---
    _convKey(userId, conversationId) {
        return `conv_ctx:${String(userId || "anon")}:${String(conversationId || "default")}`;
    }

    getConversationContext(userId, conversationId) {
        if (!userId || !conversationId) return null;
        const key = this._convKey(userId, conversationId);
        return this.conversationCache.get(key);
    }

    setConversationContext(userId, conversationId, contextData, ttl = null) {
        if (!userId || !conversationId || !contextData) return false;
        const key = this._convKey(userId, conversationId);
        return this.conversationCache.set(key, contextData, ttl);
    }

    getRecentMemory(userId, conversationId, limit = 6) {
        const ctx = this.getConversationContext(userId, conversationId);
        if (!ctx || !Array.isArray(ctx.recentMessages)) return null;
        return ctx.recentMessages.slice(-limit);
    }

    appendMessageToContext(userId, conversationId, message) {
        if (!userId || !conversationId || !message) return;
        const key = this._convKey(userId, conversationId);
        const ctx = this.conversationCache.get(key) || { title: "Chat", summary: "", recentMessages: [], totalMessages: 0 };
        ctx.recentMessages = Array.isArray(ctx.recentMessages) ? ctx.recentMessages : [];
        ctx.recentMessages.push({
            role: message.role,
            content: message.content,
            sources: message.sources || [],
            createdAt: message.createdAt || new Date().toISOString()
        });
        if (ctx.recentMessages.length > 20) {
            ctx.recentMessages = ctx.recentMessages.slice(-20);
        }
        ctx.totalMessages = (ctx.totalMessages || 0) + 1;
        this.conversationCache.set(key, ctx);
    }

    invalidateConversation(userId, conversationId) {
        if (!userId || !conversationId) return;
        const key = this._convKey(userId, conversationId);
        this.conversationCache.delete(key);
    }

    // --- Merged Chunk Context Cache ---
    _buildContextKey(chunkIds = [], kbVersion = "1") {
        const sortedIds = [...chunkIds].map(String).sort().join(",");
        const hash = crypto.createHash("sha256").update(sortedIds).digest("hex").slice(0, 24);
        return `merged_ctx:v1:kb${kbVersion}:${hash}`;
    }

    getMergedContext(chunkIds = [], kbVersion = "1") {
        if (!chunkIds || chunkIds.length === 0) return null;
        const key = this._buildContextKey(chunkIds, kbVersion);
        return this.mergedContextCache.get(key);
    }

    setMergedContext(chunkIds = [], mergedContext = null, kbVersion = "1", ttl = null) {
        if (!chunkIds || chunkIds.length === 0 || !mergedContext) return false;
        const key = this._buildContextKey(chunkIds, kbVersion);
        return this.mergedContextCache.set(key, mergedContext, ttl);
    }

    clear() {
        this.conversationCache.clear();
        this.mergedContextCache.clear();
    }

    getStats() {
        const convStats = this.conversationCache.getStats();
        const mergedStats = this.mergedContextCache.getStats();

        const totalHits = convStats.hits + mergedStats.hits;
        const totalMisses = convStats.misses + mergedStats.misses;
        const totalOps = totalHits + totalMisses;
        const hitRatePct = totalOps > 0 ? Number(((totalHits / totalOps) * 100).toFixed(2)) : 0;
        const memoryBytes = convStats.memoryBytes + mergedStats.memoryBytes;

        return {
            layer: 8,
            name: "Layer 8 — Conversation / Context Cache",
            size: convStats.size + mergedStats.size,
            hits: totalHits,
            misses: totalMisses,
            hitRate: `${hitRatePct}%`,
            hitRatePercent: hitRatePct,
            evictions: convStats.evictions + mergedStats.evictions,
            avgLookupTimeMs: Number(((convStats.avgLookupTimeMs + mergedStats.avgLookupTimeMs) / 2).toFixed(3)),
            memoryBytes,
            memoryFormatted: this.conversationCache._formatBytes(memoryBytes),
            status: "healthy"
        };
    }
}

module.exports = new Layer8_ConversationContextCache();
