import {
    Download,
    Filter,
    FolderPlus,
    Grid2X2,
    List,
    RefreshCcw,
    Search,
    Trash2,
    UploadCloud
} from "lucide-react";
import { useMemo, useState } from "react";

import { formatBytes } from "../../utils/formatBytes";
import ContextMenu from "./ContextMenu";
import FileTable from "./FileTable";
import FolderTree from "./FolderTree";
import UploadDialog from "./UploadDialog";
import "./FileManager.css";

function DocumentManager(props) {
    const selectedCount = props.selectedIds.length;
    const [viewMode, setViewMode] = useState("list");
    const [showFilters, setShowFilters] = useState(false);
    const [sortMode, setSortMode] = useState("date-desc");
    const sortedDocuments = useMemo(() => {
        const copy = [...props.documents];

        copy.sort((first, second) => {
            if (sortMode === "name-asc") {
                return String(first.title || first.originalName || "").localeCompare(String(second.title || second.originalName || ""));
            }

            if (sortMode === "size-desc") {
                return Number(second.fileSize || second.size || 0) - Number(first.fileSize || first.size || 0);
            }

            return new Date(second.updatedAt || second.createdAt || 0) - new Date(first.updatedAt || first.createdAt || 0);
        });

        return copy;
    }, [props.documents, sortMode]);

    function downloadSelected() {
        props.documents
            .filter((file) => props.selectedIds.includes(file._id))
            .forEach((file) => props.onDownload(file));
    }

    return (
        <section className="document-manager-shell">

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

                </aside>

                {/* ========== CENTER CONTENT ========== */}

                <section className="document-content">

                    {/* Toolbar */}

                    <div className="toolbar">

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
                        </select>

                        <button type="button" className="secondary-action" onClick={props.onReset}>
                            Clear
                        </button>

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

                    <FileTable
                        {...props}
                        documents={sortedDocuments}
                        viewMode={viewMode}
                        onSelectDocument={props.setSelectedDocument}
                        selectedDocument={props.selectedDocument}
                    />

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

            {/* Hidden upload form keeps the top Upload Files button functional. */}
            <div className="document-upload-portal">
                <UploadDialog {...props} />
            </div>

            {/* Floating Context Menu */}

            <ContextMenu
                menu={props.contextMenu}
                onClose={props.closeContextMenu}
                onOpen={props.onOpenDocument}
                onDownload={props.onDownload}
                onRename={props.onRename}
                onMove={props.onMove}
                onDelete={props.onDelete}
            />

        </section>
    );
}

export default DocumentManager;
