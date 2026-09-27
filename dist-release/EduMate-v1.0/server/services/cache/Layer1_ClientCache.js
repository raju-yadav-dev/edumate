/**
 * Layer 1 — Client/UI Cache
 * EduMate Mission 17 — Production Grade
 * 
 * Responsibilities:
 * - Cache recent chat messages & conversation turns
 * - Cache citation expansion payloads
 * - Cache pre-rendered markdown HTML
 * - Cache UI analytics cards & telemetry summaries
 * - Cache sidebar conversation listings
 * - Invalidation hooks on conversation change/message delivery
 * - TTL: 5–10 minutes (default 300s - 600s)
 */

const crypto = require("crypto");
const BaseLRUCache = require("./BaseLRUCache");

class Layer1_ClientCache {
    constructor() {
        const ttl = Number(process.env.CACHE_LAYER1_TTL || 300); // 5 minutes default
        const maxEntries = Number(process.env.CACHE_LAYER1_MAX || 200);

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

        this.markdownCache = new BaseLRUCache({
            name: "Layer1_ClientUI_RenderedMarkdown",
            maxEntries: 500,
            defaultTtlSeconds: ttl * 2 // 10 minutes
        });

        this.analyticsCardCache = new BaseLRUCache({
            name: "Layer1_ClientUI_AnalyticsCards",
            maxEntries: 100,
            defaultTtlSeconds: 300 // 5 minutes
        });

        this.sidebarCache = new BaseLRUCache({
            name: "Layer1_ClientUI_SidebarConversations",
            maxEntries: 150,
            defaultTtlSeconds: ttl
        });

        this.stateCache = new BaseLRUCache({
            name: "Layer1_ClientUI_State",
            maxEntries: 100,
            defaultTtlSeconds: 60
        });
    }

    _hash(text) {
        return crypto.createHash("sha256").update(String(text || "").trim()).digest("hex").slice(0, 20);
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
        this.sidebarCache.delete(`sidebar:${userId}`);
    }

    // --- Citation Expansion Cache ---
    getCachedCitations(queryOrMessageId) {
        if (!queryOrMessageId) return null;
        return this.citationCache.get(`citation:${queryOrMessageId}`);
    }

    setCachedCitations(queryOrMessageId, citations, ttl = null) {
        if (!queryOrMessageId || !citations) return;
        this.citationCache.set(`citation:${queryOrMessageId}`, citations, ttl);
    }

    // --- Rendered Markdown Cache ---
    getCachedMarkdown(rawMarkdown) {
        if (!rawMarkdown) return null;
        return this.markdownCache.get(`md:${this._hash(rawMarkdown)}`);
    }

    setCachedMarkdown(rawMarkdown, renderedHtml, ttl = null) {
        if (!rawMarkdown || !renderedHtml) return;
        this.markdownCache.set(`md:${this._hash(rawMarkdown)}`, renderedHtml, ttl);
    }

    // --- Analytics Cards Cache ---
    getAnalyticsCard(cardKey) {
        if (!cardKey) return null;
        return this.analyticsCardCache.get(`card:${cardKey}`);
    }

    setAnalyticsCard(cardKey, cardData, ttl = 300) {
        if (!cardKey || !cardData) return;
        this.analyticsCardCache.set(`card:${cardKey}`, cardData, ttl);
    }

    // --- Sidebar Conversations Cache ---
    getSidebarConversations(userId) {
        if (!userId) return null;
        return this.sidebarCache.get(`sidebar:${userId}`);
    }

    setSidebarConversations(userId, conversations, ttl = null) {
        if (!userId || !conversations) return;
        this.sidebarCache.set(`sidebar:${userId}`, conversations, ttl);
    }

    // --- Invalidate on conversation change ---
    invalidateConversation(conversationId, userId = null) {
        if (userId) {
            this.invalidateUserChats(userId);
        }
        if (conversationId) {
            this.citationCache.delete(`citation:${conversationId}`);
            this.stateCache.delete(`typing:${conversationId}`);
        }
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

    clear() {
        this.chatCache.clear();
        this.citationCache.clear();
        this.markdownCache.clear();
        this.analyticsCardCache.clear();
        this.sidebarCache.clear();
        this.stateCache.clear();
    }

    getStats() {
        const chatStats = this.chatCache.getStats();
        const citStats = this.citationCache.getStats();
        const mdStats = this.markdownCache.getStats();
        const cardStats = this.analyticsCardCache.getStats();
        const sideStats = this.sidebarCache.getStats();
        const stateStats = this.stateCache.getStats();

        const totalHits = chatStats.hits + citStats.hits + mdStats.hits + cardStats.hits + sideStats.hits + stateStats.hits;
        const totalMisses = chatStats.misses + citStats.misses + mdStats.misses + cardStats.misses + sideStats.misses + stateStats.misses;
        const totalOps = totalHits + totalMisses;
        const hitRatePct = totalOps > 0 ? Number(((totalHits / totalOps) * 100).toFixed(2)) : 0;
        const missRatePct = totalOps > 0 ? Number(((totalMisses / totalOps) * 100).toFixed(2)) : 0;
        const memoryBytes = chatStats.memoryBytes + citStats.memoryBytes + mdStats.memoryBytes + cardStats.memoryBytes + sideStats.memoryBytes + stateStats.memoryBytes;

        return {
            layer: 1,
            name: "Layer 1 — Client/UI Cache",
            size: chatStats.size + citStats.size + mdStats.size + cardStats.size + sideStats.size + stateStats.size,
            hits: totalHits,
            misses: totalMisses,
            hitRate: `${hitRatePct}%`,
            hitRatePercent: hitRatePct,
            missRate: `${missRatePct}%`,
            missRatePercent: missRatePct,
            evictions: chatStats.evictions + citStats.evictions + mdStats.evictions + cardStats.evictions + sideStats.evictions + stateStats.evictions,
            avgLookupTimeMs: Number(((chatStats.avgLookupTimeMs + citStats.avgLookupTimeMs + mdStats.avgLookupTimeMs) / 3).toFixed(3)),
            memoryBytes,
            memoryFormatted: this.chatCache._formatBytes(memoryBytes),
            status: "healthy"
        };
    }
}

module.exports = new Layer1_ClientCache();
