import "./FileTable.css";

import {
    CheckSquare,
    Download,
    File,
    RefreshCcw,
    Trash2,
    UploadCloud,
} from "lucide-react";

import { formatDate } from "../../utils/formatData";
import { formatBytes } from "../../utils/formatBytes";
import { getFileType, normalizeStatus } from "../../utils/documentUtils";

function FileTable({
    documents,
    busy,
    selectedIds,
    onToggleSelected,
    onSelectDocument,
    onDownload,
    onReplace,
    onRebuild,
    onDelete,
    onContextMenu,
}) {
    return (
        <div className="file-table">

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

            <div className="file-rows">

                {busy && documents.length === 0 && (
                    <div className="empty-state">
                        Loading document metadata...
                    </div>
                )}

                {!busy && documents.length === 0 && (
                    <div className="empty-state">
                        No files in this folder yet.
                    </div>
                )}

                {documents.map((file) => {

                    const status = normalizeStatus(file);

                    return (

                        <article
                            key={file._id}
                            className="file-row"
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
                                    onSelectDocument(file)
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
                                    onClick={() => onDownload(file)}
                                >
                                    <Download size={16} />
                                </button>

                                <label className="icon-button">

                                    <UploadCloud size={16} />

                                    <input
                                        hidden
                                        type="file"
                                        accept="application/pdf,.pdf"
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
                                    onClick={() =>
                                        onRebuild(file._id)
                                    }
                                >
                                    <RefreshCcw size={16} />
                                </button>

                                <button
                                    className="icon-button"
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
