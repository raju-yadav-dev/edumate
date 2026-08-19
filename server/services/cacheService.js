const crypto = require("crypto");

const CACHE_STATIC_TTL = Number(process.env.CACHE_STATIC_TTL || 86400);
const CACHE_DYNAMIC_TTL = Number(process.env.CACHE_DYNAMIC_TTL || 60);

// In-memory fallback cache
class MemoryCache {
    constructor() {
        this.store = new Map();
        this.categoryKeys = new Map(); // category -> Set of keys
    }

    async get(key) {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiry) {
            this.store.delete(key);
            return null;
        }
        return entry.value;
    }

    async set(key, value, ttl) {
        const expiry = Date.now() + (ttl * 1000);
        this.store.set(key, { value, expiry });
    }

    async delete(key) {
        this.store.delete(key);
    }

    async addToCategory(category, key) {
        if (!this.categoryKeys.has(category)) {
            this.categoryKeys.set(category, new Set());
        }
        this.categoryKeys.get(category).add(key);
    }

    async invalidateCategory(category) {
        const keys = this.categoryKeys.get(category);
        if (keys) {
            for (const key of keys) {
                this.store.delete(key);
            }
            this.categoryKeys.delete(category);
        }
    }
}

const memoryCache = new MemoryCache();
let redisClient = null;
let isRedisConnected = false;

// Statistics for Hackathon/Dashboard monitoring
const stats = {
    hits: 0,
    misses: 0,
    llmCallsAvoided: 0,
    totalResponseTime: 0,
    totalRequestsCount: 0
};

// Lazy loaded Dynamic Knowledge-Base Version
let localKbVersion = null;

// Initialize Redis if configured
const initRedis = async () => {
    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST;
    const redisPort = process.env.REDIS_PORT;

    if (!redisUrl && !redisHost) {
        console.warn("[Cache Service] Redis env variables are not configured. Using in-memory fallback cache.");
        return;
    }

    try {
        const { createClient } = require("redis");
        
        let clientOptions = {};
        if (redisUrl) {
            clientOptions.url = redisUrl;
        } else {
            clientOptions = {
                socket: {
                    host: redisHost,
                    port: Number(redisPort || 6379)
                }
            };
            if (process.env.REDIS_PASSWORD) {
                clientOptions.password = process.env.REDIS_PASSWORD;
            }
        }

        redisClient = createClient(clientOptions);

        redisClient.on("error", (err) => {
            console.error("[Cache Service] Redis Client Error:", err.message);
            isRedisConnected = false;
        });

        redisClient.on("connect", () => {
            console.log("[Cache Service] Connecting to Redis...");
        });

        redisClient.on("ready", () => {
            console.log("[Cache Service] Redis Client Ready and Connected.");
            isRedisConnected = true;
        });

        await redisClient.connect();
    } catch (err) {
        console.warn("[Cache Service] Failed to initialize Redis client. Falling back to in-memory cache.", err.message);
        isRedisConnected = false;
        redisClient = null;
    }
};

initRedis();

/**
 * Lazily fetches the current dynamic knowledge base version
 */
const getKbVersion = async () => {
    if (localKbVersion !== null) {
        return localKbVersion;
    }

    try {
        if (isRedisConnected && redisClient) {
            const version = await redisClient.get("edumate:kb_version");
            if (version) {
                localKbVersion = version;
                return localKbVersion;
            }
            // Initialize version
            await redisClient.set("edumate:kb_version", "1");
        }
    } catch (err) {
        console.warn("[Cache Service] Failed to fetch KB version from Redis, using local fallback:", err.message);
    }

    localKbVersion = "1";
    return localKbVersion;
};

/**
 * Increments the global knowledge base version to invalidate older cache key formats
 */
const incrementKbVersion = async () => {
    try {
        if (isRedisConnected && redisClient) {
            const newVal = await redisClient.incr("edumate:kb_version");
            localKbVersion = String(newVal);
            console.log(`[Cache Service] KB version incremented to: ${localKbVersion}`);
            return localKbVersion;
        }
    } catch (err) {
        console.warn("[Cache Service] Failed to increment KB version in Redis:", err.message);
    }

    const current = parseInt(localKbVersion || "1", 10);
    localKbVersion = String(current + 1);
    console.log(`[Cache Service] In-memory KB version incremented to: ${localKbVersion}`);
    return localKbVersion;
};

/**
 * Local deterministic query normalization
 */
const normalizeQuery = (query) => {
    return String(query || "")
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ");
};

/**
 * Generates isolated context-aware cache key
 */
const getCacheKey = (kbVersion, documentType, department, queryMode, hash) => {
    const v = kbVersion || "1";
    const t = documentType || "all";
    const d = department || "all";
    const m = queryMode || "targeted";
    return `edumate:answer:v1:kb${v}:${t}:${d}:${m}:${hash}`;
};

const getCategoryKey = (category) => `edumate:category:${category}:keys`;

/**
 * Retrieves a response from the L2 context-aware cache
 */
const get = async (query, documentType = "all", department = "all", queryMode = "targeted") => {
    stats.totalRequestsCount++;
    const kbVersion = await getKbVersion();
    const normalized = normalizeQuery(query);
    const hash = crypto.createHash("sha256").update(normalized).digest("hex");
    const key = getCacheKey(kbVersion, documentType, department, queryMode, hash);

    try {
        if (isRedisConnected && redisClient) {
            const cachedVal = await redisClient.get(key);
            if (cachedVal) {
                stats.hits++;
                stats.llmCallsAvoided++;
                console.log(`[Cache HIT] Redis HIT for query: "${normalized}" | Key: ${key}`);
                return JSON.parse(cachedVal);
            }
        }
    } catch (err) {
        console.warn("[Cache Service] Redis GET failed, checking memory cache:", err.message);
    }

    // Fallback to memory cache
    const memVal = await memoryCache.get(key);
    if (memVal) {
        stats.hits++;
        stats.llmCallsAvoided++;
        console.log(`[Cache HIT] Memory HIT for query: "${normalized}" | Key: ${key}`);
        return memVal;
    }

    stats.misses++;
    console.log(`[Cache MISS] Query: "${normalized}" | Key: ${key}`);
    return null;
};

/**
 * Caches a response in the L2 context-aware cache
 */
const set = async (query, value, categories = [], isDynamic = false, documentType = "all", department = "all", queryMode = "targeted") => {
    if (!value) return;

    const kbVersion = await getKbVersion();
    const normalized = normalizeQuery(query);
    const hash = crypto.createHash("sha256").update(normalized).digest("hex");
    const key = getCacheKey(kbVersion, documentType, department, queryMode, hash);
    const ttl = isDynamic ? CACHE_DYNAMIC_TTL : CACHE_STATIC_TTL;

    try {
        if (isRedisConnected && redisClient) {
            await redisClient.set(key, JSON.stringify(value), { EX: ttl });
            
            // Track categories for surgical invalidation
            const cats = Array.isArray(categories) ? categories : [categories];
            for (const cat of cats) {
                if (cat) {
                    const catKey = getCategoryKey(String(cat).trim().toLowerCase());
                    await redisClient.sAdd(catKey, key);
                    await redisClient.expire(catKey, CACHE_STATIC_TTL);
                }
            }
            console.log(`[Cache SET] Saved to Redis for query hash: ${hash} | TTL: ${ttl}`);
            return;
        }
    } catch (err) {
        console.warn("[Cache Service] Redis SET failed, saving to memory:", err.message);
    }

    // Fallback to memory cache
    await memoryCache.set(key, value, ttl);
    const cats = Array.isArray(categories) ? categories : [categories];
    for (const cat of cats) {
        if (cat) {
            await memoryCache.addToCategory(String(cat).trim().toLowerCase(), key);
        }
    }
    console.log(`[Cache SET] Saved to Memory for query hash: ${hash} | TTL: ${ttl}`);
};

/**
 * Deletes a single specific cache entry
 */
const del = async (query, documentType = "all", department = "all") => {
    const kbVersion = await getKbVersion();
    const normalized = normalizeQuery(query);
    const hash = crypto.createHash("sha256").update(normalized).digest("hex");
    const key = getCacheKey(kbVersion, documentType, department, hash);

    try {
        if (isRedisConnected && redisClient) {
            await redisClient.del(key);
        }
    } catch (err) {
        console.warn("[Cache Service] Redis DEL failed:", err.message);
    }
    await memoryCache.delete(key);
};

/**
 * Invalidates a specific category namespace and increments the global KB version
 */
const invalidateCategory = async (category) => {
    if (!category) return;
    const cleanCat = String(category).trim().toLowerCase();
    console.log(`[Cache Invalidation] Invalidating category: "${cleanCat}"`);

    // Increment global KB version so all old keys are dynamically invalidated
    await incrementKbVersion();

    try {
        if (isRedisConnected && redisClient) {
            const catKey = getCategoryKey(cleanCat);
            const keys = await redisClient.sMembers(catKey);
            if (Array.isArray(keys) && keys.length > 0) {
                await redisClient.del(keys);
                console.log(`[Cache Invalidation] Redis deleted ${keys.length} keys for category "${cleanCat}"`);
            }
            await redisClient.del(catKey);
            return;
        }
    } catch (err) {
        console.warn("[Cache Service] Redis invalidation failed, falling back to memory:", err.message);
    }

    // Fallback to memory
    await memoryCache.invalidateCategory(cleanCat);
    console.log(`[Cache Invalidation] Memory invalidated category: "${cleanCat}"`);
};

/**
 * Retrieves cache hit/miss statistics for admin dashboard monitoring
 */
const getStats = () => {
    const total = stats.hits + stats.misses;
    const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(2) + "%" : "0%";
    return {
        ...stats,
        hitRate
    };
};

module.exports = {
    get,
    set,
    del,
    invalidateCategory,
    getKbVersion,
    incrementKbVersion,
    getStats
};
