import React, { useState, useEffect } from "react";
import {
    X,
    Play,
    Pause,
    RotateCcw,
    XCircle,
    Activity,
    Cpu,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Loader2,
    RefreshCw
} from "lucide-react";
import {
    getChunkingQueueStatus,
    pauseChunkingQueue,
    resumeChunkingQueue,
    retryFailedChunkingQueue,
    cancelChunkingDocument,
    resumeChunkingDocument,
    retryChunkingDocument
} from "../../../services/adminService";

export default function QueueMonitorDrawer({
    isOpen,
    onClose,
    onRefreshParent
}) {
    const [queueData, setQueueData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [actionInProgress, setActionInProgress] = useState(false);

    const fetchQueue = async () => {
        try {
            setLoading(true);
            const res = await getChunkingQueueStatus();
            setQueueData(res.data);
        } catch (err) {
            console.error("[QueueMonitor] Error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        fetchQueue();
        const interval = setInterval(fetchQueue, 2000);
        return () => clearInterval(interval);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleTogglePause = async () => {
        try {
            setActionInProgress(true);
            if (queueData?.isPaused) {
                await resumeChunkingQueue();
            } else {
                await pauseChunkingQueue();
            }
            await fetchQueue();
            onRefreshParent?.();
        } catch (err) {
            console.error("[QueueMonitor] Toggle pause error:", err);
        } finally {
            setActionInProgress(false);
        }
    };

    const handleRetryAllFailed = async () => {
        try {
            setActionInProgress(true);
            await retryFailedChunkingQueue();
            await fetchQueue();
            onRefreshParent?.();
        } catch (err) {
            console.error("[QueueMonitor] Retry failed error:", err);
        } finally {
            setActionInProgress(false);
        }
    };

    const handleCancelItem = async (docId) => {
        try {
            setActionInProgress(true);
            await cancelChunkingDocument(docId);
            await fetchQueue();
            onRefreshParent?.();
        } catch (err) {
            console.error("[QueueMonitor] Cancel item error:", err);
        } finally {
            setActionInProgress(false);
        }
    };

    const handleRetryItem = async (docId) => {
        try {
            setActionInProgress(true);
            await retryChunkingDocument(docId);
            await fetchQueue();
            onRefreshParent?.();
        } catch (err) {
            console.error("[QueueMonitor] Retry item error:", err);
        } finally {
            setActionInProgress(false);
        }
    };

    const isPaused = queueData?.isPaused || false;
    const stats = queueData?.stats || { queued: 0, processing: 0, completed: 0, failed: 0 };
    const activeJobs = queueData?.activeJobs || [];
    const queue = queueData?.queue || [];

    return (
        <div className="chunk-preview-backdrop" onClick={onClose}>
            <div className="queue-monitor-drawer" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="queue-header">
                    <div className="queue-header-left">
                        <div className="queue-header-title-row">
                            <Activity size={20} className="queue-icon-pulse" />
                            <h3>Background Chunking Queue</h3>
                            <span className={`queue-status-badge ${isPaused ? "badge-paused" : "badge-running"}`}>
                                {isPaused ? "Queue Paused" : "Active Worker Pool"}
                            </span>
                        </div>
                        <p className="queue-header-sub">
                            Asynchronous worker pool (concurrency: {queueData?.concurrency || 2})
                        </p>
                    </div>

                    <div className="queue-header-actions">
                        <button
                            type="button"
                            className={`queue-btn ${isPaused ? "queue-btn-resume" : "queue-btn-pause"}`}
                            onClick={handleTogglePause}
                            disabled={actionInProgress}
                        >
                            {isPaused ? <Play size={14} /> : <Pause size={14} />}
                            <span>{isPaused ? "Resume Queue" : "Pause Queue"}</span>
                        </button>

                        <button
                            type="button"
                            className="queue-btn queue-btn-retry"
                            onClick={handleRetryAllFailed}
                            disabled={actionInProgress || stats.failed === 0}
                        >
                            <RotateCcw size={14} />
                            <span>Retry Failed ({stats.failed})</span>
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

                {/* Queue Stats Bar */}
                <div className="queue-stats-grid">
                    <div className="queue-stat-card">
                        <div className="stat-card-icon queued-color">
                            <Clock size={16} />
                        </div>
                        <div className="stat-card-info">
                            <span className="stat-card-num">{stats.queued}</span>
                            <span className="stat-card-lbl">In Queue</span>
                        </div>
                    </div>
                    <div className="queue-stat-card">
                        <div className="stat-card-icon processing-color">
                            <Cpu size={16} />
                        </div>
                        <div className="stat-card-info">
                            <span className="stat-card-num">{stats.processing}</span>
                            <span className="stat-card-lbl">Processing Now</span>
                        </div>
                    </div>
                    <div className="queue-stat-card">
                        <div className="stat-card-icon completed-color">
                            <CheckCircle2 size={16} />
                        </div>
                        <div className="stat-card-info">
                            <span className="stat-card-num">{stats.completed}</span>
                            <span className="stat-card-lbl">Completed</span>
                        </div>
                    </div>
                    <div className="queue-stat-card">
                        <div className="stat-card-icon failed-color">
                            <AlertTriangle size={16} />
                        </div>
                        <div className="stat-card-info">
                            <span className="stat-card-num">{stats.failed}</span>
                            <span className="stat-card-lbl">Failed</span>
                        </div>
                    </div>
                </div>

                {/* Body: Active Jobs + Waiting Queue */}
                <div className="queue-body">
                    {/* Active Workers Section */}
                    <div className="queue-section">
                        <div className="queue-section-header">
                            <Cpu size={16} />
                            <span>Active Processing Workers ({activeJobs.length}/{queueData?.concurrency || 2})</span>
                        </div>

                        {activeJobs.length === 0 ? (
                            <div className="queue-empty-box">No documents currently being processed by workers.</div>
                        ) : (
                            <div className="active-workers-list">
                                {activeJobs.map((job) => (
                                    <div key={job.documentId} className="active-worker-card">
                                        <div className="worker-top-row">
                                            <div className="worker-title-group">
                                                <Loader2 size={15} className="spin-icon" style={{ color: "#3b82f6" }} />
                                                <span className="worker-doc-name">{job.title || "Document"}</span>
                                            </div>
                                            <div className="worker-stage-pill">{job.stage || "Processing"}</div>
                                        </div>

                                        <div className="worker-progress-bar-wrap">
                                            <div className="worker-progress-bar" style={{ width: `${job.progress || 10}%` }}></div>
                                        </div>

                                        <div className="worker-bottom-row">
                                            <span className="worker-progress-pct">{job.progress || 0}% Complete</span>
                                            <button
                                                type="button"
                                                className="worker-cancel-btn"
                                                onClick={() => handleCancelItem(job.documentId)}
                                                disabled={actionInProgress}
                                            >
                                                <XCircle size={12} />
                                                <span>Cancel</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Queued Waiting List */}
                    <div className="queue-section">
                        <div className="queue-section-header">
                            <Clock size={16} />
                            <span>Waiting Queue ({queue.length})</span>
                        </div>

                        {queue.length === 0 ? (
                            <div className="queue-empty-box">Queue is empty. Select files and click "Chunk Selected" to enqueue.</div>
                        ) : (
                            <div className="queued-items-list">
                                {queue.map((item, idx) => (
                                    <div key={item.documentId || idx} className="queued-item-row">
                                        <div className="queued-item-left">
                                            <span className="queue-pos-badge">#{item.queuePosition || idx + 1}</span>
                                            <span className="queued-item-title">{item.title || item.originalName || "Document"}</span>
                                            <span className="queued-item-cat">{item.category || "General"}</span>
                                        </div>
                                        <div className="queued-item-actions">
                                            <button
                                                type="button"
                                                className="queued-cancel-btn"
                                                onClick={() => handleCancelItem(item.documentId)}
                                                disabled={actionInProgress}
                                                title="Remove from queue"
                                            >
                                                <X size={13} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
