import React, { useState, useEffect } from "react";
import {
    X,
    ShieldCheck,
    AlertTriangle,
    CheckCircle2,
    Wrench,
    RefreshCw,
    Loader2,
    FileText,
    Database,
    Layers,
    ArrowRight
} from "lucide-react";
import {
    getIntegrityReport,
    repairAdminDocument,
    repairAllAdminDocuments
} from "../../../services/adminService";

export default function IntegrityAuditModal({
    isOpen,
    onClose,
    onRefreshParent
}) {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [repairing, setRepairing] = useState(false);
    const [repairSuccessMsg, setRepairSuccessMsg] = useState("");

    const runAudit = async () => {
        try {
            setLoading(true);
            setRepairSuccessMsg("");
            const res = await getIntegrityReport();
            setReport(res.data);
        } catch (err) {
            console.error("[IntegrityAudit] Error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        runAudit();
    }, [isOpen]);

    if (!isOpen) return null;

    const handleRepairAll = async () => {
        try {
            setRepairing(true);
            setRepairSuccessMsg("");
            const res = await repairAllAdminDocuments();
            setRepairSuccessMsg(`Auto-repair complete: ${res.data?.repairedCount || 0} document(s) fixed.`);
            await runAudit();
            onRefreshParent?.();
        } catch (err) {
            console.error("[IntegrityAudit] Repair all error:", err);
        } finally {
            setRepairing(false);
        }
    };

    const handleRepairSingle = async (docId) => {
        try {
            setRepairing(true);
            const res = await repairAdminDocument(docId);
            setRepairSuccessMsg(`Document ${docId} successfully repaired.`);
            await runAudit();
            onRefreshParent?.();
        } catch (err) {
            console.error("[IntegrityAudit] Repair single error:", err);
        } finally {
            setRepairing(false);
        }
    };

    const isHealthy = report?.isHealthy || false;
    const stats = report?.stats || { totalDocuments: 0, healthyDocuments: 0, issuesFound: 0 };
    const issues = report?.issues || [];

    return (
        <div className="chunk-preview-backdrop" onClick={onClose}>
            <div className="integrity-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="integrity-modal-header">
                    <div className="integrity-header-title-row">
                        <ShieldCheck size={22} className="integrity-icon-shield" />
                        <div>
                            <h3>Knowledge Base Integrity & Auto-Repair</h3>
                            <p className="integrity-header-sub">
                                Cross-validates MongoDB chunk registries, Qdrant vectors, and Local storage
                            </p>
                        </div>
                    </div>

                    <div className="integrity-header-actions">
                        <button
                            type="button"
                            className="studio-btn studio-btn-secondary studio-btn-icon"
                            onClick={runAudit}
                            disabled={loading || repairing}
                            title="Run Integrity Scan"
                        >
                            <RefreshCw size={14} className={loading ? "spin-icon" : ""} />
                        </button>
                        <button
                            type="button"
                            className="preview-close-btn"
                            onClick={onClose}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="integrity-modal-body">
                    {/* Status Banner */}
                    {loading ? (
                        <div className="integrity-loading-card">
                            <Loader2 size={32} className="spin-icon" />
                            <p>Scanning all documents, vector points, and storage links...</p>
                        </div>
                    ) : (
                        <>
                            <div className={`integrity-status-banner ${isHealthy ? "banner-healthy" : "banner-warning"}`}>
                                <div className="banner-left">
                                    {isHealthy ? (
                                        <CheckCircle2 size={24} style={{ color: "#10b981" }} />
                                    ) : (
                                        <AlertTriangle size={24} style={{ color: "#f59e0b" }} />
                                    )}
                                    <div>
                                        <h4>{isHealthy ? "Knowledge Base is 100% Healthy" : `${stats.issuesFound} Integrity Issues Detected`}</h4>
                                        <p>
                                            {isHealthy
                                                ? "All indexed documents match vector collections and storage records perfectly."
                                                : "Some documents have missing embeddings, corrupted metadata, or orphaned points."}
                                        </p>
                                    </div>
                                </div>

                                {!isHealthy && (
                                    <button
                                        type="button"
                                        className="integrity-repair-all-btn"
                                        onClick={handleRepairAll}
                                        disabled={repairing}
                                    >
                                        <Wrench size={14} className={repairing ? "spin-icon" : ""} />
                                        <span>{repairing ? "Repairing Knowledge Base..." : "1-Click Auto Repair All"}</span>
                                    </button>
                                )}
                            </div>

                            {repairSuccessMsg && (
                                <div className="integrity-success-toast">
                                    <CheckCircle2 size={15} />
                                    <span>{repairSuccessMsg}</span>
                                </div>
                            )}

                            {/* Stats Counter */}
                            <div className="integrity-stats-row">
                                <div className="int-stat-box">
                                    <span className="int-stat-num">{stats.totalDocuments}</span>
                                    <span className="int-stat-lbl">Audited Documents</span>
                                </div>
                                <div className="int-stat-box">
                                    <span className="int-stat-num" style={{ color: "#10b981" }}>{stats.healthyDocuments}</span>
                                    <span className="int-stat-lbl">Healthy</span>
                                </div>
                                <div className="int-stat-box">
                                    <span className="int-stat-num" style={{ color: stats.issuesFound > 0 ? "#ef4444" : "#10b981" }}>{stats.issuesFound}</span>
                                    <span className="int-stat-lbl">Issues Found</span>
                                </div>
                            </div>

                            {/* Issues Table */}
                            {issues.length > 0 && (
                                <div className="integrity-issues-table-wrap">
                                    <div className="integrity-issues-title">Detected Anomalies</div>
                                    <div className="integrity-table">
                                        <div className="int-thead">
                                            <div>Document Name</div>
                                            <div>Category</div>
                                            <div>Issue Description</div>
                                            <div>Action</div>
                                        </div>
                                        <div className="int-tbody">
                                            {issues.map((item) => (
                                                <div key={item.documentId} className="int-trow">
                                                    <div className="int-doc-col" title={item.title}>
                                                        <FileText size={14} />
                                                        <span>{item.title || item.documentId}</span>
                                                    </div>
                                                    <div className="int-cat-col">{item.category || "General"}</div>
                                                    <div className="int-issue-col">
                                                        <span className="issue-tag">{item.issueType || "MISMATCH"}</span>
                                                        <span className="issue-msg">{item.message}</span>
                                                    </div>
                                                    <div className="int-action-col">
                                                        <button
                                                            type="button"
                                                            className="int-repair-btn"
                                                            onClick={() => handleRepairSingle(item.documentId)}
                                                            disabled={repairing}
                                                        >
                                                            <Wrench size={12} />
                                                            <span>Repair</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
