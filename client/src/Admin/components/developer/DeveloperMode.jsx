import React, { useState, useEffect, useCallback } from "react";
import "./DeveloperMode.css";
import {
    Code2,
    Activity,
    Layers,
    Search,
    Play,
    RotateCcw,
    Download,
    FileText,
    Cpu,
    Terminal,
    CheckCircle2,
    Clock,
    Sliders,
    Zap,
    Compass,
    Bot,
    Network
} from "lucide-react";
import { getApiRootUrl } from "../../../services/apiConfig";
import { getAdminAccessToken } from "../../../services/adminSession";

export default function DeveloperMode() {
    const [activeTab, setActiveTab] = useState("timeline");
    const [traces, setTraces] = useState([]);
    const [selectedTraceId, setSelectedTraceId] = useState("");
    const [selectedTrace, setSelectedTrace] = useState(null);
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState("");

    // Agents Ecosystem state
    const [agents, setAgents] = useState([]);
    const [agentQuestion, setAgentQuestion] = useState("Explain Python and Brainware Python syllabus.");
    const [selectedAgentId, setSelectedAgentId] = useState("");
    const [orchestratorResult, setOrchestratorResult] = useState(null);

    // Playgrounds state
    const [qpQuestion, setQpQuestion] = useState("What is the admission procedure for B.Tech in CSE?");
    const [qpResult, setQpResult] = useState(null);
    const [ragQuery, setRagQuery] = useState("Who is the HOD of Computational Sciences?");
    const [ragTopK, setRagTopK] = useState(5);
    const [ragMinScore, setRagMinScore] = useState(0.5);
    const [ragResult, setRagResult] = useState(null);
    const [customPrompt, setCustomPrompt] = useState("You are EduMate, the official AI University Assistant for Brainware University. Answer strictly from verified institutional facts.");
    const [promptQuery, setPromptQuery] = useState("Explain the hostel fee structure.");
    const [promptResult, setPromptResult] = useState(null);
    const [aiLogs, setAiLogs] = useState([]);

    const fetchTraces = useCallback(async () => {
        setLoading(true);
        const token = getAdminAccessToken();
        const root = getApiRootUrl();
        const headers = {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        };

        try {
            const res = await fetch(`${root}/api/admin/developer/traces?limit=20`, { credentials: "include", headers });
            if (res.ok) {
                const data = await res.json();
                if (data?.data?.traces) {
                    setTraces(data.data.traces);
                    if (!selectedTraceId && data.data.traces.length > 0) {
                        setSelectedTraceId(data.data.traces[0].traceId);
                        setSelectedTrace(data.data.traces[0]);
                    }
                }
            }
        } catch (err) {
            console.warn("Could not fetch remote developer traces:", err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedTraceId]);

    const fetchLogs = useCallback(async () => {
        const token = getAdminAccessToken();
        const root = getApiRootUrl();
        try {
            const res = await fetch(`${root}/api/admin/developer/logs?limit=50`, {
                credentials: "include",
                headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
            });
            if (res.ok) {
                const data = await res.json();
                if (data?.data?.logs) setAiLogs(data.data.logs);
            }
        } catch (_) {}
    }, []);

    const fetchAgents = useCallback(async () => {
        const token = getAdminAccessToken();
        const root = getApiRootUrl();
        try {
            const res = await fetch(`${root}/api/admin/agents/list`, {
                credentials: "include",
                headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
            });
            if (res.ok) {
                const data = await res.json();
                if (data?.data?.agents) setAgents(data.data.agents);
            }
        } catch (_) {}
    }, []);

    useEffect(() => {
        fetchTraces();
        fetchLogs();
        fetchAgents();
    }, [fetchTraces, fetchLogs, fetchAgents]);

    const handleToggleAgent = async (agentId, currentStatus) => {
        const token = getAdminAccessToken();
        const root = getApiRootUrl();
        try {
            const res = await fetch(`${root}/api/admin/agents/toggle`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include",
                body: JSON.stringify({ agentId, isEnabled: !currentStatus })
            });
            if (res.ok) {
                await fetchAgents();
            }
        } catch (err) {
            alert(`Toggle error: ${err.message}`);
        }
    };

    const handleRunAgentPlayground = async () => {
        setLoading(true);
        const token = getAdminAccessToken();
        const root = getApiRootUrl();
        try {
            const res = await fetch(`${root}/api/admin/agents/playground`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include",
                body: JSON.stringify({ question: agentQuestion, agentId: selectedAgentId || undefined })
            });
            if (res.ok) {
                const data = await res.json();
                setOrchestratorResult(data.data);
            }
        } catch (err) {
            alert(`Orchestrator error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedTraceId && traces.length > 0) {
            const found = traces.find((t) => t.traceId === selectedTraceId);
            if (found) setSelectedTrace(found);
        }
    }, [selectedTraceId, traces]);

    // Query Planner Playground Execution
    const handleRunQueryPlanner = async () => {
        setLoading(true);
        const token = getAdminAccessToken();
        const root = getApiRootUrl();
        try {
            const res = await fetch(`${root}/api/admin/developer/playground/query-planner`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include",
                body: JSON.stringify({ question: qpQuestion })
            });
            if (res.ok) {
                const data = await res.json();
                setQpResult(data.data);
            }
        } catch (err) {
            alert(`Query Planner error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // RAG Playground Execution
    const handleRunRag = async () => {
        setLoading(true);
        const token = getAdminAccessToken();
        const root = getApiRootUrl();
        try {
            const res = await fetch(`${root}/api/admin/developer/playground/rag`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include",
                body: JSON.stringify({ query: ragQuery, topK: ragTopK, minScore: ragMinScore })
            });
            if (res.ok) {
                const data = await res.json();
                setRagResult(data.data);
            }
        } catch (err) {
            alert(`RAG Sandbox error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Prompt Playground Execution
    const handleRunPrompt = async () => {
        const token = getAdminAccessToken();
        const root = getApiRootUrl();
        try {
            const res = await fetch(`${root}/api/admin/developer/playground/prompt`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include",
                body: JSON.stringify({ question: promptQuery, customSystemPrompt: customPrompt })
            });
            if (res.ok) {
                const data = await res.json();
                setPromptResult(data.data);
            }
        } catch (err) {
            alert(`Prompt Sandbox error: ${err.message}`);
        }
    };

    // Replay Trace
    const handleReplayTrace = async () => {
        if (!selectedTrace) return;
        setLoading(true);
        const token = getAdminAccessToken();
        const root = getApiRootUrl();
        try {
            const res = await fetch(`${root}/api/admin/developer/traces/replay`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include",
                body: JSON.stringify({ traceId: selectedTrace.traceId })
            });
            if (res.ok) {
                const data = await res.json();
                setNotice("Trace successfully replayed through pipeline.");
                setTimeout(() => setNotice(""), 4000);
                await fetchTraces();
                if (data.data) {
                    setSelectedTraceId(data.data.traceId);
                    setSelectedTrace(data.data);
                }
            }
        } catch (err) {
            alert(`Replay error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Export Debug Bundle
    const handleExportDebugBundle = () => {
        if (!selectedTrace) return;
        const root = getApiRootUrl();
        window.open(`${root}/api/admin/developer/debug-bundle/${selectedTrace.traceId}`, "_blank");
    };

    return (
        <div className="developer-mode">
            {/* Header */}
            <div className="dev-header">
                <div className="dev-header-title">
                    <Code2 size={28} color="#38bdf8" />
                    <div>
                        <h2>AI Developer Mode & RAG Debugger</h2>
                        <span className="dev-badge">
                            <Zap size={12} /> Real-Time Pipeline Observability Active
                        </span>
                    </div>
                </div>

                <div className="dev-actions">
                    <button className="dev-btn" onClick={handleReplayTrace} disabled={loading || !selectedTrace}>
                        <RotateCcw size={14} />
                        <span>Replay Query</span>
                    </button>
                    <button className="dev-btn primary" onClick={handleExportDebugBundle} disabled={!selectedTrace}>
                        <Download size={14} />
                        <span>Export Debug Bundle</span>
                    </button>
                </div>
            </div>

            {notice && (
                <div style={{ padding: "10px 16px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.3)", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "8px" }}>
                    <CheckCircle2 size={16} />
                    <span>{notice}</span>
                </div>
            )}

            {/* Trace Selector */}
            <div className="trace-selector-bar">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Clock size={16} color="#94a3b8" />
                    <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Select Execution Trace:</span>
                    <select
                        className="trace-select"
                        value={selectedTraceId}
                        onChange={(e) => setSelectedTraceId(e.target.value)}
                    >
                        {traces.map((t) => (
                            <option key={t.traceId} value={t.traceId}>
                                [{new Date(t.timestamp).toLocaleTimeString()}] "{t.query.slice(0, 45)}..." ({t.totalLatencyMs}ms - {t.routingMode})
                            </option>
                        ))}
                    </select>
                </div>
                {selectedTrace && (
                    <div style={{ fontSize: "0.8rem", color: "#38bdf8", fontWeight: "600" }}>
                        Latency: {selectedTrace.totalLatencyMs}ms | Intent: {selectedTrace.intent}
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="dev-nav-tabs">
                <button
                    className={`dev-tab ${activeTab === "agents" ? "active" : ""}`}
                    onClick={() => setActiveTab("agents")}
                >
                    <Bot size={15} />
                    <span>AI Agent Ecosystem ({agents.length || 9})</span>
                </button>
                <button
                    className={`dev-tab ${activeTab === "timeline" ? "active" : ""}`}
                    onClick={() => setActiveTab("timeline")}
                >
                    <Activity size={15} />
                    <span>14-Stage Timeline</span>
                </button>
                <button
                    className={`dev-tab ${activeTab === "prompts" ? "active" : ""}`}
                    onClick={() => setActiveTab("prompts")}
                >
                    <FileText size={15} />
                    <span>Prompt & Context</span>
                </button>
                <button
                    className={`dev-tab ${activeTab === "retrieval" ? "active" : ""}`}
                    onClick={() => setActiveTab("retrieval")}
                >
                    <Layers size={15} />
                    <span>Retrieved Chunks & Vectors</span>
                </button>
                <button
                    className={`dev-tab ${activeTab === "query_planner" ? "active" : ""}`}
                    onClick={() => setActiveTab("query_planner")}
                >
                    <Compass size={15} />
                    <span>Query Planner Playground</span>
                </button>
                <button
                    className={`dev-tab ${activeTab === "rag_playground" ? "active" : ""}`}
                    onClick={() => setActiveTab("rag_playground")}
                >
                    <Search size={15} />
                    <span>RAG Sandbox</span>
                </button>
                <button
                    className={`dev-tab ${activeTab === "prompt_playground" ? "active" : ""}`}
                    onClick={() => setActiveTab("prompt_playground")}
                >
                    <Sliders size={15} />
                    <span>Prompt Sandbox</span>
                </button>
                <button
                    className={`dev-tab ${activeTab === "logs" ? "active" : ""}`}
                    onClick={() => setActiveTab("logs")}
                >
                    <Terminal size={15} />
                    <span>AI Logs Stream</span>
                </button>
            </div>

            {/* Content Views */}

            {/* Tab 1: 14-Stage Timeline */}
            {activeTab === "timeline" && selectedTrace && (
                <div className="dev-card">
                    {/* Token Breakdown Grid */}
                    <div className="token-grid">
                        <div className="token-box">
                            <div className="token-label">Prompt Tokens</div>
                            <div className="token-val">{selectedTrace.tokens?.promptTokens || 0}</div>
                        </div>
                        <div className="token-box">
                            <div className="token-label">Context Tokens</div>
                            <div className="token-val">{selectedTrace.tokens?.contextTokens || 0}</div>
                        </div>
                        <div className="token-box">
                            <div className="token-label">Completion Tokens</div>
                            <div className="token-val">{selectedTrace.tokens?.completionTokens || 0}</div>
                        </div>
                        <div className="token-box">
                            <div className="token-label">Citation Tokens</div>
                            <div className="token-val">{selectedTrace.tokens?.citationTokens || 0}</div>
                        </div>
                        <div className="token-box">
                            <div className="token-label">Total Tokens</div>
                            <div className="token-val" style={{ color: "#34d399" }}>
                                {selectedTrace.tokens?.totalTokens || 0}
                            </div>
                        </div>
                        <div className="token-box">
                            <div className="token-label">Confidence</div>
                            <div className="token-val" style={{ color: "#f59e0b" }}>
                                {selectedTrace.confidence?.rating || "HIGH"}
                            </div>
                        </div>
                    </div>

                    <h3 style={{ margin: "16px 0 8px 0", fontSize: "1rem", color: "#cbd5e1" }}>
                        Pipeline Execution Waterfall (14 Stages)
                    </h3>

                    <div className="waterfall-container">
                        {selectedTrace.timeline?.map((stg, idx) => {
                            const maxDuration = Math.max(...selectedTrace.timeline.map((s) => s.durationMs || 1), 50);
                            const widthPct = Math.max(((stg.durationMs || 1) / maxDuration) * 100, 4);

                            return (
                                <div className="timeline-row" key={idx}>
                                    <span className="stage-name">
                                        {idx + 1}. {stg.stage}
                                    </span>
                                    <div className="bar-wrapper">
                                        <div className="waterfall-bar" style={{ width: `${widthPct}%` }} />
                                    </div>
                                    <span className="stage-duration">{stg.durationMs} ms</span>
                                    <div>
                                        {stg.cacheHit ? (
                                            <span className="cache-tag hit">Cache HIT</span>
                                        ) : (
                                            <span className="cache-tag miss">Compute</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Tab 2: Prompt & Context Inspector */}
            {activeTab === "prompts" && selectedTrace && (
                <div className="dev-card">
                    <div className="prompt-panel-grid">
                        <div className="prompt-box">
                            <div className="prompt-box-header">
                                <span>System Prompt</span>
                                <small>Role Instructions</small>
                            </div>
                            <pre className="prompt-text">{selectedTrace.prompts?.systemPrompt || "Default System Prompt"}</pre>
                        </div>

                        <div className="prompt-box">
                            <div className="prompt-box-header">
                                <span>User Query</span>
                                <small>Input Prompt</small>
                            </div>
                            <pre className="prompt-text">{selectedTrace.query}</pre>
                        </div>

                        <div className="prompt-box">
                            <div className="prompt-box-header">
                                <span>Retrieved Context Chunks</span>
                                <small>Injected Grounding</small>
                            </div>
                            <pre className="prompt-text">{selectedTrace.prompts?.retrievedContext || "No context injected (Direct LLM)"}</pre>
                        </div>

                        <div className="prompt-box">
                            <div className="prompt-box-header">
                                <span>Final Prompt to Local Qwen</span>
                                <small>Compiled LLM Input</small>
                            </div>
                            <pre className="prompt-text">{selectedTrace.prompts?.finalPrompt || selectedTrace.query}</pre>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 3: Retrieved Chunks & Vectors */}
            {activeTab === "retrieval" && selectedTrace && (
                <div className="dev-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3 style={{ margin: 0, fontSize: "1rem" }}>
                            Retrieved & Ranked Knowledge Chunks ({selectedTrace.retrieval?.chunks?.length || 0})
                        </h3>
                        <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                            Vector Collection: {selectedTrace.retrieval?.vectorSearch?.collection || "edumate"} | Metric: Cosine
                        </span>
                    </div>

                    <div className="chunks-list">
                        {selectedTrace.retrieval?.chunks?.map((chunk, idx) => (
                            <div className="chunk-card" key={idx}>
                                <div className="chunk-card-header">
                                    <strong>
                                        📄 {chunk.document || "Knowledge Document"} (Page {chunk.page || 1})
                                    </strong>
                                    <span style={{ color: chunk.selected ? "#34d399" : "#94a3b8", fontWeight: "600", fontSize: "0.75rem" }}>
                                        {chunk.selected ? "✓ SELECTED FOR CONTEXT" : "REJECTED (Low Rank)"}
                                    </span>
                                </div>

                                <div className="chunk-scores">
                                    <span className="score-pill highlight">Rerank: {chunk.finalRerankScore}</span>
                                    <span className="score-pill">Semantic: {chunk.semanticScore}</span>
                                    <span className="score-pill">BM25: {chunk.bm25Score}</span>
                                    <span className="score-pill">Metadata: {chunk.metadataScore}</span>
                                </div>

                                <div style={{ fontSize: "0.8rem", color: "#cbd5e1", lineHeight: "1.4", background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: "6px" }}>
                                    {chunk.text}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tab 4: Query Planner Playground */}
            {activeTab === "query_planner" && (
                <div className="dev-card">
                    <div className="playground-form">
                        <div className="form-group">
                            <label>Test Query (Simulates intent & routing without calling LLM)</label>
                            <input
                                type="text"
                                className="form-input"
                                value={qpQuestion}
                                onChange={(e) => setQpQuestion(e.target.value)}
                            />
                        </div>

                        <button className="dev-btn primary" onClick={handleRunQueryPlanner} disabled={loading}>
                            <Play size={14} />
                            <span>Execute Query Planner</span>
                        </button>

                        {qpResult && (
                            <pre className="playground-result">
                                {JSON.stringify(qpResult, null, 2)}
                            </pre>
                        )}
                    </div>
                </div>
            )}

            {/* Tab 5: RAG Sandbox */}
            {activeTab === "rag_playground" && (
                <div className="dev-card">
                    <div className="playground-form">
                        <div className="form-group">
                            <label>RAG Test Query</label>
                            <input
                                type="text"
                                className="form-input"
                                value={ragQuery}
                                onChange={(e) => setRagQuery(e.target.value)}
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Top-K Results ({ragTopK})</label>
                                <input
                                    type="range"
                                    min="1"
                                    max="15"
                                    value={ragTopK}
                                    onChange={(e) => setRagTopK(Number(e.target.value))}
                                />
                            </div>

                            <div className="form-group">
                                <label>Min Similarity Threshold ({ragMinScore})</label>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="0.9"
                                    step="0.05"
                                    value={ragMinScore}
                                    onChange={(e) => setRagMinScore(Number(e.target.value))}
                                />
                            </div>
                        </div>

                        <button className="dev-btn primary" onClick={handleRunRag} disabled={loading}>
                            <Search size={14} />
                            <span>Run Retrieval Test</span>
                        </button>

                        {ragResult && (
                            <pre className="playground-result">
                                {JSON.stringify(ragResult, null, 2)}
                            </pre>
                        )}
                    </div>
                </div>
            )}

            {/* Tab 6: Prompt Sandbox */}
            {activeTab === "prompt_playground" && (
                <div className="dev-card">
                    <div className="playground-form">
                        <div className="form-group">
                            <label>Custom System Prompt</label>
                            <textarea
                                className="form-textarea"
                                rows={3}
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>User Query</label>
                            <input
                                type="text"
                                className="form-input"
                                value={promptQuery}
                                onChange={(e) => setPromptQuery(e.target.value)}
                            />
                        </div>

                        <button className="dev-btn primary" onClick={handleRunPrompt}>
                            <Sliders size={14} />
                            <span>Preview Prompt & Token Counts</span>
                        </button>

                        {promptResult && (
                            <pre className="playground-result">
                                {JSON.stringify(promptResult, null, 2)}
                            </pre>
                        )}
                    </div>
                </div>
            )}

            {/* Tab 7: AI Logs Stream */}
            {activeTab === "logs" && (
                <div className="dev-card">
                    <h3 style={{ margin: "0 0 12px 0", fontSize: "1rem" }}>Real-Time AI Execution Logs ({aiLogs.length})</h3>
                    <div style={{ maxHeight: "400px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {aiLogs.map((log) => (
                            <div key={log.id} style={{ padding: "8px 12px", background: "rgba(0,0,0,0.3)", borderRadius: "6px", fontSize: "0.8rem", display: "flex", gap: "12px" }}>
                                <span style={{ color: "#94a3b8", whiteSpace: "nowrap" }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                <span style={{ color: log.level === "ERROR" ? "#ef4444" : "#38bdf8", fontWeight: "600" }}>[{log.category}]</span>
                                <span style={{ color: "#cbd5e1" }}>{log.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tab: AI Agent Ecosystem & Playground */}
            {activeTab === "agents" && (
                <div className="dev-card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div>
                        <h3 style={{ margin: "0 0 6px 0", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "8px" }}>
                            <Bot size={20} color="#38bdf8" />
                            Multi-Agent Ecosystem Registry & Status
                        </h3>
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8" }}>
                            Specialized autonomous agents collaborating under a central orchestrator.
                        </p>
                    </div>

                    {/* Agents Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
                        {agents.map((agent) => (
                            <div key={agent.id} style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <strong style={{ fontSize: "0.9rem", color: "#38bdf8" }}>{agent.name}</strong>
                                    <button
                                        onClick={() => handleToggleAgent(agent.id, agent.isEnabled)}
                                        style={{
                                            background: agent.isEnabled ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                                            color: agent.isEnabled ? "#34d399" : "#f87171",
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            padding: "3px 8px",
                                            borderRadius: "999px",
                                            fontSize: "0.7rem",
                                            fontWeight: "600",
                                            cursor: "pointer"
                                        }}
                                    >
                                        {agent.isEnabled ? "ENABLED" : "DISABLED"}
                                    </button>
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "#cbd5e1" }}>{agent.role}</div>
                                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                                    {agent.tools?.map((tool, idx) => (
                                        <span key={idx} style={{ background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: "4px", fontSize: "0.7rem", color: "#94a3b8" }}>
                                            🛠️ {tool}
                                        </span>
                                    ))}
                                </div>
                                <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "auto", display: "flex", justifyContent: "space-between" }}>
                                    <span>Invocations: {agent.invocations || 0}</span>
                                    <span>Avg: {agent.avgLatencyMs || 35}ms</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Agent Sandbox & Orchestrator Playground */}
                    <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: "8px", padding: "16px", marginTop: "8px" }}>
                        <h4 style={{ margin: "0 0 12px 0", color: "#38bdf8", display: "flex", alignItems: "center", gap: "8px" }}>
                            <Network size={18} />
                            Multi-Agent Orchestrator Sandbox
                        </h4>

                        <div className="playground-form">
                            <div className="form-group">
                                <label>User Prompt / Complex Multi-Intent Inquiry</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={agentQuestion}
                                    onChange={(e) => setAgentQuestion(e.target.value)}
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Direct Target Agent (Optional - Leave blank for Auto-Orchestration)</label>
                                    <select
                                        className="form-input"
                                        value={selectedAgentId}
                                        onChange={(e) => setSelectedAgentId(e.target.value)}
                                    >
                                        <option value="">⚡ Auto-Orchestrate (Parallel / Sequential Multi-Agent)</option>
                                        {agents.map((a) => (
                                            <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button className="dev-btn primary" onClick={handleRunAgentPlayground} disabled={loading}>
                                <Play size={14} />
                                <span>Execute Multi-Agent Orchestration</span>
                            </button>

                            {orchestratorResult && (
                                <div>
                                    {/* Execution Graph */}
                                    <div style={{ margin: "16px 0 8px 0", padding: "12px", background: "#090d16", borderRadius: "8px", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                                        <div style={{ fontSize: "0.8rem", color: "#38bdf8", fontWeight: "600", marginBottom: "8px" }}>
                                            🕸️ Agent Execution Graph & Routing:
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                            <span style={{ padding: "4px 10px", background: "rgba(255,255,255,0.08)", borderRadius: "6px", fontSize: "0.75rem" }}>
                                                👤 User Input
                                            </span>
                                            <span>➡️</span>
                                            <span style={{ padding: "4px 10px", background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "600" }}>
                                                🧭 Orchestrator ({orchestratorResult.executionMode || "SINGLE"})
                                            </span>
                                            <span>➡️</span>
                                            {orchestratorResult.participatingAgents?.map((ag, idx) => (
                                                <span key={idx} style={{ padding: "4px 10px", background: "rgba(16, 185, 129, 0.2)", color: "#34d399", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "600" }}>
                                                    🤖 {ag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <pre className="playground-result">
                                        {JSON.stringify(orchestratorResult, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
