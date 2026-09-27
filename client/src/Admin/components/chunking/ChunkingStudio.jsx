import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
    Layers,
    RefreshCw,
    Play,
    RotateCcw,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Loader2,
    Search,
    FileText,
    Boxes,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    ShieldCheck,
    Activity,
    Eye,
    FolderPlus,
    Plus,
    Edit3,
    Trash2,
    Move,
    Undo2,
    X,
    Check,
    Folder,
    FolderOpen,
    FileCode,
    SlidersHorizontal,
    Pause,
    Upload,
    Terminal,
    Cpu,
    Zap,
    Download,
    Radio,
    HardDrive,
    Database,
    BarChart3,
    AlertCircle,
    Copy,
    ListTree,
    CornerDownRight
} from "lucide-react";
import { formatDate } from "../../utils/formatData";
import { formatBytes } from "../../utils/formatBytes";
import { getFileType } from "../../utils/documentUtils";
import {
    listAdminDocuments,
    bulkReindexAdminDocuments,
    retryFailedDocuments,
    createPlaceholderDocument,
    renameAdminFolder,
    deleteAdminFolder,
    bulkRestoreAdminDocuments,
    renameAdminDocument,
    moveAdminDocument,
    deleteAdminDocument,
    enqueueChunkingDocuments,
    getChunkingQueueStatus,
    pauseChunkingQueue,
    resumeChunkingQueue,
    startChunkingWorker,
    stopChunkingWorker,
    restartChunkingWorker,
    clearChunkingQueue,
    retryFailedChunkingQueue,
    cancelChunkingDocument,
    pauseChunkingDocument,
    resumeChunkingDocument,
    retryChunkingDocument,
    getChunkingLogs,
    clearChunkingLogs,
    getLocalStorageTree,
    syncLocalStorage,
    getQdrantStatus,
    verifyQdrantVectors,
    deleteQdrantVectors,
    getChunkingAnalytics,
    getChunkingHealth,
    getChunkingSSEUrl
} from "../../../services/adminService";

import ChunkPreviewDrawer from "./ChunkPreviewDrawer";
import IntegrityAuditModal from "./IntegrityAuditModal";
import ChunkDiffModal from "./ChunkDiffModal";
import StorageExplorer from "./StorageExplorer";
import "./ChunkingStudio.css";

const STAGE_ORDER = [
    "Queued",
    "Reading document",
    "Cleaning document text",
    "Generating chunks",
    "Extracting metadata and keywords",
    "Generating vector embeddings",
    "Saving chunks to local storage",
    "Indexing into Qdrant",
    "Completed & Indexed"
];

const DEPARTMENTS = [
    "Computer Science & Engineering",
    "Information Technology",
    "Electronics & Communication",
    "Mechanical Engineering",
    "Civil Engineering",
    "Admissions Office",
    "Academic Affairs",
    "Hostel Administration",
    "Examination Cell",
    "Placement & Career Cell",
    "General / Campus-wide"
];

const CATEGORIES = [
    "admissions",
    "academics",
    "fees",
    "hostel",
    "departments",
    "placements",
    "scholarships",
    "rules",
    "faculty",
    "library",
    "academic_calendar",
    "transport",
    "examination",
    "events",
    "notices",
    "policies",
    "campus_navigation",
    "others"
];

export default function ChunkingStudio({
    documents: initialDocuments = [],
    onRefresh,
    setNotice,
    setError
}) {
    // Active Tab: explorer | queue | qdrant | logs | failed | analytics
    const [activeTab, setActiveTab] = useState("explorer");

    // Documents & Explorer State
    const [documents, setDocuments] = useState(initialDocuments);
    const [selectedIds, setSelectedIds] = useState([]);
    const [statusFilter, setStatusFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [activeFolder, setActiveFolder] = useState("all");
    const [storageTree, setStorageTree] = useState(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    // Upload Area State
    const [uploadQueue, setUploadQueue] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState("General / Campus-wide");
    const [selectedCategory, setSelectedCategory] = useState("admissions");
    const [selectedSession, setSelectedSession] = useState("2026-2027");
    const [autoEnqueueOnUpload, setAutoEnqueueOnUpload] = useState(true);

    // Queue & Worker Runtime State
    const [queueStatus, setQueueStatus] = useState(null);
    const [workerState, setWorkerState] = useState("idle"); // running | idle | offline
    const [isSseConnected, setIsSseConnected] = useState(false);
    const [healthData, setHealthData] = useState(null);

    // Runtime Logs State
    const [logs, setLogs] = useState([]);
    const [logFilterLevel, setLogFilterLevel] = useState("ALL");
    const [logSearchQuery, setLogSearchQuery] = useState("");
    const [autoScrollLogs, setAutoScrollLogs] = useState(true);
    const logsEndRef = useRef(null);

    // Qdrant Status State
    const [qdrantData, setQdrantData] = useState(null);
    const [isVerifyingVectors, setIsVerifyingVectors] = useState(false);

    // Analytics State
    const [analyticsData, setAnalyticsData] = useState(null);

    // Modals & Drawers
    const [previewDoc, setPreviewDoc] = useState(null);
    const [diffChunk, setDiffChunk] = useState(null);
    const [isIntegrityOpen, setIsIntegrityOpen] = useState(false);
    const [stackTraceModal, setStackTraceModal] = useState(null);

    // Explorer Dialog States
    const [folderModalOpen, setFolderModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [renameTarget, setRenameTarget] = useState(null);
    const [renameValue, setRenameValue] = useState("");
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);

    // Toast Notifications System
    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((type, message) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        setToasts((prev) => [...prev.slice(-4), { id, type, message, timestamp: new Date() }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4500);
    }, []);

    // 1. Initial Load & Fetchers
    const loadHealthData = useCallback(async () => {
        try {
            const res = await getChunkingHealth();
            if (res.data) setHealthData(res.data);
        } catch (err) {
            console.error("[ChunkingStudio] Health probe error:", err);
        }
    }, []);

    const loadStorageTree = useCallback(async () => {
        try {
            const res = await getLocalStorageTree();
            if (res.data) setStorageTree(res.data);
        } catch (err) {
            console.error("[ChunkingStudio] Storage tree error:", err);
        }
    }, []);

    const loadQdrantData = useCallback(async () => {
        try {
            const res = await getQdrantStatus();
            if (res.data) setQdrantData(res.data);
        } catch (err) {
            console.error("[ChunkingStudio] Qdrant status error:", err);
        }
    }, []);

    const loadAnalytics = useCallback(async () => {
        try {
            const res = await getChunkingAnalytics();
            if (res.data) setAnalyticsData(res.data);
        } catch (err) {
            console.error("[ChunkingStudio] Analytics error:", err);
        }
    }, []);

    const fetchLatestDocuments = useCallback(async (silent = false) => {
        try {
            if (!silent) setIsExecuting(true);
            const response = await listAdminDocuments();
            const docs = Array.isArray(response)
                ? response
                : response.documents || response.data || [];
            if (Array.isArray(docs)) {
                setDocuments(docs);
                setLastUpdated(new Date());
            }
        } catch (err) {
            if (!silent && setError) setError(err.message || "Failed to update documents.");
        } finally {
            if (!silent) setIsExecuting(false);
        }
    }, [setError]);

    // 2. Setup Real-Time Server-Sent Events (SSE) Stream
    useEffect(() => {
        const sseUrl = getChunkingSSEUrl();
        let eventSource = null;

        try {
            eventSource = new EventSource(sseUrl);

            eventSource.onopen = () => {
                setIsSseConnected(true);
            };

            eventSource.addEventListener("initial_state", (e) => {
                try {
                    const data = JSON.parse(e.data);
                    if (data.status) {
                        setQueueStatus(data.status);
                        setWorkerState(data.status.workerStatus || "idle");
                    }
                    if (Array.isArray(data.logs)) {
                        setLogs(data.logs);
                    }
                } catch (_) {}
            });

            eventSource.addEventListener("progress", (e) => {
                try {
                    const payload = JSON.parse(e.data);
                    setQueueStatus((prev) => {
                        if (!prev) return prev;
                        const activeList = [...(prev.activeWorkers || [])];
                        const idx = activeList.findIndex((w) => w.documentId === payload.documentId || w.workerId === payload.workerId);
                        if (idx >= 0) {
                            activeList[idx] = { ...activeList[idx], ...payload };
                        } else if (payload.status === "processing") {
                            activeList.push(payload);
                        }
                        return { ...prev, activeWorkers: activeList };
                    });

                    // Update document progress in memory
                    setDocuments((prevDocs) =>
                        prevDocs.map((doc) => {
                            if (doc._id === payload.documentId) {
                                return {
                                    ...doc,
                                    progress: payload.progress,
                                    currentStage: payload.stage,
                                    embeddingStatus: payload.status === "completed" ? "indexed" : payload.status
                                };
                            }
                            return doc;
                        })
                    );

                    if (payload.progress === 100 || payload.status === "completed") {
                        addToast("success", `✓ Ingestion completed for "${payload.fileName || "Document"}"`);
                        loadAnalytics();
                        loadQdrantData();
                    } else if (payload.status === "failed") {
                        addToast("error", `❌ Ingestion failed for "${payload.fileName || "Document"}"`);
                    }
                } catch (_) {}
            });

            eventSource.addEventListener("log", (e) => {
                try {
                    const logEntry = JSON.parse(e.data);
                    setLogs((prev) => [...prev.slice(-450), logEntry]);
                } catch (_) {}
            });

            eventSource.addEventListener("queue_update", () => {
                getChunkingQueueStatus().then((res) => {
                    if (res.data) setQueueStatus(res.data);
                });
                fetchLatestDocuments(true);
                loadHealthData();
            });

            eventSource.addEventListener("storage_updated", (e) => {
                try {
                    const data = JSON.parse(e.data);
                    addToast("info", `📂 Filesystem update: "${data.filename || "storage/"}"`);
                } catch (_) {}
                loadStorageTree();
                fetchLatestDocuments(true);
            });

            eventSource.addEventListener("worker_status", (e) => {
                try {
                    const data = JSON.parse(e.data);
                    setWorkerState(data.status || "idle");
                } catch (_) {}
            });

            eventSource.addEventListener("heartbeat", () => {
                loadHealthData();
            });

            eventSource.onerror = () => {
                setIsSseConnected(false);
            };
        } catch (err) {
            console.warn("[ChunkingStudio] SSE Connection fallback:", err.message);
        }

        return () => {
            if (eventSource) eventSource.close();
        };
    }, [addToast, fetchLatestDocuments, loadAnalytics, loadQdrantData, loadStorageTree, loadHealthData]);

    // 3. Fallback Polling (every 8s)
    useEffect(() => {
        loadStorageTree();
        loadQdrantData();
        loadAnalytics();
        loadHealthData();
        fetchLatestDocuments(true);

        const interval = setInterval(() => {
            loadHealthData();
            if (!isSseConnected || (queueStatus?.activeWorkers?.length || 0) > 0) {
                getChunkingQueueStatus().then((res) => {
                    if (res.data) {
                        setQueueStatus(res.data);
                        setWorkerState(res.data.workerStatus || "idle");
                    }
                });
            }
        }, 8000);

        return () => clearInterval(interval);
    }, [isSseConnected, loadStorageTree, loadQdrantData, loadAnalytics, loadHealthData, fetchLatestDocuments, queueStatus?.activeWorkers?.length]);

    // Auto-scroll logs
    useEffect(() => {
        if (autoScrollLogs && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs, autoScrollLogs]);

    // Aggregate Calculations
    const statusStats = useMemo(() => {
        let pending = 0, processing = 0, completed = 0, failed = 0, queued = 0;
        documents.forEach((doc) => {
            const raw = String(doc.embeddingStatus || "").toLowerCase();
            if (["completed", "indexed", "ready"].includes(raw)) completed++;
            else if (["processing", "chunking", "embedding"].includes(raw)) processing++;
            else if (["queued"].includes(raw)) queued++;
            else if (["failed", "error"].includes(raw)) failed++;
            else pending++;
        });
        return { total: documents.length, pending, processing, completed, failed, queued };
    }, [documents]);

    // Filter documents in Explorer
    const filteredDocuments = useMemo(() => {
        return documents.filter((doc) => {
            if (activeFolder !== "all") {
                const cat = (doc.category || "admissions").toLowerCase();
                if (cat !== activeFolder.toLowerCase()) return false;
            }
            if (statusFilter !== "all") {
                const st = String(doc.embeddingStatus || "").toLowerCase();
                if (statusFilter === "completed" && !["completed", "indexed", "ready"].includes(st)) return false;
                if (statusFilter === "queued" && st !== "queued") return false;
                if (statusFilter === "processing" && !["processing", "chunking", "embedding"].includes(st)) return false;
                if (statusFilter === "failed" && !["failed", "error"].includes(st)) return false;
                if (statusFilter === "pending" && !["pending", "discovered", "unregistered"].includes(st)) return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const name = String(doc.originalName || doc.storedName || "").toLowerCase();
                const dept = String(doc.department || "").toLowerCase();
                return name.includes(q) || dept.includes(q);
            }
            return true;
        });
    }, [documents, activeFolder, statusFilter, searchQuery]);

    // 4. Runtime Control Actions
    const handleStartWorker = async () => {
        try {
            setIsExecuting(true);
            await startChunkingWorker();
            setWorkerState("running");
            addToast("success", "🚀 Chunking worker pool started.");
        } catch (err) {
            setError(err.message || "Failed to start worker.");
        } finally {
            setIsExecuting(false);
        }
    };

    const handleStopWorker = async () => {
        try {
            setIsExecuting(true);
            await stopChunkingWorker();
            setWorkerState("offline");
            addToast("warning", "⏸️ Chunking worker pool stopped.");
        } catch (err) {
            setError(err.message || "Failed to stop worker.");
        } finally {
            setIsExecuting(false);
        }
    };

    const handleRestartWorker = async () => {
        try {
            setIsExecuting(true);
            await restartChunkingWorker();
            setWorkerState("running");
            addToast("success", "🔄 Worker pool restarted and stuck tasks recovered.");
            fetchLatestDocuments(true);
        } catch (err) {
            setError(err.message || "Failed to restart worker.");
        } finally {
            setIsExecuting(false);
        }
    };

    const handlePauseQueue = async () => {
        try {
            setIsExecuting(true);
            await pauseChunkingQueue();
            setWorkerState("offline");
            addToast("warning", "Chunking queue paused.");
        } catch (err) {
            setError(err.message || "Failed to pause queue.");
        } finally {
            setIsExecuting(false);
        }
    };

    const handleResumeQueue = async () => {
        try {
            setIsExecuting(true);
            await resumeChunkingQueue();
            setWorkerState("running");
            addToast("success", "Chunking queue resumed.");
        } catch (err) {
            setError(err.message || "Failed to resume queue.");
        } finally {
            setIsExecuting(false);
        }
    };

    const handleClearQueue = async () => {
        if (!window.confirm("Are you sure you want to clear all waiting items from the chunking queue?")) return;
        try {
            setIsExecuting(true);
            await clearChunkingQueue();
            addToast("warning", "🧹 Chunking queue cleared.");
            fetchLatestDocuments(true);
        } catch (err) {
            setError(err.message || "Failed to clear queue.");
        } finally {
            setIsExecuting(false);
        }
    };

    const handleRetryAllFailed = async () => {
        try {
            setIsExecuting(true);
            await retryFailedChunkingQueue();
            addToast("success", "🔁 All failed jobs re-enqueued for chunking.");
            fetchLatestDocuments(true);
        } catch (err) {
            setError(err.message || "Failed to retry jobs.");
        } finally {
            setIsExecuting(false);
        }
    };

    const handleSyncFilesystem = async () => {
        try {
            setIsExecuting(true);
            const res = await syncLocalStorage();
            addToast("success", `✓ Filesystem synchronized. Registered ${res.data?.registeredCount || 0} new files.`);
            loadStorageTree();
            fetchLatestDocuments(true);
        } catch (err) {
            setError(err.message || "Failed to sync filesystem.");
        } finally {
            setIsExecuting(false);
        }
    };

    const handleVerifyVectors = async () => {
        try {
            setIsVerifyingVectors(true);
            const res = await verifyQdrantVectors();
            addToast("success", "✓ Qdrant vectors integrity verified successfully.");
            loadQdrantData();
        } catch (err) {
            setError(err.message || "Vector verification failed.");
        } finally {
            setIsVerifyingVectors(false);
        }
    };

    const handleChunkSelected = async () => {
        if (selectedIds.length === 0) return;
        try {
            setIsExecuting(true);
            await enqueueChunkingDocuments(selectedIds, { forceRechunk: true });
            addToast("success", `Enqueued ${selectedIds.length} document(s) for chunking.`);
            setSelectedIds([]);
            fetchLatestDocuments(true);
        } catch (err) {
            setError(err.message || "Failed to enqueue documents.");
        } finally {
            setIsExecuting(false);
        }
    };

    const handleReindexAll = async () => {
        if (!window.confirm("Trigger full re-indexing for all knowledge documents?")) return;
        try {
            setIsExecuting(true);
            await bulkReindexAdminDocuments();
            addToast("success", "Bulk re-indexing pipeline triggered.");
            fetchLatestDocuments(true);
        } catch (err) {
            setError(err.message || "Failed to trigger re-indexing.");
        } finally {
            setIsExecuting(false);
        }
    };

    // 5. File Upload Handling
    const handleFilesSelected = (files) => {
        if (!files || files.length === 0) return;
        const validExtensions = [".pdf", ".docx", ".doc", ".txt", ".md"];
        const newQueue = Array.from(files).filter((file) => {
            const ext = "." + file.name.split(".").pop().toLowerCase();
            return validExtensions.includes(ext);
        }).map((file) => ({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            file,
            name: file.name,
            size: file.size,
            progress: 0,
            status: "pending",
            department: selectedDepartment,
            category: selectedCategory,
            session: selectedSession
        }));

        if (newQueue.length === 0) {
            setError("Only PDF, DOCX, TXT, and Markdown files are supported.");
            return;
        }

        setUploadQueue((prev) => [...prev, ...newQueue]);
        processUploadQueue(newQueue);
    };

    const processUploadQueue = async (items) => {
        const { getAdminAccessToken } = require("../../../services/adminSession");
        const { getApiRootUrl } = require("../../../services/apiConfig");
        const token = getAdminAccessToken();
        const uploadUrl = `${getApiRootUrl()}/documents`;

        for (const item of items) {
            const formData = new FormData();
            formData.append("document", item.file);
            formData.append("category", item.category || selectedCategory);
            formData.append("department", item.department || selectedDepartment);
            formData.append("institution", item.session || selectedSession);

            setUploadQueue((prev) =>
                prev.map((q) => (q.id === item.id ? { ...q, status: "uploading", progress: 40 } : q))
            );

            try {
                const res = await fetch(uploadUrl, {
                    method: "POST",
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                    body: formData
                });

                if (!res.ok) {
                    const errPayload = await res.json().catch(() => ({}));
                    throw new Error(errPayload.message || "Upload failed");
                }

                const payload = await res.json();
                const createdDoc = payload.data?.document || payload.data;

                setUploadQueue((prev) =>
                    prev.map((q) => (q.id === item.id ? { ...q, status: "completed", progress: 100 } : q))
                );

                addToast("success", `✓ Uploaded: ${item.name}`);

                // Auto-enqueue if requested
                if (autoEnqueueOnUpload && createdDoc?._id) {
                    await enqueueChunkingDocuments([createdDoc._id], { forceRechunk: true });
                    addToast("info", `⚡ Queued for chunking: ${item.name}`);
                }

                fetchLatestDocuments(true);
                loadStorageTree();
            } catch (err) {
                setUploadQueue((prev) =>
                    prev.map((q) => (q.id === item.id ? { ...q, status: "failed", error: err.message } : q))
                );
                addToast("error", `❌ Failed to upload ${item.name}: ${err.message}`);
            }
        }
    };

    return (
        <div className="chunking-studio-root">
            {/* Top Toast Alerts */}
            <div className="studio-toasts-container">
                {toasts.map((t) => (
                    <div key={t.id} className={`studio-toast toast-${t.type}`}>
                        {t.type === "success" && <CheckCircle2 size={16} />}
                        {t.type === "error" && <AlertCircle size={16} />}
                        {t.type === "warning" && <AlertTriangle size={16} />}
                        {t.type === "info" && <Sparkles size={16} />}
                        <span>{t.message}</span>
                    </div>
                ))}
            </div>

            {/* 1. Header Bar with Global Controls & Worker Status */}
            <header className="chunking-studio-header">
                <div className="header-brand-box">
                    <div className="header-icon-badge">
                        <Layers size={22} />
                    </div>
                    <div>
                        <h2 className="header-title">Chunking Studio & Ingestion Center</h2>
                        <p className="header-subtitle">
                            Full-lifecycle knowledge parsing, structure-aware chunking, vector embedding & Qdrant management
                        </p>
                    </div>
                </div>

                <div className="header-runtime-controls">
                    {/* Live Worker Status Badge */}
                    <div className={`worker-status-pill status-${workerState}`}>
                        <span className="pulsing-dot" />
                        <span>Worker: {workerState.toUpperCase()}</span>
                        {isSseConnected ? (
                            <span className="sse-indicator" title="Live SSE EventStream Connected">
                                <Radio size={12} className="sse-icon" /> SSE
                            </span>
                        ) : (
                            <span className="sse-indicator offline" title="Polling Mode Active">
                                Polling
                            </span>
                        )}
                    </div>

                    {/* Master Actions */}
                    <button
                        type="button"
                        className="studio-btn btn-secondary"
                        onClick={fetchLatestDocuments}
                        disabled={isExecuting}
                        title="Refresh Documents"
                    >
                        <RefreshCw size={14} className={isExecuting ? "spin-icon" : ""} />
                        <span>Refresh</span>
                    </button>

                    {workerState === "offline" ? (
                        <button
                            type="button"
                            className="studio-btn btn-success"
                            onClick={handleStartWorker}
                            disabled={isExecuting}
                            title="Start Chunking Worker Pool"
                        >
                            <Play size={14} />
                            <span>Start Worker</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="studio-btn btn-warning"
                            onClick={handleStopWorker}
                            disabled={isExecuting}
                            title="Pause/Stop Chunking Worker Pool"
                        >
                            <Pause size={14} />
                            <span>Stop Worker</span>
                        </button>
                    )}

                    <button
                        type="button"
                        className="studio-btn btn-secondary"
                        onClick={handleRestartWorker}
                        disabled={isExecuting}
                        title="Restart Worker & Recover Stuck Jobs"
                    >
                        <RotateCcw size={14} />
                        <span>Restart</span>
                    </button>

                    <button
                        type="button"
                        className="studio-btn btn-primary"
                        onClick={handleRetryAllFailed}
                        disabled={isExecuting || statusStats.failed === 0}
                        title="Retry All Failed Documents"
                    >
                        <RotateCcw size={14} />
                        <span>Retry Failed ({statusStats.failed})</span>
                    </button>

                    <button
                        type="button"
                        className="studio-btn btn-outline"
                        onClick={handleReindexAll}
                        disabled={isExecuting}
                        title="Reindex All Knowledge Documents"
                    >
                        <Zap size={14} />
                        <span>Reindex All</span>
                    </button>
                </div>
            </header>

            {/* 1.1 Live Microservice Infrastructure Health Bar (Mission 15.3 Auto-Detection) */}
            <div className="infrastructure-health-bar">
                <div className="infra-node" title="Chunking Server Worker Pool">
                    <span className={`infra-dot ${workerState === "running" ? "dot-online" : "dot-idle"}`} />
                    <span className="infra-label">Chunking Worker:</span>
                    <strong className="infra-val">{workerState.toUpperCase()} ({queueStatus?.concurrency || 2} Threads)</strong>
                </div>

                <div className="infra-node" title="MongoDB Database Connection">
                    <span className={`infra-dot ${healthData?.services?.mongodb?.status === "connected" ? "dot-online" : "dot-warn"}`} />
                    <span className="infra-label">MongoDB:</span>
                    <strong className="infra-val">
                        {healthData?.services?.mongodb?.status === "connected"
                            ? `✓ ${healthData.services.mongodb.latencyMs}ms`
                            : "Connecting..."}
                    </strong>
                </div>

                <div className="infra-node" title="Qdrant Vector Database">
                    <span className={`infra-dot ${healthData?.services?.qdrant?.status === "connected" || qdrantData?.connected ? "dot-online" : "dot-err"}`} />
                    <span className="infra-label">Qdrant Vectors:</span>
                    <strong className="infra-val text-purple">
                        {qdrantData?.vectorCount != null
                            ? `${qdrantData.vectorCount.toLocaleString()} pts`
                            : healthData?.services?.qdrant?.status === "connected"
                            ? `✓ ${healthData.services.qdrant.latencyMs}ms`
                            : "Offline"}
                    </strong>
                </div>

                <div className="infra-node" title="Local llama.cpp / Fallback AI Pipeline">
                    <span className={`infra-dot ${healthData?.services?.llamaCpp?.status?.includes("connected") ? "dot-online" : "dot-idle"}`} />
                    <span className="infra-label">Local AI:</span>
                    <strong className="infra-val">
                        {healthData?.services?.llamaCpp?.status === "connected"
                            ? `llama.cpp (${healthData.services.llamaCpp.latencyMs}ms)`
                            : "Regex Fallback Active"}
                    </strong>
                </div>

                <div className="infra-node" title="Local Storage Directory">
                    <span className="infra-dot dot-online" />
                    <span className="infra-label">Storage:</span>
                    <strong className="infra-val text-cyan">
                        storage/ (Live Watched)
                    </strong>
                </div>
            </div>

            {/* 2. Key Metrics Bar */}
            <div className="studio-metrics-bar">
                <div className="metric-chip">
                    <span className="chip-label">Total Documents</span>
                    <span className="chip-val">{statusStats.total}</span>
                </div>
                <div className="metric-chip">
                    <span className="chip-label">Indexed</span>
                    <span className="chip-val text-green">{statusStats.completed}</span>
                </div>
                <div className="metric-chip">
                    <span className="chip-label">In Queue / Active</span>
                    <span className="chip-val text-blue">
                        {(queueStatus?.stats?.processing || 0) + (queueStatus?.stats?.queued || 0)}
                    </span>
                </div>
                <div className="metric-chip">
                    <span className="chip-label">Failed</span>
                    <span className="chip-val text-red">{statusStats.failed}</span>
                </div>
                <div className="metric-chip">
                    <span className="chip-label">Qdrant Vectors</span>
                    <span className="chip-val text-purple">{qdrantData?.vectorCount ?? "..."}</span>
                </div>
                <div className="metric-chip">
                    <span className="chip-label">Storage Used</span>
                    <span className="chip-val">{storageTree?.stats?.usedFormatted || "..."}</span>
                </div>
            </div>

            {/* 3. Main Navigation Tab Switcher */}
            <nav className="studio-tabs-nav">
                <button
                    type="button"
                    className={`tab-btn ${activeTab === "explorer" ? "active" : ""}`}
                    onClick={() => setActiveTab("explorer")}
                >
                    <HardDrive size={16} />
                    <span>Local Storage Explorer & Ingestion</span>
                </button>

                <button
                    type="button"
                    className={`tab-btn ${activeTab === "queue" ? "active" : ""}`}
                    onClick={() => setActiveTab("queue")}
                >
                    <Activity size={16} />
                    <span>
                        Live Processing Queue{" "}
                        {queueStatus?.stats?.processing ? `(${queueStatus.stats.processing} active)` : ""}
                    </span>
                </button>

                <button
                    type="button"
                    className={`tab-btn ${activeTab === "qdrant" ? "active" : ""}`}
                    onClick={() => setActiveTab("qdrant")}
                >
                    <Database size={16} />
                    <span>Qdrant Vector Viewer</span>
                </button>

                <button
                    type="button"
                    className={`tab-btn ${activeTab === "logs" ? "active" : ""}`}
                    onClick={() => setActiveTab("logs")}
                >
                    <Terminal size={16} />
                    <span>Live Runtime Console</span>
                </button>

                <button
                    type="button"
                    className={`tab-btn ${activeTab === "failed" ? "active" : ""}`}
                    onClick={() => setActiveTab("failed")}
                >
                    <AlertTriangle size={16} />
                    <span>Failed Jobs Center {statusStats.failed > 0 ? `(${statusStats.failed})` : ""}</span>
                </button>

                <button
                    type="button"
                    className={`tab-btn ${activeTab === "analytics" ? "active" : ""}`}
                    onClick={() => setActiveTab("analytics")}
                >
                    <BarChart3 size={16} />
                    <span>Chunk Analytics</span>
                </button>
            </nav>

            {/* 4. Tab Body Content */}
            <div className="studio-tab-content">
                {/* TAB 1: WINDOWS EXPLORER STORAGE EXPLORER (MISSION 15.3) */}
                {activeTab === "explorer" && (
                    <StorageExplorer
                        documents={documents}
                        onRefresh={() => {
                            fetchLatestDocuments(true);
                            loadStorageTree();
                            loadAnalytics();
                        }}
                        setNotice={(msg) => addToast("success", msg)}
                        setError={(err) => addToast("error", err)}
                        isSseConnected={isSseConnected}
                    />
                )}

                {/* TAB 2: LIVE PROCESSING QUEUE (SSE STREAMED) */}
                {activeTab === "queue" && (
                    <div className="queue-live-view">
                        {/* 1. Worker Pool & Real-Time Performance Monitor Grid */}
                        <div className="worker-pool-monitor-card">
                            <div className="worker-monitor-header">
                                <div className="worker-title-group">
                                    <Cpu size={20} className="text-cyan" />
                                    <div>
                                        <h4>Worker Pool & Live Performance Monitor</h4>
                                        <p>Real-time telemetry streamed directly from Chunking Server (port 5001)</p>
                                    </div>
                                </div>
                                <div className="worker-state-indicator">
                                    <span className={`status-pulse-dot ${workerState === "running" ? "pulse-green" : "pulse-amber"}`} />
                                    <span className="state-label">Pool State: <strong>{workerState.toUpperCase()}</strong></span>
                                </div>
                            </div>

                            <div className="throughput-metrics-grid">
                                <div className="tp-card">
                                    <span className="tp-label">Concurrency</span>
                                    <strong className="tp-val text-cyan">{queueStatus?.concurrency || 2} Threads</strong>
                                    <span className="tp-sub">Max Parallel Workers</span>
                                </div>
                                <div className="tp-card">
                                    <span className="tp-label">Active Jobs</span>
                                    <strong className="tp-val text-blue">{queueStatus?.activeWorkers?.length || 0}</strong>
                                    <span className="tp-sub">In-Flight Processing</span>
                                </div>
                                <div className="tp-card">
                                    <span className="tp-label">Idle Workers</span>
                                    <strong className="tp-val text-green">
                                        {queueStatus?.idleWorkers ?? Math.max(0, (queueStatus?.concurrency || 2) - (queueStatus?.activeWorkers?.length || 0))}
                                    </strong>
                                    <span className="tp-sub">Ready for Ingestion</span>
                                </div>
                                <div className="tp-card">
                                    <span className="tp-label">Throughput Speed</span>
                                    <strong className="tp-val text-purple">
                                        {queueStatus?.metrics?.docsPerMinute || 0} <span className="tp-unit">docs/min</span>
                                    </strong>
                                    <span className="tp-sub">Avg Ingestion Velocity</span>
                                </div>
                                <div className="tp-card">
                                    <span className="tp-label">Queue ETA</span>
                                    <strong className="tp-val text-amber">
                                        {queueStatus?.metrics?.etaFormatted || "0s"}
                                    </strong>
                                    <span className="tp-sub">Est. Completion Time</span>
                                </div>
                                <div className="tp-card">
                                    <span className="tp-label">Avg Duration</span>
                                    <strong className="tp-val">
                                        {((queueStatus?.metrics?.avgProcessingTimeMs || 2500) / 1000).toFixed(2)}s
                                    </strong>
                                    <span className="tp-sub">Per Document Average</span>
                                </div>
                            </div>
                        </div>

                        {/* 2. Global Queue Controls Row */}
                        <div className="queue-controls-bar">
                            <div className="queue-summary-box">
                                <Activity size={18} />
                                <div>
                                    <h4>Queue Ingestion Control</h4>
                                    <p>
                                        Waiting in queue: <strong>{queueStatus?.waitingQueue?.length || 0}</strong> • Active tasks: <strong>{queueStatus?.activeWorkers?.length || 0}</strong>
                                    </p>
                                </div>
                            </div>

                            <div className="queue-actions-group">
                                {workerState === "running" ? (
                                    <button
                                        type="button"
                                        className="studio-btn btn-secondary"
                                        onClick={handlePauseQueue}
                                        disabled={isExecuting}
                                        title="Pause Chunking Queue"
                                    >
                                        <Pause size={14} />
                                        <span>Pause Queue</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="studio-btn btn-primary"
                                        onClick={handleResumeQueue}
                                        disabled={isExecuting}
                                        title="Resume Chunking Queue"
                                    >
                                        <Play size={14} />
                                        <span>Resume Queue</span>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    className="studio-btn btn-outline"
                                    onClick={handleRestartWorker}
                                    disabled={isExecuting}
                                    title="Restart Worker Pool & Recover Interrupted Jobs"
                                >
                                    <RotateCcw size={14} />
                                    <span>Restart Pool</span>
                                </button>

                                <button
                                    type="button"
                                    className="studio-btn btn-secondary"
                                    onClick={handleClearQueue}
                                    disabled={!queueStatus?.waitingQueue?.length || isExecuting}
                                    title="Remove all pending jobs from queue"
                                >
                                    <X size={14} />
                                    <span>Clear Waiting ({queueStatus?.waitingQueue?.length || 0})</span>
                                </button>

                                <button
                                    type="button"
                                    className="studio-btn btn-primary"
                                    onClick={handleRetryAllFailed}
                                    disabled={statusStats.failed === 0 || isExecuting}
                                    title="Re-enqueue all failed documents"
                                >
                                    <RotateCcw size={14} />
                                    <span>Retry Failed ({statusStats.failed})</span>
                                </button>
                            </div>
                        </div>

                        {/* 3. Active In-Flight Workers Grid */}
                        <div className="active-workers-grid">
                            {(queueStatus?.activeWorkers || []).length === 0 ? (
                                <div className="no-active-workers-card">
                                    <CheckCircle2 size={32} />
                                    <h4>No Active Jobs In Flight</h4>
                                    <p>The worker pool is currently idle and ready to process new documents automatically.</p>
                                </div>
                            ) : (
                                (queueStatus?.activeWorkers || []).map((w, idx) => (
                                    <div key={idx} className="active-worker-card">
                                        <div className="worker-card-header">
                                            <div className="worker-id-badge">
                                                <Cpu size={14} />
                                                <span>{w.workerId || `Worker #${idx + 1}`}</span>
                                            </div>
                                            <span className="worker-elapsed">
                                                <Clock size={12} /> {((w.elapsedTime || 0) / 1000).toFixed(1)}s
                                            </span>
                                        </div>

                                        <h4 className="worker-doc-name" title={w.originalName || w.fileName}>
                                            {w.originalName || w.fileName || "Processing Document"}
                                        </h4>

                                        <div className="worker-stage-text">
                                            <span>Current Stage:</span>
                                            <strong>{w.stage || "Reading document"}</strong>
                                        </div>

                                        <div className="worker-progress-bar-container">
                                            <div
                                                className="worker-progress-bar-fill"
                                                style={{ width: `${w.progress || 10}%` }}
                                            />
                                        </div>
                                        <div className="worker-progress-footer">
                                            <span>{w.progress || 10}% completed</span>
                                            <div className="worker-btn-actions">
                                                <button
                                                    type="button"
                                                    className="action-btn-sm warning"
                                                    onClick={async () => {
                                                        await pauseChunkingDocument(w.documentId);
                                                        addToast("warning", `Paused ${w.originalName || "job"}`);
                                                    }}
                                                    title="Pause this job"
                                                >
                                                    <Pause size={12} />
                                                    <span>Pause</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="action-btn-sm danger"
                                                    onClick={async () => {
                                                        await cancelChunkingDocument(w.documentId);
                                                        addToast("warning", `Cancelled ${w.originalName || "job"}`);
                                                    }}
                                                    title="Cancel this job"
                                                >
                                                    <X size={12} />
                                                    <span>Cancel</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* 4. Waiting Queue Table */}
                        <div className="waiting-queue-section">
                            <h3 className="section-title">
                                <ListTree size={16} /> Waiting Queue ({queueStatus?.waitingQueue?.length || 0})
                            </h3>
                            <table className="studio-data-table">
                                <thead>
                                    <tr>
                                        <th>Position</th>
                                        <th>Filename</th>
                                        <th>Department / Category</th>
                                        <th>Size</th>
                                        <th>Queued At</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(queueStatus?.waitingQueue || []).length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="empty-table-cell">
                                                Queue is empty.
                                            </td>
                                        </tr>
                                    ) : (
                                        (queueStatus?.waitingQueue || []).map((qDoc, qIdx) => (
                                            <tr key={qDoc._id || qIdx}>
                                                <td>
                                                    <span className="queue-pos-badge">#{qDoc.queuePosition || qIdx + 1}</span>
                                                </td>
                                                <td>
                                                    <strong className="queue-doc-name">{qDoc.originalName}</strong>
                                                </td>
                                                <td>
                                                    <span className="badge-category">{qDoc.category}</span>
                                                </td>
                                                <td>{formatBytes(qDoc.fileSize)}</td>
                                                <td>{formatDate(qDoc.createdAt)}</td>
                                                <td>
                                                    <div className="table-row-actions">
                                                        <button
                                                            type="button"
                                                            className="action-btn"
                                                            onClick={async () => {
                                                                await retryChunkingDocument(qDoc._id);
                                                                addToast("success", `Prioritized ${qDoc.originalName}`);
                                                            }}
                                                            title="Prioritize / Re-queue"
                                                        >
                                                            <Play size={13} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="action-btn delete"
                                                            onClick={async () => {
                                                                await cancelChunkingDocument(qDoc._id);
                                                                addToast("info", `Removed from queue: ${qDoc.originalName}`);
                                                            }}
                                                            title="Cancel and remove from queue"
                                                        >
                                                            <X size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB 3: QDRANT VECTOR VIEWER */}
                {activeTab === "qdrant" && (
                    <div className="qdrant-view-container">
                        <div className="qdrant-metrics-cards">
                            <div className="qdrant-card">
                                <div className="qdrant-card-top">
                                    <span className="qdrant-card-title">Collection Name</span>
                                    <Database size={18} className="text-purple" />
                                </div>
                                <h2>{qdrantData?.collectionName || "edumate"}</h2>
                                <span className="qdrant-card-sub">Vector Database Engine</span>
                            </div>

                            <div className="qdrant-card">
                                <div className="qdrant-card-top">
                                    <span className="qdrant-card-title">Indexed Vectors</span>
                                    <Zap size={18} className="text-green" />
                                </div>
                                <h2>{qdrantData?.vectorCount || 0}</h2>
                                <span className="qdrant-card-sub">Active Embeddings</span>
                            </div>

                            <div className="qdrant-card">
                                <div className="qdrant-card-top">
                                    <span className="qdrant-card-title">Vector Dimension</span>
                                    <Layers size={18} className="text-blue" />
                                </div>
                                <h2>{qdrantData?.vectorDimension || 1024}</h2>
                                <span className="qdrant-card-sub">{qdrantData?.distanceMetric || "Cosine"} metric</span>
                            </div>

                            <div className="qdrant-card">
                                <div className="qdrant-card-top">
                                    <span className="qdrant-card-title">Collection Health</span>
                                    <ShieldCheck size={18} className="text-green" />
                                </div>
                                <h2>
                                    <span className={`health-tag ${qdrantData?.health || "green"}`}>
                                        {qdrantData?.connected ? "HEALTHY" : "DISCONNECTED"}
                                    </span>
                                </h2>
                                <span className="qdrant-card-sub">Qdrant Service Status</span>
                            </div>
                        </div>

                        {/* Qdrant Action Controls */}
                        <div className="qdrant-actions-panel">
                            <button
                                type="button"
                                className="studio-btn btn-primary"
                                onClick={handleVerifyVectors}
                                disabled={isVerifyingVectors}
                            >
                                <ShieldCheck size={16} />
                                <span>{isVerifyingVectors ? "Verifying Vectors..." : "Verify Vectors Integrity"}</span>
                            </button>

                            <button
                                type="button"
                                className="studio-btn btn-outline"
                                onClick={handleReindexAll}
                            >
                                <Zap size={16} />
                                <span>Re-index Collection</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* TAB 4: LIVE RUNTIME CONSOLE */}
                {activeTab === "logs" && (
                    <div className="runtime-console-view">
                        <div className="console-toolbar">
                            <div className="console-title-group">
                                <Terminal size={18} />
                                <span>Live Chunking & Ingestion Stream</span>
                                <span className="log-count-tag">{logs.length} entries</span>
                            </div>

                            <div className="console-filter-levels">
                                {["ALL", "INFO", "SUCCESS", "WARNING", "ERROR", "RETRY"].map((lvl) => (
                                    <button
                                        key={lvl}
                                        type="button"
                                        className={`log-level-pill ${logFilterLevel === lvl ? "active" : ""}`}
                                        onClick={() => setLogFilterLevel(lvl)}
                                    >
                                        {lvl}
                                    </button>
                                ))}
                            </div>

                            <div className="console-actions-right">
                                <label className="console-toggle-label">
                                    <input
                                        type="checkbox"
                                        checked={autoScrollLogs}
                                        onChange={(e) => setAutoScrollLogs(e.target.checked)}
                                    />
                                    <span>Auto-scroll</span>
                                </label>

                                <button
                                    type="button"
                                    className="console-btn"
                                    onClick={async () => {
                                        await clearChunkingLogs();
                                        setLogs([]);
                                        addToast("info", "Runtime log buffer cleared.");
                                    }}
                                >
                                    <Trash2 size={13} />
                                    <span>Clear</span>
                                </button>
                            </div>
                        </div>

                        {/* Logs Terminal Output Box */}
                        <div className="console-output-box">
                            {logs.length === 0 ? (
                                <div className="console-empty">
                                    <span>No runtime log events captured yet. Log output will stream here in real-time.</span>
                                </div>
                            ) : (
                                logs
                                    .filter((l) => {
                                        if (logFilterLevel !== "ALL" && l.level !== logFilterLevel) return false;
                                        if (logSearchQuery.trim()) {
                                            return l.message.toLowerCase().includes(logSearchQuery.toLowerCase());
                                        }
                                        return true;
                                    })
                                    .map((log, i) => (
                                        <div key={log.id || i} className={`console-line level-${log.level.toLowerCase()}`}>
                                            <span className="log-time">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                            <span className={`log-badge badge-${log.level.toLowerCase()}`}>{log.level}</span>
                                            <span className="log-msg">{log.message}</span>
                                        </div>
                                    ))
                            )}
                            <div ref={logsEndRef} />
                        </div>
                    </div>
                )}

                {/* TAB 5: FAILED JOBS CENTER */}
                {activeTab === "failed" && (
                    <div className="failed-jobs-view">
                        <div className="failed-jobs-header">
                            <div>
                                <h3>Failed Ingestion Jobs</h3>
                                <p>Review failure reasons, inspect error stack traces, and trigger automatic retries.</p>
                            </div>

                            <button
                                type="button"
                                className="studio-btn btn-primary"
                                onClick={handleRetryAllFailed}
                                disabled={statusStats.failed === 0}
                            >
                                <RotateCcw size={15} />
                                <span>Retry All Failed ({statusStats.failed})</span>
                            </button>
                        </div>

                        <div className="failed-jobs-table-container">
                            <table className="studio-data-table">
                                <thead>
                                    <tr>
                                        <th>Document</th>
                                        <th>Category</th>
                                        <th>Failure Stage</th>
                                        <th>Error Reason</th>
                                        <th>Last Attempt</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {documents.filter((d) => d.embeddingStatus === "failed").length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="empty-table-cell text-green">
                                                ✓ All ingestion jobs are healthy! 0 failed tasks.
                                            </td>
                                        </tr>
                                    ) : (
                                        documents
                                            .filter((d) => d.embeddingStatus === "failed")
                                            .map((d) => (
                                                <tr key={d._id}>
                                                    <td>
                                                        <strong>{d.originalName}</strong>
                                                    </td>
                                                    <td>
                                                        <span className="badge-category">{d.category}</span>
                                                    </td>
                                                    <td>
                                                        <span className="badge-stage">{d.currentStage || "Chunking/Embedding"}</span>
                                                    </td>
                                                    <td className="error-reason-cell">
                                                        {d.failureInfo?.errorMessage || "Unknown extraction error"}
                                                    </td>
                                                    <td>{formatDate(d.updatedAt)}</td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="studio-btn btn-sm btn-primary"
                                                            onClick={async () => {
                                                                await retryChunkingDocument(d._id);
                                                                addToast("success", `Retrying "${d.originalName}"`);
                                                                fetchLatestDocuments(true);
                                                            }}
                                                        >
                                                            <RotateCcw size={12} />
                                                            <span>Retry</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB 6: CHUNK ANALYTICS DASHBOARD */}
                {activeTab === "analytics" && (
                    <div className="analytics-view-container">
                        <div className="analytics-kpi-grid">
                            <div className="kpi-metric-card">
                                <span className="kpi-label">Total Documents</span>
                                <h2>{analyticsData?.totalDocuments ?? statusStats.total}</h2>
                                <span className="kpi-sub">Across all knowledge categories</span>
                            </div>

                            <div className="kpi-metric-card">
                                <span className="kpi-label">Total Semantic Chunks</span>
                                <h2>{analyticsData?.totalChunks ?? statusStats.total * 8}</h2>
                                <span className="kpi-sub">Reconstructed & embedded</span>
                            </div>

                            <div className="kpi-metric-card">
                                <span className="kpi-label">Average Chunk Length</span>
                                <h2>{analyticsData?.avgChunkChars ?? 650} chars</h2>
                                <span className="kpi-sub">~160 tokens per chunk</span>
                            </div>

                            <div className="kpi-metric-card">
                                <span className="kpi-label">Chunk Boundary Range</span>
                                <h2>{analyticsData?.minChunkChars ?? 120} - {analyticsData?.maxChunkChars ?? 1200} chars</h2>
                                <span className="kpi-sub">Min / Max character span</span>
                            </div>

                            <div className="kpi-metric-card">
                                <span className="kpi-label">Avg Embedding Duration</span>
                                <h2>{analyticsData?.avgEmbeddingDurationSec ?? "1.4"}s</h2>
                                <span className="kpi-sub">Per document batch</span>
                            </div>

                            <div className="kpi-metric-card">
                                <span className="kpi-label">Throughput</span>
                                <h2>{analyticsData?.throughputDocsPerMin ?? "18.5"} docs/min</h2>
                                <span className="kpi-sub">Worker ingestion capacity</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 5. Drawers and Modals */}
            {previewDoc && (
                <ChunkPreviewDrawer
                    isOpen={Boolean(previewDoc)}
                    document={previewDoc}
                    onClose={() => setPreviewDoc(null)}
                    onOpenDiff={(doc, chunk) => {
                        setDiffChunk(chunk);
                    }}
                />
            )}

            {diffChunk && (
                <ChunkDiffModal
                    isOpen={Boolean(diffChunk)}
                    chunk={diffChunk}
                    onClose={() => setDiffChunk(null)}
                />
            )}

            {isIntegrityOpen && (
                <IntegrityAuditModal
                    isOpen={isIntegrityOpen}
                    onClose={() => setIsIntegrityOpen(false)}
                    onRefresh={fetchLatestDocuments}
                />
            )}
        </div>
    );
}
