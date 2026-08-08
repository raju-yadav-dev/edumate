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
    FolderMinus
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
    
    // Properties Modal State
    const [propertiesItem, setPropertiesItem] = useState(null);

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
        onCreateFolder: props.onCreateFolder,
        onRenameFolder: props.onRenameFolder,
        onRename: props.onRename,
        onBulkDelete: props.onBulkDelete,
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
                    />

                    {/* Background Jobs Widget */}
                    {props.jobs && (
                        <div className="jobs-status-widget" style={{ padding: "8px", margin: "10px" }}>
                            <div className="jobs-widget-header" onClick={() => setIsJobsOpen(!isJobsOpen)}>
                                <span>Background Indexing</span>
                                <span style={{ fontSize: "11px", color: "var(--admin-gold)" }}>
                                    {props.jobs.running?.length > 0 ? "⏳ Running" : "💤 Idle"}
                                </span>
                            </div>
                            {isJobsOpen && (
                                <div className="jobs-widget-body">
                                    <div className="job-item">
                                        <span>Completed:</span>
                                        <strong>{props.jobs.completedCount} / {props.jobs.totalCount}</strong>
                                    </div>
                                    {props.jobs.queue?.length > 0 && (
                                        <div className="job-item">
                                            <span>In Queue:</span>
                                            <strong>{props.jobs.queue.length} file(s)</strong>
                                        </div>
                                    )}
                                    {props.jobs.running?.length > 0 && (
                                        <div className="job-item">
                                            <span>Processing:</span>
                                            <strong>{props.jobs.running.length} file(s)</strong>
                                        </div>
                                    )}
                                    {props.jobs.failed?.length > 0 && (
                                        <div className="job-item failed">
                                            <span>Failed Index:</span>
                                            <strong>{props.jobs.failed.length} file(s)</strong>
                                        </div>
                                    )}
                                    {props.jobs.failed?.length > 0 && (
                                        <button
                                            type="button"
                                            className="jobs-retry-all-btn"
                                            onClick={props.onRetryFailedIndexing}
                                        >
                                            Retry All Failed
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

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
                onRename={props.onRename}
                onMove={props.onMove}
                onDelete={props.onDelete}
                onCreateFolder={props.onCreateFolder}
                clipboard={props.clipboard}
                onCopy={props.onCopy}
                onCut={props.onCut}
                onPaste={props.onPaste}
                onSelectFolder={handleSelectFolder}
                onRenameFolder={props.onRenameFolder}
                onDeleteFolder={props.onDeleteFolder}
                onMoveFolder={props.onMoveFolder}
                onDuplicate={props.onDuplicate}
                onReindex={props.onRebuild}
                onReindexFolder={props.onReindexFolder}
                onProperties={(item) => setPropertiesItem(item)}
                selectedCount={props.selectedIds.length}
            />

        </section>
    );
}

export default DocumentManager;
