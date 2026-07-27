import React, { useState } from "react";
import {
    Upload,
    Key,
    Trash2,
    LogIn,
    AlertTriangle,
    Settings,
    Download,
    RefreshCw,
    ShieldCheck,
    Lock,
    MoreHorizontal,
    ChevronLeft,
    ChevronRight,
    X,
    CheckCircle2
} from "lucide-react";

export default function ActivityLogsTable({ logs = [] }) {
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedLog, setSelectedLog] = useState(null);
    const pageSize = 10;

    const getActionIcon = (action) => {
        const a = (action || "").toLowerCase();
        if (a.includes("uploaded")) return <Upload size={14} className="icon-emerald" />;
        if (a.includes("api key")) return <Key size={14} className="icon-amber" />;
        if (a.includes("deleted")) return <Trash2 size={14} className="icon-red" />;
        if (a.includes("login") && !a.includes("failed")) return <LogIn size={14} className="icon-cyan" />;
        if (a.includes("failed") || a.includes("error")) return <AlertTriangle size={14} className="icon-red" />;
        if (a.includes("settings")) return <Settings size={14} className="icon-purple" />;
        if (a.includes("export")) return <Download size={14} className="icon-blue" />;
        if (a.includes("re-index")) return <RefreshCw size={14} className="icon-emerald" />;
        if (a.includes("backup")) return <ShieldCheck size={14} className="icon-emerald" />;
        if (a.includes("lock") || a.includes("attempt")) return <Lock size={14} className="icon-red" />;
        return <Upload size={14} className="icon-gray" />;
    };

    const getUserAvatarBg = (userName) => {
        const u = (userName || "").toLowerCase();
        if (u.includes("raju")) return { bg: "#10b981", text: "#ffffff", init: "R" };
        if (u.includes("priya")) return { bg: "#a855f7", text: "#ffffff", init: "PP" };
        if (u.includes("rahul")) return { bg: "#3b82f6", text: "#ffffff", init: "RK" };
        if (u.includes("sneha")) return { bg: "#ef4444", text: "#ffffff", init: "SN" };
        if (u.includes("anthropic") || u.includes("ai")) return { bg: "#f59e0b", text: "#0b0f17", init: "AI" };
        if (u.includes("vikram")) return { bg: "#06b6d4", text: "#ffffff", init: "VS" };
        if (u.includes("meera")) return { bg: "#eab308", text: "#0b0f17", init: "MJ" };
        if (u.includes("system")) return { bg: "#6b7280", text: "#ffffff", init: "S" };
        return { bg: "#4b5563", text: "#ffffff", init: "U" };
    };

    const totalLogs = logs.length;
    const totalPages = Math.ceil(totalLogs / pageSize) || 1;
    const startIndex = (currentPage - 1) * pageSize;
    const currentLogs = logs.slice(startIndex, startIndex + pageSize);

    return (
        <div className="activity-table-card">
            <div className="table-responsive">
                <table className="activity-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>User</th>
                            <th>Action</th>
                            <th>Service</th>
                            <th>Resource</th>
                            <th>Details</th>
                            <th>IP Address</th>
                            <th>Status</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentLogs.map((log, index) => {
                            const avatar = getUserAvatarBg(log.user);
                            const isSuccess = (log.status || "").toLowerCase() === "success" || (log.status || "").toLowerCase() === "completed";
                            return (
                                <tr key={log.id || index} className="activity-row" onClick={() => setSelectedLog(log)}>
                                    <td className="time-cell">{log.time}</td>
                                    <td>
                                        <div className="user-cell-content">
                                            <div
                                                className="user-avatar-badge"
                                                style={{ backgroundColor: avatar.bg, color: avatar.text }}
                                            >
                                                {avatar.init}
                                            </div>
                                            <strong className="user-name-text">{log.user}</strong>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="action-cell-content">
                                            {getActionIcon(log.action)}
                                            <span>{log.action}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="service-tag-pill">{log.service}</span>
                                    </td>
                                    <td className="resource-text">{log.resource}</td>
                                    <td className="details-text" title={log.details}>{log.details}</td>
                                    <td className="ip-text">{log.ipAddress}</td>
                                    <td>
                                        <span className={`status-pill ${isSuccess ? "success" : "failed"}`}>
                                            {isSuccess ? "Success" : "Failed"}
                                        </span>
                                    </td>
                                    <td className="text-right">
                                        <button
                                            type="button"
                                            className="row-more-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedLog(log);
                                            }}
                                        >
                                            <MoreHorizontal size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Table Footer with Pagination */}
            <div className="activity-table-footer">
                <div className="footer-showing-text">
                    Showing {totalLogs > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + pageSize, totalLogs)} of {totalLogs.toLocaleString()} logs
                </div>

                <div className="pagination-wrapper">
                    <button
                        type="button"
                        className="pagination-nav-btn"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    >
                        <ChevronLeft size={15} />
                    </button>

                    <button
                        type="button"
                        className={`pagination-page-btn ${currentPage === 1 ? "active" : ""}`}
                        onClick={() => setCurrentPage(1)}
                    >
                        1
                    </button>
                    {totalPages >= 2 && (
                        <button
                            type="button"
                            className={`pagination-page-btn ${currentPage === 2 ? "active" : ""}`}
                            onClick={() => setCurrentPage(2)}
                        >
                            2
                        </button>
                    )}
                    {totalPages >= 3 && (
                        <button
                            type="button"
                            className={`pagination-page-btn ${currentPage === 3 ? "active" : ""}`}
                            onClick={() => setCurrentPage(3)}
                        >
                            3
                        </button>
                    )}

                    {totalPages > 4 && <span className="pagination-dots">...</span>}

                    {totalPages > 3 && (
                        <button
                            type="button"
                            className={`pagination-page-btn ${currentPage === totalPages ? "active" : ""}`}
                            onClick={() => setCurrentPage(totalPages)}
                        >
                            {totalPages}
                        </button>
                    )}

                    <button
                        type="button"
                        className="pagination-nav-btn"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    >
                        <ChevronRight size={15} />
                    </button>
                </div>
            </div>

            {/* Log Event Detail Inspector Modal */}
            {selectedLog && (
                <div className="op-modal-backdrop" onClick={() => setSelectedLog(null)}>
                    <div className="op-modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="op-modal-header">
                            <div className="modal-title-with-icon">
                                {(selectedLog.status || "").toLowerCase() === "success" ? (
                                    <CheckCircle2 size={18} className="green-icon" />
                                ) : (
                                    <AlertTriangle size={18} className="red-icon" />
                                )}
                                <h3>Event Inspector: {selectedLog.action}</h3>
                            </div>
                            <button className="op-modal-close" onClick={() => setSelectedLog(null)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="op-modal-body">
                            <div className="op-summary-chips">
                                <div><span>User:</span> <strong>{selectedLog.user}</strong></div>
                                <div><span>Service:</span> <strong>{selectedLog.service}</strong></div>
                                <div><span>IP Address:</span> <strong>{selectedLog.ipAddress}</strong></div>
                            </div>

                            <div className="op-log-terminal">
                                <div className="terminal-bar">Raw Event Payload Metadata</div>
                                <div className="terminal-content">
                                    <div className="terminal-line"><span className="term-prompt">&gt;</span> Timestamp: {selectedLog.time}</div>
                                    <div className="terminal-line"><span className="term-prompt">&gt;</span> Resource: {selectedLog.resource}</div>
                                    <div className="terminal-line"><span className="term-prompt">&gt;</span> Details: {selectedLog.details}</div>
                                    <div className="terminal-line"><span className="term-prompt">&gt;</span> Status Code: {(selectedLog.status || "").toLowerCase() === "success" ? "200 OK" : "429 RATE_LIMIT_EXCEEDED"}</div>
                                    <div className="terminal-line"><span className="term-prompt">&gt;</span> Client User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)</div>
                                </div>
                            </div>
                        </div>

                        <div className="op-modal-footer">
                            <button className="btn-secondary" onClick={() => setSelectedLog(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
