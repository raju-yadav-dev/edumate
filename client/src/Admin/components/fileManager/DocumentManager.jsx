import {
    Download,
    Filter,
    FolderPlus,
    Grid2X2,
    List,
    RefreshCcw,
    Search,
    Trash2,
    UploadCloud,
    Copy,
    Scissors,
    Clipboard,
    Undo2,
    Redo2,
    ChevronRight,
    Play,
    Pause,
    Trash,
    Loader2,
    FolderMinus,
    X
} from "lucide-react";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";

import { formatBytes } from "../../utils/formatBytes";
import ContextMenu from "./ContextMenu";
import FileTable from "./FileTable";
import FolderTree from "./FolderTree";
import UploadDialog from "./UploadDialog";
import PreviewPanel from "./PreviewPanel";
import PropertiesModal from "./PropertiesModal";
import "./FileManager.css";

function DocumentManager(props) {
    const selectedCount = props.selectedIds.length;
    const [viewMode, setViewMode] = useState("list");
    const [showFilters, setShowFilters] = useState(false);
    const [sortMode, setSortMode] = useState("date-desc");
    const [singleDocumentFilterId, setSingleDocumentFilterId] = useState(null);
    const [fileTypeFilter, setFileTypeFilter] = useState("all");
    const [recentFilter, setRecentFilter] = useState("all");
    const [isJobsOpen, setIsJobsOpen] = useState(false);
    
    // Custom Modal States (replacing native dialog prompts)
    const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
    const [createFolderParent, setCreateFolderParent] = useState(null); // null means root/active
    const [createFolderName, setCreateFolderName] = useState("");

    const [moveItemData, setMoveItemData] = useState(null); // file or folder data
    const [targetParentFolder, setTargetParentFolder] = useState("");

    const [deleteItemData, setDeleteItemData] = useState(null);

    const [renameFileItem, setRenameFileItem] = useState(null);
    const [newFileName, setNewFileName] = useState("");

    // Properties Modal State
    const [propertiesItem, setPropertiesItem] = useState(null);

    // Rename Folder Modal State
    const [renameFolderItem, setRenameFolderItem] = useState(null);
    const [newFolderName, setNewFolderName] = useState("");

    // Failed Jobs Modal State
    const [isFailedModalOpen, setIsFailedModalOpen] = useState(false);

    // Drag and Drop active indicator state
    const [isDraggingActive, setIsDraggingActive] = useState(false);

    useEffect(() => {
        const handleDragStart = () => setIsDraggingActive(true);
        const handleDragEnd = () => setIsDraggingActive(false);

        window.addEventListener("dragstart", handleDragStart);
        window.addEventListener("dragend", handleDragEnd);
        return () => {
            window.removeEventListener("dragstart", handleDragStart);
            window.removeEventListener("dragend", handleDragEnd);
        };
    }, []);

    // Resizer states
    const [sidebarWidth, setSidebarWidth] = useState(240);
    const [previewWidth, setPreviewWidth] = useState(380);

    // Arrow keys & shift multi-selection indices tracking
    const [focusedIndex, setFocusedIndex] = useState(null);
    const [selectionStart, setSelectionStart] = useState(null);

    const startSidebarResize = useCallback((e) => {
        e.preventDefault();
        const startWidth = sidebarWidth;
        const startX = e.clientX;
        const onMouseMove = (moveEvent) => {
            const newWidth = Math.max(160, Math.min(500, startWidth + (moveEvent.clientX - startX)));
            sidebarWidth !== newWidth && setSidebarWidth(newWidth);
        };
        const onMouseUp = () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    }, [sidebarWidth]);

    const startPreviewResize = useCallback((e) => {
        e.preventDefault();
        const startWidth = previewWidth;
        const startX = e.clientX;
        const onMouseMove = (moveEvent) => {
            const newWidth = Math.max(200, Math.min(600, startWidth - (moveEvent.clientX - startX)));
            previewWidth !== newWidth && setPreviewWidth(newWidth);
        };
        const onMouseUp = () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    }, [previewWidth]);

    // Breadcrumb Trail path
    const breadcrumbs = useMemo(() => {
        if (!props.activeFolder || props.activeFolder === "root") return [{ label: "Root", value: "root" }];
        const parts = props.activeFolder.split("_");
        const path = [];
        let currentVal = "";
        parts.forEach((part) => {
            currentVal = currentVal ? `${currentVal}_${part}` : part;
            const folderObj = props.folders.find(f => f.value === currentVal);
            path.push({
                label: folderObj ? folderObj.label : part,
                value: currentVal
            });
        });
        return [{ label: "Root", value: "root" }, ...path];
    }, [props.activeFolder, props.folders]);

    const sortedDocuments = useMemo(() => {
        let copy = [...props.documents];

        if (singleDocumentFilterId) {
            copy = copy.filter((doc) => doc._id === singleDocumentFilterId);
        }

        // Frontend filters
        if (fileTypeFilter !== "all") {
            copy = copy.filter(doc => {
                const name = (doc.originalName || "").toLowerCase();
                const mime = (doc.mimeType || "").toLowerCase();
                if (fileTypeFilter === "pdf") return name.endsWith(".pdf");
                if (fileTypeFilter === "docx") return name.endsWith(".docx") || name.endsWith(".doc");
                if (fileTypeFilter === "pptx") return name.endsWith(".pptx") || name.endsWith(".ppt");
                if (fileTypeFilter === "xlsx") return name.endsWith(".xlsx") || name.endsWith(".xls");
                if (fileTypeFilter === "images") return mime.startsWith("image/") || /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(name);
                if (fileTypeFilter === "documents") return mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".pptx") || name.endsWith(".xlsx");
                return true;
            });
        }

        if (recentFilter !== "all") {
            const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            copy = copy.filter(doc => {
                const docTime = new Date(doc.updatedAt || doc.createdAt || 0).getTime();
                return docTime > oneWeekAgo;
            });
        }

        copy.sort((first, second) => {
            if (sortMode === "name-asc") {
                return String(first.originalName || first.title || "").localeCompare(String(second.originalName || second.title || ""));
            }

            if (sortMode === "size-desc") {
                return Number(second.fileSize || second.size || 0) - Number(first.fileSize || first.size || 0);
            }

            if (sortMode === "type-asc") {
                const extA = (first.originalName || "").split(".").pop().toLowerCase();
                const extB = (second.originalName || "").split(".").pop().toLowerCase();
                return extA.localeCompare(extB);
            }

            return new Date(second.updatedAt || second.createdAt || 0) - new Date(first.updatedAt || first.createdAt || 0);
        });

        return copy;
    }, [props.documents, sortMode, singleDocumentFilterId, fileTypeFilter, recentFilter]);

    // Unified items list matching the view layout (subfolders first, then files)
    const listItems = useMemo(() => {
        const activeFolderVal = props.activeFolder || "root";
        const subfolders = (props.folders || [])
            .filter(f => {
                if (activeFolderVal === "root" || activeFolderVal === "") {
                    return !f.parent;
                }
                return f.parent === activeFolderVal;
            })
            .sort((a, b) => (a.label || "").localeCompare(b.label || ""));

        let filteredFolders = subfolders;
        let filteredFiles = sortedDocuments;

        if (props.search) {
            const s = props.search.toLowerCase();
            filteredFolders = subfolders.filter(f => f.label.toLowerCase().includes(s));
        }

        return [
            ...filteredFolders.map(folder => ({
                id: `folder:${folder.value}`,
                isFolder: true,
                name: folder.label,
                value: folder.value,
                folderObj: folder
            })),
            ...filteredFiles.map(file => ({
                id: file._id,
                isFolder: false,
                name: file.title || file.originalName,
                fileObj: file
            }))
        ];
    }, [props.folders, props.activeFolder, sortedDocuments, props.search]);

    // Reset focused index when folder changes
    useEffect(() => {
        setFocusedIndex(null);
        setSelectionStart(null);
    }, [props.activeFolder]);

    const handleOpenCreateFolderModal = useCallback((parentVal = null) => {
        const parentString = typeof parentVal === "string" ? parentVal : null;
        const targetParent = parentString !== null ? parentString : (props.activeFolder && props.activeFolder !== "root" ? props.activeFolder : null);
        setCreateFolderParent(targetParent);
        setCreateFolderName("");
        setIsCreateFolderModalOpen(true);
    }, [props.activeFolder]);

    const handleOpenMoveModal = useCallback((item, isFolder = false) => {
        if (isFolder) {
            setMoveItemData({
                type: "folder",
                id: item.value,
                name: item.label,
                currentCategoryOrParent: item.parent || "root"
            });
            setTargetParentFolder(item.parent || "root");
        } else {
            setMoveItemData({
                type: "file",
                id: item._id,
                name: item.title || item.originalName,
                currentCategoryOrParent: item.category || "root"
            });
            setTargetParentFolder(item.category || "root");
        }
    }, []);

    const handleOpenDeleteModal = useCallback((item = null, isFolder = false, isBulk = false) => {
        if (isBulk) {
            const fileIds = props.selectedIds.filter(id => !id.startsWith("folder:"));
            const folderValues = props.selectedIds.filter(id => id.startsWith("folder:")).map(id => id.replace("folder:", ""));
            
            let filesCount = fileIds.length;
            folderValues.forEach(fVal => {
                const visited = new Set();
                const getDescendantFoldersLocal = (val) => {
                    if (visited.has(val)) return [];
                    visited.add(val);
                    let desc = [val];
                    props.folders.filter(f => f.parent === val).forEach(child => {
                        desc = [...desc, ...getDescendantFoldersLocal(child.value)];
                    });
                    return desc;
                };
                const descendants = getDescendantFoldersLocal(fVal);
                filesCount += props.documents.filter(doc => descendants.includes(doc.category)).length;
            });

            setDeleteItemData({
                type: "bulk",
                fileIds,
                folderValues,
                name: `${props.selectedIds.length} selected item(s)`,
                filesCount
            });
        } else if (isFolder) {
            const visited = new Set();
            const getDescendantFoldersLocal = (val) => {
                if (visited.has(val)) return [];
                visited.add(val);
                let desc = [val];
                props.folders.filter(f => f.parent === val).forEach(child => {
                    desc = [...desc, ...getDescendantFoldersLocal(child.value)];
                });
                return desc;
            };
            const descendants = getDescendantFoldersLocal(item.value);
            const filesCount = props.documents.filter(doc => descendants.includes(doc.category)).length;

            setDeleteItemData({
                type: "folder",
                id: item.value,
                name: item.label,
                filesCount
            });
        } else {
            setDeleteItemData({
                type: "file",
                id: item._id,
                name: item.title || item.originalName,
                filesCount: 1
            });
        }
    }, [props.selectedIds, props.folders, props.documents]);

    const handleOpenRenameFileModal = useCallback((id, currentName) => {
        setRenameFileItem({ id, currentName });
        setNewFileName(currentName);
    }, []);

    const handleOpenRenameFolderModal = useCallback((folderValue) => {
        const folder = props.folders.find(f => f.value === folderValue);
        if (folder) {
            setRenameFolderItem(folder);
            setNewFolderName(folder.label);
        }
    }, [props.folders]);

    const latestStateRef = useRef();
    latestStateRef.current = {
        listItems,
        focusedIndex,
        selectionStart,
        folders: props.folders,
        activeFolder: props.activeFolder,
        setSelectedIds: props.setSelectedIds,
        setSelectedDocument: props.setSelectedDocument,
        onCopy: props.onCopy,
        onCut: props.onCut,
        onPaste: props.onPaste,
        onUndo: props.onUndo,
        onRedo: props.onRedo,
        onCreateFolder: handleOpenCreateFolderModal,
        onRenameFolder: handleOpenRenameFolderModal,
        onRename: handleOpenRenameFileModal,
        onBulkDelete: () => handleOpenDeleteModal(null, false, true),
        onOpenDocument: props.onOpenDocument,
        onSelectFolder: handleSelectFolder
    };

    // Keyboard Shortcuts and Navigation Event Listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            const activeEl = document.activeElement;
            const isTyping = activeEl && (
                activeEl.tagName === "INPUT" ||
                activeEl.tagName === "TEXTAREA" ||
                activeEl.isContentEditable
            );

            // Global/overridable keys
            if (e.key === "Escape") {
                e.preventDefault();
                latestStateRef.current.setSelectedIds([]);
                latestStateRef.current.setSelectedDocument(null);
                setFocusedIndex(null);
                setSelectionStart(null);
                if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
                    document.activeElement.blur();
                }
                return;
            }

            if (isTyping) {
                return;
            }

            const state = latestStateRef.current;

            // Ctrl + A -> Select all items
            if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === "a") {
                e.preventDefault();
                const allIds = state.listItems.map(item => item.id);
                state.setSelectedIds(allIds);
                return;
            }

            // Ctrl + C -> Copy
            if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === "c") {
                e.preventDefault();
                state.onCopy();
                return;
            }

            // Ctrl + X -> Cut
            if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === "x") {
                e.preventDefault();
                state.onCut();
                return;
            }

            // Ctrl + V -> Paste
            if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === "v") {
                e.preventDefault();
                state.onPaste();
                return;
            }

            // Ctrl + Z -> Undo
            if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === "z") {
                e.preventDefault();
                state.onUndo?.();
                return;
            }

            // Ctrl + Y -> Redo
            if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === "y") {
                e.preventDefault();
                state.onRedo?.();
                return;
            }

            // Ctrl + Shift + N -> New Folder
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key?.toLowerCase() === "n") {
                e.preventDefault();
                state.onCreateFolder();
                return;
            }

            // F2 -> Rename
            if (e.key === "F2") {
                e.preventDefault();
                const activeItem = state.listItems[state.focusedIndex];
                if (activeItem) {
                    if (activeItem.isFolder) {
                        state.onRenameFolder?.(activeItem.value);
                    } else {
                        state.onRename?.(activeItem.id, activeItem.name);
                    }
                }
                return;
            }

            // Delete
            if (e.key === "Delete") {
                e.preventDefault();
                state.onBulkDelete();
                return;
            }

            // Backspace -> Go back
            if (e.key === "Backspace") {
                e.preventDefault();
                const currentFolder = state.folders?.find(f => f.value === state.activeFolder);
                if (currentFolder && currentFolder.parent) {
                    state.onSelectFolder(currentFolder.parent);
                } else if (state.activeFolder !== "root" && state.activeFolder !== "") {
                    state.onSelectFolder("root");
                }
                return;
            }

            // F5 -> Refresh
            if (e.key === "F5") {
                e.preventDefault();
                props.onRefresh();
                return;
            }

            // Ctrl + F -> Focus search
            if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === "f") {
                e.preventDefault();
                document.querySelector(".search input")?.focus();
                return;
            }

            // Home
            if (e.key === "Home") {
                e.preventDefault();
                if (state.listItems.length > 0) {
                    setFocusedIndex(0);
                    setSelectionStart(0);
                    state.setSelectedIds([state.listItems[0].id]);
                    if (state.listItems[0].isFolder) {
                        state.setSelectedDocument(state.listItems[0].folderObj);
                    } else {
                        state.setSelectedDocument(state.listItems[0].fileObj);
                    }
                }
                return;
            }

            // End
            if (e.key === "End") {
                e.preventDefault();
                if (state.listItems.length > 0) {
                    const lastIdx = state.listItems.length - 1;
                    setFocusedIndex(lastIdx);
                    setSelectionStart(lastIdx);
                    state.setSelectedIds([state.listItems[lastIdx].id]);
                    if (state.listItems[lastIdx].isFolder) {
                        state.setSelectedDocument(state.listItems[lastIdx].folderObj);
                    } else {
                        state.setSelectedDocument(state.listItems[lastIdx].fileObj);
                    }
                }
                return;
            }

            // Enter -> Open folder/file
            if (e.key === "Enter") {
                e.preventDefault();
                const activeItem = state.listItems[state.focusedIndex];
                if (activeItem) {
                    if (activeItem.isFolder) {
                        state.onSelectFolder(activeItem.value);
                    } else {
                        state.onOpenDocument(activeItem.fileObj);
                    }
                }
                return;
            }

            // Up / Down arrow navigation
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                if (state.listItems.length === 0) return;

                let nextIndex = 0;
                if (state.focusedIndex === null) {
                    nextIndex = e.key === "ArrowDown" ? 0 : state.listItems.length - 1;
                } else {
                    if (e.key === "ArrowDown") {
                        nextIndex = state.focusedIndex >= state.listItems.length - 1 ? 0 : state.focusedIndex + 1;
                    } else {
                        nextIndex = state.focusedIndex <= 0 ? state.listItems.length - 1 : state.focusedIndex - 1;
                    }
                }

                setFocusedIndex(nextIndex);

                if (e.shiftKey) {
                    const startIdx = state.selectionStart !== null ? state.selectionStart : (state.focusedIndex || 0);
                    if (state.selectionStart === null) setSelectionStart(startIdx);

                    const start = Math.min(startIdx, nextIndex);
                    const end = Math.max(startIdx, nextIndex);
                    const idsInRange = state.listItems.slice(start, end + 1).map(item => item.id);
                    state.setSelectedIds(idsInRange);
                } else {
                    setSelectionStart(nextIndex);
                    const item = state.listItems[nextIndex];
                    state.setSelectedIds([item.id]);
                    if (item.isFolder) {
                        state.setSelectedDocument(item.folderObj);
                    } else {
                        state.setSelectedDocument(item.fileObj);
                    }
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);



    function handleSelectFolder(value) {
        setSingleDocumentFilterId(null);
        setFocusedIndex(null);
        setSelectionStart(null);
        props.onSelectFolder(value);
    }

    function handleSelectTableDoc(doc) {
        setSingleDocumentFilterId(null);
        props.setSelectedDocument(doc);
    }

    function handleSelectTreeDoc(doc) {
        props.setSelectedDocument(doc);
        setSingleDocumentFilterId(doc._id);
        if (doc.category) {
            props.onSelectFolder(doc.category);
        }
    }

    function downloadSelected() {
        // Download files
        props.documents
            .filter((file) => props.selectedIds.includes(file._id))
            .forEach((file) => props.onDownload(file));

        // Download folder zips recursively
        props.folders
            .filter(folder => props.selectedIds.includes(`folder:${folder.value}`))
            .forEach(folder => props.onDownload(folder));
    }

    return (
        <section
            className={`document-manager-shell ${isDraggingActive ? "dragging-active" : ""}`}
            onDragOver={props.onDragOver}
            onDragLeave={props.onDragLeave}
            onDrop={props.onDrop}
        >

            {/* ================= HEADER ================= */}

            <div className="panel-header-row document-manager-head">

                <div>
                    <h2>Document Management</h2>
                    <p>Upload, organize and manage your files</p>
                </div>

                {/* Background Jobs Widget */}
                {props.jobs && (
                    <div className="jobs-status-widget header-jobs-widget" style={{ padding: "6px 12px", margin: 0, border: "1px solid var(--admin-line)", borderRadius: "8px", background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: "14px", alignItems: "center", fontSize: "12px", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: "600", color: "#e2e8f0" }}>Indexing:</span>
                            <span style={{ color: props.jobs.running?.length > 0 ? "var(--admin-gold)" : "var(--admin-muted)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                {props.jobs.running?.length > 0 ? "⏳ Running" : "💤 Idle"}
                            </span>
                            <span style={{ height: "12px", width: "1px", background: "var(--admin-line)" }} />
                            <span>Completed: <strong style={{ color: "#2ecc71" }}>{props.jobs.completedCount}</strong></span>
                            <span>Pending: <strong style={{ color: "#3498db" }}>{(props.jobs.queue?.length || 0) + (props.jobs.running?.length || 0)}</strong></span>
                            <span
                                style={{
                                    cursor: (props.jobs?.failed?.length || 0) > 0 ? "pointer" : "default"
                                }}
                                onClick={() => {
                                    if ((props.jobs?.failed?.length || 0) > 0) {
                                        setIsFailedModalOpen(true);
                                    }
                                }}
                                title={(props.jobs?.failed?.length || 0) > 0 ? "Click to view failed files" : ""}
                            >
                                Failed: <strong style={{ color: (props.jobs?.failed?.length || 0) > 0 ? "#ff5252" : "var(--admin-muted)", textDecoration: (props.jobs?.failed?.length || 0) > 0 ? "underline" : "none" }}>{props.jobs?.failed?.length || 0}</strong>
                            </span>
                            <span>Total: <strong style={{ color: "#fff" }}>{props.jobs.totalCount}</strong></span>
                            {(props.jobs.failed?.length || 0) > 0 && (
                                <button
                                    type="button"
                                    onClick={props.onRetryFailedIndexing}
                                    style={{
                                        background: "rgba(255, 82, 82, 0.12)",
                                        border: "1px solid rgba(255, 82, 82, 0.25)",
                                        color: "#ff5252",
                                        padding: "3px 8px",
                                        borderRadius: "4px",
                                        fontSize: "11px",
                                        cursor: "pointer",
                                        transition: "all 0.2s"
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 82, 82, 0.2)"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255, 82, 82, 0.12)"}
                                >
                                    Retry Failed
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="toolbar-actions">

                    <button
                        type="button"
                        className="primary-action"
                        onClick={() =>
                            document.querySelector(".upload-dropzone input")?.click()
                        }
                    >
                        <UploadCloud size={16} />
                        Upload Files
                    </button>

                    <button
                        type="button"
                        className="secondary-action"
                        onClick={props.onCreateFolder}
                    >
                        <FolderPlus size={16} />
                        New Folder
                    </button>

                    <button
                        type="button"
                        className="secondary-action"
                        onClick={() => props.onCopy()}
                        disabled={!selectedCount}
                        title="Copy selected file(s)"
                    >
                        <Copy size={16} />
                        Copy
                    </button>

                    <button
                        type="button"
                        className="secondary-action"
                        onClick={() => props.onCut()}
                        disabled={!selectedCount}
                        title="Cut selected file(s)"
                    >
                        <Scissors size={16} />
                        Cut
                    </button>

                    <button
                        type="button"
                        className="secondary-action"
                        onClick={() => props.onPaste()}
                        disabled={!props.clipboard || !props.clipboard.action}
                        title="Paste file(s)"
                    >
                        <Clipboard size={16} />
                        Paste
                    </button>

                    <button
                        type="button"
                        className="secondary-action"
                        onClick={props.onUndo}
                        disabled={!props.undoStack || props.undoStack.length === 0}
                        title="Undo last action"
                    >
                        <Undo2 size={16} />
                        Undo
                    </button>

                    <button
                        type="button"
                        className="secondary-action"
                        onClick={props.onRedo}
                        disabled={!props.redoStack || props.redoStack.length === 0}
                        title="Redo last action"
                    >
                        <Redo2 size={16} />
                        Redo
                    </button>

                    <button
                        type="button"
                        className="secondary-action"
                        onClick={downloadSelected}
                        disabled={!selectedCount}
                    >
                        <Download size={16} />
                        Download
                    </button>

                    <button
                        type="button"
                        className="secondary-action"
                        onClick={props.onBulkDelete}
                        disabled={!selectedCount}
                    >
                        <Trash2 size={16} />
                        Delete
                    </button>

                    <button
                        type="button"
                        className="secondary-action"
                        onClick={() => {
                            setSingleDocumentFilterId(null);
                            props.onRefresh();
                        }}
                    >
                        <RefreshCcw size={16} />
                        Refresh
                    </button>

                </div>

            </div>

            {/* ================= BREADCRUMBS TRAIL ================= */}

            <div className="breadcrumb-trail">
                {breadcrumbs.map((segment, index) => (
                    <span key={segment.value} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        {index > 0 && <ChevronRight size={12} className="breadcrumb-separator" />}
                        <span
                            className={`breadcrumb-segment ${index === breadcrumbs.length - 1 ? "active" : ""}`}
                            onClick={() => index !== breadcrumbs.length - 1 && handleSelectFolder(segment.value)}
                        >
                            {segment.label}
                        </span>
                    </span>
                ))}
            </div>

            {/* ================= MAIN LAYOUT ================= */}

            <div
                className={props.selectedDocument ? "document-layout has-preview" : "document-layout"}
                style={{
                    display: "grid",
                    gridTemplateColumns: `${sidebarWidth}px 4px minmax(0, 1fr)${props.selectedDocument ? ` 4px ${previewWidth}px` : ""}`,
                    transition: "none"
                }}
            >

                {/* ========== LEFT SIDEBAR ========== */}

                <aside className="document-sidebar">

                    <FolderTree
                        {...props}
                        onSelectFolder={handleSelectFolder}
                        onSelectTreeDoc={handleSelectTreeDoc}
                        onRenameFolder={handleOpenRenameFolderModal}
                        onMoveFolder={(folderValue) => handleOpenMoveModal(props.folders.find(f => f.value === folderValue), true)}
                        onDeleteFolder={(folderValue) => handleOpenDeleteModal(props.folders.find(f => f.value === folderValue), true)}
                    />



                </aside>

                <div className="sidebar-resizer" onMouseDown={startSidebarResize} />

                {/* ========== CENTER CONTENT ========== */}

                <section className="document-content">

                    {/* Toolbar */}

                    <div className="toolbar">

                        <div className="search">

                            <Search size={16} />

                            <input
                                placeholder={`Search in ${props.activeFolderLabel}...`}
                                value={props.search}
                                onChange={(event) => {
                                    setSingleDocumentFilterId(null);
                                    props.setSearch(event.target.value);
                                }}
                            />

                        </div>

                        <div className="toolbar-icons">

                            <button
                                type="button"
                                className={viewMode === "grid" ? "icon-button active" : "icon-button"}
                                onClick={() => setViewMode("grid")}
                                aria-label="Grid view"
                            >
                                <Grid2X2 size={16} />
                            </button>

                            <button
                                type="button"
                                className={viewMode === "list" ? "icon-button active" : "icon-button"}
                                onClick={() => setViewMode("list")}
                                aria-label="List view"
                            >
                                <List size={16} />
                            </button>

                            <button
                                type="button"
                                className={showFilters ? "icon-button active" : "icon-button"}
                                onClick={() => setShowFilters((current) => !current)}
                                aria-label="Filter"
                            >
                                <Filter size={16} />
                            </button>

                        </div>

                    </div>

                    {/* Filters */}

                    <div className={showFilters ? "document-filter-row visible" : "document-filter-row"}>

                        <input
                            value={props.filters.department}
                            placeholder="Department"
                            onChange={(event) =>
                                props.setFilters((current) => ({
                                    ...current,
                                    department: event.target.value
                                }))
                            }
                        />

                        <input
                            value={props.filters.institution}
                            placeholder="Institution"
                            onChange={(event) =>
                                props.setFilters((current) => ({
                                    ...current,
                                    institution: event.target.value
                                }))
                            }
                        />

                        <input
                            value={props.filters.version}
                            placeholder="Document type / version"
                            onChange={(event) =>
                                props.setFilters((current) => ({
                                    ...current,
                                    version: event.target.value
                                }))
                            }
                        />

                        <select
                            value={sortMode}
                            onChange={(event) => setSortMode(event.target.value)}
                        >
                            <option value="date-desc">Newest first</option>
                            <option value="name-asc">Name A-Z</option>
                            <option value="size-desc">Largest first</option>
                            <option value="type-asc">Type (Extension)</option>
                        </select>

                        <select
                            value={fileTypeFilter}
                            onChange={(event) => setFileTypeFilter(event.target.value)}
                        >
                            <option value="all">All File Types</option>
                            <option value="pdf">PDF Documents</option>
                            <option value="docx">Word (DOCX)</option>
                            <option value="pptx">PowerPoint (PPTX)</option>
                            <option value="xlsx">Excel (XLSX)</option>
                            <option value="images">Images</option>
                            <option value="documents">Text / Documents</option>
                        </select>

                        <select
                            value={recentFilter}
                            onChange={(event) => setRecentFilter(event.target.value)}
                        >
                            <option value="all">All Dates</option>
                            <option value="uploaded">Recently Uploaded (7d)</option>
                        </select>

                        <select
                            value={props.filters.processingStatus}
                            onChange={(event) =>
                                props.setFilters((current) => ({
                                    ...current,
                                    processingStatus: event.target.value
                                }))
                            }
                        >
                            <option value="">All statuses</option>
                            <option value="queued">Uploaded</option>
                            <option value="processing">Processing</option>
                            <option value="embedding">Embedding</option>
                            <option value="ready">Ready</option>
                            <option value="failed">Failed</option>
                        </select>

                        <button
                            type="button"
                            className="secondary-action"
                            style={{ gridColumn: "span 1" }}
                            onClick={() => {
                                setSingleDocumentFilterId(null);
                                setFileTypeFilter("all");
                                setRecentFilter("all");
                                props.onReset();
                            }}
                        >
                            Clear
                        </button>

                    </div>

                    {/* File Table */}

                    <FileTable
                        {...props}
                        documents={sortedDocuments}
                        viewMode={viewMode}
                        onSelectDocument={handleSelectTableDoc}
                        selectedDocument={props.selectedDocument}
                        focusedIndex={focusedIndex}
                        setFocusedIndex={setFocusedIndex}
                        search={props.search}
                        onProperties={(item) => setPropertiesItem(item)}
                        onDuplicate={props.onDuplicate}
                        onReindexFolder={props.onReindexFolder}
                        onRenameFolder={handleOpenRenameFolderModal}
                        onRename={(id, name) => handleOpenRenameFileModal(id, name)}
                        onMove={(id, cat) => handleOpenMoveModal(props.documents.find(d => d._id === id), false)}
                        onDelete={(id) => handleOpenDeleteModal(props.documents.find(d => d._id === id), false)}
                        onDeleteFolder={(folderValue) => handleOpenDeleteModal(props.folders.find(f => f.value === folderValue), true)}
                        onMoveFolder={(folderValue) => handleOpenMoveModal(props.folders.find(f => f.value === folderValue), true)}
                    />

                    {/* Footer */}

                    <div className="table-footer">

                        <span>
                            Showing {sortedDocuments.length} files
                        </span>

                        <span>
                            Total size: {formatBytes(props.visibleFolderStorage)}
                        </span>

                    </div>

                </section>

                {props.selectedDocument && <div className="preview-resizer" onMouseDown={startPreviewResize} />}

                {/* ========== RIGHT SIDEBAR (PREVIEW) ========== */}
                {props.selectedDocument && !props.selectedDocument.value && (
                    <aside className="document-preview-sidebar" style={{ width: previewWidth }}>
                        <PreviewPanel
                            file={props.selectedDocument}
                            onClose={() => props.setSelectedDocument(null)}
                            onOpen={props.onOpenDocument}
                            onDownload={props.onDownload}
                            onRebuild={props.onRebuild}
                        />
                    </aside>
                )}

            </div>

            {/* Hidden upload form keeps the top Upload Files button functional. */}
            <div className={`document-upload-portal${props.upload.file || (props.upload.files && props.upload.files.length > 0) || props.isDropActive ? " active" : ""}`}>
                <UploadDialog {...props} />
            </div>

            {/* Floating Upload Queue Panel */}
            {props.uploadQueue && props.uploadQueue.length > 0 && (
                <div className="upload-queue-panel">
                    <header className="upload-queue-header">
                        <h3>Uploading: {props.uploadQueue.filter(u => u.status === 'completed').length} / {props.uploadQueue.length} Files</h3>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <button type="button" onClick={props.onRetryFailedUploads} style={{ color: "var(--admin-gold)" }}>Retry Failed</button>
                            <button type="button" onClick={props.onClearCompletedUploads}>Clear Done</button>
                            <button type="button" onClick={props.onCancelAllUploads} style={{ color: "#ff5252" }}>Cancel All</button>
                        </div>
                    </header>
                    <div className="upload-queue-list">
                        {props.uploadQueue.map(item => (
                            <div key={item.id} className="upload-queue-item">
                                <div className="upload-item-name" title={item.relativePath || item.name}>{item.relativePath || item.name}</div>
                                <div className="upload-item-status-row">
                                    <span className={`upload-item-badge ${item.status}`}>{item.status}</span>
                                    {item.status === 'uploading' && <span className="upload-item-pct">{item.progress}%</span>}
                                    {item.status === 'failed' && <span className="upload-item-error" style={{ color: "var(--admin-red)" }} title={item.error}>{item.error}</span>}
                                </div>
                                <div className="upload-item-progress-row">
                                    <div className="upload-item-progress-bar">
                                        <div className="upload-item-progress" style={{ width: `${item.progress}%` }} />
                                    </div>
                                </div>
                                <div className="upload-item-controls">
                                    {item.status === 'uploading' && (
                                        <button type="button" onClick={() => props.onPauseUpload(item.id)}>Pause</button>
                                    )}
                                    {item.status === 'paused' && (
                                        <button type="button" onClick={() => props.onResumeUpload(item.id)}>Resume</button>
                                    )}
                                    {item.status === 'failed' && (
                                        <button type="button" onClick={() => props.onRetryUpload(item.id)}>Retry</button>
                                    )}
                                    {item.status === 'queued' && (
                                        <button type="button" onClick={() => props.onSkipUpload(item.id)}>Skip</button>
                                    )}
                                    {item.status === 'skipped' && (
                                        <button type="button" onClick={() => props.onResumeUpload(item.id)}>Queue</button>
                                    )}
                                    <button type="button" onClick={() => props.onCancelUpload(item.id)} className="cancel">Cancel</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Properties Modal Overlay */}
            {propertiesItem && (
                <PropertiesModal
                    item={propertiesItem === "currentFolder" 
                        ? props.folders.find(f => f.value === props.activeFolder) || { label: "Root", value: "root" }
                        : propertiesItem}
                    onClose={() => setPropertiesItem(null)}
                    folders={props.folders}
                    documents={props.documents}
                />
            )}

            {/* Floating Context Menu */}
            <ContextMenu
                menu={props.contextMenu}
                onClose={props.closeContextMenu}
                onOpen={props.onOpenDocument}
                onDownload={props.onDownload}
                onRename={(id, name) => handleOpenRenameFileModal(id, name)}
                onMove={(id, cat) => handleOpenMoveModal(props.documents.find(d => d._id === id), false)}
                onDelete={(id) => handleOpenDeleteModal(props.documents.find(d => d._id === id), false)}
                onBulkDelete={() => handleOpenDeleteModal(null, false, true)}
                onCreateFolder={(parentVal) => handleOpenCreateFolderModal(parentVal)}
                clipboard={props.clipboard}
                onCopy={props.onCopy}
                onCut={props.onCut}
                onPaste={props.onPaste}
                onSelectFolder={handleSelectFolder}
                onRenameFolder={handleOpenRenameFolderModal}
                onDeleteFolder={(folderValue) => handleOpenDeleteModal(props.folders.find(f => f.value === folderValue), true)}
                onMoveFolder={(folderValue) => handleOpenMoveModal(props.folders.find(f => f.value === folderValue), true)}
                onDuplicate={props.onDuplicate}
                onReindex={props.onRebuild}
                onReindexFolder={props.onReindexFolder}
                onProperties={(item) => setPropertiesItem(item)}
                selectedCount={props.selectedIds.length}
            />

            {/* Create Folder Modal Dialog */}
            {isCreateFolderModalOpen && (
                <div className="rename-folder-modal-overlay" onClick={() => setIsCreateFolderModalOpen(false)}>
                    <div className="rename-folder-modal-card" onClick={(e) => e.stopPropagation()}>
                        <header className="rename-folder-modal-header">
                            <h3>Create Folder</h3>
                            <button className="rename-folder-modal-close-btn" onClick={() => setIsCreateFolderModalOpen(false)}>
                                <X size={16} />
                            </button>
                        </header>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (createFolderName.trim()) {
                                props.onCreateFolder(createFolderParent, createFolderName.trim());
                            }
                            setIsCreateFolderModalOpen(false);
                        }}>
                            <div className="rename-folder-modal-body">
                                <label style={{ color: "var(--admin-muted)", fontSize: "12px" }}>Folder Name</label>
                                <input
                                    type="text"
                                    value={createFolderName}
                                    onChange={(e) => setCreateFolderName(e.target.value)}
                                    autoFocus
                                    placeholder="Enter folder name"
                                    required
                                    style={{
                                        width: "100%",
                                        background: "#0e1823",
                                        border: "1px solid var(--admin-line)",
                                        color: "#fff",
                                        borderRadius: "6px",
                                        padding: "8px 10px",
                                        marginTop: "6px"
                                    }}
                                />
                                {createFolderParent && (
                                    <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--admin-muted)" }}>
                                        Creating inside: <strong>{props.folders.find(f => f.value === createFolderParent)?.label || createFolderParent}</strong>
                                    </div>
                                )}
                            </div>
                            <footer className="rename-folder-modal-footer">
                                <button type="button" className="cancel-btn" onClick={() => setIsCreateFolderModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="submit-btn">
                                    Create
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}

            {/* Rename Folder Modal Dialog */}
            {renameFolderItem && (
                <div className="rename-folder-modal-overlay" onClick={() => setRenameFolderItem(null)}>
                    <div className="rename-folder-modal-card" onClick={(e) => e.stopPropagation()}>
                        <header className="rename-folder-modal-header">
                            <h3>Rename Folder</h3>
                            <button className="rename-folder-modal-close-btn" onClick={() => setRenameFolderItem(null)}>
                                <X size={16} />
                            </button>
                        </header>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (newFolderName.trim() && newFolderName.trim() !== renameFolderItem.label) {
                                props.onRenameFolder(renameFolderItem.value, newFolderName.trim());
                            }
                            setRenameFolderItem(null);
                        }}>
                            <div className="rename-folder-modal-body">
                                <label style={{ color: "var(--admin-muted)", fontSize: "12px" }}>Folder Name</label>
                                <input
                                    type="text"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    autoFocus
                                    placeholder="Enter new folder name"
                                    required
                                    style={{
                                        width: "100%",
                                        background: "#0e1823",
                                        border: "1px solid var(--admin-line)",
                                        color: "#fff",
                                        borderRadius: "6px",
                                        padding: "8px 10px",
                                        marginTop: "6px"
                                    }}
                                />
                            </div>
                            <footer className="rename-folder-modal-footer">
                                <button type="button" className="cancel-btn" onClick={() => setRenameFolderItem(null)}>
                                    Cancel
                                </button>
                                <button type="submit" className="submit-btn">
                                    Rename
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}

            {/* Rename File Modal Dialog */}
            {renameFileItem && (
                <div className="rename-folder-modal-overlay" onClick={() => setRenameFileItem(null)}>
                    <div className="rename-folder-modal-card" onClick={(e) => e.stopPropagation()}>
                        <header className="rename-folder-modal-header">
                            <h3>Rename File</h3>
                            <button className="rename-folder-modal-close-btn" onClick={() => setRenameFileItem(null)}>
                                <X size={16} />
                            </button>
                        </header>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (newFileName.trim() && newFileName.trim() !== renameFileItem.currentName) {
                                props.onRename(renameFileItem.id, renameFileItem.currentName, newFileName.trim());
                            }
                            setRenameFileItem(null);
                        }}>
                            <div className="rename-folder-modal-body">
                                <label style={{ color: "var(--admin-muted)", fontSize: "12px" }}>File Name</label>
                                <input
                                    type="text"
                                    value={newFileName}
                                    onChange={(e) => setNewFileName(e.target.value)}
                                    autoFocus
                                    placeholder="Enter new file name"
                                    required
                                    style={{
                                        width: "100%",
                                        background: "#0e1823",
                                        border: "1px solid var(--admin-line)",
                                        color: "#fff",
                                        borderRadius: "6px",
                                        padding: "8px 10px",
                                        marginTop: "6px"
                                    }}
                                />
                            </div>
                            <footer className="rename-folder-modal-footer">
                                <button type="button" className="cancel-btn" onClick={() => setRenameFileItem(null)}>
                                    Cancel
                                </button>
                                <button type="submit" className="submit-btn">
                                    Rename
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}

            {/* Move Item (File or Folder) Modal Dialog */}
            {moveItemData && (
                <div className="rename-folder-modal-overlay" onClick={() => setMoveItemData(null)}>
                    <div className="rename-folder-modal-card" onClick={(e) => e.stopPropagation()}>
                        <header className="rename-folder-modal-header">
                            <h3>Move {moveItemData.type === "folder" ? "Folder" : "File"}</h3>
                            <button className="rename-folder-modal-close-btn" onClick={() => setMoveItemData(null)}>
                                <X size={16} />
                            </button>
                        </header>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (moveItemData.type === "folder") {
                                const targetVal = targetParentFolder === "root" ? null : targetParentFolder;
                                await props.onMoveFolder(moveItemData.id, targetVal);
                            } else {
                                await props.onMove(moveItemData.id, moveItemData.currentCategoryOrParent, targetParentFolder === "root" ? "" : targetParentFolder);
                            }
                            setMoveItemData(null);
                        }}>
                            <div className="rename-folder-modal-body">
                                <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#fff" }}>
                                    Move <strong>{moveItemData.name}</strong> to:
                                </p>
                                <label style={{ color: "var(--admin-muted)", fontSize: "12px" }}>Destination Folder</label>
                                <select
                                    value={targetParentFolder}
                                    onChange={(e) => setTargetParentFolder(e.target.value)}
                                    style={{
                                        width: "100%",
                                        background: "#0e1823",
                                        border: "1px solid var(--admin-line)",
                                        color: "#fff",
                                        borderRadius: "6px",
                                        padding: "8px 10px",
                                        marginTop: "6px"
                                    }}
                                >
                                    <option value="root">Root</option>
                                    {(() => {
                                        if (moveItemData.type === "folder") {
                                            const visited = new Set();
                                            const getDescendantsLocal = (val) => {
                                                if (visited.has(val)) return [];
                                                visited.add(val);
                                                let desc = [val];
                                                props.folders.filter(f => f.parent === val).forEach(child => {
                                                    desc = [...desc, ...getDescendantsLocal(child.value)];
                                                });
                                                return desc;
                                            };
                                            const descendants = getDescendantsLocal(moveItemData.id);
                                            return props.folders.filter(f => !descendants.includes(f.value));
                                        }
                                        return props.folders;
                                    })().map(f => (
                                        <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                </select>
                            </div>
                            <footer className="rename-folder-modal-footer">
                                <button type="button" className="cancel-btn" onClick={() => setMoveItemData(null)}>
                                    Cancel
                                </button>
                                <button type="submit" className="submit-btn">
                                    Move
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal Dialog */}
            {deleteItemData && (
                <div className="rename-folder-modal-overlay" onClick={() => setDeleteItemData(null)}>
                    <div className="rename-folder-modal-card" onClick={(e) => e.stopPropagation()}>
                        <header className="rename-folder-modal-header" style={{ borderBottom: "1px solid rgba(255,82,82,0.2)" }}>
                            <h3 style={{ color: "#ff5252" }}>Delete Confirmation</h3>
                            <button className="rename-folder-modal-close-btn" onClick={() => setDeleteItemData(null)}>
                                <X size={16} />
                            </button>
                        </header>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (deleteItemData.type === "bulk") {
                                await props.onBulkDelete(true);
                            } else if (deleteItemData.type === "folder") {
                                await props.onDeleteFolder(deleteItemData.id, true);
                            } else {
                                await props.onDelete(deleteItemData.id, true);
                            }
                            setDeleteItemData(null);
                        }}>
                            <div className="rename-folder-modal-body">
                                <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#fff", lineHeight: "1.5" }}>
                                    Are you sure you want to delete <strong>{deleteItemData.name}</strong>?
                                </p>
                                {deleteItemData.filesCount > 0 && deleteItemData.type === "folder" && (
                                    <div style={{
                                        background: "rgba(242, 163, 11, 0.1)",
                                        border: "1px solid rgba(242, 163, 11, 0.2)",
                                        borderRadius: "6px",
                                        padding: "10px",
                                        fontSize: "12px",
                                        color: "var(--admin-gold)",
                                        lineHeight: "1.4"
                                    }}>
                                        ⚠️ This folder is not empty. All <strong>{deleteItemData.filesCount} file(s)</strong> inside it and its subfolders will be moved to Admissions.
                                    </div>
                                )}
                            </div>
                            <footer className="rename-folder-modal-footer">
                                <button type="button" className="cancel-btn" onClick={() => setDeleteItemData(null)}>
                                    Cancel
                                </button>
                                <button type="submit" className="submit-btn" style={{ background: "#ff5252", color: "#fff" }}>
                                    Delete
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}

            {/* Failed Indexing Jobs Modal Overlay */}
            {isFailedModalOpen && props.jobs?.failed && (
                <div className="rename-folder-modal-overlay" onClick={() => setIsFailedModalOpen(false)}>
                    <div className="rename-folder-modal-card" style={{ maxWidth: "620px", width: "92%" }} onClick={(e) => e.stopPropagation()}>
                        <header className="rename-folder-modal-header">
                            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", color: "#ff5252" }}>
                                <span>⚠️ Failed Indexing Files ({props.jobs.failed.length})</span>
                            </h3>
                            <button className="rename-folder-modal-close-btn" onClick={() => setIsFailedModalOpen(false)}>
                                <X size={16} />
                            </button>
                        </header>
                        <div className="rename-folder-modal-body" style={{ maxHeight: "420px", overflowY: "auto", padding: "12px 16px" }}>
                            {props.jobs.failed.length === 0 ? (
                                <p style={{ color: "var(--admin-muted)", textAlign: "center", padding: "20px" }}>No failed documents.</p>
                            ) : (
                                props.jobs.failed.map((doc) => (
                                    <div key={doc._id} style={{
                                        background: "rgba(255, 82, 82, 0.05)",
                                        border: "1px solid rgba(255, 82, 82, 0.2)",
                                        borderRadius: "8px",
                                        padding: "14px",
                                        marginBottom: "12px"
                                    }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", gap: "10px" }}>
                                            <div>
                                                <strong style={{ color: "#fff", fontSize: "14px", display: "block" }}>{doc.originalName || "Untitled Document"}</strong>
                                                <span style={{ fontSize: "12px", color: "var(--admin-muted)" }}>
                                                    Folder: <strong style={{ color: "var(--admin-gold)" }}>{doc.category || "Root"}</strong>
                                                </span>
                                            </div>
                                            <span style={{ fontSize: "11px", color: "#ff5252", background: "rgba(255, 82, 82, 0.1)", padding: "2px 8px", borderRadius: "12px" }}>
                                                Indexing Failed
                                            </span>
                                        </div>

                                        <div style={{
                                            fontSize: "12px",
                                            color: "#ff9999",
                                            background: "rgba(0, 0, 0, 0.3)",
                                            borderLeft: "3px solid #ff5252",
                                            padding: "8px 10px",
                                            borderRadius: "4px",
                                            marginBottom: "12px",
                                            wordBreak: "break-word",
                                            fontFamily: "monospace"
                                        }}>
                                            {doc.metadata?.error || "Image-only or scanned PDF (0 text characters extracted)."}
                                        </div>

                                        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    await props.onRebuild?.(doc._id);
                                                    props.onRefresh?.();
                                                }}
                                                style={{
                                                    background: "var(--admin-surface-light, #1a2634)",
                                                    border: "1px solid var(--admin-line)",
                                                    color: "#fff",
                                                    padding: "6px 12px",
                                                    borderRadius: "6px",
                                                    fontSize: "12px",
                                                    cursor: "pointer"
                                                }}
                                            >
                                                Retry Re-index
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    await props.onDelete?.(doc._id);
                                                    props.onRefresh?.();
                                                }}
                                                style={{
                                                    background: "rgba(255, 82, 82, 0.15)",
                                                    border: "1px solid rgba(255, 82, 82, 0.3)",
                                                    color: "#ff5252",
                                                    padding: "6px 12px",
                                                    borderRadius: "6px",
                                                    fontSize: "12px",
                                                    cursor: "pointer"
                                                }}
                                            >
                                                Delete File
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <footer className="rename-folder-modal-footer">
                            <button type="button" className="cancel-btn" onClick={() => setIsFailedModalOpen(false)}>
                                Close
                            </button>
                        </footer>
                    </div>
                </div>
            )}

        </section>
    );
}

export default DocumentManager;
