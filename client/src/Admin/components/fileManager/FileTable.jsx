import "./FileTable.css";

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
        onMoveFolder
    } = props;
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

                {documents.map((file) => {

                    const status = normalizeStatus(file);

                    return (

                        <article
                            key={file._id}
                            className={selectedDocument?._id === file._id ? "file-row selected" : "file-row"}
                            onContextMenu={(event) =>
                                onContextMenu(event, file)
                            }
                        >

                            <div className="table-checkbox">

                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(file._id)}
                                    onChange={() =>
                                        onToggleSelected(file._id)
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

                            <span
                                className={`document-status status-${status}`}
                            >
                                {status}
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
