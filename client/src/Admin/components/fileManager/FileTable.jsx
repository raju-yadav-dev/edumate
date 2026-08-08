import "./FileTable.css";
import { useState, useMemo } from "react";
import {
    CheckSquare,
    Download,
    File,
    RefreshCcw,
    Trash2,
    UploadCloud,
    Eye,
    FolderSymlink,
    Folder,
    Edit2,
    ChevronLeft,
    ChevronRight,
    Files
} from "lucide-react";

import { formatDate } from "../../utils/formatData";
import { formatBytes } from "../../utils/formatBytes";
import { getFileType, normalizeStatus } from "../../utils/documentUtils";

function FileTable(props) {
    const {
        documents = [],
        busy,
        selectedIds = [],
        onToggleSelected,
        onSelectDocument,
        selectedDocument,
        onDownload,
        onReplace,
        onRebuild,
        onDelete,
        onContextMenu,
        viewMode = "list",
        folders = [],
        activeFolder = "root",
        onSelectFolder,
        onRenameFolder,
        onDeleteFolder,
        onMoveFolder,
        onMoveFolderDirect,
        onMoveDocuments,
        onCopyDocuments,
        setSelectedIds,
        onRefresh,
        onDuplicate,
        onReindexFolder,
        onProperties,
        // Pagination props
        currentPage = 1,
        pageSize = 50,
        totalItems = 0,
        totalPages = 1,
        onPageChange,
        onPageSizeChange,
        // Search & focused state
        search = "",
        focusedIndex = null,
        setFocusedIndex
    } = props;

    // Filter subfolders of the current active folder
    const subfolders = useMemo(() => {
        const activeFolderVal = activeFolder || "root";
        const list = (folders || []).filter(f => {
            if (activeFolderVal === "root" || activeFolderVal === "") {
                return !f.parent;
            }
            return f.parent === activeFolderVal;
        });

        // Apply name search to folders if active
        if (search) {
            const s = search.toLowerCase();
            return list.filter(f => f.label.toLowerCase().includes(s));
        }

        return list.sort((a, b) => (a.label || "").localeCompare(b.label || ""));
    }, [folders, activeFolder, search]);

    // Unified list of items in the current viewport (folders first, then paginated files)
    const viewItems = useMemo(() => {
        const items = [
            ...subfolders.map(folder => ({
                id: `folder:${folder.value}`,
                isFolder: true,
                name: folder.label,
                value: folder.value,
                folderObj: folder
            })),
            ...documents.map(file => ({
                id: file._id,
                isFolder: false,
                name: file.title || file.originalName,
                fileObj: file
            }))
        ];
        return items;
    }, [subfolders, documents]);

    // Multi-select & Shift-selection range mapping
    const handleRowClick = (item, index, event) => {
        event.stopPropagation();
        
        const itemId = item.id;
        setFocusedIndex?.(index);

        if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
            document.activeElement.blur();
        }

        if (event.ctrlKey || event.metaKey) {
            // Toggle selection of this item
            onToggleSelected?.(itemId);
        } else if (event.shiftKey && focusedIndex !== null && focusedIndex < viewItems.length) {
            // Select range from last focused index to current
            const start = Math.min(focusedIndex, index);
            const end = Math.max(focusedIndex, index);
            const idsInRange = viewItems.slice(start, end + 1).map(item => item.id);
            // Union selections
            const nextSelected = Array.from(new Set([...selectedIds, ...idsInRange]));
            setSelectedIds?.(nextSelected);
        } else {
            // Normal click - select single item
            setSelectedIds?.([itemId]);
            if (item.isFolder) {
                onSelectDocument?.(item.folderObj); // Show folder in properties/preview
            } else {
                onSelectDocument?.(item.fileObj);
            }
        }
    };

    const handleCheckboxChange = (itemId, index, event) => {
        event.stopPropagation();
        if (event.nativeEvent.shiftKey && focusedIndex !== null) {
            const start = Math.min(index, focusedIndex);
            const end = Math.max(index, focusedIndex);
            const idsInRange = viewItems.slice(start, end + 1).map(item => item.id);
            const nextSelected = Array.from(new Set([...selectedIds, ...idsInRange]));
            setSelectedIds?.(nextSelected);
        } else {
            onToggleSelected?.(itemId);
            setFocusedIndex?.(index);
        }
    };

    const statusColors = {
        ready: "status-active",
        indexed: "status-active",
        processing: "status-processing",
        embedding: "status-processing",
        queued: "status-processing",
        failed: "status-failed",
        not_required: "status-disabled"
    };

    const statusLabel = {
        ready: "Indexed",
        indexed: "Indexed",
        processing: "Indexing",
        embedding: "Embedding",
        queued: "Queued",
        failed: "Index Failed",
        not_required: "Not Required"
    };

    return (
        <div className={viewMode === "grid" ? "file-table grid-view" : "file-table"}>

            {/* ================= TABLE HEADER ================= */}

            <div className="table-head">
                <span onClick={() => {
                    const allIds = viewItems.map(i => i.id);
                    if (selectedIds.length === viewItems.length) {
                        setSelectedIds?.([]);
                    } else {
                        setSelectedIds?.(allIds);
                    }
                }} style={{ cursor: "pointer" }}>
                    <CheckSquare size={15} />
                </span>
                <span>Icon</span>
                <span>Filename</span>
                <span>Type</span>
                <span>Size</span>
                <span>Uploaded By</span>
                <span>Uploaded Date</span>
                <span>Last Modified</span>
                <span>Status</span>
                <span>Actions</span>
            </div>

            {/* ================= TABLE BODY ================= */}

            <div
                className="file-rows"
                onContextMenu={(event) => {
                    if (event.target.classList.contains("file-rows") || event.target.classList.contains("empty-state")) {
                        onContextMenu?.(event, null);
                    }
                }}
                onClick={() => {
                    setSelectedIds?.([]);
                    onSelectDocument?.(null);
                    setFocusedIndex?.(null);
                    if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
                        document.activeElement.blur();
                    }
                }}
            >
                {viewItems.length === 0 ? (
                    busy ? (
                        <div className="empty-state">Loading documents...</div>
                    ) : (
                        <div className="empty-state">No files or folders found here.</div>
                    )
                ) : (
                    viewItems.map((item, index) => {
                        const isFolder = item.isFolder;
                        const isSelected = selectedIds.includes(item.id);
                        const isFocused = focusedIndex === index;

                        if (isFolder) {
                            const folder = item.folderObj;
                            return (
                                <article
                                    key={item.id}
                                    className={`file-row folder-row ${isSelected ? "selected" : ""} ${isFocused ? "focused" : ""}`}
                                    draggable
                                    onDragStart={(e) => {
                                        e.stopPropagation();
                                        e.dataTransfer.setData("text/plain", JSON.stringify({ type: "folder", value: folder.value }));
                                    }}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.currentTarget.classList.add("drag-over");
                                    }}
                                    onDragLeave={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.currentTarget.classList.remove("drag-over");
                                    }}
                                    onDrop={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.currentTarget.classList.remove("drag-over");
                                        try {
                                            const rawData = e.dataTransfer.getData("text/plain");
                                            if (!rawData) return;
                                            const data = JSON.parse(rawData);
                                            if (data.type === "file") {
                                                await onMoveDocuments([data.id], folder.value);
                                                onRefresh?.();
                                            } else if (data.type === "folder") {
                                                if (data.value === folder.value) return;
                                                await onMoveFolderDirect?.(data.value, folder.value);
                                            }
                                        } catch (err) {
                                            console.error("Drop failed:", err);
                                        }
                                    }}
                                    onDoubleClick={() => onSelectFolder(folder.value)}
                                    onClick={(e) => handleRowClick(item, index, e)}
                                    onContextMenu={(event) => {
                                        event.stopPropagation();
                                        onContextMenu(event, folder, true);
                                    }}
                                >
                                    <div className="table-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => handleCheckboxChange(item.id, index, e)}
                                            onClick={(e) => e.stopPropagation()}
                                            aria-label={`Select folder ${folder.label}`}
                                        />
                                    </div>

                                    <div className="table-icon">
                                        <Folder className="folder-icon" style={{ color: "var(--admin-gold)" }} />
                                    </div>

                                    <button
                                        type="button"
                                        className="row-main"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectFolder(folder.value);
                                        }}
                                    >
                                        <div className="row-text">
                                            <strong>{folder.label}</strong>
                                        </div>
                                    </button>

                                    <span>Folder</span>
                                    <span>-</span>
                                    <span>-</span>
                                    <span>-</span>
                                    <span>-</span>
                                    <span className="document-status status-active">active</span>

                                    <div className="actions" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            className="icon-button"
                                            title="Open Folder"
                                            type="button"
                                            onClick={() => onSelectFolder(folder.value)}
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            className="icon-button"
                                            title="Rename Folder"
                                            type="button"
                                            onClick={() => onRenameFolder?.(folder.value)}
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            className="icon-button"
                                            title="Move Folder"
                                            type="button"
                                            onClick={() => onMoveFolder?.(folder.value)}
                                        >
                                            <FolderSymlink size={16} />
                                        </button>
                                        <button
                                            className="icon-button"
                                            title="Delete Folder"
                                            type="button"
                                            onClick={() => onDeleteFolder?.(folder.value)}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </article>
                            );
                        } else {
                            const file = item.fileObj;
                            const status = normalizeStatus(file);
                            const statusClass = statusColors[status] || "status-processing";
                            const displayLabel = statusLabel[status] || status;
                            const dotColor = status === 'ready' || status === 'indexed' ? '#2ecc71' : status === 'failed' ? '#e74c3c' : status === 'not_required' ? '#95a5a6' : '#f1c40f';

                            return (
                                <article
                                    key={item.id}
                                    className={`file-row ${isSelected ? "selected" : ""} ${isFocused ? "focused" : ""}`}
                                    draggable
                                    onDragStart={(e) => {
                                        e.stopPropagation();
                                        // Support dragging multiple selected items or just this single item
                                        const dragIds = selectedIds.includes(file._id) 
                                            ? selectedIds.filter(id => !id.startsWith("folder:"))
                                            : [file._id];
                                        e.dataTransfer.setData("text/plain", JSON.stringify({ type: "file", id: file._id, ids: dragIds }));
                                    }}
                                    onClick={(e) => handleRowClick(item, index, e)}
                                    onContextMenu={(event) => {
                                        event.stopPropagation();
                                        onContextMenu(event, file, false);
                                    }}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        onSelectDocument?.(file);
                                    }}
                                >
                                    <div className="table-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => handleCheckboxChange(item.id, index, e)}
                                            onClick={(e) => e.stopPropagation()}
                                            aria-label={`Select document ${file.originalName}`}
                                        />
                                    </div>

                                    <div className="table-icon">
                                        <File className="pdf-icon" />
                                    </div>

                                    <button
                                        type="button"
                                        className="row-main"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectDocument?.(file);
                                        }}
                                    >
                                        <div className="row-text">
                                            <strong>{file.title || file.originalName}</strong>
                                            <span>{file.originalName}</span>
                                        </div>
                                    </button>

                                    <span>{getFileType(file)}</span>
                                    <span>{formatBytes(file.fileSize || file.size)}</span>
                                    <span>{file.createdBy?.fullName || file.uploadedBy?.fullName || "Admin"}</span>
                                    <span>{formatDate(file.createdAt)}</span>
                                    <span>{formatDate(file.updatedAt || file.createdAt)}</span>

                                    <span className={`document-status ${statusClass}`}>
                                        <span
                                            className="folder-status-indicator"
                                            style={{
                                                backgroundColor: dotColor,
                                                verticalAlign: "middle",
                                                marginRight: "4px"
                                            }}
                                        />
                                        {displayLabel}
                                    </span>

                                    <div className="actions" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            className="icon-button"
                                            title="Preview Details"
                                            type="button"
                                            onClick={() => onSelectDocument?.(file)}
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            className="icon-button"
                                            title="Download"
                                            type="button"
                                            onClick={() => onDownload(file)}
                                        >
                                            <Download size={16} />
                                        </button>
                                        <label className="icon-button" title="Replace File">
                                            <UploadCloud size={16} style={{ cursor: "pointer" }} />
                                            <input
                                                hidden
                                                type="file"
                                                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.markdown,.json,.xml,.png,.jpg,.jpeg,.webp,.gif,.zip"
                                                onChange={(e) => onReplace(file._id, e.target.files?.[0] || null)}
                                            />
                                        </label>
                                        <button
                                            className="icon-button"
                                            title="Duplicate"
                                            type="button"
                                            onClick={() => onDuplicate?.(file._id)}
                                        >
                                            <Files size={16} />
                                        </button>
                                        <button
                                            className="icon-button"
                                            title="Rebuild Embeddings"
                                            type="button"
                                            onClick={() => onRebuild(file._id)}
                                        >
                                            <RefreshCcw size={16} />
                                        </button>
                                        <button
                                            className="icon-button"
                                            title="Delete"
                                            type="button"
                                            onClick={() => onDelete(file._id)}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </article>
                            );
                        }
                    })
                )}
            </div>

            {/* ================= PAGINATION FOOTER ================= */}
            {totalItems > 0 && (
                <footer className="file-table-pagination">
                    <div className="pagination-info">
                        Showing <strong>{Math.min(totalItems, (currentPage - 1) * pageSize + 1)}</strong> to <strong>{Math.min(totalItems, currentPage * pageSize)}</strong> of <strong>{totalItems}</strong> files
                    </div>
                    <div className="pagination-controls">
                        <button
                            type="button"
                            className="pagination-btn"
                            disabled={currentPage <= 1}
                            onClick={() => onPageChange?.(currentPage - 1)}
                            aria-label="Previous Page"
                        >
                            <ChevronLeft size={16} />
                            <span>Prev</span>
                        </button>
                        
                        <div className="pagination-pages">
                            {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
                                // Simple sliding window for page numbers
                                let pageNum = idx + 1;
                                if (currentPage > 3 && totalPages > 5) {
                                    pageNum = currentPage - 3 + idx;
                                    if (pageNum + (4 - idx) > totalPages) {
                                        pageNum = totalPages - 4 + idx;
                                    }
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        type="button"
                                        className={`pagination-page-num ${currentPage === pageNum ? "active" : ""}`}
                                        onClick={() => onPageChange?.(pageNum)}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            className="pagination-btn"
                            disabled={currentPage >= totalPages}
                            onClick={() => onPageChange?.(currentPage + 1)}
                            aria-label="Next Page"
                        >
                            <span>Next</span>
                            <ChevronRight size={16} />
                        </button>

                        <div className="pagination-size-selector">
                            <select
                                value={pageSize}
                                onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
                                aria-label="Items per page"
                            >
                                <option value={20}>20 / page</option>
                                <option value={50}>50 / page</option>
                                <option value={100}>100 / page</option>
                                <option value={200}>200 / page</option>
                            </select>
                        </div>
                    </div>
                </footer>
            )}
        </div>
    );
}

export default FileTable;
