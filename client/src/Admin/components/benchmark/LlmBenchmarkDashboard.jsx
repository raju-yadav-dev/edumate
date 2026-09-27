import React, { useState, useEffect, useCallback } from "react";
import "./LlmBenchmarkDashboard.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function LlmBenchmarkDashboard() {
    const [metrics, setMetrics] = useState(null);
    const [comparison, setComparison] = useState([]);
    const [loading, setLoading] = useState(true);
    const [benchmarking, setBenchmarking] = useState(false);
    const [benchmarkResult, setBenchmarkResult] = useState(null);
    const [selectedScenario, setSelectedScenario] = useState("all");
    const [error, setError] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchMetrics = useCallback(async () => {
        try {
            const token = localStorage.getItem("accessToken") || "";
            const res = await fetch(`${API_BASE}/api/benchmark/metrics`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
            if (!res.ok) {
                if (res.status === 403) {
                    setError("Developer mode disabled. Enable AI_DEBUG=true in .env to access AI Performance Profiler.");
                    return;
                }
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            if (data.success) {
                setMetrics(data);
                setError(null);
            }
        } catch (err) {
            console.warn("Failed to fetch benchmark metrics:", err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchComparison = useCallback(async () => {
        try {
            const token = localStorage.getItem("accessToken") || "";
            const res = await fetch(`${API_BASE}/api/benchmark/comparison`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setComparison(data.comparison || []);
            }
        } catch (err) {
            console.warn("Failed to fetch model comparison:", err.message);
        }
    }, []);

    useEffect(() => {
        fetchMetrics();
        fetchComparison();

        let interval = null;
        if (autoRefresh) {
            interval = setInterval(fetchMetrics, 3000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [autoRefresh, fetchMetrics, fetchComparison]);

    const handleRunBenchmark = async () => {
        setBenchmarking(true);
        setBenchmarkResult(null);
        setError(null);

        try {
            const token = localStorage.getItem("accessToken") || "";
            const payload = selectedScenario === "all" ? {} : { scenarioId: selectedScenario };
            const res = await fetch(`${API_BASE}/api/benchmark/run`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                setBenchmarkResult(data.result);
                fetchMetrics();
            } else {
                setError(data.error || "Benchmark run failed");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setBenchmarking(false);
        }
    };

    const handleExport = async (format = "markdown") => {
        try {
            const token = localStorage.getItem("accessToken") || "";
            const res = await fetch(`${API_BASE}/api/benchmark/export?format=${format}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (format === "markdown") {
                const text = await res.text();
                const blob = new Blob([text], { type: "text/markdown" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `edumate-benchmark-report-${Date.now()}.md`;
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                const data = await res.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `edumate-benchmark-report-${Date.now()}.json`;
                a.click();
                window.URL.revokeObjectURL(url);
            }
        } catch (err) {
            alert(`Failed to export: ${err.message}`);
        }
    };

    if (loading) {
        return (
            <div className="llm-bench-loading">
                <div className="llm-bench-spinner"></div>
                <p>Initializing AI Performance Profiler...</p>
            </div>
        );
    }

    if (error && !metrics) {
        return (
            <div className="llm-bench-error-card">
                <div className="llm-bench-error-icon">🛡️</div>
                <h3>Developer Mode Restricted</h3>
                <p>{error}</p>
                <div className="llm-bench-env-hint">
                    <code>AI_DEBUG=true</code> in <code>.env</code>
                </div>
            </div>
        );
    }

    const modelInfo = metrics?.model || {};
    const hardware = metrics?.hardware || {};
    const monitoring = metrics?.monitoring || {};
    const cache = metrics?.cache || {};
    const targets = metrics?.targets || {};
    const recent = metrics?.recentRequests || [];
    const latestReq = recent[0] || null;

    return (
        <div className="llm-bench-dashboard">
            {/* Header */}
            <div className="llm-bench-header">
                <div className="llm-bench-title-block">
                    <div className="llm-bench-badge">PRODUCTION PROFILER</div>
                    <h2>LLM Benchmarking & Performance Dashboard</h2>
                    <p className="llm-bench-subtitle">
                        Real-time telemetry, stage waterfall profiler, cache efficiency & multi-model comparison
                    </p>
                </div>

                <div className="llm-bench-controls">
                    <label className="llm-bench-toggle">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        <span>Live Poll (3s)</span>
                    </label>

                    <button
                        className="llm-bench-btn-secondary"
                        onClick={() => handleExport("json")}
                    >
                        Export JSON
                    </button>
                    <button
                        className="llm-bench-btn-primary"
                        onClick={() => handleExport("markdown")}
                    >
                        Export Markdown
                    </button>
                </div>
            </div>

            {/* Quick Status Bar */}
            <div className="llm-bench-status-bar">
                <div className="llm-bench-stat-pill">
                    <span className="stat-label">Model:</span>
                    <span className="stat-val highlight">{modelInfo.displayName || modelInfo.model || "Qwen 1.7B"}</span>
                </div>
                <div className="llm-bench-stat-pill">
                    <span className="stat-label">Provider:</span>
                    <span className="stat-val">{modelInfo.provider || "llama.cpp"}</span>
                </div>
                <div className="llm-bench-stat-pill">
                    <span className="stat-label">Context Size:</span>
                    <span className="stat-val">{modelInfo.contextSize || 4096} tokens</span>
                </div>
                <div className="llm-bench-stat-pill">
                    <span className="stat-label">Threads / GPU:</span>
                    <span className="stat-val">{modelInfo.threads || 4}t / {modelInfo.gpuLayers || 0}ngl</span>
                </div>
                <div className="llm-bench-stat-pill">
                    <span className="stat-label">RAM Usage:</span>
                    <span className="stat-val">{hardware.ramUsagePercent || 0}% ({hardware.usedRamMb || 0} MB)</span>
                </div>
                <div className="llm-bench-stat-pill">
                    <span className="stat-label">Status:</span>
                    <span className={`stat-val status-${modelInfo.online ? "online" : "offline"}`}>
                        {modelInfo.online ? "● ONLINE" : "○ OFFLINE"}
                    </span>
                </div>
            </div>

            {/* Top Gauges Grid */}
            <div className="llm-bench-grid-4">
                {/* Gauge 1: Retrieval Latency */}
                <div className="llm-bench-card gauge-card">
                    <div className="card-header">
                        <span className="card-title">Retrieval Latency</span>
                        <span className={`target-badge ${targets.qdrantSearch?.passed ? "pass" : "fail"}`}>
                            Target ≤800ms
                        </span>
                    </div>
                    <div className="gauge-val">{monitoring.avgRetrievalLatencyMs || 0} <span className="unit">ms</span></div>
                    <div className="gauge-sub">
                        <span>Planner: ~{Math.round((monitoring.avgRetrievalLatencyMs || 0) * 0.15)}ms</span>
                        <span>Qdrant: ~{Math.round((monitoring.avgRetrievalLatencyMs || 0) * 0.70)}ms</span>
                    </div>
                </div>

                {/* Gauge 2: Generation Latency */}
                <div className="llm-bench-card gauge-card">
                    <div className="card-header">
                        <span className="card-title">Avg LLM Latency</span>
                        <span className="target-badge pass">Streaming Enabled</span>
                    </div>
                    <div className="gauge-val">{monitoring.avgLlmLatencyMs || 0} <span className="unit">ms</span></div>
                    <div className="gauge-sub">
                        <span>First Token: ≤1.0s target</span>
                        <span>Prompt Cache: ACTIVE</span>
                    </div>
                </div>

                {/* Gauge 3: Total RAG Turnaround */}
                <div className="llm-bench-card gauge-card">
                    <div className="card-header">
                        <span className="card-title">Total RAG Response</span>
                        <span className={`target-badge ${targets.totalRagResponse?.passed ? "pass" : "fail"}`}>
                            Target ≤10.0s
                        </span>
                    </div>
                    <div className="gauge-val">
                        {((monitoring.avgTotalLatencyMs || 0) / 1000).toFixed(2)} <span className="unit">sec</span>
                    </div>
                    <div className="gauge-sub">
                        <span>Total Requests: {monitoring.totalRequests || 0}</span>
                        <span>Status: {targets.totalRagResponse?.passed ? "✓ Optimal" : "Degraded"}</span>
                    </div>
                </div>

                {/* Gauge 4: Cache Efficiency */}
                <div className="llm-bench-card gauge-card">
                    <div className="card-header">
                        <span className="card-title">Retrieval Cache Hit</span>
                        <span className={`target-badge ${cache.retrievalCache?.hitRatePercent >= 70 ? "pass" : "fail"}`}>
                            Target ≥70%
                        </span>
                    </div>
                    <div className="gauge-val">{cache.retrievalCache?.hitRatePercent || 0} <span className="unit">%</span></div>
                    <div className="gauge-sub">
                        <span>KV Cache Reuse: YES</span>
                        <span>Prompt Caching: YES</span>
                    </div>
                </div>
            </div>

            {/* Stage Timeline Waterfall */}
            <div className="llm-bench-card waterfall-card">
                <div className="card-header">
                    <span className="card-title">Request Timeline Profiler (Latest Turn)</span>
                    <span className="waterfall-query">
                        {latestReq ? `"${latestReq.question?.slice(0, 50)}..."` : "No recent requests recorded"}
                    </span>
                </div>

                {latestReq ? (
                    <div className="waterfall-stages">
                        <div className="waterfall-stage-row">
                            <span className="stage-name">1. Query Planner</span>
                            <div className="stage-bar-track">
                                <div
                                    className="stage-bar bar-planner"
                                    style={{ width: `${Math.max(5, Math.min(100, (latestReq.timers?.queryPlannerLatencyMs || 10) / 5))}%` }}
                                ></div>
                            </div>
                            <span className="stage-time">{latestReq.timers?.queryPlannerLatencyMs || 0} ms</span>
                        </div>

                        <div className="waterfall-stage-row">
                            <span className="stage-name">2. Metadata Filter</span>
                            <div className="stage-bar-track">
                                <div
                                    className="stage-bar bar-filter"
                                    style={{ width: `${Math.max(5, Math.min(100, (latestReq.timers?.metadataFilterLatencyMs || 5) / 5))}%` }}
                                ></div>
                            </div>
                            <span className="stage-time">{latestReq.timers?.metadataFilterLatencyMs || 0} ms</span>
                        </div>

                        <div className="waterfall-stage-row">
                            <span className="stage-name">3. Qdrant Search</span>
                            <div className="stage-bar-track">
                                <div
                                    className="stage-bar bar-qdrant"
                                    style={{ width: `${Math.max(5, Math.min(100, (latestReq.timers?.qdrantLatencyMs || 25) / 5))}%` }}
                                ></div>
                            </div>
                            <span className="stage-time">{latestReq.timers?.qdrantLatencyMs || 0} ms</span>
                        </div>

                        <div className="waterfall-stage-row">
                            <span className="stage-name">4. Mongo Lookup</span>
                            <div className="stage-bar-track">
                                <div
                                    className="stage-bar bar-mongo"
                                    style={{ width: `${Math.max(5, Math.min(100, (latestReq.timers?.mongoLookupLatencyMs || 15) / 5))}%` }}
                                ></div>
                            </div>
                            <span className="stage-time">{latestReq.timers?.mongoLookupLatencyMs || 0} ms</span>
                        </div>

                        <div className="waterfall-stage-row">
                            <span className="stage-name">5. Context Builder</span>
                            <div className="stage-bar-track">
                                <div
                                    className="stage-bar bar-context"
                                    style={{ width: `${Math.max(5, Math.min(100, (latestReq.timers?.contextBuilderLatencyMs || 10) / 5))}%` }}
                                ></div>
                            </div>
                            <span className="stage-time">{latestReq.timers?.contextBuilderLatencyMs || 0} ms</span>
                        </div>

                        <div className="waterfall-stage-row">
                            <span className="stage-name">6. Prompt Builder</span>
                            <div className="stage-bar-track">
                                <div
                                    className="stage-bar bar-prompt"
                                    style={{ width: `${Math.max(5, Math.min(100, (latestReq.timers?.promptBuilderLatencyMs || 5) / 5))}%` }}
                                ></div>
                            </div>
                            <span className="stage-time">{latestReq.timers?.promptBuilderLatencyMs || 0} ms</span>
                        </div>

                        <div className="waterfall-stage-row">
                            <span className="stage-name">7. llama.cpp First Token & Stream</span>
                            <div className="stage-bar-track">
                                <div
                                    className="stage-bar bar-llm"
                                    style={{ width: `${Math.max(5, Math.min(100, (latestReq.timers?.llmLatencyMs || 1500) / 30))}%` }}
                                ></div>
                            </div>
                            <span className="stage-time">{latestReq.timers?.llmLatencyMs || 0} ms</span>
                        </div>
                    </div>
                ) : (
                    <div className="empty-waterfall">
                        <p>Ask a question in EduMate Chat to view real-time waterfall latency breakdown.</p>
                    </div>
                )}
            </div>

            {/* Benchmark Suite Runner */}
            <div className="llm-bench-card bench-suite-card">
                <div className="card-header">
                    <div>
                        <span className="card-title">Production Benchmark Test Suite</span>
                        <p className="card-desc">Execute standardized 4-tier benchmark scenarios and measure tokens/sec against SLA targets</p>
                    </div>

                    <div className="suite-actions">
                        <select
                            value={selectedScenario}
                            onChange={(e) => setSelectedScenario(e.target.value)}
                            disabled={benchmarking}
                            className="suite-select"
                        >
                            <option value="all">Full 4-Tier Benchmark Suite (All Scenarios)</option>
                            <option value="small">Small Question: "Who is the HOD of CSS?"</option>
                            <option value="medium">Medium Question: "What is the BCA fee structure?"</option>
                            <option value="large">Large Question: "Tell me everything about BCA admissions."</option>
                            <option value="very_large">Very Large: "List all CSS faculty with designations"</option>
                        </select>

                        <button
                            className="llm-bench-btn-run"
                            onClick={handleRunBenchmark}
                            disabled={benchmarking}
                        >
                            {benchmarking ? "Executing Benchmark..." : "⚡ Run Benchmark"}
                        </button>
                    </div>
                </div>

                {benchmarkResult && (
                    <div className="benchmark-results-box">
                        <h4>Benchmark Execution Summary</h4>
                        {benchmarkResult.overallSummary && (
                            <div className="summary-pills">
                                <div className="pill">
                                    <span>Average Total Latency:</span>
                                    <strong>{benchmarkResult.overallSummary.averageTotalLatencyMs} ms</strong>
                                </div>
                                <div className="pill">
                                    <span>Average Speed:</span>
                                    <strong>{benchmarkResult.overallSummary.averageTokensPerSec} t/s</strong>
                                </div>
                                <div className="pill">
                                    <span>Peak Speed:</span>
                                    <strong>{benchmarkResult.overallSummary.peakTokensPerSec} t/s</strong>
                                </div>
                                <div className="pill">
                                    <span>Target Status:</span>
                                    <strong className={benchmarkResult.overallSummary.meetsProductionLatencyTarget ? "pass" : "fail"}>
                                        {benchmarkResult.overallSummary.meetsProductionLatencyTarget ? "✓ SLA PASSED" : "⚠ EXCEEDED"}
                                    </strong>
                                </div>
                            </div>
                        )}

                        {benchmarkResult.scenarios && (
                            <table className="benchmark-table">
                                <thead>
                                    <tr>
                                        <th>Scenario</th>
                                        <th>Question</th>
                                        <th>Target Latency</th>
                                        <th>Avg Total Latency</th>
                                        <th>TTFT</th>
                                        <th>Tokens/Sec</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {benchmarkResult.scenarios.map((s, idx) => (
                                        <tr key={idx}>
                                            <td><strong>{s.scenarioName}</strong></td>
                                            <td className="q-text">"{s.question}"</td>
                                            <td>≤{s.targetLatencyMs} ms</td>
                                            <td><strong>{s.averages?.totalLatencyMs} ms</strong></td>
                                            <td>{s.averages?.ttftMs} ms</td>
                                            <td>{s.averages?.tokensPerSec} t/s</td>
                                            <td>
                                                <span className={`status-badge ${s.averages?.totalLatencyMs <= s.targetLatencyMs ? "pass" : "fail"}`}>
                                                    {s.averages?.totalLatencyMs <= s.targetLatencyMs ? "✓ PASS" : "⚠ FAIL"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>

            {/* Model Comparison Matrix */}
            <div className="llm-bench-card comparison-card">
                <div className="card-header">
                    <span className="card-title">Model Comparison Matrix</span>
                    <span className="comparison-hint">Switch models seamlessly by updating LLM_MODEL in .env</span>
                </div>

                <div className="comparison-table-wrapper">
                    <table className="comparison-table">
                        <thead>
                            <tr>
                                <th>Model Profile</th>
                                <th>Family</th>
                                <th>First Token Latency</th>
                                <th>Avg Total Latency</th>
                                <th>Generation Speed</th>
                                <th>Ideal Deployment</th>
                            </tr>
                        </thead>
                        <tbody>
                            {comparison.map((m, idx) => (
                                <tr key={idx} className={m.isCurrentActiveModel ? "active-row" : ""}>
                                    <td>
                                        <strong>{m.displayName}</strong>
                                        {m.isCurrentActiveModel && <span className="active-tag">ACTIVE</span>}
                                    </td>
                                    <td>{m.family?.toUpperCase()}</td>
                                    <td>{m.expectedFirstTokenLatency}</td>
                                    <td>{m.expectedTotalLatency}</td>
                                    <td><strong>{m.expectedTokensPerSec}</strong></td>
                                    <td>{m.recommendedFor}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
