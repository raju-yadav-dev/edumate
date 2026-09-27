import React, { useState, useEffect, useCallback } from "react";
import "./KnowledgeAnalyticsDashboard.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function KnowledgeAnalyticsDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAnalytics = useCallback(async () => {
        try {
            const token = localStorage.getItem("accessToken") || "";
            const res = await fetch(`${API_BASE}/api/analytics/overview`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
            const resJson = await res.json();
            if (resJson.success) {
                setData(resJson.data);
                setError(null);
            } else {
                setError(resJson.error || "Failed to load analytics");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAnalytics();
        const interval = setInterval(fetchAnalytics, 10000);
        return () => clearInterval(interval);
    }, [fetchAnalytics]);

    const handleExport = async (format = "csv") => {
        try {
            const token = localStorage.getItem("accessToken") || "";
            const res = await fetch(`${API_BASE}/api/analytics/export?format=${format}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (format === "csv") {
                const text = await res.text();
                const blob = new Blob([text], { type: "text/csv" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `edumate-knowledge-analytics-${Date.now()}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                const json = await res.json();
                const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `edumate-knowledge-analytics-${Date.now()}.json`;
                a.click();
                window.URL.revokeObjectURL(url);
            }
        } catch (err) {
            alert(`Export failed: ${err.message}`);
        }
    };

    if (loading) {
        return (
            <div className="analytics-loading">
                <div className="analytics-spinner"></div>
                <p>Loading Knowledge Base Analytics...</p>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="analytics-error-box">
                <h3>Analytics Unavailable</h3>
                <p>{error}</p>
                <button onClick={fetchAnalytics} className="btn-retry">Retry</button>
            </div>
        );
    }

    const kb = data?.knowledgeBase || {};
    const ai = data?.aiPerformance || {};
    const health = data?.healthStatus || {};
    const user = data?.userActivity || {};
    const queue = data?.chunkingQueue || {};
    const popularQueries = data?.popularQueries || [];

    return (
        <div className="knowledge-analytics-view">
            {/* Header */}
            <div className="analytics-header">
                <div>
                    <span className="analytics-badge">MONITORING CENTER</span>
                    <h2>Knowledge Base & AI System Analytics</h2>
                    <p className="analytics-sub">Live document breakdowns, vector counts, AI telemetry, and queue metrics</p>
                </div>

                <div className="analytics-export-actions">
                    <button onClick={() => handleExport("json")} className="btn-export-secondary">
                        Export JSON
                    </button>
                    <button onClick={() => handleExport("csv")} className="btn-export-primary">
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Top 4 KPI Cards */}
            <div className="analytics-kpi-grid">
                <div className="kpi-card">
                    <span className="kpi-label">Total Documents</span>
                    <span className="kpi-value">{kb.totalDocuments || 0}</span>
                    <span className="kpi-sub">Uploaded & Verified</span>
                </div>
                <div className="kpi-card">
                    <span className="kpi-label">Indexed Chunks</span>
                    <span className="kpi-value">{kb.totalChunks || 0}</span>
                    <span className="kpi-sub">Avg {kb.averageChunksPerDocument || 0} chunks/doc</span>
                </div>
                <div className="kpi-card">
                    <span className="kpi-label">Qdrant Vectors</span>
                    <span className="kpi-value highlight">{kb.totalIndexedVectors || 0}</span>
                    <span className="kpi-sub">768-dim Embeddings</span>
                </div>
                <div className="kpi-card">
                    <span className="kpi-label">Retrieval Cache Hit</span>
                    <span className="kpi-value green">{ai.retrievalCacheHitRatePercent || 0}%</span>
                    <span className="kpi-sub">Total Requests: {ai.totalRequests || 0}</span>
                </div>
            </div>

            {/* Main 2-Column Analytics Section */}
            <div className="analytics-main-grid">
                {/* Column 1: Category & Department Breakdown */}
                <div className="analytics-card">
                    <h3>📚 Knowledge Documents by Category</h3>
                    <div className="table-responsive">
                        <table className="analytics-table">
                            <thead>
                                <tr>
                                    <th>Category Path</th>
                                    <th>Documents</th>
                                    <th>Share</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(kb.byCategory || []).map((cat, i) => {
                                    const pct = kb.totalDocuments > 0 ? Math.round((cat.count / kb.totalDocuments) * 100) : 0;
                                    return (
                                        <tr key={i}>
                                            <td><strong>{cat.category}</strong></td>
                                            <td>{cat.count}</td>
                                            <td>
                                                <div className="share-bar-wrapper">
                                                    <div className="share-bar" style={{ width: `${Math.max(5, pct)}%` }}></div>
                                                    <span>{pct}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Column 2: System Health & AI Latency Breakdown */}
                <div className="analytics-card">
                    <h3>⚡ AI Latency & Pipeline Health</h3>

                    <div className="health-status-row">
                        <div className="health-pill">
                            <span>System Status:</span>
                            <strong className={health.overall === "healthy" ? "healthy" : "warning"}>
                                {health.overall?.toUpperCase() || "HEALTHY"}
                            </strong>
                        </div>
                        <div className="health-pill">
                            <span>Model:</span>
                            <strong>{ai.model || "Qwen 1.7B"}</strong>
                        </div>
                        <div className="health-pill">
                            <span>Speed:</span>
                            <strong>{ai.estimatedTokensPerSec || "35 t/s"}</strong>
                        </div>
                    </div>

                    <div className="latencies-box">
                        <div className="latency-item">
                            <span className="lbl">Average Total Latency:</span>
                            <span className="val">{((ai.averageTotalLatencyMs || 0) / 1000).toFixed(2)}s</span>
                        </div>
                        <div className="latency-item">
                            <span className="lbl">Average LLM Generation:</span>
                            <span className="val">{ai.averageLlmLatencyMs || 0} ms</span>
                        </div>
                        <div className="latency-item">
                            <span className="lbl">Average Retrieval Latency:</span>
                            <span className="val">{ai.averageRetrievalLatencyMs || 0} ms</span>
                        </div>
                    </div>

                    <h4 style={{ marginTop: "24px", marginBottom: "12px", color: "#94a3b8" }}>🔥 Popular University Queries</h4>
                    <ul className="popular-queries-list">
                        {popularQueries.map((pq, idx) => (
                            <li key={idx} className="popular-query-item">
                                <span className="query-text">"{pq.query}"</span>
                                <span className="query-count">{pq.count} hits</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
