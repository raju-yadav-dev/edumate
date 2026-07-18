import {
    Download,
    Edit3,
    Filter,
    FolderPlus,
    Home,
    List,
    MoveRight,
    RefreshCcw,
    Search,
    Trash2,
    UploadCloud
} from "lucide-react";

import { formatBytes } from "../../utils/formatBytes";
import ContextMenu from "./ContextMenu";
import FileTable from "./FileTable";
import FolderTree from "./FolderTree";
import UploadDialog from "./UploadDialog";
import "./FileManager.css";

function DocumentManager(props) {
    const selectedCount = props.selectedIds.length;

    return (
        <section className="document-manager-shell">

            {/* ================= HEADER ================= */}

            <div className="panel-header-row document-manager-head">

                <div>
                    <h2>File Manager</h2>
                    <p>Upload, organize, preview, and manage knowledge files.</p>
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
                        Upload
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
                    >
                        <Edit3 size={16} />
                        Rename
                    </button>

                    <button
                        type="button"
                        className="secondary-action"
                    >
                        <MoveRight size={16} />
                        Move
                    </button>

                    <button
                        type="button"
                        className="secondary-action"
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
                        onClick={props.onRefresh}
                    >
                        <RefreshCcw size={16} />
                        Refresh
                    </button>

                </div>

            </div>

            {/* ================= MAIN LAYOUT ================= */}

            <div className="document-layout">

                {/* ========== LEFT SIDEBAR ========== */}

                <aside className="document-sidebar">

                    <FolderTree {...props} />

                    <UploadDialog {...props} />

                </aside>

                {/* ========== CENTER CONTENT ========== */}

                <section className="document-content">

                    {/* Toolbar */}

                    <div className="toolbar">

                        <div className="path">

                            <Home size={16} />

                            <span>Admin</span>

                            <span>/</span>

                            <span>{props.activeFolderLabel}</span>

                            {selectedCount > 0 && (
                                <b>{selectedCount} selected</b>
                            )}

                        </div>

                        <div className="search">

                            <Search size={16} />

                            <input
                                placeholder={`Search in ${props.activeFolderLabel}...`}
                                value={props.search}
                                onChange={(event) =>
                                    props.setSearch(event.target.value)
                                }
                            />

                        </div>

                        <div className="toolbar-icons">

                            <button
                                type="button"
                                className="icon-button"
                                onClick={props.onRefresh}
                                aria-label="Refresh"
                            >
                                <RefreshCcw size={16} />
                            </button>

                            <button
                                type="button"
                                className="icon-button"
                                aria-label="Sort"
                            >
                                <List size={16} />
                            </button>

                            <button
                                type="button"
                                className="icon-button"
                                onClick={props.onReset}
                                aria-label="Filter"
                            >
                                <Filter size={16} />
                            </button>

                        </div>

                    </div>

                    {/* Filters */}

                    <div className="document-filter-row">

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

                    </div>

                    {/* File Table */}

                    <FileTable {...props} />

                    {/* Footer */}

                    <div className="table-footer">

                        <span>
                            Showing {props.documents.length} files
                        </span>

                        <span>
                            Total size: {formatBytes(props.visibleFolderStorage)}
                        </span>

                    </div>

                </section>

            </div>

            {/* Floating Context Menu */}

            <ContextMenu
                menu={props.contextMenu}
                onClose={props.closeContextMenu}
                onOpen={props.onOpenDocument}
                onDownload={props.onDownload}
                onDelete={props.onDelete}
            />

        </section>
    );
}

export default DocumentManager;
