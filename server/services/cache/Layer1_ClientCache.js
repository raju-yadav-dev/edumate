/**
 * Layer 1 — Client/UI Cache
 * EduMate Mission 14.1
 * 
 * Responsibilities:
 * - Cache recent chats & conversation history in fast memory
 * - Cache citations by query/message ID
 * - Cache user typing states and active voice conversation states
 * - Cache UI search & filter history
 */

const BaseLRUCache = require("./BaseLRUCache");

class Layer1_ClientCache {
    constructor() {
        const ttl = Number(process.env.CACHE_LAYER1_TTL || 300); // 5 minutes
        const maxEntries = Number(process.env.CACHE_LAYER1_MAX || 150);

        this.chatCache = new BaseLRUCache({
            name: "Layer1_ClientUI_Chats",
            maxEntries,
            defaultTtlSeconds: ttl
        });

        this.citationCache = new BaseLRUCache({
            name: "Layer1_ClientUI_Citations",
            maxEntries: maxEntries * 2,
            defaultTtlSeconds: ttl
        });

        this.stateCache = new BaseLRUCache({
            name: "Layer1_ClientUI_State",
            maxEntries: 100,
            defaultTtlSeconds: 60
        });

        this.searchHistoryCache = new BaseLRUCache({
            name: "Layer1_ClientUI_SearchHistory",
            maxEntries: 200,
            defaultTtlSeconds: 1800 // 30 minutes
        });
    }

    // --- Recent Chats Cache ---
    getCachedChats(userId) {
        if (!userId) return null;
        return this.chatCache.get(`user_chats:${userId}`);
    }

    setCachedChats(userId, chats, ttl = null) {
        if (!userId || !chats) return;
        this.chatCache.set(`user_chats:${userId}`, chats, ttl);
    }

    invalidateUserChats(userId) {
        if (!userId) return;
        this.chatCache.delete(`user_chats:${userId}`);
    }

    // --- Citations Cache ---
    getCachedCitations(queryOrMessageId) {
        if (!queryOrMessageId) return null;
        return this.citationCache.get(`citation:${queryOrMessageId}`);
    }

    setCachedCitations(queryOrMessageId, citations, ttl = null) {
        if (!queryOrMessageId || !citations) return;
        this.citationCache.set(`citation:${queryOrMessageId}`, citations, ttl);
    }

    // --- State (Typing, Voice) Cache ---
    getVoiceState(sessionId) {
        if (!sessionId) return null;
        return this.stateCache.get(`voice:${sessionId}`);
    }

    setVoiceState(sessionId, state, ttl = 60) {
        if (!sessionId || !state) return;
        this.stateCache.set(`voice:${sessionId}`, state, ttl);
    }

    getTypingState(conversationId) {
        if (!conversationId) return null;
        return this.stateCache.get(`typing:${conversationId}`);
    }

    setTypingState(conversationId, typingInfo, ttl = 30) {
        if (!conversationId) return;
        this.stateCache.set(`typing:${conversationId}`, typingInfo, ttl);
    }

    // --- UI Search History Cache ---
    getSearchHistory(userId) {
        if (!userId) return [];
        return this.searchHistoryCache.get(`search_history:${userId}`) || [];
    }

    addSearchHistory(userId, query) {
        if (!userId || !query) return;
        const key = `search_history:${userId}`;
        const history = this.searchHistoryCache.get(key) || [];
        const filtered = history.filter(q => q.toLowerCase() !== query.toLowerCase());
        filtered.unshift(query);
        const trimmed = filtered.slice(0, 15);
        this.searchHistoryCache.set(key, trimmed);
    }

    clear() {
        this.chatCache.clear();
        this.citationCache.clear();
        this.stateCache.clear();
        this.searchHistoryCache.clear();
    }

    getStats() {
        const chatStats = this.chatCache.getStats();
        const citStats = this.citationCache.getStats();
        const stateStats = this.stateCache.getStats();
        const searchStats = this.searchHistoryCache.getStats();

        const totalHits = chatStats.hits + citStats.hits + stateStats.hits + searchStats.hits;
        const totalMisses = chatStats.misses + citStats.misses + stateStats.misses + searchStats.misses;
        const totalOps = totalHits + totalMisses;
        const hitRatePct = totalOps > 0 ? Number(((totalHits / totalOps) * 100).toFixed(2)) : 0;
        const memoryBytes = chatStats.memoryBytes + citStats.memoryBytes + stateStats.memoryBytes + searchStats.memoryBytes;

        return {
            layer: 1,
            name: "Layer 1 — Client/UI Cache",
            size: chatStats.size + citStats.size + stateStats.size + searchStats.size,
            hits: totalHits,
            misses: totalMisses,
            hitRate: `${hitRatePct}%`,
            hitRatePercent: hitRatePct,
            evictions: chatStats.evictions + citStats.evictions + stateStats.evictions + searchStats.evictions,
            avgLookupTimeMs: Number(((chatStats.avgLookupTimeMs + citStats.avgLookupTimeMs) / 2).toFixed(3)),
            memoryBytes,
            memoryFormatted: this.chatCache._formatBytes(memoryBytes),
            status: "healthy"
        };
    }
}

module.exports = new Layer1_ClientCache();
