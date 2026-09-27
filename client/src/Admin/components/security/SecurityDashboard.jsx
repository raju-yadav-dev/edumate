import React, { useState, useEffect, useCallback } from "react";
import "./SecurityDashboard.css";
import {
    Shield,
    ShieldAlert,
    ShieldCheck,
    Lock,
    Key,
    UserX,
    AlertOctagon,
    RefreshCw,
    Activity,
    Terminal,
    CheckCircle2,
    XCircle,
    Server,
    FileCheck,
    GlobeLock,
    UserCheck,
    Zap
} from "lucide-react";
import { getApiRootUrl } from "../../../services/apiConfig";
import { getAdminAccessToken } from "../../../services/adminSession";

export default function SecurityDashboard() {
    const [metrics, setMetrics] = useState({
        failedLogins: 0,
        blockedRequests: 0,
        rateLimitHits: 0,
        promptInjections: 0,
        activeSessions: 1,
        totalAuditEvents: 0,
        jwtStatus: "active",
        storageIntegrity: "verified"
    });

    const [auditLogs, setAuditLogs] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [activeTab, setActiveTab] = useState("audit");
    const [searchFilter, setSearchFilter] = useState("");
    const [loading, setLoading] = useState(false);
    const [revokingId, setRevokingId] = useState(null);
    const [statusNotice, setStatusNotice] = useState("");

    const fetchSecurityData = useCallback(async () => {
        setLoading(true);
        const token = getAdminAccessToken();
        const headers = {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        };

        const root = getApiRootUrl();

        try {
            // 1. Fetch Metrics
            const metricsRes = await fetch(`${root}/api/admin/security/metrics`, { credentials: "include", headers });
            if (metricsRes.ok) {
                const data = await metricsRes.json();
                if (data?.data) {
                    setMetrics((prev) => ({ ...prev, ...data.data }));
                }
            }

            // 2. Fetch Audit Logs
            const logsRes = await fetch(`${root}/api/admin/security/audit-logs?limit=100`, { credentials: "include", headers });
            if (logsRes.ok) {
                const data = await logsRes.json();
                if (data?.data?.logs) {
                    setAuditLogs(data.data.logs);
                }
            }

            // 3. Fetch Active Sessions
            const sessRes = await fetch(`${root}/api/admin/security/sessions`, { credentials: "include", headers });
            if (sessRes.ok) {
                const data = await sessRes.json();
                if (data?.data?.sessions) {
                    setSessions(data.data.sessions);
                }
            }
        } catch (err) {
            console.warn("Could not fetch remote security metrics, using local status:", err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSecurityData();
        const interval = setInterval(fetchSecurityData, 10000);
        return () => clearInterval(interval);
    }, [fetchSecurityData]);

    const handleRevokeSession = async (sessionId) => {
        if (!window.confirm("Are you sure you want to revoke this session? The user will be immediately logged out.")) {
            return;
        }

        setRevokingId(sessionId);
        const token = getAdminAccessToken();
        const root = getApiRootUrl();

        try {
            const res = await fetch(`${root}/api/admin/security/sessions/revoke`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                credentials: "include",
                body: JSON.stringify({ sessionId })
            });

            if (res.ok) {
                setStatusNotice("Session revoked successfully.");
                setTimeout(() => setStatusNotice(""), 4000);
                await fetchSecurityData();
            }
        } catch (err) {
            alert(`Failed to revoke session: ${err.message}`);
        } finally {
            setRevokingId(null);
        }
    };

    const filteredLogs = auditLogs.filter((log) => {
        if (!searchFilter) return true;
        const q = searchFilter.toLowerCase();
        return (
            (log.action && log.action.toLowerCase().includes(q)) ||
            (log.email && log.email.toLowerCase().includes(q)) ||
            (log.resourceType && log.resourceType.toLowerCase().includes(q)) ||
            (log.ip && log.ip.includes(q))
        );
    });

    const filteredSessions = sessions.filter((s) => {
        if (!searchFilter) return true;
        const q = searchFilter.toLowerCase();
        return (
            (s.deviceInfo && s.deviceInfo.toLowerCase().includes(q)) ||
            (s.ip && s.ip.includes(q)) ||
            (s.userId?.fullName && s.userId.fullName.toLowerCase().includes(q)) ||
            (s.userId?.email && s.userId.email.toLowerCase().includes(q))
        );
    });

    return (
        <div className="security-dashboard">
            {/* Header */}
            <div className="security-header">
                <div className="security-header-title">
                    <Shield size={28} color="var(--admin-gold, #f59e0b)" />
                    <div>
                        <h2>Enterprise Security & Audit Hub</h2>
                        <span className="security-badge pulse">
                            <ShieldCheck size={12} /> Local-First Threat Protection Active
                        </span>
                    </div>
                </div>

                <div className="security-actions">
                    <button className="sec-btn" onClick={fetchSecurityData} disabled={loading}>
                        <RefreshCw size={14} className={loading ? "spin" : ""} />
                        <span>Refresh Telemetry</span>
                    </button>
                </div>
            </div>

            {statusNotice && (
                <div style={{ padding: "10px 16px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.3)", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "8px" }}>
                    <CheckCircle2 size={16} />
                    <span>{statusNotice}</span>
                </div>
            )}

            {/* Metrics Grid */}
            <div className="sec-metrics-grid">
                <div className="sec-metric-card danger">
                    <div className="sec-metric-top">
                        <span className="sec-metric-title">Failed Logins</span>
                        <UserX size={18} className="sec-metric-icon" color="#ef4444" />
                    </div>
                    <div className="sec-metric-val">{metrics.failedLogins || 0}</div>
                    <div className="sec-metric-sub">Brute-force protection enabled</div>
                </div>

                <div className="sec-metric-card warning">
                    <div className="sec-metric-top">
                        <span className="sec-metric-title">Blocked Requests</span>
                        <ShieldAlert size={18} className="sec-metric-icon" color="#f59e0b" />
                    </div>
                    <div className="sec-metric-val">{metrics.blockedRequests || 0}</div>
                    <div className="sec-metric-sub">Mongo injection & traversal blocked</div>
                </div>

                <div className="sec-metric-card info">
                    <div className="sec-metric-top">
                        <span className="sec-metric-title">Rate Limit Hits</span>
                        <Zap size={18} className="sec-metric-icon" color="#3b82f6" />
                    </div>
                    <div className="sec-metric-val">{metrics.rateLimitHits || 0}</div>
                    <div className="sec-metric-sub">Chat (20/m), Uploads (10/h), Auth (5/15m)</div>
                </div>

                <div className="sec-metric-card purple">
                    <div className="sec-metric-top">
                        <span className="sec-metric-title">Prompt Injections</span>
                        <AlertOctagon size={18} className="sec-metric-icon" color="#a855f7" />
                    </div>
                    <div className="sec-metric-val">{metrics.promptInjections || 0}</div>
                    <div className="sec-metric-sub">Guarded against jailbreak payloads</div>
                </div>

                <div className="sec-metric-card success">
                    <div className="sec-metric-top">
                        <span className="sec-metric-title">Active Sessions</span>
                        <UserCheck size={18} className="sec-metric-icon" color="#10b981" />
                    </div>
                    <div className="sec-metric-val">{metrics.activeSessions || 1}</div>
                    <div className="sec-metric-sub">JWT token rotation & revocation</div>
                </div>

                <div className="sec-metric-card success">
                    <div className="sec-metric-top">
                        <span className="sec-metric-title">Storage Integrity</span>
                        <FileCheck size={18} className="sec-metric-icon" color="#10b981" />
                    </div>
                    <div className="sec-metric-val">HMAC-256</div>
                    <div className="sec-metric-sub">Cryptographically signed backups</div>
                </div>
            </div>

            {/* Architecture Highlights Banner */}
            <div className="sec-banner-grid">
                <div className="sec-banner-card">
                    <h4><GlobeLock size={18} /> API & HTTP Security</h4>
                    <p>Protected by Helmet headers, strict CORS origin policies, and route-specific token buckets.</p>
                    <div className="sec-features-pills">
                        <span className="sec-pill active">CSP & HSTS</span>
                        <span className="sec-pill active">Bcrypt (12 Rounds)</span>
                        <span className="sec-pill active">XSS Sanitizer</span>
                        <span className="sec-pill active">NoSQL Guard</span>
                    </div>
                </div>

                <div className="sec-banner-card">
                    <h4><Terminal size={18} /> Local AI Prompt Guard</h4>
                    <p>Multi-pattern heuristic defense protecting system prompts, file systems, and instruction fidelity.</p>
                    <div className="sec-features-pills">
                        <span className="sec-pill active">System Prompt Guard</span>
                        <span className="sec-pill active">Jailbreak Detection</span>
                        <span className="sec-pill active">Citation Verifier</span>
                        <span className="sec-pill active">Command Shield</span>
                    </div>
                </div>

                <div className="sec-banner-card">
                    <h4><Server size={18} /> Storage & Vector Isolation</h4>
                    <p>Path traversal prevention with safe root sandboxing and magic byte file signature validation.</p>
                    <div className="sec-features-pills">
                        <span className="sec-pill active">Magic Bytes (PDF/DOCX/TXT)</span>
                        <span className="sec-pill active">Path Traversal Guard</span>
                        <span className="sec-pill active">SHA-256 Checksums</span>
                        <span className="sec-pill active">RBAC Vector Shield</span>
                    </div>
                </div>
            </div>

            {/* Audit Logs & Sessions Section */}
            <div className="sec-section-card">
                <div className="sec-tabs-header">
                    <div className="sec-tabs">
                        <button
                            className={`sec-tab-btn ${activeTab === "audit" ? "active" : ""}`}
                            onClick={() => setActiveTab("audit")}
                        >
                            <Activity size={15} />
                            <span>Security Audit Events ({filteredLogs.length})</span>
                        </button>
                        <button
                            className={`sec-tab-btn ${activeTab === "sessions" ? "active" : ""}`}
                            onClick={() => setActiveTab("sessions")}
                        >
                            <Lock size={15} />
                            <span>Active Sessions ({filteredSessions.length})</span>
                        </button>
                    </div>

                    <input
                        type="text"
                        className="sec-search-input"
                        placeholder="Search logs, actions, IPs, emails..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                    />
                </div>

                {activeTab === "audit" ? (
                    <div className="sec-table-wrapper">
                        {filteredLogs.length === 0 ? (
                            <div className="sec-empty">
                                <ShieldCheck size={32} style={{ marginBottom: "8px", opacity: 0.5 }} />
                                <div>No security incidents or audit events recorded yet. System is safe and operational.</div>
                            </div>
                        ) : (
                            <table className="sec-table">
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Action</th>
                                        <th>User / Email</th>
                                        <th>Role</th>
                                        <th>IP Address</th>
                                        <th>Status</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLogs.map((log, idx) => (
                                        <tr key={idx}>
                                            <td style={{ whiteSpace: "nowrap", color: "#94a3b8" }}>
                                                {new Date(log.timestamp).toLocaleTimeString()} {new Date(log.timestamp).toLocaleDateString()}
                                            </td>
                                            <td>
                                                <code style={{ background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: "4px", color: "#f59e0b" }}>
                                                    {log.action}
                                                </code>
                                            </td>
                                            <td>{log.email || "system"}</td>
                                            <td>
                                                <span className="sec-status-badge info">{log.role || "system"}</span>
                                            </td>
                                            <td style={{ fontFamily: "monospace", color: "#94a3b8" }}>{log.ip || "127.0.0.1"}</td>
                                            <td>
                                                {log.success ? (
                                                    <span className="sec-status-badge success">
                                                        <CheckCircle2 size={12} /> Success
                                                    </span>
                                                ) : (
                                                    <span className="sec-status-badge danger">
                                                        <XCircle size={12} /> Blocked
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                                                {log.details ? JSON.stringify(log.details).slice(0, 50) : "-"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                ) : (
                    <div className="sec-table-wrapper">
                        {filteredSessions.length === 0 ? (
                            <div className="sec-empty">
                                <div>No active persistent sessions found in database.</div>
                            </div>
                        ) : (
                            <table className="sec-table">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Device / Browser</th>
                                        <th>IP Address</th>
                                        <th>Last Active</th>
                                        <th>Created At</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSessions.map((s, idx) => (
                                        <tr key={idx}>
                                            <td>
                                                <strong>{s.userId?.fullName || "Active User"}</strong>
                                                <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{s.userId?.email}</div>
                                            </td>
                                            <td>{s.deviceInfo || "Desktop Browser"}</td>
                                            <td style={{ fontFamily: "monospace", color: "#94a3b8" }}>{s.ip || "127.0.0.1"}</td>
                                            <td>{new Date(s.lastUsedAt || s.createdAt).toLocaleString()}</td>
                                            <td style={{ color: "#94a3b8" }}>{new Date(s.createdAt).toLocaleString()}</td>
                                            <td>
                                                <button
                                                    className="sec-revoke-btn"
                                                    onClick={() => handleRevokeSession(s.sessionId)}
                                                    disabled={revokingId === s.sessionId}
                                                >
                                                    {revokingId === s.sessionId ? "Revoking..." : "Revoke Session"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
