/**
 * Developer Mode & RAG Debugger Service — EduMate Mission 21
 * 
 * Provides:
 * - 14-Stage Execution Timeline Tracer
 * - Prompt & Token Inspector
 * - Retrieval & Vector Search Visualizer
 * - Query Planner, RAG & Prompt Playgrounds
 * - Request Replay System
 * - Debug Bundle Exporter
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const smartCacheHub = require("./cache/SmartCacheHub");
const { planQuery } = require("../ai/utils/queryPlanner");
const { inspectPromptSecurity } = require("../ai/security/promptInjectionGuard");
const localChunkManager = require("../storage/localChunkManager");

class DeveloperModeService {
    constructor() {
        this.maxTraces = 100;
        this.traces = []; // Ring buffer of detailed query execution traces
        this.logs = []; // AI execution log ring buffer
        this._initSampleTraces();
    }

    _initSampleTraces() {
        // Pre-populate with realistic starter traces so developer mode has instant data to inspect
        this.recordTrace({
            traceId: `trace_bootstrap_${Date.now()}`,
            timestamp: new Date().toISOString(),
            query: "Who is the HOD of Computational Sciences department?",
            normalizedQuery: "who is the head of department of computational sciences",
            intent: "FACULTY_INQUIRY",
            routingMode: "RAG + LLM",
            category: "faculty",
            status: "SUCCESS",
            totalLatencyMs: 142,
            tokens: {
                promptTokens: 480,
                contextTokens: 320,
                completionTokens: 65,
                citationTokens: 25,
                memoryTokens: 40,
                totalTokens: 545
            },
            timeline: [
                { stage: "Request Received", durationMs: 2, status: "OK", cacheHit: false },
                { stage: "Query Normalization", durationMs: 4, status: "OK", cacheHit: true },
                { stage: "Intent Classification", durationMs: 12, status: "OK", cacheHit: true },
                { stage: "Router Decision", durationMs: 5, status: "OK", cacheHit: true },
                { stage: "Metadata Extraction", durationMs: 6, status: "OK", cacheHit: false },
                { stage: "Retrieval", durationMs: 28, status: "OK", cacheHit: false },
                { stage: "Reranking", durationMs: 14, status: "OK", cacheHit: false },
                { stage: "Context Builder", durationMs: 8, status: "OK", cacheHit: false },
                { stage: "Prompt Builder", durationMs: 5, status: "OK", cacheHit: false },
                { stage: "LLM Request", durationMs: 45, status: "OK", cacheHit: false },
                { stage: "Streaming", durationMs: 0, status: "SKIPPED", cacheHit: false },
                { stage: "Response Validation", durationMs: 4, status: "OK", cacheHit: false },
                { stage: "Citation Attachment", durationMs: 6, status: "OK", cacheHit: false },
                { stage: "Response Formatting", durationMs: 3, status: "OK", cacheHit: false }
            ],
            prompts: {
                systemPrompt: "You are EduMate, the official AI University Assistant for Brainware University. Answer accurately based on verified institutional documents.",
                userPrompt: "Who is the HOD of Computational Sciences department?",
                retrievedContext: "Document: Faculty_List_2025.pdf | Department: Computational Sciences\nDr. Jayanta Aich is the Professor and Head of Department (HOD) of Computational Sciences.",
                conversationMemory: "Previous turns: None (New Session)",
                finalPrompt: "[SYSTEM]\nYou are EduMate, official AI Assistant...\n\n[CONTEXT]\nDr. Jayanta Aich is the Professor and Head of Department...\n\n[USER]\nWho is the HOD of Computational Sciences department?"
            },
            retrieval: {
                chunks: [
                    {
                        chunkId: "chunk_css_hod_01",
                        document: "Faculty_Computational_Sciences.pdf",
                        page: 1,
                        heading: "Department Leadership",
                        category: "faculty",
                        semanticScore: 0.94,
                        bm25Score: 0.88,
                        metadataScore: 0.95,
                        finalRerankScore: 0.93,
                        selected: true,
                        text: "Dr. Jayanta Aich, Professor & Head of Department, Department of Computational Sciences. Email: hod.css@brainwareuniversity.ac.in. Room: 304, Building 3."
                    },
                    {
                        chunkId: "chunk_css_fac_02",
                        document: "Faculty_Computational_Sciences.pdf",
                        page: 2,
                        heading: "Assistant Professors",
                        category: "faculty",
                        semanticScore: 0.72,
                        bm25Score: 0.65,
                        metadataScore: 0.80,
                        finalRerankScore: 0.71,
                        selected: false,
                        text: "Department of Computational Sciences faculty members include Dr. Subhasish Ghosh, Dr. Debasis Giri..."
                    }
                ],
                vectorSearch: {
                    collection: "edumate",
                    topK: 5,
                    similarityThreshold: 0.65,
                    distanceMetric: "Cosine",
                    searchLatencyMs: 28
                }
            },
            citations: [
                {
                    sourceName: "Faculty_Computational_Sciences.pdf",
                    pageNumber: 1,
                    section: "Department Leadership",
                    confidenceScore: 0.96,
                    snippet: "Dr. Jayanta Aich is the Professor and HOD of Department of Computational Sciences."
                }
            ],
            confidence: {
                semanticConfidence: 0.94,
                metadataConfidence: 0.95,
                citationConfidence: 0.96,
                chunkDensity: 0.90,
                overallConfidence: 0.94,
                rating: "HIGH"
            },
            response: "The Head of Department (HOD) of the Computational Sciences department is **Dr. Jayanta Aich** (Professor & HoD). His office is located in Room 304, Building 3."
        });
    }

    /**
     * Records a full query execution trace
     */
    recordTrace(traceData) {
        const trace = {
            traceId: traceData.traceId || `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: traceData.timestamp || new Date().toISOString(),
            query: traceData.query || "",
            normalizedQuery: traceData.normalizedQuery || traceData.query || "",
            intent: traceData.intent || "GENERAL_QUERY",
            routingMode: traceData.routingMode || "RAG + LLM",
            category: traceData.category || "general",
            status: traceData.status || "SUCCESS",
            totalLatencyMs: traceData.totalLatencyMs || 0,
            tokens: traceData.tokens || { promptTokens: 0, contextTokens: 0, completionTokens: 0, totalTokens: 0 },
            timeline: traceData.timeline || [],
            prompts: traceData.prompts || {},
            retrieval: traceData.retrieval || { chunks: [] },
            citations: traceData.citations || [],
            confidence: traceData.confidence || { overallConfidence: 0.9, rating: "HIGH" },
            response: traceData.response || ""
        };

        this.traces.unshift(trace);
        if (this.traces.length > this.maxTraces) {
            this.traces.pop();
        }

        // Add to log stream
        this.addLog({
            timestamp: trace.timestamp,
            level: trace.status === "SUCCESS" ? "INFO" : "ERROR",
            category: "AI_ROUTER",
            message: `Processed query: "${trace.query.slice(0, 60)}" in ${trace.totalLatencyMs}ms (Mode: ${trace.routingMode})`,
            traceId: trace.traceId
        });

        return trace;
    }

    addLog(logItem) {
        this.logs.unshift({
            id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: logItem.timestamp || new Date().toISOString(),
            level: logItem.level || "INFO",
            category: logItem.category || "SYSTEM",
            message: logItem.message || "",
            traceId: logItem.traceId || null
        });
        if (this.logs.length > 300) {
            this.logs.pop();
        }
    }

    getTraces(limit = 20) {
        return this.traces.slice(0, Number(limit) || 20);
    }

    getTraceById(traceId) {
        return this.traces.find(t => t.traceId === traceId) || null;
    }

    getLogs(filter = {}) {
        let list = this.logs;
        if (filter.level) {
            list = list.filter(l => l.level === filter.level);
        }
        if (filter.category) {
            list = list.filter(l => l.category === filter.category);
        }
        if (filter.search) {
            const q = filter.search.toLowerCase();
            list = list.filter(l => l.message.toLowerCase().includes(q));
        }
        return list.slice(0, Number(filter.limit) || 100);
    }

    /**
     * Query Planner Playground execution
     */
    runQueryPlannerPlayground(question) {
        const start = Date.now();
        const plan = planQuery(question);
        const securityCheck = inspectPromptSecurity(question);

        const durationMs = Date.now() - start;

        return {
            question,
            durationMs,
            plan: {
                intent: plan.intent || "GENERAL_QUERY",
                primaryTopic: plan.primaryTopic || "General",
                department: plan.department || null,
                category: plan.category || "general",
                routingMode: plan.routingMode || "LLM Only",
                requiresRetrieval: plan.requiresRetrieval || false,
                confidenceScore: plan.confidenceScore || 0.92,
                entities: plan.entities || {},
                metadataFilters: plan.metadataFilters || {}
            },
            security: {
                isSafe: securityCheck.isSafe,
                isBlocked: securityCheck.isBlocked,
                reason: securityCheck.reason
            }
        };
    }

    /**
     * RAG Playground execution
     */
    async runRagPlayground({ query, topK = 5, category = null, hybrid = true, minScore = 0.5 }) {
        const start = Date.now();
        const chunks = await localChunkManager.searchLocalChunks(query, {
            category,
            limit: Number(topK) || 5,
            minScore: Number(minScore) || 0.5
        });

        const durationMs = Date.now() - start;

        const enrichedChunks = chunks.map((c, idx) => ({
            rank: idx + 1,
            chunkId: c.chunkId || `chunk_${idx + 1}`,
            documentId: c.documentId,
            documentTitle: c.documentTitle || "University Knowledge Document",
            category: c.category || category || "general",
            pageNumber: c.pageNumber || 1,
            score: c.score || Number((0.95 - (idx * 0.08)).toFixed(3)),
            contentSnippet: c.content ? c.content.slice(0, 300) : "",
            fullContent: c.content || ""
        }));

        return {
            query,
            topK: Number(topK),
            category,
            hybrid,
            minScore: Number(minScore),
            retrievalLatencyMs: durationMs,
            resultsCount: enrichedChunks.length,
            chunks: enrichedChunks
        };
    }

    /**
     * Prompt Playground execution
     */
    runPromptPlayground({ question, customSystemPrompt, contextDocs = "" }) {
        const sysPrompt = customSystemPrompt || "You are EduMate, the official AI University Assistant for Brainware University. Answer grounded in institutional knowledge.";
        const contextSection = contextDocs ? `\n[VERIFIED INSTITUTIONAL CONTEXT]\n${contextDocs}\n` : "";
        const finalPrompt = `[SYSTEM INSTRUCTIONS]\n${sysPrompt}\n${contextSection}\n[USER QUERY]\n${question}\n\n[ASSISTANT RESPONSE]`;

        const approxTokens = (text) => Math.ceil(text.length / 4);

        return {
            systemPrompt: sysPrompt,
            contextDocs,
            finalPrompt,
            tokenEstimates: {
                systemPromptTokens: approxTokens(sysPrompt),
                contextTokens: approxTokens(contextDocs),
                userQueryTokens: approxTokens(question),
                totalEstimatedTokens: approxTokens(finalPrompt)
            }
        };
    }

    /**
     * Export Debug Bundle for a trace
     */
    getDebugBundle(traceId) {
        const trace = this.getTraceById(traceId) || this.traces[0];
        const cacheStats = smartCacheHub.getStats();

        return {
            bundleVersion: "1.0.0",
            exportedAt: new Date().toISOString(),
            trace,
            cacheStateSnapshot: cacheStats,
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                llmProvider: process.env.LLM_PROVIDER || "llama.cpp",
                qdrantUrl: process.env.QDRANT_URL || "http://localhost:6333"
            }
        };
    }
}

module.exports = new DeveloperModeService();
