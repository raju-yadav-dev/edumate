import React, { useState, useEffect, useCallback } from "react";
import {
    Activity,
    Database,
    Zap,
    RefreshCw,
    Trash2,
    Flame,
    Server,
    HardDrive,
    Layers,
    Cpu,
    CheckCircle,
    AlertTriangle,
    Clock,
    TrendingUp,
    ShieldCheck
} from "lucide-react";
import "./SmartCacheDashboard.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const LAYER_METADATA = {
    layer1_clientUI: {
        id: 1,
        title: "Layer 1 — Client/UI Cache",
        icon: HardDrive,
        ttl: "5-10 min",
        desc: "Recent chat messages, citation expansions, rendered markdown, analytics cards & sidebars."
    },
    layer2_promptQuery: {
        id: 2,
        title: "Layer 2 — Prompt Cache",
        icon: Cpu,
        ttl: "1 hour",
        desc: "Query planner & router outputs (intent, entities, metadata, routing mode & response layout)."
    },
    layer3_embeddings: {
        id: 3,
        title: "Layer 3 — Embedding Cache",
        icon: Zap,
        ttl: "Infinite",
        desc: "Clean-text SHA-256 vector store. Avoids redundant embedding calls across chunk iterations."
    },
    layer4_vectorSearch: {
        id: 4,
        title: "Layer 4 — Vector Search Cache",
        icon: Database,
        ttl: "15 min",
        desc: "Raw Qdrant similarity results, candidate chunk IDs, and filtered query vectors."
    },
    layer5_documentChunks: {
        id: 5,
        title: "Layer 5 — Document Chunk Cache",
        icon: Layers,
        ttl: "30 days",
        desc: "Parsed chunk JSON, hierarchy, page offsets, keywords, and entity links direct from disk."
    },
    layer6_retriever: {
        id: 6,
        title: "Layer 6 — Retriever Cache",
        icon: RefreshCw,
        ttl: "15 min",
        desc: "Reranked top-k candidate chunks with combined semantic, BM25, and metadata scores."
    },
    layer7_llmResponses: {
        id: 7,
        title: "Layer 7 — LLM Response Cache",
        icon: Server,
        ttl: "30 min",
        desc: "Final synthesized answers, citations, confidence scores, and pre-formatted layout."
    },
    layer8_conversationContext: {
        id: 8,
        title: "Layer 8 — Conversation Context",
        icon: Clock,
        ttl: "Session",
        desc: "Active dialogue turns, conversation summaries, user memory state, and merged chunks."
    },
    layer9_modelKV: {
        id: 9,
        title: "Layer 9 — llama.cpp KV Cache",
        icon: Cpu,
        ttl: "30 min",
        desc: "Transformer attention state slots, prefix reuse, and Q8_0 KV quantization buffers."
    },
    layer10_persistentDisk: {
        id: 10,
        title: "Layer 10 — Persistent Disk Cache",
        icon: HardDrive,
        ttl: "Versioned",
        desc: "Local storage cache across 8 namespaces with transparent GZIP compression."
    }
};

export default function SmartCacheDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionBusy, setActionBusy] = useState(false);
    const [notice, setNotice] = useState(null);
    const [error, setError] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/cache/stats`);
            const data = await res.json();
            if (data && data.success && data.data) {
                setStats(data.data);
                setError(null);
            } else {
                setError(data.message || "Failed to load cache statistics.");
            }
        } catch (err) {
            setError(`Could not connect to cache service: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
        if (!autoRefresh) return;
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, [fetchStats, autoRefresh]);

    const handleClearAll = async () => {
        if (!window.confirm("Purge all 10 cache layers and disk storage?")) return;
        setActionBusy(true);
        try {
            const res = await fetch(`${API_BASE}/api/cache/clear`, { method: "POST" });
            const data = await res.json();
            if (data.success) {
                setNotice("All 10 Cache Layers purged successfully.");
                fetchStats();
            } else {
                setError(data.message || "Failed to clear cache.");
            }
        } catch (err) {
            setError(`Error clearing cache: ${err.message}`);
        } finally {
            setActionBusy(false);
        }
    };

    const handleClearLayer = async (layerNum) => {
        setActionBusy(true);
        try {
            const res = await fetch(`${API_BASE}/api/cache/clear`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ layer: layerNum })
            });
            const data = await res.json();
            if (data.success) {
                setNotice(`Layer ${layerNum} cache cleared.`);
                fetchStats();
            } else {
                setError(data.message || `Failed to clear layer ${layerNum}`);
            }
        } catch (err) {
            setError(`Error: ${err.message}`);
        } finally {
            setActionBusy(false);
        }
    };

    const handleWarmCache = async () => {
        setActionBusy(true);
        try {
            const res = await fetch(`${API_BASE}/api/cache/warm`, { method: "POST" });
            const data = await res.json();
            if (data.success) {
                setNotice(`Cache warming finished (${data.data?.warmedEntries || 0} entries warmed).`);
                fetchStats();
            } else {
                setError(data.message || "Failed to warm cache.");
            }
        } catch (err) {
            setError(`Error warming cache: ${err.message}`);
        } finally {
            setActionBusy(false);
        }
    };

    const global = stats?.global || {
        hitRate: "0%",
        totalHits: 0,
        totalMisses: 0,
        memoryFormatted: "0 B",
        diskFormatted: "0 B",
        avgLookupTimeMs: 0,
        avgLatencySavedMs: 0,
        evictions: 0,
        totalEntries: 0,
        status: "optimal"
    };

    const layers = stats?.layers || {};

    return (
        <div className="smart-cache-dashboard">
            {/* Header / Title */}
            <div className="cache-dashboard-header">
                <div>
                    <div className="cache-badge-pill">
                        <Zap size={14} className="badge-icon" />
                        <span>10-LAYER PRODUCTION ARCHITECTURE</span>
                    </div>
                    <h1>Smart Cache Infrastructure</h1>
                    <p>Sub-millisecond local in-memory LRU and persistent disk caching for LLMs, RAG, embeddings & chunks.</p>
                </div>

                <div className="cache-header-actions">
                    <button
                        type="button"
                        className={`cache-btn cache-btn-secondary ${autoRefresh ? "active" : ""}`}
                        onClick={() => setAutoRefresh(v => !v)}
                        title="Toggle live telemetry polling"
                    >
                        <RefreshCw size={15} className={autoRefresh ? "spin-icon" : ""} />
                        <span>{autoRefresh ? "Live (5s)" : "Paused"}</span>
                    </button>

                    <button
                        type="button"
                        className="cache-btn cache-btn-warm"
                        onClick={handleWarmCache}
                        disabled={actionBusy}
                    >
                        <Flame size={15} />
                        <span>Warm Cache</span>
                    </button>

                    <button
                        type="button"
                        className="cache-btn cache-btn-danger"
                        onClick={handleClearAll}
                        disabled={actionBusy}
                    >
                        <Trash2 size={15} />
                        <span>Clear All 10 Layers</span>
                    </button>
                </div>
            </div>

            {/* Notification & Alerts */}
            {notice && (
                <div className="cache-alert cache-alert-success">
                    <CheckCircle size={18} />
                    <span>{notice}</span>
                    <button type="button" onClick={() => setNotice(null)}>×</button>
                </div>
            )}

            {error && (
                <div className="cache-alert cache-alert-error">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                    <button type="button" onClick={() => setError(null)}>×</button>
                </div>
            )}

            {/* Global Summary Cards */}
            <div className="cache-summary-grid">
                <div className="cache-summary-card">
                    <div className="card-top">
                        <span className="card-label">Global Hit Ratio</span>
                        <div className="card-icon-wrap gold">
                            <TrendingUp size={20} />
                        </div>
                    </div>
                    <div className="card-value">{global.hitRate}</div>
                    <div className="card-meta">
                        <span className="hits-text">{global.totalHits} Hits</span> / <span className="misses-text">{global.totalMisses} Misses</span>
                    </div>
                </div>

                <div className="cache-summary-card">
                    <div className="card-top">
                        <span className="card-label">Memory Footprint</span>
                        <div className="card-icon-wrap blue">
                            <Activity size={20} />
                        </div>
                    </div>
                    <div className="card-value">{global.memoryFormatted}</div>
                    <div className="card-meta">In-Memory LRU RAM</div>
                </div>

                <div className="cache-summary-card">
                    <div className="card-top">
                        <span className="card-label">Persistent Disk Usage</span>
                        <div className="card-icon-wrap purple">
                            <HardDrive size={20} />
                        </div>
                    </div>
                    <div className="card-value">{global.diskFormatted}</div>
                    <div className="card-meta">8 Storage Subfolders (GZIP)</div>
                </div>

                <div className="cache-summary-card">
                    <div className="card-top">
                        <span className="card-label">Avg Latency Saved</span>
                        <div className="card-icon-wrap green">
                            <Zap size={20} />
                        </div>
                    </div>
                    <div className="card-value">
                        {global.avgLatencySavedMs > 0 ? `${global.avgLatencySavedMs} ms` : `${global.avgLookupTimeMs} ms`}
                    </div>
                    <div className="card-meta">
                        Lookup speed: {global.avgLookupTimeMs} ms
                    </div>
                </div>

                <div className="cache-summary-card">
                    <div className="card-top">
                        <span className="card-label">Total Entries & Evictions</span>
                        <div className="card-icon-wrap amber">
                            <ShieldCheck size={20} />
                        </div>
                    </div>
                    <div className="card-value">{global.totalEntries} items</div>
                    <div className="card-meta">{global.evictions} LRU Evictions</div>
                </div>
            </div>

            {/* Per-Layer Grid */}
            <div className="layers-section-header">
                <h2>10 Independent Cache Layers</h2>
                <span className="layers-subtext">Each layer operates autonomously with deterministic SHA-256 keys, LRU eviction, and automatic invalidation.</span>
            </div>

            <div className="layers-grid">
                {Object.entries(LAYER_METADATA).map(([layerKey, meta]) => {
                    const layerStats = layers[layerKey] || {};
                    const LayerIcon = meta.icon;
                    const isHealthy = layerStats.status === "healthy" || !layerStats.status;

                    return (
                        <div key={layerKey} className="layer-card">
                            <div className="layer-card-header">
                                <div className="layer-badge-icon">
                                    <LayerIcon size={18} />
                                </div>
                                <div className="layer-titles">
                                    <h3>{meta.title}</h3>
                                    <span className="layer-ttl">TTL: {meta.ttl}</span>
                                </div>
                                <button
                                    type="button"
                                    className="layer-clear-btn"
                                    onClick={() => handleClearLayer(meta.id)}
                                    title={`Purge Layer ${meta.id}`}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>

                            <p className="layer-description">{meta.desc}</p>

                            <div className="layer-metrics-grid">
                                <div className="layer-metric-item">
                                    <span className="metric-label">Entries</span>
                                    <span className="metric-val">{layerStats.size || 0}</span>
                                </div>
                                <div className="layer-metric-item">
                                    <span className="metric-label">Hit Rate</span>
                                    <span className="metric-val highlight">{layerStats.hitRate || "0%"}</span>
                                </div>
                                <div className="layer-metric-item">
                                    <span className="metric-label">Latency</span>
                                    <span className="metric-val">{layerStats.avgLookupTimeMs || 0} ms</span>
                                </div>
                                <div className="layer-metric-item">
                                    <span className="metric-label">Storage</span>
                                    <span className="metric-val">{layerStats.memoryFormatted || layerStats.diskFormatted || "0 B"}</span>
                                </div>
                            </div>

                            <div className="layer-card-footer">
                                <div className="layer-status-pill">
                                    <span className="status-dot healthy" />
                                    <span>{isHealthy ? "Healthy" : "Degraded"}</span>
                                </div>
                                <div className="layer-hits-detail">
                                    {layerStats.hits || 0} hits / {layerStats.misses || 0} misses
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
