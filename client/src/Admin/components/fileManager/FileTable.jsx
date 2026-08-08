import "./FileTable.css";
import { useState } from "react";

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
    Edit2
} from "lucide-react";

import { formatDate } from "../../utils/formatData";
import { formatBytes } from "../../utils/formatBytes";
import { getFileType, normalizeStatus } from "../../utils/documentUtils";

function FileTable(props) {
    const {
        documents,
        busy,
        selectedIds,
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
        setSelectedIds,
        onRefresh
    } = props;

    const [lastSelectedIndex, setLastSelectedIndex] = useState(null);

    const handleCheckboxChange = (fileId, index, event) => {
        if (event.nativeEvent.shiftKey && lastSelectedIndex !== null) {
            const start = Math.min(index, lastSelectedIndex);
            const end = Math.max(index, lastSelectedIndex);
            const idsInRange = documents.slice(start, end + 1).map(d => d._id);
            const newSelectedIds = Array.from(new Set([...selectedIds, ...idsInRange]));
            setSelectedIds(newSelectedIds);
        } else {
            onToggleSelected(fileId);
            setLastSelectedIndex(index);
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

                <span><CheckSquare size={15} /></span>

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
            >

                {(() => {
                    const activeFolderVal = activeFolder || "root";
                    const subfolders = (folders || [])
                        .filter(f => {
                            if (activeFolderVal === "root" || activeFolderVal === "") {
                                    return !f.parent;
                                }
                                return f.parent === activeFolderVal;
                        })
                        .sort((a, b) => (a.label || "").localeCompare(b.label || ""));

                    return (
                        <>
                            {subfolders.map((folder) => (
                                <article
                                    key={folder.value}
                                    className="file-row folder-row"
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
                                    onClick={() => onSelectDocument?.(null)}
                                    onContextMenu={(event) =>
                                        onContextMenu(event, folder, true)
                                    }
                                >
                                    <div className="table-checkbox">
                                        {/* Empty space */}
                                    </div>

                                    <div className="table-icon">
                                        <Folder className="folder-icon" style={{ color: "var(--admin-gold)" }} />
                                    </div>

                                    <button
                                        type="button"
                                        className="row-main"
                                        onClick={() =>
                                            onSelectFolder(folder.value)
                                        }
                                    >
                                        <div className="row-text">
                                            <strong>
                                                {folder.label}
                                            </strong>
                                        </div>
                                    </button>

                                    <span>Folder</span>

                                    <span>-</span>

                                    <span>-</span>

                                    <span>-</span>

                                    <span>-</span>

                                    <span className="document-status status-active">
                                        active
                                    </span>

                                    <div className="actions">
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
                            ))}

                            {busy && documents.length === 0 && subfolders.length === 0 && (
                                <div className="empty-state">
                                    Loading document metadata...
                                </div>
                            )}

                            {!busy && documents.length === 0 && subfolders.length === 0 && (
                                <div className="empty-state">
                                    No files in this folder yet.
                                </div>
                            )}
                        </>
                    );
                })()}

                {documents.map((file, fileIndex) => {

                    const status = normalizeStatus(file);
                    const statusClass = statusColors[status] || "status-processing";
                    const displayLabel = statusLabel[status] || status;
                    const dotColor = status === 'ready' || status === 'indexed' ? '#2ecc71' : status === 'failed' ? '#e74c3c' : status === 'not_required' ? '#95a5a6' : '#f1c40f';

                    return (

                        <article
                            key={file._id}
                            className={selectedDocument?._id === file._id ? "file-row selected" : "file-row"}
                            draggable
                            onDragStart={(e) => {
                                e.stopPropagation();
                                e.dataTransfer.setData("text/plain", JSON.stringify({ type: "file", id: file._id }));
                            }}
                            onContextMenu={(event) =>
                                onContextMenu(event, file)
                            }
                        >

                            <div className="table-checkbox">

                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(file._id)}
                                    onChange={(event) =>
                                        handleCheckboxChange(file._id, fileIndex, event)
                                    }
                                    aria-label={`Select ${file.originalName}`}
                                />

                            </div>

                            <div className="table-icon">

                                <File className="pdf-icon" />

                            </div>

                            <button
                                type="button"
                                className="row-main"
                                onClick={() =>
                                    onSelectDocument?.(file)
                                }
                            >

                                <div className="row-text">

                                    <strong>
                                        {file.title || file.originalName}
                                    </strong>

                                    <span>
                                        {file.originalName}
                                    </span>

                                </div>

                            </button>

                            <span>{getFileType(file)}</span>

                            <span>{formatBytes(file.fileSize || file.size)}</span>

                            <span>
                                {file.createdBy?.fullName ||
                                    file.uploadedBy?.fullName ||
                                    "Admin"}
                            </span>

                            <span>
                                {formatDate(file.createdAt)}
                            </span>

                            <span>
                                {formatDate(
                                    file.updatedAt || file.createdAt
                                )}
                            </span>

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

                            <div className="actions">

                                <button
                                    className="icon-button"
                                    title="Preview details"
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

                                <label className="icon-button">

                                    <UploadCloud size={16} />

                                    <input
                                        hidden
                                        type="file"
                                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.markdown,.json,.xml,.png,.jpg,.jpeg,.webp,.gif,.zip"
                                        onChange={(event) =>
                                            onReplace(
                                                file._id,
                                                event.target.files?.[0] || null
                                            )
                                        }
                                    />

                                </label>

                                <button
                                    className="icon-button"
                                    title="Rebuild embeddings"
                                    type="button"
                                    onClick={() =>
                                        onRebuild(file._id)
                                    }
                                >
                                    <RefreshCcw size={16} />
                                </button>

                                <button
                                    className="icon-button"
                                    title="Delete"
                                    type="button"
                                    onClick={() =>
                                        onDelete(file._id)
                                    }
                                >
                                    <Trash2 size={16} />
                                </button>

                            </div>

                        </article>

                    );
                })}

            </div>

        </div>
    );
}

export default FileTable;
