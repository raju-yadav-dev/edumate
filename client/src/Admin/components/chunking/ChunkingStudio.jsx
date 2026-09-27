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
    Pause
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
    enqueueChunkingDocuments
} from "../../../services/adminService";

import FolderTreeSidebar from "./FolderTreeSidebar";
import ChunkPreviewDrawer from "./ChunkPreviewDrawer";
import QueueMonitorDrawer from "./QueueMonitorDrawer";
import IntegrityAuditModal from "./IntegrityAuditModal";
import ChunkDiffModal from "./ChunkDiffModal";
import "./ChunkingStudio.css";

export default function ChunkingStudio({
    documents: initialDocuments = [],
    onRefresh,
    setNotice,
    setError
}) {
    // Documents state
    const [documents, setDocuments] = useState(initialDocuments);
    const [selectedIds, setSelectedIds] = useState([]);
    const [statusFilter, setStatusFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [activeFolder, setActiveFolder] = useState("all");
    const [isExecuting, setIsExecuting] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Modal & Drawer states
    const [previewDoc, setPreviewDoc] = useState(null);
    const [diffChunk, setDiffChunk] = useState(null);
    const [isQueueOpen, setIsQueueOpen] = useState(false);
    const [isIntegrityOpen, setIsIntegrityOpen] = useState(false);

    // Explorer Dialog States
    const [folderModalOpen, setFolderModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [targetParentFolder, setTargetParentFolder] = useState("");

    const [fileModalOpen, setFileModalOpen] = useState(false);
    const [newFileName, setNewFileName] = useState("");
    const [fileDepartment, setFileDepartment] = useState("General");
    const [fileCategory, setFileCategory] = useState("admissions");

    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [renameTarget, setRenameTarget] = useState(null); // { type: 'doc'|'folder', id/path, currentName }
    const [renameValue, setRenameValue] = useState("");

    const [moveModalOpen, setMoveModalOpen] = useState(false);
    const [moveTargetDoc, setMoveTargetDoc] = useState(null);
    const [targetCategory, setTargetCategory] = useState("admissions");

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'doc'|'folder', id/path, name, count }

    // 10s Undo Toast State
    const [undoToast, setUndoToast] = useState(null); // { deletedIds, message, timeoutId, timer: 10 }
    const undoTimerRef = useRef(null);

    // Sync when parent initialDocuments changes
    useEffect(() => {
        if (Array.isArray(initialDocuments) && initialDocuments.length > 0) {
            setDocuments(initialDocuments);
            setLastUpdated(new Date());
        }
    }, [initialDocuments]);

    // Live refresh
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
            console.error("[ChunkingStudio] Refresh error:", err);
            if (!silent && setError) {
                setError(err.message || "Failed to update documents.");
            }
        } finally {
            if (!silent) setIsExecuting(false);
        }
    }, [setError]);

    // Compute status stats across 9 lifecycle states
    const statusStats = useMemo(() => {
        let pending = 0;
        let processing = 0;
        let completed = 0;
        let failed = 0;
        let queued = 0;
        let paused = 0;
        let totalChunks = 0;

        documents.forEach((doc) => {
            const raw = String(doc.embeddingStatus || doc.status || "").toLowerCase();
            const chunkCount = Number(doc.chunksCount || doc.chunkCount || doc.metadata?.chunkCount || 0);
            totalChunks += chunkCount;

            if (["ready", "indexed", "completed"].includes(raw)) {
                completed++;
            } else if (["queued"].includes(raw)) {
                queued++;
                processing++;
            } else if (["processing", "embedding", "chunking", "indexing", "extracting"].includes(raw)) {
                processing++;
            } else if (["failed", "error"].includes(raw)) {
                failed++;
            } else if (["paused"].includes(raw)) {
                paused++;
            } else {
                pending++;
            }
        });

        const total = documents.length || 1;
        const progressPct = Math.round((completed / total) * 100);

        return {
            total: documents.length,
            pending,
            queued,
            processing,
            completed,
            failed,
            paused,
            totalChunks,
            progressPct
        };
    }, [documents]);

    // Live Polling when tasks are in queue or processing
    useEffect(() => {
        const isPipelineActive = statusStats.processing > 0 || statusStats.queued > 0;
        if (!isPipelineActive) return;

        const interval = setInterval(() => {
            fetchLatestDocuments(true);
            onRefresh?.();
        }, 2000);

        return () => clearInterval(interval);
    }, [statusStats.processing, statusStats.queued, fetchLatestDocuments, onRefresh]);

    // Filter documents by Folder, Status, and Search Query
    const filteredDocuments = useMemo(() => {
        return documents.filter((doc) => {
            const rawStatus = String(doc.embeddingStatus || doc.status || "").toLowerCase();
            let normStatus = "pending";
            if (["ready", "indexed", "completed"].includes(rawStatus)) normStatus = "completed";
            else if (["processing", "embedding", "chunking", "indexing", "queued"].includes(rawStatus)) normStatus = "processing";
            else if (["failed", "error"].includes(rawStatus)) normStatus = "failed";

            if (statusFilter !== "all" && normStatus !== statusFilter) {
                return false;
            }

            // Folder Filter
            if (activeFolder !== "all") {
                const docCategory = String(doc.category || doc.folder || "others").trim().toLowerCase();
                const targetFolder = activeFolder.toLowerCase();
                if (docCategory !== targetFolder && !docCategory.startsWith(`${targetFolder}/`)) {
                    return false;
                }
            }

            // Search Query
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const name = String(doc.title || doc.originalName || "").toLowerCase();
                const category = String(doc.category || "").toLowerCase();
                const dept = String(doc.department || doc.metadata?.department || "").toLowerCase();
                return name.includes(query) || category.includes(query) || dept.includes(query);
            }

            return true;
        });
    }, [documents, statusFilter, activeFolder, searchQuery]);

    // Available categories
    const availableCategories = useMemo(() => {
        const set = new Set(["admissions", "academics", "fees", "hostel", "departments", "placements", "scholarships", "rules", "faculty", "library", "general"]);
        documents.forEach((d) => {
            const cat = d.category || d.folder;
            if (cat) set.add(cat);
        });
        return Array.from(set).sort();
    }, [documents]);

    // Pagination calculations
    const totalFiltered = filteredDocuments.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const paginatedDocs = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredDocuments.slice(start, start + pageSize);
    }, [filteredDocuments, currentPage, pageSize]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(1);
        }
    }, [totalPages, currentPage]);

    // Checkbox multi-select
    const isAllCurrentPageSelected = paginatedDocs.length > 0 && paginatedDocs.every((d) => selectedIds.includes(d._id));

    const toggleSelectAll = () => {
        if (isAllCurrentPageSelected) {
            const pageIds = new Set(paginatedDocs.map((d) => d._id));
            setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
        } else {
            const pageIds = paginatedDocs.map((d) => d._id);
            setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
        }
    };

    const toggleSelectDoc = (id) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const handleSelectAllFiltered = () => {
        const allIds = filteredDocuments.map((d) => d._id);
        setSelectedIds(allIds);
    };

    // --- Actions ---
    const handleChunkSelected = async () => {
        if (selectedIds.length === 0) return;
        try {
            setIsExecuting(true);
            setError?.("");
            await enqueueChunkingDocuments(selectedIds, { priority: "normal" });
            setNotice?.(`Enqueued ${selectedIds.length} document(s) for background chunking.`);
            setSelectedIds([]);
            await fetchLatestDocuments(false);
            onRefresh?.();
        } catch (err) {
            setError?.(err.message || "Failed to enqueue selected documents.");
        } finally {
            setIsExecuting(false);
        }
    };

    const handleChunkEntireFolder = async () => {
        const folderDocIds = filteredDocuments.map((d) => d._id);
        if (folderDocIds.length === 0) {
            setNotice?.("No documents in current folder to chunk.");
            return;
        }
        try {
            setIsExecuting(true);
            setError?.("");
            await enqueueChunkingDocuments(folderDocIds, { priority: "normal" });
            setNotice?.(`Enqueued entire folder (${folderDocIds.length} docs) for chunking.`);
            await fetchLatestDocuments(false);
            onRefresh?.();
        } catch (err) {
            setError?.(err.message || "Failed to enqueue folder documents.");
        } finally {
            setIsExecuting(false);
        }
    };

    const handleChunkAllPending = async () => {
        const unchunkedDocs = documents.filter((d) => {
            const raw = String(d.embeddingStatus || d.status || "").toLowerCase();
            return !["ready", "indexed", "completed"].includes(raw);
        });
        const ids = unchunkedDocs.map((d) => d._id);
        if (ids.length === 0) {
            setNotice?.("All documents in knowledge base are already completed.");
            return;
        }
        try {
            setIsExecuting(true);
            setError?.("");
            await enqueueChunkingDocuments(ids, { priority: "normal" });
            setNotice?.(`Enqueued all ${ids.length} pending/failed documents for chunking.`);
            await fetchLatestDocuments(false);
            onRefresh?.();
        } catch (err) {
            setError?.(err.message || "Failed to enqueue pending documents.");
        } finally {
            setIsExecuting(false);
        }
    };

    const handleRetryFailed = async () => {
        try {
            setIsExecuting(true);
            setError?.("");
            await retryFailedDocuments();
            setNotice?.("Retry initiated for all failed documents.");
            await fetchLatestDocuments(false);
            onRefresh?.();
        } catch (err) {
            setError?.(err.message || "Failed to retry failed documents.");
        } finally {
            setIsExecuting(false);
        }
    };

    // --- Folder / File Creation & Explorer Handlers ---
    const handleOpenCreateFolder = (parentFolder = "") => {
        setTargetParentFolder(parentFolder);
        setNewFolderName("");
        setFolderModalOpen(true);
    };

    const handleConfirmCreateFolder = async (e) => {
        e.preventDefault();
        const trimmed = newFolderName.trim();
        if (!trimmed) {
            setError?.("Folder name cannot be empty.");
            return;
        }

        const fullPath = targetParentFolder ? `${targetParentFolder}/${trimmed}` : trimmed;
        // Check for duplicates
        const exists = documents.some((d) => (d.category || "").toLowerCase() === fullPath.toLowerCase());
        if (exists) {
            setError?.("A folder with this path already exists.");
            return;
        }

        try {
            setIsExecuting(true);
            // Create a seed placeholder file to materialize folder in MongoDB/Supabase
            await createPlaceholderDocument({
                name: `.folder_seed`,
                category: fullPath,
                department: "General",
                program: "General"
            });
            setNotice?.(`Folder "${fullPath}" created successfully.`);
            setFolderModalOpen(false);
            setNewFolderName("");
            await fetchLatestDocuments(false);
            onRefresh?.();
        } catch (err) {
            setError?.(err.message || "Failed to create folder.");
        } finally {
            setIsExecuting(false);
        }
    };

    const handleOpenCreateFile = (category = "admissions") => {
        setFileCategory(category);
        setNewFileName("");
        setFileDepartment("General");
        setFileModalOpen(true);
    };

    const handleConfirmCreateFile = async (e) => {
        e.preventDefault();
        const trimmed = newFileName.trim();
        if (!trimmed) {
            setError?.("Document name cannot be empty.");
            return;
        }

        try {
            setIsExecuting(true);
            await createPlaceholderDocument({
                name: trimmed,
                category: fileCategory,
                department: fileDepartment,
                program: "General"
            });
            setNotice?.(`Placeholder file "${trimmed}" created.`);
            setFileModalOpen(false);
            setNewFileName("");
            await fetchLatestDocuments(false);
            onRefresh?.();
        } catch (err) {
            setError?.(err.message || "Failed to create file.");
        } finally {
            setIsExecuting(false);
        }
    };

    // --- Rename Handlers ---
    const handleOpenRename = (type, target) => {
        if (type === "folder") {
            setRenameTarget({ type: "folder", path: target, currentName: target });
            setRenameValue(target.split("/").pop());
        } else {
            setRenameTarget({ type: "doc", id: target._id, currentName: target.originalName || target.title });
            setRenameValue(target.originalName || target.title || "");
        }
        setRenameModalOpen(true);
    };

    const handleConfirmRename = async (e) => {
        e.preventDefault();
        const trimmed = renameValue.trim();
        if (!trimmed) return;

        try {
            setIsExecuting(true);
            if (renameTarget.type === "folder") {
                const parts = renameTarget.path.split("/");
                parts[parts.length - 1] = trimmed;
                const newPath = parts.join("/");
                await renameAdminFolder({ oldPath: renameTarget.path, newPath });
                setNotice?.(`Folder renamed to "${newPath}".`);
            } else {
                await renameAdminDocument(renameTarget.id, trimmed);
                setNotice?.(`Document renamed to "${trimmed}".`);
            }
            setRenameModalOpen(false);
            await fetchLatestDocuments(false);
            onRefresh?.();
        } catch (err) {
            setError?.(err.message || "Failed to rename.");
        } finally {
            setIsExecuting(false);
        }
    };

    // --- Move Handlers ---
    const handleOpenMove = (doc) => {
        setMoveTargetDoc(doc);
        setTargetCategory(doc.category || "admissions");
        setMoveModalOpen(true);
    };

    const handleConfirmMove = async (e) => {
        e.preventDefault();
        if (!moveTargetDoc) return;

        try {
            setIsExecuting(true);
            await moveAdminDocument(moveTargetDoc._id, targetCategory);
            setNotice?.(`Moved "${moveTargetDoc.originalName}" to "${targetCategory}".`);
            setMoveModalOpen(false);
            await fetchLatestDocuments(false);
            onRefresh?.();
        } catch (err) {
            setError?.(err.message || "Failed to move document.");
        } finally {
            setIsExecuting(false);
        }
    };

    // --- Delete & 10s Undo Handlers ---
    const handleOpenDelete = (type, target, count = 1) => {
        if (type === "folder") {
            setDeleteTarget({ type: "folder", path: target, name: target, count });
        } else {
            setDeleteTarget({ type: "doc", id: target._id, name: target.originalName || target.title, count: 1 });
        }
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;

        try {
            setIsExecuting(true);
            let deletedIds = [];
            let msg = "";

            if (deleteTarget.type === "folder") {
                const res = await deleteAdminFolder(deleteTarget.path);
                deletedIds = res.data?.deletedIds || [];
                msg = `Deleted folder "${deleteTarget.name}" (${deletedIds.length} file${deletedIds.length === 1 ? "" : "s"}).`;
            } else {
                await deleteAdminDocument(deleteTarget.id);
                deletedIds = [deleteTarget.id];
                msg = `Deleted document "${deleteTarget.name}".`;
            }

            setDeleteModalOpen(false);
            await fetchLatestDocuments(false);
            onRefresh?.();

            // Setup 10s interactive Undo Toast
            if (deletedIds.length > 0) {
                if (undoTimerRef.current) clearInterval(undoTimerRef.current);
                let secondsLeft = 10;
                setUndoToast({ deletedIds, message: msg, secondsLeft });

                undoTimerRef.current = setInterval(() => {
                    secondsLeft -= 1;
                    if (secondsLeft <= 0) {
                        clearInterval(undoTimerRef.current);
                        setUndoToast(null);
                    } else {
                        setUndoToast((prev) => (prev ? { ...prev, secondsLeft } : null));
                    }
                }, 1000);
            }
        } catch (err) {
            setError?.(err.message || "Failed to delete.");
        } finally {
            setIsExecuting(false);
        }
    };

    const handleExecuteUndo = async () => {
        if (!undoToast?.deletedIds?.length) return;
        try {
            setIsExecuting(true);
            if (undoTimerRef.current) clearInterval(undoTimerRef.current);
            const ids = undoToast.deletedIds;
            setUndoToast(null);

            await bulkRestoreAdminDocuments(ids);
            setNotice?.(`Restored ${ids.length} item(s) successfully.`);
            await fetchLatestDocuments(false);
            onRefresh?.();
        } catch (err) {
            setError?.(err.message || "Failed to restore deleted items.");
        } finally {
            setIsExecuting(false);
        }
    };

    // Badge formatter for 9 lifecycle states
    const renderStatusBadge = (doc) => {
        const raw = String(doc.embeddingStatus || doc.status || "pending").toLowerCase();
        const progress = doc.progress !== undefined ? doc.progress : (["ready", "indexed", "completed"].includes(raw) ? 100 : 0);
        const stage = doc.currentStage || raw;

        if (["ready", "indexed", "completed"].includes(raw)) {
            return (
                <span className="studio-status-pill status-badge-completed" title="Indexed and verified in vector DB">
                    <CheckCircle2 size={12} />
                    <span>Completed</span>
                </span>
            );
        }
        if (["queued"].includes(raw)) {
            return (
                <span className="studio-status-pill status-badge-queued" title={`Position in queue: #${doc.queuePosition || 1}`}>
                    <Clock size={12} />
                    <span>Queued #{doc.queuePosition || 1}</span>
                </span>
            );
        }
        if (["processing", "embedding", "chunking", "indexing", "extracting"].includes(raw)) {
            return (
                <div className="status-progress-cell-wrap">
                    <span className="studio-status-pill status-badge-processing">
                        <Loader2 size={12} className="spin-icon" />
                        <span>{stage.charAt(0).toUpperCase() + stage.slice(1)}</span>
                    </span>
                    <div className="mini-progress-track">
                        <div className="mini-progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            );
        }
        if (["failed", "error"].includes(raw)) {
            const failReason = doc.failureInfo?.reason || doc.errorMessage || "Processing error";
            return (
                <span className="studio-status-pill status-badge-failed" title={failReason}>
                    <AlertTriangle size={12} />
                    <span>Failed</span>
                </span>
            );
        }
        if (["paused"].includes(raw)) {
            return (
                <span className="studio-status-pill status-badge-paused">
                    <Pause size={12} />
                    <span>Paused</span>
                </span>
            );
        }
        return (
            <span className="studio-status-pill status-badge-pending">
                <Clock size={12} />
                <span>Pending</span>
            </span>
        );
    };

    return (
        <div className="chunking-studio-master-layout">
            {/* Folder Explorer Tree Sidebar (Mission 9.1) */}
            <FolderTreeSidebar
                documents={documents}
                activeFolder={activeFolder}
                onSelectFolder={(folder) => {
                    setActiveFolder(folder);
                    setCurrentPage(1);
                }}
                onCreateFolder={handleOpenCreateFolder}
                onCreateFile={handleOpenCreateFile}
                onRenameFolder={(path) => handleOpenRename("folder", path)}
                onDeleteFolder={(path, count) => handleOpenDelete("folder", path, count)}
            />

            {/* Main Content Area */}
            <div className="chunking-studio-main">
                {/* Header */}
                <div className="chunking-studio-header">
                    <div className="studio-title-group">
                        <div className="studio-title-badge-row">
                            <h2 className="studio-title">
                                <Layers className="studio-icon" size={24} />
                                Chunking Studio
                            </h2>
                            <span className="studio-live-indicator">
                                <span className="pulse-dot"></span>
                                Live Engine
                            </span>
                        </div>
                        <p className="studio-subtitle">
                            Semantic segmentation monitor, chunk relationships, vector queue, and auto-repair
                        </p>
                    </div>

                    <div className="studio-header-actions">
                        <div className="studio-timestamp-badge" title="Timestamp of latest synchronization">
                            <Clock size={13} />
                            <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
                        </div>

                        <button
                            type="button"
                            className="studio-btn studio-btn-secondary studio-btn-icon"
                            onClick={() => fetchLatestDocuments(false)}
                            disabled={isExecuting}
                            title="Refresh counts and status"
                        >
                            <RefreshCw size={14} className={isExecuting ? "spin-icon" : ""} />
                        </button>

                        {/* Queue Monitor Trigger */}
                        <button
                            type="button"
                            className="studio-btn studio-btn-secondary"
                            onClick={() => setIsQueueOpen(true)}
                            title="View Active Workers and Queued Items"
                        >
                            <Activity size={14} />
                            <span>Queue Monitor ({statusStats.queued + statusStats.processing})</span>
                        </button>

                        {/* Integrity Audit Trigger */}
                        <button
                            type="button"
                            className="studio-btn studio-btn-secondary"
                            onClick={() => setIsIntegrityOpen(true)}
                            title="Run Knowledge Base Integrity Audit"
                        >
                            <ShieldCheck size={14} />
                            <span>Integrity & Repair</span>
                        </button>

                        {/* Retry Failed */}
                        <button
                            type="button"
                            className="studio-btn studio-btn-danger"
                            onClick={handleRetryFailed}
                            disabled={isExecuting || statusStats.failed === 0}
                        >
                            <RotateCcw size={14} />
                            <span>Retry Failed ({statusStats.failed})</span>
                        </button>

                        {/* Chunk All Pending */}
                        <button
                            type="button"
                            className="studio-btn studio-btn-primary"
                            onClick={handleChunkAllPending}
                            disabled={isExecuting || statusStats.pending + statusStats.failed === 0}
                        >
                            <Sparkles size={14} />
                            <span>Chunk All Pending ({statusStats.pending + statusStats.failed})</span>
                        </button>
                    </div>
                </div>

                {/* 4 Interactive Status Cards (Mission 9.2) */}
                <div className="studio-status-cards-grid">
                    {/* Pending */}
                    <div
                        className={`studio-status-card ${statusFilter === "pending" ? "active-filter" : ""}`}
                        onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")}
                    >
                        <div className="card-top-row">
                            <div className="card-icon-box card-icon-pending">
                                <Clock size={18} />
                            </div>
                            <span className="card-percentage">
                                {Math.round((statusStats.pending / (statusStats.total || 1)) * 100)}%
                            </span>
                        </div>
                        <div className="card-count-row">
                            <span className="card-count">{statusStats.pending}</span>
                            <span className="card-label">Pending</span>
                        </div>
                        <span className="card-subtext">Awaiting chunk segmentation</span>
                    </div>

                    {/* Processing & Queued */}
                    <div
                        className={`studio-status-card ${statusFilter === "processing" ? "active-filter" : ""}`}
                        onClick={() => setStatusFilter(statusFilter === "processing" ? "all" : "processing")}
                    >
                        <div className="card-top-row">
                            <div className="card-icon-box card-icon-processing">
                                <Loader2 size={18} className={statusStats.processing > 0 ? "spin-icon" : ""} />
                            </div>
                            <span className="card-percentage">
                                {Math.round((statusStats.processing / (statusStats.total || 1)) * 100)}%
                            </span>
                        </div>
                        <div className="card-count-row">
                            <span className="card-count">{statusStats.processing}</span>
                            <span className="card-label">Processing / Queued</span>
                        </div>
                        <span className="card-subtext">Active in background workers</span>
                    </div>

                    {/* Completed */}
                    <div
                        className={`studio-status-card ${statusFilter === "completed" ? "active-filter" : ""}`}
                        onClick={() => setStatusFilter(statusFilter === "completed" ? "all" : "completed")}
                    >
                        <div className="card-top-row">
                            <div className="card-icon-box card-icon-completed">
                                <CheckCircle2 size={18} />
                            </div>
                            <span className="card-percentage">{statusStats.progressPct}%</span>
                        </div>
                        <div className="card-count-row">
                            <span className="card-count">{statusStats.completed}</span>
                            <span className="card-label">Completed</span>
                        </div>
                        <span className="card-subtext">100% indexed in Qdrant</span>
                    </div>

                    {/* Failed */}
                    <div
                        className={`studio-status-card ${statusFilter === "failed" ? "active-filter" : ""}`}
                        onClick={() => setStatusFilter(statusFilter === "failed" ? "all" : "failed")}
                    >
                        <div className="card-top-row">
                            <div className="card-icon-box card-icon-failed">
                                <AlertTriangle size={18} />
                            </div>
                            <span className="card-percentage">
                                {Math.round((statusStats.failed / (statusStats.total || 1)) * 100)}%
                            </span>
                        </div>
                        <div className="card-count-row">
                            <span className="card-count">{statusStats.failed}</span>
                            <span className="card-label">Failed</span>
                        </div>
                        <span className="card-subtext">Extraction or embedding errors</span>
                    </div>
                </div>

                {/* Progress Ribbon */}
                <div className="studio-progress-ribbon">
                    <div className="progress-header-row">
                        <div className="progress-title-meta">
                            <span className="progress-title">Knowledge Base Segmentation Progress</span>
                            <span className="progress-meta-pill">
                                Current Scope: <strong>{activeFolder === "all" ? "All Knowledge" : activeFolder}</strong>
                            </span>
                            <span className="progress-meta-pill">
                                Total Chunks: <strong>{statusStats.totalChunks.toLocaleString()}</strong>
                            </span>
                        </div>
                        <span className="progress-pct-value">{statusStats.progressPct}% Complete</span>
                    </div>

                    <div className="studio-progress-track">
                        <div className="studio-progress-fill" style={{ width: `${statusStats.progressPct}%` }}></div>
                    </div>
                </div>

                {/* Controls Bar & Search */}
                <div className="studio-table-controls">
                    <div className="studio-search-group">
                        <div className="studio-search-wrapper">
                            <Search size={14} className="studio-search-icon" />
                            <input
                                type="text"
                                className="studio-search-input"
                                placeholder="Search by filename, category, or department..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <select
                            className="studio-filter-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Statuses ({documents.length})</option>
                            <option value="pending">Pending ({statusStats.pending})</option>
                            <option value="processing">Processing / Queued ({statusStats.processing})</option>
                            <option value="completed">Completed ({statusStats.completed})</option>
                            <option value="failed">Failed ({statusStats.failed})</option>
                        </select>
                    </div>

                    <div className="folder-quick-actions">
                        {activeFolder !== "all" && (
                            <button
                                type="button"
                                className="folder-action-chip"
                                onClick={handleChunkEntireFolder}
                                disabled={isExecuting}
                            >
                                <Play size={12} />
                                <span>Chunk Entire Folder ({filteredDocuments.length})</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Multi-Select Floating Toolbar */}
                {selectedIds.length > 0 && (
                    <div className="studio-selected-toolbar">
                        <span className="selected-toolbar-text">
                            <strong>{selectedIds.length}</strong> document{selectedIds.length > 1 ? "s" : ""} selected across pages
                        </span>
                        <div className="selected-toolbar-actions">
                            <button
                                type="button"
                                className="studio-btn studio-btn-primary"
                                onClick={handleChunkSelected}
                                disabled={isExecuting}
                            >
                                <Play size={13} />
                                <span>Chunk Selected ({selectedIds.length})</span>
                            </button>

                            <button
                                type="button"
                                className="studio-btn studio-btn-secondary"
                                onClick={handleSelectAllFiltered}
                            >
                                <span>Select All Filtered ({filteredDocuments.length})</span>
                            </button>

                            <button
                                type="button"
                                className="studio-btn studio-btn-secondary"
                                onClick={() => setSelectedIds([])}
                            >
                                <span>Clear Selection</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Table Card */}
                <div className="studio-table-card">
                    <div className="studio-table">
                        {/* Table Head */}
                        <div className="studio-thead">
                            <div className="studio-checkbox-cell">
                                <input
                                    type="checkbox"
                                    checked={isAllCurrentPageSelected}
                                    onChange={toggleSelectAll}
                                    title="Select all on this page"
                                />
                            </div>
                            <div>Status</div>
                            <div>Document Name</div>
                            <div className="studio-category-header">Category</div>
                            <div>Chunks</div>
                            <div className="studio-updated-header">Updated</div>
                            <div style={{ textAlign: "right" }}>Actions</div>
                        </div>

                        {/* Table Body */}
                        <div className="studio-tbody">
                            {paginatedDocs.length === 0 ? (
                                <div className="studio-empty-state">
                                    <Boxes size={32} />
                                    <p>No documents found matching your filter or folder criteria.</p>
                                </div>
                            ) : (
                                paginatedDocs.map((doc) => {
                                    const isSelected = selectedIds.includes(doc._id);
                                    const isRowProcessing = ["processing", "embedding", "chunking", "indexing", "queued"].includes(
                                        String(doc.embeddingStatus || doc.status || "").toLowerCase()
                                    );
                                    const fileType = getFileType(doc.originalName || doc.title || "");
                                    const chunks = Number(doc.chunksCount || doc.chunkCount || doc.metadata?.chunkCount || 0);
                                    const updatedDate = doc.updatedAt || doc.createdAt || new Date();

                                    return (
                                        <div
                                            key={doc._id}
                                            className={`studio-row ${isSelected ? "row-selected" : ""}`}
                                        >
                                            {/* Checkbox */}
                                            <div className="studio-checkbox-cell">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectDoc(doc._id)}
                                                />
                                            </div>

                                            {/* Status */}
                                            <div>{renderStatusBadge(doc)}</div>

                                            {/* Filename & Category meta */}
                                            <div className="studio-file-cell" title={doc.originalName || doc.title}>
                                                <div className={`file-type-icon-badge type-badge-${fileType.toLowerCase()}`}>
                                                    {fileType.toUpperCase().slice(0, 3)}
                                                </div>
                                                <div className="file-info-group">
                                                    <span className="file-name-text">
                                                        {doc.originalName || doc.title || "Untitled Document"}
                                                    </span>
                                                    <span className="file-folder-text">
                                                        {doc.category || doc.folder || "documents"}
                                                        {doc.department ? ` • ${doc.department}` : ""}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Category Pill */}
                                            <div className="studio-category-cell">
                                                <span className="studio-category-pill" title={doc.category || "General"}>
                                                    {doc.category || "General"}
                                                </span>
                                            </div>

                                            {/* Chunks Count */}
                                            <div className="studio-chunks-cell">
                                                {chunks > 0 ? (
                                                    <span className="chunks-badge-pill">
                                                        {chunks} chunk{chunks === 1 ? "" : "s"}
                                                    </span>
                                                ) : (
                                                    <span className="chunks-badge-empty">—</span>
                                                )}
                                            </div>

                                            {/* Updated */}
                                            <div className="studio-updated-cell">
                                                {formatDate(updatedDate)}
                                            </div>

                                            {/* Actions */}
                                            <div className="studio-actions-cell" style={{ justifyContent: "flex-end" }}>
                                                {/* Inspect Chunks Button (Mission 9.5) */}
                                                <button
                                                    type="button"
                                                    className="studio-icon-btn preview-btn"
                                                    onClick={() => setPreviewDoc(doc)}
                                                    title="Inspect Semantic Chunks & Metadata"
                                                >
                                                    <Eye size={13} />
                                                </button>

                                                {/* Rename */}
                                                <button
                                                    type="button"
                                                    className="studio-icon-btn"
                                                    onClick={() => handleOpenRename("doc", doc)}
                                                    title="Rename document"
                                                >
                                                    <Edit3 size={13} />
                                                </button>

                                                {/* Move */}
                                                <button
                                                    type="button"
                                                    className="studio-icon-btn"
                                                    onClick={() => handleOpenMove(doc)}
                                                    title="Move to another folder"
                                                >
                                                    <Move size={13} />
                                                </button>

                                                {/* Delete */}
                                                <button
                                                    type="button"
                                                    className="studio-icon-btn delete-btn"
                                                    onClick={() => handleOpenDelete("doc", doc)}
                                                    title="Delete document"
                                                >
                                                    <Trash2 size={13} />
                                                </button>

                                                {/* Chunk / Rechunk */}
                                                <button
                                                    type="button"
                                                    className="studio-row-action-btn"
                                                    onClick={async () => {
                                                        try {
                                                            setIsExecuting(true);
                                                            await enqueueChunkingDocuments([doc._id], { priority: "high" });
                                                            setNotice?.(`Enqueued "${doc.originalName}" for chunking.`);
                                                            await fetchLatestDocuments(false);
                                                            onRefresh?.();
                                                        } catch (err) {
                                                            setError?.(err.message || "Failed to chunk document.");
                                                        } finally {
                                                            setIsExecuting(false);
                                                        }
                                                    }}
                                                    disabled={isExecuting || isRowProcessing}
                                                    title="Chunk / Re-index this document"
                                                >
                                                    {isRowProcessing ? (
                                                        <Loader2 size={12} className="spin-icon" />
                                                    ) : (
                                                        <Play size={12} />
                                                    )}
                                                    <span>{chunks > 0 ? "Re-chunk" : "Chunk"}</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Pagination */}
                    <div className="studio-pagination-bar">
                        <div className="pagination-left-group">
                            <span>
                                Showing {totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
                                {Math.min(currentPage * pageSize, totalFiltered)} of {totalFiltered} files
                            </span>
                            <select
                                className="page-size-selector"
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                            >
                                <option value={20}>20 files / page</option>
                                <option value={25}>25 files / page</option>
                                <option value={50}>50 files / page</option>
                            </select>
                        </div>

                        <div className="pagination-right-buttons">
                            <button
                                type="button"
                                className="page-num-btn"
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={currentPage <= 1}
                                title="Previous Page"
                            >
                                <ChevronLeft size={14} />
                            </button>

                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pNum;
                                if (totalPages <= 5) {
                                    pNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pNum = totalPages - 4 + i;
                                } else {
                                    pNum = currentPage - 2 + i;
                                }

                                return (
                                    <button
                                        key={pNum}
                                        type="button"
                                        className={`page-num-btn ${currentPage === pNum ? "active-page" : ""}`}
                                        onClick={() => setCurrentPage(pNum)}
                                    >
                                        {pNum}
                                    </button>
                                );
                            })}

                            <button
                                type="button"
                                className="page-num-btn"
                                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={currentPage >= totalPages}
                                title="Next Page"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Modals & Drawers --- */}

            {/* Chunk Preview Drawer (Mission 9.5) */}
            <ChunkPreviewDrawer
                isOpen={!!previewDoc}
                document={previewDoc}
                onClose={() => setPreviewDoc(null)}
                onOpenDiff={(doc, chunk) => setDiffChunk({ doc, chunk })}
            />

            {/* Chunk Diff Modal (Mission 9.5) */}
            <ChunkDiffModal
                isOpen={!!diffChunk}
                document={diffChunk?.doc}
                chunk={diffChunk?.chunk}
                onClose={() => setDiffChunk(null)}
            />

            {/* Queue Monitor Drawer (Mission 9.3) */}
            <QueueMonitorDrawer
                isOpen={isQueueOpen}
                onClose={() => setIsQueueOpen(false)}
                onRefreshParent={() => fetchLatestDocuments(true)}
            />

            {/* Integrity Audit Modal (Mission 9.5) */}
            <IntegrityAuditModal
                isOpen={isIntegrityOpen}
                onClose={() => setIsIntegrityOpen(false)}
                onRefreshParent={() => fetchLatestDocuments(false)}
            />

            {/* Create Folder Modal */}
            {folderModalOpen && (
                <div className="chunk-preview-backdrop" onClick={() => setFolderModalOpen(false)}>
                    <div className="studio-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-card-header">
                            <div className="modal-title-wrap">
                                <FolderPlus size={18} />
                                <h3>Create New Folder</h3>
                            </div>
                            <button type="button" className="preview-close-btn" onClick={() => setFolderModalOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleConfirmCreateFolder} className="modal-form">
                            <div className="form-group">
                                <label>Folder Name</label>
                                <input
                                    type="text"
                                    className="studio-input"
                                    placeholder="e.g. syllabus, notices, handbook"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    autoFocus
                                />
                                {targetParentFolder && (
                                    <span className="input-hint">Will be created inside: <strong>{targetParentFolder}</strong></span>
                                )}
                            </div>
                            <div className="modal-footer-actions">
                                <button type="button" className="studio-btn studio-btn-secondary" onClick={() => setFolderModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="studio-btn studio-btn-primary" disabled={!newFolderName.trim()}>
                                    Create Folder
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Placeholder File Modal */}
            {fileModalOpen && (
                <div className="chunk-preview-backdrop" onClick={() => setFileModalOpen(false)}>
                    <div className="studio-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-card-header">
                            <div className="modal-title-wrap">
                                <Plus size={18} />
                                <h3>Create Knowledge Document Placeholder</h3>
                            </div>
                            <button type="button" className="preview-close-btn" onClick={() => setFileModalOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleConfirmCreateFile} className="modal-form">
                            <div className="form-group">
                                <label>Document Title / Filename</label>
                                <input
                                    type="text"
                                    className="studio-input"
                                    placeholder="e.g. fee_structure_2026.txt"
                                    value={newFileName}
                                    onChange={(e) => setNewFileName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label>Category / Folder</label>
                                <select
                                    className="studio-select"
                                    value={fileCategory}
                                    onChange={(e) => setFileCategory(e.target.value)}
                                >
                                    {availableCategories.map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Department</label>
                                <input
                                    type="text"
                                    className="studio-input"
                                    placeholder="e.g. Computer Science, Admissions"
                                    value={fileDepartment}
                                    onChange={(e) => setFileDepartment(e.target.value)}
                                />
                            </div>
                            <div className="modal-footer-actions">
                                <button type="button" className="studio-btn studio-btn-secondary" onClick={() => setFileModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="studio-btn studio-btn-primary" disabled={!newFileName.trim()}>
                                    Create Document
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Rename Modal */}
            {renameModalOpen && (
                <div className="chunk-preview-backdrop" onClick={() => setRenameModalOpen(false)}>
                    <div className="studio-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-card-header">
                            <div className="modal-title-wrap">
                                <Edit3 size={18} />
                                <h3>Rename {renameTarget?.type === "folder" ? "Folder" : "Document"}</h3>
                            </div>
                            <button type="button" className="preview-close-btn" onClick={() => setRenameModalOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleConfirmRename} className="modal-form">
                            <div className="form-group">
                                <label>New Name</label>
                                <input
                                    type="text"
                                    className="studio-input"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="modal-footer-actions">
                                <button type="button" className="studio-btn studio-btn-secondary" onClick={() => setRenameModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="studio-btn studio-btn-primary" disabled={!renameValue.trim()}>
                                    Save Name
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Move Document Modal */}
            {moveModalOpen && (
                <div className="chunk-preview-backdrop" onClick={() => setMoveModalOpen(false)}>
                    <div className="studio-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-card-header">
                            <div className="modal-title-wrap">
                                <Move size={18} />
                                <h3>Move Document to Folder</h3>
                            </div>
                            <button type="button" className="preview-close-btn" onClick={() => setMoveModalOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleConfirmMove} className="modal-form">
                            <div className="form-group">
                                <label>Target Folder</label>
                                <select
                                    className="studio-select"
                                    value={targetCategory}
                                    onChange={(e) => setTargetCategory(e.target.value)}
                                >
                                    {availableCategories.map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="modal-footer-actions">
                                <button type="button" className="studio-btn studio-btn-secondary" onClick={() => setMoveModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="studio-btn studio-btn-primary">
                                    Move Document
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalOpen && (
                <div className="chunk-preview-backdrop" onClick={() => setDeleteModalOpen(false)}>
                    <div className="studio-modal-card danger-card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-card-header">
                            <div className="modal-title-wrap">
                                <Trash2 size={18} style={{ color: "#ef4444" }} />
                                <h3>Confirm Deletion</h3>
                            </div>
                            <button type="button" className="preview-close-btn" onClick={() => setDeleteModalOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className="modal-form">
                            <p className="delete-confirm-text">
                                Are you sure you want to delete{" "}
                                <strong>{deleteTarget?.name}</strong>?
                            </p>
                            {deleteTarget?.type === "folder" && deleteTarget?.count > 0 && (
                                <div className="delete-warning-box">
                                    <AlertTriangle size={15} />
                                    <span>
                                        Warning: This folder contains <strong>{deleteTarget.count}</strong> document(s). All child documents will be moved to the trash bin.
                                    </span>
                                </div>
                            )}
                            <p className="delete-undo-note">
                                (You can undo this deletion for 10 seconds via the toast banner.)
                            </p>
                            <div className="modal-footer-actions">
                                <button type="button" className="studio-btn studio-btn-secondary" onClick={() => setDeleteModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="button" className="studio-btn studio-btn-danger" onClick={handleConfirmDelete}>
                                    Delete {deleteTarget?.type === "folder" ? "Folder & Contents" : "Document"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 10s Interactive Undo Toast */}
            {undoToast && (
                <div className="undo-toast-banner">
                    <div className="undo-toast-left">
                        <Trash2 size={16} className="undo-trash-icon" />
                        <span className="undo-msg">{undoToast.message}</span>
                    </div>
                    <div className="undo-toast-right">
                        <button type="button" className="undo-action-btn" onClick={handleExecuteUndo}>
                            <Undo2 size={14} />
                            <span>Undo ({undoToast.secondsLeft}s)</span>
                        </button>
                        <button type="button" className="undo-dismiss-btn" onClick={() => setUndoToast(null)}>
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
