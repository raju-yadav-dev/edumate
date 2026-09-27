/**
 * Layer 1 — Client UI Smart Cache Manager
 * EduMate Mission 14.1
 * 
 * Responsibilities:
 * - Cache recent chats & conversations in browser memory / sessionStorage
 * - Cache source citations & references for fast instant hover cards
 * - Cache typing indicators & voice conversation states
 * - Cache search query history & filter selections
 */

class ClientCacheManager {
    constructor() {
        this.memoryStore = new Map();
        this.maxEntries = 100;
        this.defaultTtlMs = 5 * 60 * 1000; // 5 minutes
    }

    _isExpired(entry) {
        if (!entry || !entry.expiry) return false;
        return Date.now() > entry.expiry;
    }

    get(key) {
        const entry = this.memoryStore.get(key);
        if (!entry) return null;
        if (this._isExpired(entry)) {
            this.memoryStore.delete(key);
            return null;
        }
        // Refresh LRU
        this.memoryStore.delete(key);
        this.memoryStore.set(key, entry);
        return entry.value;
    }

    set(key, value, ttlMs = null) {
        if (this.memoryStore.has(key)) {
            this.memoryStore.delete(key);
        } else if (this.memoryStore.size >= this.maxEntries) {
            const oldestKey = this.memoryStore.keys().next().value;
            if (oldestKey) this.memoryStore.delete(oldestKey);
        }

        const effectiveTtl = ttlMs !== null ? ttlMs : this.defaultTtlMs;
        this.memoryStore.set(key, {
            value,
            expiry: effectiveTtl > 0 ? Date.now() + effectiveTtl : null,
            createdAt: Date.now()
        });
    }

    delete(key) {
        return this.memoryStore.delete(key);
    }

    clear() {
        this.memoryStore.clear();
    }

    // --- Domain Helpers ---

    getCachedMessages(chatId) {
        if (!chatId) return null;
        return this.get(`chat_msgs:${chatId}`);
    }

    setCachedMessages(chatId, messages, ttlMs = 10 * 60 * 1000) {
        if (!chatId || !messages) return;
        this.set(`chat_msgs:${chatId}`, messages, ttlMs);
    }

    getCachedCitations(queryId) {
        if (!queryId) return null;
        return this.get(`citations:${queryId}`);
    }

    setCachedCitations(queryId, citations) {
        if (!queryId || !citations) return;
        this.set(`citations:${queryId}`, citations, 15 * 60 * 1000);
    }

    getVoiceState(sessionId) {
        if (!sessionId) return null;
        return this.get(`voice_state:${sessionId}`);
    }

    setVoiceState(sessionId, state) {
        if (!sessionId || !state) return;
        this.set(`voice_state:${sessionId}`, state, 60 * 1000);
    }

    getSearchHistory() {
        try {
            if (typeof window !== "undefined" && window.localStorage) {
                const stored = window.localStorage.getItem("edumate_search_history");
                return stored ? JSON.parse(stored) : [];
            }
        } catch (_) {}
        return this.get("search_history") || [];
    }

    addSearchHistory(query) {
        if (!query || typeof query !== "string") return;
        const history = this.getSearchHistory();
        const filtered = history.filter(q => q.toLowerCase() !== query.toLowerCase());
        filtered.unshift(query.trim());
        const trimmed = filtered.slice(0, 10);

        try {
            if (typeof window !== "undefined" && window.localStorage) {
                window.localStorage.setItem("edumate_search_history", JSON.stringify(trimmed));
            }
        } catch (_) {}
        this.set("search_history", trimmed, 24 * 60 * 60 * 1000);
    }
}

const clientCacheManager = new ClientCacheManager();

if (typeof window !== "undefined") {
    window.__EDUMATE_CLIENT_CACHE__ = clientCacheManager;
}

export default clientCacheManager;
