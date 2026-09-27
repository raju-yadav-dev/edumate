import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
    Folder,
    FolderOpen,
    FolderPlus,
    FileText,
    FileCode,
    FileType,
    Play,
    RotateCcw,
    Trash2,
    Eye,
    Layers,
    MoreVertical,
    Upload,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Plus,
    Check,
    X,
    Database,
    HardDrive,
    Sparkles,
    SlidersHorizontal,
    ArrowUpDown,
    Download
} from "lucide-react";
import StorageTree from "./StorageTree";
import StorageBreadcrumb from "./StorageBreadcrumb";
import StorageToolbar from "./StorageToolbar";
import FolderContextMenu from "./FolderContextMenu";
import FileContextMenu from "./FileContextMenu";
import ChunkDrawer from "./ChunkDrawer";
import FilePreviewDrawer from "./FilePreviewDrawer";
import { formatBytes } from "../../utils/formatBytes";
import { formatDate } from "../../utils/formatData";
import {
    getLocalStorageTree,
    syncLocalStorage,
    enqueueChunkingDocuments,
    createStorageFolder,
    deleteStorageFolder,
    deleteStorageFile,
    renameStorageItem,
    chunkStorageFolder,
    uploadFilesToStorageFolder,
    deleteAdminDocument
} from "../../../services/adminService";

/**
 * StorageExplorer — Windows 11 / VS Code Style Knowledge File Explorer (Mission 15.3)
 * 
 * Master Two-Panel Architecture:
 * - Left Panel: Recursive Folder Tree (`edumate / storage / ...`)
 * - Right Panel: Detailed Folder Contents (Breadcrumbs, Command Bar, Grid/List, Context Menus, Drawers)
 */
export default function StorageExplorer({
    documents = [],
    onRefresh,
    setNotice,
    setError,
    isSseConnected = false
}) {
    // 1. Core Navigation State
    const [treeData, setTreeData] = useState([]);
    const [stats, setStats] = useState({});
    const [activePath, setActivePath] = useState("storage");
    const [isLoadingTree, setIsLoadingTree] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);

    // 2. Toolbar & View Options
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sortBy, setSortBy] = useState("name");
    const [sortOrder, setSortOrder] = useState("asc");
    const [viewMode, setViewMode] = useState("list"); // list | grid

    // 3. Selection & Multi-select State
    const [selectedPaths, setSelectedPaths] = useState([]);
    const [lastSelectedIndex, setLastSelectedIndex] = useState(null);

    // 4. Drag & Drop Upload State
    const [isDragOverMain, setIsDragOverMain] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(null); // { percent, totalFiles, currentFile }
    const fileInputRef = useRef(null);

    // 5. Context Menus State
    const [folderContext, setFolderContext] = useState(null); // { x, y, folder }
    const [fileContext, setFileContext] = useState(null); // { x, y, file }

    // 6. Drawers State
    const [previewTarget, setPreviewTarget] = useState(null);
    const [chunkTarget, setChunkTarget] = useState(null);

    // 7. Modals State
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [targetParentFolder, setTargetParentFolder] = useState("");
    const [renameTarget, setRenameTarget] = useState(null);
    const [renameNewName, setRenameNewName] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);

    // ----------------------------------------------------
    // Load Dynamic Storage Tree from Filesystem
    // ----------------------------------------------------
    const loadTree = useCallback(async (silent = false) => {
        try {
            if (!silent) setIsLoadingTree(true);
            const res = await getLocalStorageTree();
            if (res.data) {
                setTreeData(res.data.tree || []);
                setStats(res.data.stats || {});
            } else if (res.tree) {
                setTreeData(res.tree || []);
                setStats(res.stats || {});
            }
        } catch (err) {
            console.error("[StorageExplorer] Tree load error:", err);
            if (typeof setError === "function") setError(err.message);
        } finally {
            if (!silent) setIsLoadingTree(false);
        }
    }, [setError]);

    useEffect(() => {
        loadTree();
    }, [loadTree]);

    // ----------------------------------------------------
    // Locate Active Folder Node in Tree
    // ----------------------------------------------------
    const currentFolderNode = useMemo(() => {
        if (!activePath || activePath === "storage" || activePath === "all") {
            // Root storage node
            const rootFiles = treeData.filter(item => item.type === "file");
            const rootFolders = treeData.filter(item => item.type === "folder");
            return {
                name: "storage",
                path: "storage",
                type: "folder",
                isRoot: true,
                children: treeData,
                files: rootFiles,
                subfolders: rootFolders
            };
        }

        const findNode = (nodes, targetPath) => {
            if (!Array.isArray(nodes)) return null;
            for (const node of nodes) {
                if (node.path === targetPath) return node;
                if (node.children) {
                    const found = findNode(node.children, targetPath);
                    if (found) return found;
                }
            }
            return null;
        };

        const node = findNode(treeData, activePath);
        if (!node) {
            return {
                name: activePath.split("/").pop() || activePath,
                path: activePath,
                type: "folder",
                children: [],
                files: [],
                subfolders: []
            };
        }

        const files = (node.children || []).filter(c => c.type === "file");
        const subfolders = (node.children || []).filter(c => c.type === "folder");
        return {
            ...node,
            files,
            subfolders
        };
    }, [treeData, activePath]);

    // ----------------------------------------------------
    // Current Folder Files (Enriched with Live MongoDB Documents)
    // ----------------------------------------------------
    const currentFiles = useMemo(() => {
        const rawFiles = currentFolderNode.files || [];
        const docMap = new Map();
        documents.forEach((d) => {
            const rel = String(d.storagePath || d.metadata?.localRelativePath || d.originalName).toLowerCase().replace(/\\/g, "/");
            docMap.set(rel, d);
            docMap.set(d.originalName?.toLowerCase(), d);
        });

        return rawFiles.map((f) => {
            const relKey = String(f.path || f.name).toLowerCase().replace(/\\/g, "/");
            const doc = docMap.get(relKey) || docMap.get(f.name.toLowerCase());
            return {
                ...f,
                documentId: doc?._id || f.documentId || null,
                embeddingStatus: doc?.embeddingStatus || f.embeddingStatus || "unindexed",
                indexedChunks: doc?.chunkStats?.indexedChunks ?? f.indexedChunks ?? 0,
                totalChunks: doc?.chunkStats?.totalChunks ?? f.totalChunks ?? 0,
                category: doc?.category || f.category || activePath.split("/")[0] || "general",
                department: doc?.department || f.department || "",
                progress: doc?.progress || 0,
                currentStage: doc?.currentStage || ""
            };
        });
    }, [currentFolderNode, documents, activePath]);

    // ----------------------------------------------------
    // Folder Statistics Metrics
    // ----------------------------------------------------
    const folderStats = useMemo(() => {
        let totalFiles = currentFiles.length;
        let pdfs = 0;
        let totalSize = 0;
        let completed = 0;
        let pending = 0;
        let failed = 0;

        currentFiles.forEach((file) => {
            if (file.extension === ".pdf") pdfs++;
            totalSize += file.size || 0;
            const st = String(file.embeddingStatus || "").toLowerCase();
            if (st === "completed" || st === "indexed") completed++;
            else if (st === "failed") failed++;
            else pending++;
        });

        return {
            totalFiles,
            pdfs,
            totalSize,
            completed,
            pending,
            failed,
            subfoldersCount: currentFolderNode.subfolders?.length || 0
        };
    }, [currentFiles, currentFolderNode]);

    // ----------------------------------------------------
    // Filtered & Sorted File Items
    // ----------------------------------------------------
    const displayedFiles = useMemo(() => {
        let list = [...currentFiles];

        // 1. Search Query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(f => f.name.toLowerCase().includes(q));
        }

        // 2. Status Filter
        if (statusFilter !== "all") {
            list = list.filter((f) => {
                const st = String(f.embeddingStatus || "").toLowerCase();
                if (statusFilter === "completed") return st === "completed" || st === "indexed";
                if (statusFilter === "queued") return st === "queued" || st === "processing";
                if (statusFilter === "pending") return st === "pending" || st === "unindexed";
                if (statusFilter === "failed") return st === "failed";
                return true;
            });
        }

        // 3. Sorting
        list.sort((a, b) => {
            let res = 0;
            if (sortBy === "name") {
                res = a.name.localeCompare(b.name);
            } else if (sortBy === "size") {
                res = (a.size || 0) - (b.size || 0);
            } else if (sortBy === "mtime") {
                res = new Date(a.mtime || 0) - new Date(b.mtime || 0);
            } else if (sortBy === "status") {
                res = String(a.embeddingStatus || "").localeCompare(String(b.embeddingStatus || ""));
            }
            return sortOrder === "desc" ? -res : res;
        });

        return list;
    }, [currentFiles, searchQuery, statusFilter, sortBy, sortOrder]);

    // ----------------------------------------------------
    // Multi-Selection Logic (Shift / Ctrl / Click)
    // ----------------------------------------------------
    const handleFileClick = (e, file, index) => {
        e.stopPropagation();
        const fileKey = file.path || file.name;

        if (e.shiftKey && lastSelectedIndex !== null) {
            // Range selection
            const start = Math.min(lastSelectedIndex, index);
            const end = Math.max(lastSelectedIndex, index);
            const rangeKeys = displayedFiles.slice(start, end + 1).map(f => f.path || f.name);
            setSelectedPaths(Array.from(new Set([...selectedPaths, ...rangeKeys])));
        } else if (e.ctrlKey || e.metaKey) {
            // Toggle selection
            setSelectedPaths((prev) =>
                prev.includes(fileKey) ? prev.filter(p => p !== fileKey) : [...prev, fileKey]
            );
            setLastSelectedIndex(index);
        } else {
            // Single select / unselect
            setSelectedPaths([fileKey]);
            setLastSelectedIndex(index);
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedPaths(displayedFiles.map(f => f.path || f.name));
        } else {
            setSelectedPaths([]);
        }
    };

    // Keyboard Shortcuts (Ctrl+A, Escape)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "a" && !["INPUT", "TEXTAREA"].includes(e.target.tagName)) {
                e.preventDefault();
                setSelectedPaths(displayedFiles.map(f => f.path || f.name));
            } else if (e.key === "Escape") {
                setSelectedPaths([]);
                setFolderContext(null);
                setFileContext(null);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [displayedFiles]);

    // ----------------------------------------------------
    // Drag & Drop Upload Handlers
    // ----------------------------------------------------
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragOverMain) setIsDragOverMain(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOverMain(false);
    };

    const handleDropUpload = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOverMain(false);

        if (e.dataTransfer?.files?.length > 0) {
            await executeUpload(e.dataTransfer.files, activePath === "storage" ? "others" : activePath);
        }
    };

    const executeUpload = async (files, folderPath) => {
        try {
            setIsExecuting(true);
            setUploadProgress({ percent: 10, totalFiles: files.length });

            const targetFolder = folderPath === "storage" ? "others" : folderPath;
            await uploadFilesToStorageFolder(files, targetFolder, {
                autoChunk: true,
                onProgress: (percent) => {
                    setUploadProgress({ percent, totalFiles: files.length });
                }
            });

            if (typeof setNotice === "function") {
                setNotice(`Successfully uploaded ${files.length} document(s) to [storage/${targetFolder}].`);
            }
            await loadTree(true);
            if (typeof onRefresh === "function") onRefresh();
        } catch (err) {
            console.error("[StorageExplorer] Upload error:", err);
            if (typeof setError === "function") setError(err.message);
        } finally {
            setUploadProgress(null);
            setIsExecuting(false);
        }
    };

    // ----------------------------------------------------
    // Operations & Actions
    // ----------------------------------------------------
    const handleChunkFolder = async (folderPath = activePath, force = false) => {
        try {
            setIsExecuting(true);
            const targetFolder = folderPath === "storage" ? "" : folderPath;
            const res = await chunkStorageFolder(targetFolder, force);
            if (typeof setNotice === "function") {
                setNotice(res.message || `Queued ${res.data?.enqueuedCount || 0} document(s) for chunking.`);
            }
            if (typeof onRefresh === "function") onRefresh();
        } catch (err) {
            if (typeof setError === "function") setError(err.message);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleChunkSelectedFiles = async (force = false) => {
        try {
            setIsExecuting(true);
            const selectedDocs = displayedFiles
                .filter(f => selectedPaths.includes(f.path || f.name))
                .map(f => f.documentId)
                .filter(Boolean);

            if (selectedDocs.length === 0) {
                // If files aren't in database yet, trigger sync first
                await syncLocalStorage();
                await loadTree(true);
                return;
            }

            await enqueueChunkingDocuments(selectedDocs, { forceRechunk: force });
            if (typeof setNotice === "function") {
                setNotice(`Enqueued ${selectedDocs.length} selected document(s) for chunking.`);
            }
            setSelectedPaths([]);
            if (typeof onRefresh === "function") onRefresh();
        } catch (err) {
            if (typeof setError === "function") setError(err.message);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleScanSyncStorage = async () => {
        try {
            setIsExecuting(true);
            const res = await syncLocalStorage();
            if (typeof setNotice === "function") {
                setNotice(`Storage synchronized: ${res.data?.registeredCount || 0} newly registered document(s).`);
            }
            await loadTree();
            if (typeof onRefresh === "function") onRefresh();
        } catch (err) {
            if (typeof setError === "function") setError(err.message);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleCreateFolder = async (e) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;

        try {
            setIsExecuting(true);
            const cleanName = newFolderName.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
            const parent = targetParentFolder && targetParentFolder !== "storage" ? targetParentFolder : "";
            const targetPath = parent ? `${parent}/${cleanName}` : cleanName;

            await createStorageFolder(targetPath);
            if (typeof setNotice === "function") setNotice(`Created folder: storage/${targetPath}`);
            setIsCreateFolderOpen(false);
            setNewFolderName("");
            await loadTree();
            setActivePath(targetPath);
        } catch (err) {
            if (typeof setError === "function") setError(err.message);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleRenameSubmit = async (e) => {
        e.preventDefault();
        if (!renameTarget || !renameNewName.trim()) return;

        try {
            setIsExecuting(true);
            const parent = renameTarget.path.includes("/")
                ? renameTarget.path.substring(0, renameTarget.path.lastIndexOf("/"))
                : "";
            const cleanNewName = renameNewName.trim();
            const newPath = parent ? `${parent}/${cleanNewName}` : cleanNewName;

            await renameStorageItem(renameTarget.path, newPath);
            if (typeof setNotice === "function") setNotice(`Renamed to: ${newPath}`);
            setRenameTarget(null);
            setRenameNewName("");
            await loadTree();
            if (activePath === renameTarget.path) setActivePath(newPath);
            if (typeof onRefresh === "function") onRefresh();
        } catch (err) {
            if (typeof setError === "function") setError(err.message);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleDeleteSubmit = async () => {
        if (!deleteTarget) return;

        try {
            setIsExecuting(true);
            if (deleteTarget.type === "folder") {
                await deleteStorageFolder(deleteTarget.path);
                if (typeof setNotice === "function") setNotice(`Deleted folder: ${deleteTarget.path}`);
                if (activePath === deleteTarget.path) setActivePath("storage");
            } else {
                await deleteStorageFile(deleteTarget.path || deleteTarget.name);
                if (typeof setNotice === "function") setNotice(`Deleted file: ${deleteTarget.name}`);
            }
            setDeleteTarget(null);
            await loadTree();
            if (typeof onRefresh === "function") onRefresh();
        } catch (err) {
            if (typeof setError === "function") setError(err.message);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleBatchDeleteSelected = async () => {
        if (selectedPaths.length === 0) return;
        if (!window.confirm(`Delete ${selectedPaths.length} selected file(s) from storage disk?`)) return;

        try {
            setIsExecuting(true);
            for (const path of selectedPaths) {
                await deleteStorageFile(path);
            }
            if (typeof setNotice === "function") setNotice(`Deleted ${selectedPaths.length} file(s).`);
            setSelectedPaths([]);
            await loadTree();
            if (typeof onRefresh === "function") onRefresh();
        } catch (err) {
            if (typeof setError === "function") setError(err.message);
        } finally {
            setIsExecuting(false);
        }
    };

    // ----------------------------------------------------
    // Render Helper: File Icon Resolver
    // ----------------------------------------------------
    const renderFileIcon = (ext) => {
        const clean = (ext || "").toLowerCase();
        if (clean === ".pdf") return <FileText size={18} className="file-icon-pdf" />;
        if ([".docx", ".doc"].includes(clean)) return <FileText size={18} className="file-icon-docx" />;
        if ([".md", ".txt", ".markdown"].includes(clean)) return <FileCode size={18} className="file-icon-md" />;
        return <FileType size={18} className="file-icon-default" />;
    };

    return (
        <div
            className="storage-explorer-master-wrapper"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDropUpload}
            onClick={() => {
                setFolderContext(null);
                setFileContext(null);
            }}
        >
            {/* Drag & Drop Visual Overlay */}
            {isDragOverMain && (
                <div className="storage-drop-overlay">
                    <div className="drop-target-modal">
                        <Upload size={48} className="text-neon-cyan animate-bounce" />
                        <h3>Drop Files to Upload</h3>
                        <p>Uploading to: <code>storage/{activePath === "storage" ? "others" : activePath}</code></p>
                    </div>
                </div>
            )}

            {/* Hidden Input for Manual File Upload */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.md,.markdown"
                style={{ display: "none" }}
                onChange={(e) => {
                    if (e.target.files?.length > 0) {
                        executeUpload(e.target.files, activePath === "storage" ? "others" : activePath);
                    }
                }}
            />

            {/* Split Panel 1: Left Sidebar (Recursive Folder Tree) */}
            <StorageTree
                treeData={treeData}
                stats={stats}
                activePath={activePath}
                onSelectFolder={(path) => {
                    setActivePath(path);
                    setSelectedPaths([]);
                }}
                onCreateFolder={(parentPath) => {
                    setTargetParentFolder(parentPath || activePath);
                    setIsCreateFolderOpen(true);
                }}
                onRefreshTree={() => loadTree()}
                onContextMenu={(e, folder) => {
                    setFileContext(null);
                    setFolderContext({ x: e.clientX, y: e.clientY, folder });
                }}
                onDropFiles={(files, destPath) => executeUpload(files, destPath)}
                isLoading={isLoadingTree}
            />

            {/* Split Panel 2: Right Main Panel (Folder Contents & Actions) */}
            <main className="storage-explorer-content-panel">
                {/* 1. Navigational Breadcrumbs Bar */}
                <StorageBreadcrumb
                    activePath={activePath}
                    onNavigate={(path) => {
                        setActivePath(path);
                        setSelectedPaths([]);
                    }}
                    itemCount={displayedFiles.length + (currentFolderNode.subfolders?.length || 0)}
                    selectedCount={selectedPaths.length}
                    totalSizeBytes={folderStats.totalSize}
                />

                {/* 2. Command & Action Toolbar */}
                <StorageToolbar
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortChange={(field, order) => {
                        setSortBy(field);
                        setSortOrder(order);
                    }}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    selectedCount={selectedPaths.length}
                    totalCount={displayedFiles.length}
                    isAllSelected={displayedFiles.length > 0 && selectedPaths.length === displayedFiles.length}
                    onSelectAll={handleSelectAll}
                    onUploadClick={() => fileInputRef.current?.click()}
                    onCreateFolderClick={() => {
                        setTargetParentFolder(activePath);
                        setIsCreateFolderOpen(true);
                    }}
                    onChunkFolderClick={() => {
                        if (selectedPaths.length > 0) {
                            handleChunkSelectedFiles(false);
                        } else {
                            handleChunkFolder(activePath, false);
                        }
                    }}
                    onReindexFolderClick={() => {
                        if (selectedPaths.length > 0) {
                            handleChunkSelectedFiles(true);
                        } else {
                            handleChunkFolder(activePath, true);
                        }
                    }}
                    onSyncStorageClick={handleScanSyncStorage}
                    onBatchDeleteClick={handleBatchDeleteSelected}
                    isExecuting={isExecuting}
                    activeFolder={activePath}
                />

                {/* 3. Folder Statistics Summary Ribbon */}
                <div className="storage-folder-stats-ribbon">
                    <div className="stat-pill">
                        <span className="stat-pill-label">Files</span>
                        <strong className="stat-pill-val text-neon-cyan">{folderStats.totalFiles}</strong>
                    </div>
                    <div className="stat-pill">
                        <span className="stat-pill-label">PDFs</span>
                        <strong className="stat-pill-val">{folderStats.pdfs}</strong>
                    </div>
                    <div className="stat-pill">
                        <span className="stat-pill-label">Total Size</span>
                        <strong className="stat-pill-val">{formatBytes(folderStats.totalSize)}</strong>
                    </div>
                    <div className="stat-pill">
                        <span className="stat-pill-label">Indexed in Qdrant</span>
                        <strong className="stat-pill-val text-neon-green">{folderStats.completed}</strong>
                    </div>
                    {folderStats.pending > 0 && (
                        <div className="stat-pill">
                            <span className="stat-pill-label">Pending</span>
                            <strong className="stat-pill-val text-amber-400">{folderStats.pending}</strong>
                        </div>
                    )}
                    {folderStats.failed > 0 && (
                        <div className="stat-pill">
                            <span className="stat-pill-label">Failed</span>
                            <strong className="stat-pill-val text-red-400">{folderStats.failed}</strong>
                        </div>
                    )}
                </div>

                {/* Upload Progress Bar (Active Transfer) */}
                {uploadProgress && (
                    <div className="upload-transfer-banner">
                        <div className="transfer-header">
                            <span>Uploading {uploadProgress.totalFiles} document(s)...</span>
                            <strong>{uploadProgress.percent}%</strong>
                        </div>
                        <div className="transfer-track">
                            <div className="transfer-fill" style={{ width: `${uploadProgress.percent}%` }} />
                        </div>
                    </div>
                )}

                {/* 4. Subfolders Cards Grid (if subfolders exist) */}
                {currentFolderNode.subfolders?.length > 0 && (
                    <div className="subfolders-section">
                        <h4 className="section-title">Folders ({currentFolderNode.subfolders.length})</h4>
                        <div className="subfolders-grid">
                            {currentFolderNode.subfolders.map((folder) => (
                                <div
                                    key={folder.path || folder.name}
                                    className="subfolder-card"
                                    onClick={() => setActivePath(folder.path)}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setFileContext(null);
                                        setFolderContext({ x: e.clientX, y: e.clientY, folder });
                                    }}
                                >
                                    <Folder className="subfolder-icon text-neon-green" size={22} />
                                    <div className="subfolder-info">
                                        <span className="subfolder-name" title={folder.name}>
                                            {folder.name}
                                        </span>
                                        <span className="subfolder-meta">
                                            {folder.fileCount || 0} file(s)
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 5. File Items (List View Table OR Grid View Tiles) */}
                <div className="folder-contents-view scrollable-panel">
                    {displayedFiles.length === 0 ? (
                        <div className="empty-folder-state">
                            <FileText size={48} className="text-gray" />
                            <h3>No Documents in this Directory</h3>
                            <p>Drag and drop PDF, DOCX, Markdown, or TXT files here to upload.</p>
                            <button
                                type="button"
                                className="studio-btn btn-primary"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload size={14} />
                                <span>Upload Document</span>
                            </button>
                        </div>
                    ) : viewMode === "list" ? (
                        /* LIST TABLE VIEW */
                        <table className="storage-files-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "36px" }}>
                                        <input
                                            type="checkbox"
                                            checked={
                                                displayedFiles.length > 0 &&
                                                selectedPaths.length === displayedFiles.length
                                            }
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                    <th>File Name</th>
                                    <th>Type</th>
                                    <th>Size</th>
                                    <th>Modified</th>
                                    <th>Status</th>
                                    <th>Chunks</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedFiles.map((file, idx) => {
                                    const fileKey = file.path || file.name;
                                    const isSelected = selectedPaths.includes(fileKey);
                                    const st = String(file.embeddingStatus || "unindexed").toLowerCase();
                                    const isDone = st === "completed" || st === "indexed";

                                    return (
                                        <tr
                                            key={fileKey}
                                            className={`file-table-row ${isSelected ? "selected-row" : ""}`}
                                            onClick={(e) => handleFileClick(e, file, idx)}
                                            onDoubleClick={() => setPreviewTarget(file)}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setFolderContext(null);
                                                setFileContext({ x: e.clientX, y: e.clientY, file });
                                            }}
                                        >
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedPaths((prev) =>
                                                            prev.includes(fileKey)
                                                                ? prev.filter(p => p !== fileKey)
                                                                : [...prev, fileKey]
                                                        );
                                                    }}
                                                />
                                            </td>
                                            <td className="file-name-cell">
                                                {renderFileIcon(file.extension)}
                                                <span className="file-name-text" title={file.name}>
                                                    {file.name}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="file-type-pill">
                                                    {(file.extension || "").toUpperCase().replace(".", "") || "FILE"}
                                                </span>
                                            </td>
                                            <td className="file-size-cell">{formatBytes(file.size)}</td>
                                            <td className="file-date-cell">{formatDate(file.mtime)}</td>
                                            <td>
                                                <span className={`badge-status status-${st}`}>
                                                    {isDone ? "Indexed" : st}
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="chunk-count-link-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setChunkTarget(file);
                                                    }}
                                                    title="Inspect Chunks in Drawer"
                                                >
                                                    <Layers size={12} />
                                                    <span>{file.totalChunks || file.indexedChunks || 0}</span>
                                                </button>
                                            </td>
                                            <td>
                                                <div className="file-action-buttons">
                                                    <button
                                                        type="button"
                                                        className="action-icon-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setPreviewTarget(file);
                                                        }}
                                                        title="Preview File"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="action-icon-btn"
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (file.documentId) {
                                                                await enqueueChunkingDocuments([file.documentId], { forceRechunk: true });
                                                            } else {
                                                                await syncLocalStorage();
                                                            }
                                                            if (typeof setNotice === "function") setNotice(`Queued "${file.name}" for re-chunking.`);
                                                            if (typeof onRefresh === "function") onRefresh();
                                                        }}
                                                        title="Re-chunk Document"
                                                    >
                                                        <RotateCcw size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="action-icon-btn danger"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeleteTarget({ ...file, type: "file" });
                                                        }}
                                                        title="Delete File"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        /* GRID TILES VIEW */
                        <div className="storage-files-grid">
                            {displayedFiles.map((file, idx) => {
                                const fileKey = file.path || file.name;
                                const isSelected = selectedPaths.includes(fileKey);
                                const st = String(file.embeddingStatus || "unindexed").toLowerCase();
                                const isDone = st === "completed" || st === "indexed";

                                return (
                                    <div
                                        key={fileKey}
                                        className={`file-grid-card ${isSelected ? "selected-card" : ""}`}
                                        onClick={(e) => handleFileClick(e, file, idx)}
                                        onDoubleClick={() => setPreviewTarget(file)}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setFolderContext(null);
                                            setFileContext({ x: e.clientX, y: e.clientY, file });
                                        }}
                                    >
                                        <div className="card-top-row">
                                            {renderFileIcon(file.extension)}
                                            <span className={`badge-status status-${st}`}>
                                                {isDone ? "Indexed" : st}
                                            </span>
                                        </div>

                                        <div className="card-body">
                                            <h4 className="card-file-name" title={file.name}>
                                                {file.name}
                                            </h4>
                                            <div className="card-meta-line">
                                                <span>{formatBytes(file.size)}</span>
                                                <span>•</span>
                                                <span>{file.totalChunks || 0} chunks</span>
                                            </div>
                                        </div>

                                        <div className="card-actions-row">
                                            <button
                                                type="button"
                                                className="card-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPreviewTarget(file);
                                                }}
                                                title="Preview File"
                                            >
                                                <Eye size={13} />
                                                <span>Preview</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="card-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setChunkTarget(file);
                                                }}
                                                title="View Chunks"
                                            >
                                                <Layers size={13} />
                                                <span>Chunks</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            {/* Context Menus */}
            {folderContext && (
                <FolderContextMenu
                    x={folderContext.x}
                    y={folderContext.y}
                    folder={folderContext.folder}
                    onClose={() => setFolderContext(null)}
                    onUploadHere={(folderPath) => {
                        setTargetParentFolder(folderPath);
                        fileInputRef.current?.click();
                    }}
                    onScanFolder={async () => {
                        await syncLocalStorage();
                        await loadTree();
                    }}
                    onChunkFolder={(folderPath, force) => handleChunkFolder(folderPath, force)}
                    onReindexFolder={(folderPath, force) => handleChunkFolder(folderPath, force)}
                    onRefresh={() => loadTree()}
                    onRename={(folder) => {
                        setRenameTarget({ ...folder, type: "folder" });
                        setRenameNewName(folder.name);
                    }}
                    onDelete={(folder) => setDeleteTarget({ ...folder, type: "folder" })}
                    onNewSubfolder={(folderPath) => {
                        setTargetParentFolder(folderPath);
                        setIsCreateFolderOpen(true);
                    }}
                />
            )}

            {fileContext && (
                <FileContextMenu
                    x={fileContext.x}
                    y={fileContext.y}
                    file={fileContext.file}
                    onClose={() => setFileContext(null)}
                    onPreview={(file) => setPreviewTarget(file)}
                    onViewChunks={(file) => setChunkTarget(file)}
                    onRechunk={async (file) => {
                        if (file.documentId) {
                            await enqueueChunkingDocuments([file.documentId], { forceRechunk: true });
                        }
                        if (typeof setNotice === "function") setNotice(`Queued "${file.name}" for rechunking.`);
                        if (typeof onRefresh === "function") onRefresh();
                    }}
                    onReEmbed={async (file) => {
                        if (file.documentId) {
                            await enqueueChunkingDocuments([file.documentId], { forceRechunk: true });
                        }
                    }}
                    onReindexQdrant={async (file) => {
                        if (file.documentId) {
                            await enqueueChunkingDocuments([file.documentId], { forceRechunk: true });
                        }
                    }}
                    onDelete={(file) => setDeleteTarget({ ...file, type: "file" })}
                />
            )}

            {/* Drawers */}
            <FilePreviewDrawer
                isOpen={!!previewTarget}
                onClose={() => setPreviewTarget(null)}
                file={previewTarget}
                onViewChunks={(file) => {
                    setPreviewTarget(null);
                    setChunkTarget(file);
                }}
                onRechunk={async (file) => {
                    if (file.documentId) {
                        await enqueueChunkingDocuments([file.documentId], { forceRechunk: true });
                    }
                    if (typeof setNotice === "function") setNotice(`Re-chunking "${file.name}"...`);
                }}
                onDelete={(file) => {
                    setPreviewTarget(null);
                    setDeleteTarget({ ...file, type: "file" });
                }}
            />

            <ChunkDrawer
                isOpen={!!chunkTarget}
                onClose={() => setChunkTarget(null)}
                file={chunkTarget}
                onRechunk={async (file) => {
                    if (file.documentId) {
                        await enqueueChunkingDocuments([file.documentId], { forceRechunk: true });
                    }
                }}
                onReindexQdrant={async (file) => {
                    if (file.documentId) {
                        await enqueueChunkingDocuments([file.documentId], { forceRechunk: true });
                    }
                }}
            />

            {/* Modal 1: Create New Folder */}
            {isCreateFolderOpen && (
                <div className="modal-backdrop" onClick={() => setIsCreateFolderOpen(false)}>
                    <div className="modal-dialog-box neo-card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <FolderPlus size={20} className="text-neon-cyan" />
                            <h3>Create New Folder</h3>
                            <button
                                type="button"
                                className="modal-close-btn"
                                onClick={() => setIsCreateFolderOpen(false)}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateFolder}>
                            <div className="modal-body">
                                <label className="form-label">
                                    Location: <code>storage/{targetParentFolder || "root"}</code>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. computer_science or semester_1"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    autoFocus
                                    required
                                    className="form-input"
                                />
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="studio-btn btn-secondary"
                                    onClick={() => setIsCreateFolderOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="studio-btn btn-primary"
                                    disabled={!newFolderName.trim() || isExecuting}
                                >
                                    Create Folder
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 2: Rename File / Folder */}
            {renameTarget && (
                <div className="modal-backdrop" onClick={() => setRenameTarget(null)}>
                    <div className="modal-dialog-box neo-card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Rename {renameTarget.type === "folder" ? "Folder" : "File"}</h3>
                            <button
                                type="button"
                                className="modal-close-btn"
                                onClick={() => setRenameTarget(null)}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleRenameSubmit}>
                            <div className="modal-body">
                                <label className="form-label">New Name:</label>
                                <input
                                    type="text"
                                    value={renameNewName}
                                    onChange={(e) => setRenameNewName(e.target.value)}
                                    autoFocus
                                    required
                                    className="form-input"
                                />
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="studio-btn btn-secondary"
                                    onClick={() => setRenameTarget(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="studio-btn btn-primary"
                                    disabled={!renameNewName.trim() || isExecuting}
                                >
                                    Save Rename
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 3: Delete Confirmation */}
            {deleteTarget && (
                <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
                    <div className="modal-dialog-box neo-card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <Trash2 size={20} className="text-red-400" />
                            <h3>Delete {deleteTarget.type === "folder" ? "Folder" : "File"}?</h3>
                            <button
                                type="button"
                                className="modal-close-btn"
                                onClick={() => setDeleteTarget(null)}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>
                                Are you sure you want to delete <strong>{deleteTarget.name}</strong> from local storage?
                            </p>
                            {deleteTarget.type === "folder" ? (
                                <p className="warning-text text-amber-400">
                                    ⚠️ This will recursively remove all documents and vectors inside this folder.
                                </p>
                            ) : (
                                <p className="warning-text text-gray-400">
                                    This file, its extracted chunks, and Qdrant vectors will be purged.
                                </p>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button
                                type="button"
                                className="studio-btn btn-secondary"
                                onClick={() => setDeleteTarget(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="studio-btn btn-danger"
                                onClick={handleDeleteSubmit}
                                disabled={isExecuting}
                            >
                                Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
