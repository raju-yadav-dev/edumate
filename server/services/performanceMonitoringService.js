/**
 * EduMate Task 17 & Mission 3 — AI Performance Monitoring & Latency Analytics
 * 
 * Measures every stage of the RAG pipeline:
 * 1. Query Planner
 * 2. Metadata Filter
 * 3. Qdrant Search
 * 4. Mongo Lookup
 * 5. Context Builder
 * 6. Prompt Builder
 * 7. llama.cpp Generation
 * 8. Total Chat Response
 * 
 * Tracks metrics for every request:
 * - retrievalLatency
 * - llmLatency
 * - totalLatency
 * - chunksRetrieved
 * - chunksMerged
 * - promptTokens
 * - completionTokens
 * - cacheHit
 * - cacheMiss
 * - retrievedChunkIds
 * - metadataFilters
 * 
 * Developer Mode:
 * Enabled via .env (AI_DEBUG_MODE=true, DEV_DEBUG=true, PERFORMANCE_DEBUG=true, DEV_MODE=true)
 * - Prints stage timings breakdown
 * - Prints retrieved chunk IDs
 * - Prints metadata filters used
 * - Prints prompt token count
 * Never exposes these logs to normal users.
 */

const { countTokens } = require("../ai/utils/tokenizer");

class PerformanceTracker {
    constructor({ requestId = null, question = "", user = null } = {}) {
        this.requestId = requestId || `req-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        this.question = question;
        this.userId = user?._id ? String(user._id) : "guest";
        this.startTime = Date.now();
        
        // 8 Pipeline Latency Timers (ms)
        this.timers = {
            queryPlannerLatencyMs: 0,
            metadataFilterLatencyMs: 0,
            qdrantLatencyMs: 0,
            mongoLookupLatencyMs: 0,
            mongoLatencyMs: 0, // sync alias
            contextBuilderLatencyMs: 0,
            promptBuilderLatencyMs: 0,
            promptBuildingLatencyMs: 0, // sync alias
            llmLatencyMs: 0,
            llamaCppLatencyMs: 0, // sync alias
            retrievalLatencyMs: 0,
            totalLatencyMs: 0
        };

        // Execution & Quality Metrics
        this.metrics = {
            chunksRetrieved: 0,
            retrievedChunksCount: 0, // sync alias
            chunksMerged: 0,
            promptTokens: 0,
            completionTokens: 0,
            cacheHit: false,
            cacheMiss: true,
            cacheStatus: "miss", // sync alias
            retrievedChunkIds: [],
            metadataFilters: {},
            failedRetrievals: 0,
            status: "success"
        };
    }

    startTimer(timerName) {
        const start = Date.now();
        return () => {
            const elapsed = Date.now() - start;
            this.recordTimer(timerName, elapsed);
            return elapsed;
        };
    }

    recordTimer(timerName, durationMs) {
        const mapping = {
            queryPlanner: "queryPlannerLatencyMs",
            query_planner: "queryPlannerLatencyMs",
            metadataFilter: "metadataFilterLatencyMs",
            metadata_filter: "metadataFilterLatencyMs",
            qdrant: "qdrantLatencyMs",
            qdrantSearch: "qdrantLatencyMs",
            mongo: "mongoLookupLatencyMs",
            mongoLookup: "mongoLookupLatencyMs",
            mongo_lookup: "mongoLookupLatencyMs",
            context: "contextBuilderLatencyMs",
            contextBuilder: "contextBuilderLatencyMs",
            context_builder: "contextBuilderLatencyMs",
            prompt: "promptBuilderLatencyMs",
            promptBuilder: "promptBuilderLatencyMs",
            prompt_builder: "promptBuilderLatencyMs",
            promptBuilding: "promptBuilderLatencyMs",
            llm: "llmLatencyMs",
            llamaCpp: "llmLatencyMs",
            llama_cpp: "llmLatencyMs",
            retrieval: "retrievalLatencyMs",
            total: "totalLatencyMs"
        };
        const key = mapping[timerName] || timerName;
        const val = Math.max(0, Math.round(durationMs));

        if (this.timers[key] !== undefined) {
            this.timers[key] += val;
        } else {
            this.timers[key] = val;
        }

        // Keep aliases strictly synchronized
        if (key === "mongoLookupLatencyMs") this.timers.mongoLatencyMs = this.timers.mongoLookupLatencyMs;
        if (key === "mongoLatencyMs") this.timers.mongoLookupLatencyMs = this.timers.mongoLatencyMs;
        if (key === "promptBuilderLatencyMs") this.timers.promptBuildingLatencyMs = this.timers.promptBuilderLatencyMs;
        if (key === "promptBuildingLatencyMs") this.timers.promptBuilderLatencyMs = this.timers.promptBuildingLatencyMs;
        if (key === "llmLatencyMs") this.timers.llamaCppLatencyMs = this.timers.llmLatencyMs;
        if (key === "llamaCppLatencyMs") this.timers.llmLatencyMs = this.timers.llamaCppLatencyMs;
    }

    recordMetric(metricName, value) {
        if (metricName === "chunksRetrieved" || metricName === "retrievedChunksCount") {
            const count = Number(value) || 0;
            this.metrics.chunksRetrieved = count;
            this.metrics.retrievedChunksCount = count;
            return;
        }

        if (metricName === "cacheStatus") {
            this.metrics.cacheStatus = value;
            this.metrics.cacheHit = value === "hit";
            this.metrics.cacheMiss = value !== "hit";
            return;
        }

        if (metricName === "cacheHit") {
            const hit = Boolean(value);
            this.metrics.cacheHit = hit;
            this.metrics.cacheMiss = !hit;
            this.metrics.cacheStatus = hit ? "hit" : "miss";
            return;
        }

        if (metricName === "cacheMiss") {
            const miss = Boolean(value);
            this.metrics.cacheMiss = miss;
            this.metrics.cacheHit = !miss;
            this.metrics.cacheStatus = miss ? "miss" : "hit";
            return;
        }

        if (metricName === "retrievedChunkIds") {
            this.metrics.retrievedChunkIds = Array.isArray(value) ? value : [];
            return;
        }

        if (metricName === "metadataFilters") {
            this.metrics.metadataFilters = (value && typeof value === "object") ? value : {};
            return;
        }

        this.metrics[metricName] = value;
    }

    recordTokens({ promptText = "", completionText = "", promptCount = null, completionCount = null }) {
        if (promptCount !== null) {
            this.metrics.promptTokens = promptCount;
        } else if (promptText) {
            this.metrics.promptTokens = countTokens(promptText);
        }

        if (completionCount !== null) {
            this.metrics.completionTokens = completionCount;
        } else if (completionText) {
            this.metrics.completionTokens = countTokens(completionText);
        }
    }

    finish() {
        this.timers.totalLatencyMs = Date.now() - this.startTime;
        
        // Ensure retrievalLatencyMs is at least the sum of qdrant search and metadata filter if not set explicitly
        if (!this.timers.retrievalLatencyMs && (this.timers.qdrantLatencyMs || this.timers.metadataFilterLatencyMs)) {
            this.timers.retrievalLatencyMs = (this.timers.queryPlannerLatencyMs || 0) + 
                                             (this.timers.metadataFilterLatencyMs || 0) + 
                                             (this.timers.qdrantLatencyMs || 0);
        }

        const telemetry = {
            requestId: this.requestId,
            question: this.question,
            userId: this.userId,
            timers: { ...this.timers },
            metrics: { ...this.metrics },
            
            // Required direct metrics fields
            retrievalLatency: this.timers.retrievalLatencyMs,
            llmLatency: this.timers.llmLatencyMs,
            totalLatency: this.timers.totalLatencyMs,
            chunksRetrieved: this.metrics.chunksRetrieved || this.metrics.retrievedChunksCount || 0,
            chunksMerged: this.metrics.chunksMerged || 0,
            promptTokens: this.metrics.promptTokens || 0,
            completionTokens: this.metrics.completionTokens || 0,
            cacheHit: Boolean(this.metrics.cacheHit),
            cacheMiss: Boolean(this.metrics.cacheMiss),
            
            // Rich diagnostics
            retrievedChunkIds: [...(this.metrics.retrievedChunkIds || [])],
            metadataFilters: { ...(this.metrics.metadataFilters || {}) },
            timestamp: new Date().toISOString()
        };

        // Record in in-memory ring buffer
        performanceMonitoringService.recordRequest(telemetry);

        // Developer Debug Mode logging (only if enabled via .env)
        if (performanceMonitoringService.isDebugMode()) {
            this.logDebugSummary();
        }

        return telemetry;
    }

    logDebugSummary() {
        const t = this.timers;
        const m = this.metrics;
        const divider = "═".repeat(65);
        const subDivider = "─".repeat(65);

        console.log(`\n[AI Performance Monitor] ${divider}`);
        console.log(`[Req ID]: ${this.requestId} | User: ${this.userId}`);
        console.log(`[Query]: "${String(this.question).slice(0, 60)}"`);
        console.log(`[STAGE TIMINGS (ms)] ${subDivider}`);
        console.log(`• 1. Query Planner:       ${t.queryPlannerLatencyMs || 0}ms`);
        console.log(`• 2. Metadata Filter:     ${t.metadataFilterLatencyMs || 0}ms`);
        console.log(`• 3. Qdrant Search:       ${t.qdrantLatencyMs || 0}ms`);
        console.log(`• 4. Mongo Lookup:        ${t.mongoLookupLatencyMs || t.mongoLatencyMs || 0}ms`);
        console.log(`• 5. Context Builder:     ${t.contextBuilderLatencyMs || 0}ms`);
        console.log(`• 6. Prompt Builder:      ${t.promptBuilderLatencyMs || t.promptBuildingLatencyMs || 0}ms`);
        console.log(`• 7. llama.cpp Latency:   ${t.llmLatencyMs || 0}ms`);
        console.log(`• 8. Total Chat Response: ${t.totalLatencyMs || 0}ms`);
        console.log(`[RETRIEVAL & METADATA] ${subDivider}`);
        console.log(`• Chunks Retrieved:       ${m.chunksRetrieved || m.retrievedChunksCount || 0}`);
        console.log(`• Chunks Merged:          ${m.chunksMerged || 0}`);
        console.log(`• Retrieved Chunk IDs:    ${JSON.stringify(m.retrievedChunkIds || [])}`);
        console.log(`• Metadata Filters Used:  ${JSON.stringify(m.metadataFilters || {})}`);
        console.log(`[TOKEN & CACHE ANALYTICS] ${subDivider}`);
        console.log(`• Prompt Tokens:          ${m.promptTokens || 0}`);
        console.log(`• Completion Tokens:      ${m.completionTokens || 0}`);
        console.log(`• Cache Hit:              ${m.cacheHit ? "YES" : "NO"}`);
        console.log(`• Cache Miss:             ${m.cacheMiss ? "YES" : "NO"}`);
        console.log(`[AI Performance Monitor] ${divider}\n`);
    }
}

class PerformanceMonitoringService {
    constructor() {
        this.ringBufferSize = 200;
        this.history = [];
    }

    isDebugMode() {
        return (
            process.env.AI_DEBUG_MODE === "true" ||
            process.env.DEV_DEBUG === "true" ||
            process.env.PERFORMANCE_DEBUG === "true" ||
            process.env.AI_PERFORMANCE_DEBUG === "true" ||
            process.env.DEV_MODE === "true"
        );
    }

    createTracker(params) {
        return new PerformanceTracker(params);
    }

    recordRequest(telemetry) {
        this.history.push(telemetry);
        if (this.history.length > this.ringBufferSize) {
            this.history.shift();
        }
    }

    getMetricsSummary() {
        if (this.history.length === 0) {
            return {
                totalRequests: 0,
                avgTotalLatencyMs: 0,
                avgLlmLatencyMs: 0,
                avgRetrievalLatencyMs: 0,
                cacheHitRate: 0,
                totalFailedRetrievals: 0
            };
        }

        const total = this.history.length;
        let sumTotal = 0;
        let sumLlm = 0;
        let sumRetrieval = 0;
        let cacheHits = 0;
        let failedRetrievals = 0;

        this.history.forEach(entry => {
            sumTotal += entry.timers?.totalLatencyMs || entry.totalLatency || 0;
            sumLlm += entry.timers?.llmLatencyMs || entry.llmLatency || 0;
            sumRetrieval += entry.timers?.retrievalLatencyMs || entry.retrievalLatency || 0;
            if (entry.metrics?.cacheStatus === "hit" || entry.metrics?.cacheHit === true || entry.cacheHit === true) {
                cacheHits++;
            }
            if (entry.metrics?.failedRetrievals > 0) failedRetrievals += entry.metrics.failedRetrievals;
        });

        return {
            totalRequests: total,
            avgTotalLatencyMs: Math.round(sumTotal / total),
            avgLlmLatencyMs: Math.round(sumLlm / total),
            avgRetrievalLatencyMs: Math.round(sumRetrieval / total),
            cacheHitRate: Math.round((cacheHits / total) * 100),
            totalFailedRetrievals: failedRetrievals,
            debugModeEnabled: this.isDebugMode()
        };
    }

    clearHistory() {
        this.history = [];
    }
}

const performanceMonitoringService = new PerformanceMonitoringService();

module.exports = performanceMonitoringService;
