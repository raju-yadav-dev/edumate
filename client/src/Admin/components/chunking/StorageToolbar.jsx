import React from "react";
import {
    Search,
    X,
    LayoutGrid,
    List,
    ArrowUpDown,
    Upload,
    Play,
    RotateCcw,
    FolderPlus,
    RefreshCw,
    Trash2,
    CheckSquare,
    Square,
    Sparkles,
    Filter
} from "lucide-react";

/**
 * StorageToolbar — Windows Explorer Command Bar
 * 
 * Features:
 * - Search inside active directory
 * - Sort options (Name, Size, Modified, Status)
 * - Grid/List view toggle
 * - Batch operations (Chunk, Reindex, Delete)
 * - Upload & New Folder quick actions
 */
export default function StorageToolbar({
    searchQuery = "",
    onSearchChange,
    sortBy = "name",
    sortOrder = "asc",
    onSortChange,
    viewMode = "list", // list | grid
    onViewModeChange,
    statusFilter = "all",
    onStatusFilterChange,
    selectedCount = 0,
    totalCount = 0,
    isAllSelected = false,
    onSelectAll,
    onUploadClick,
    onCreateFolderClick,
    onChunkFolderClick,
    onReindexFolderClick,
    onSyncStorageClick,
    onBatchDeleteClick,
    isExecuting = false,
    activeFolder = "storage"
}) {
    return (
        <div className="storage-toolbar-container">
            {/* Left Section: Search & Status Filters */}
            <div className="toolbar-left-group">
                {/* Search in Current Folder */}
                <div className="toolbar-search-box">
                    <Search size={14} className="search-icon" />
                    <input
                        type="text"
                        placeholder={`Search in ${activeFolder === "storage" ? "storage" : activeFolder}...`}
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="toolbar-search-input"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            className="clear-search-btn"
                            onClick={() => onSearchChange("")}
                            title="Clear search"
                        >
                            <X size={13} />
                        </button>
                    )}
                </div>

                {/* Status Filter Pills */}
                <div className="toolbar-filter-pills">
                    {[
                        { id: "all", label: "All" },
                        { id: "completed", label: "Indexed" },
                        { id: "queued", label: "Queued" },
                        { id: "pending", label: "Pending" },
                        { id: "failed", label: "Failed" }
                    ].map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            className={`filter-pill-btn ${statusFilter === f.id ? "active" : ""}`}
                            onClick={() => onStatusFilterChange(f.id)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Section: Actions & View Modes */}
            <div className="toolbar-right-group">
                {/* Multi-Selection Actions Bar (Conditional) */}
                {selectedCount > 0 ? (
                    <div className="toolbar-batch-actions">
                        <button
                            type="button"
                            className="toolbar-action-btn primary"
                            onClick={onChunkFolderClick}
                            disabled={isExecuting}
                            title="Chunk & Vectorize Selected Files"
                        >
                            <Play size={14} />
                            <span>Chunk ({selectedCount})</span>
                        </button>
                        <button
                            type="button"
                            className="toolbar-action-btn secondary"
                            onClick={onReindexFolderClick}
                            disabled={isExecuting}
                            title="Re-embed & Reindex Selected"
                        >
                            <RotateCcw size={14} />
                            <span>Reindex</span>
                        </button>
                        <button
                            type="button"
                            className="toolbar-action-btn danger"
                            onClick={onBatchDeleteClick}
                            disabled={isExecuting}
                            title="Delete Selected Files"
                        >
                            <Trash2 size={14} />
                            <span>Delete</span>
                        </button>
                    </div>
                ) : (
                    /* Default Folder Operations */
                    <div className="toolbar-default-actions">
                        <button
                            type="button"
                            className="toolbar-action-btn primary"
                            onClick={onUploadClick}
                            title="Upload documents to current folder"
                        >
                            <Upload size={14} />
                            <span>Upload</span>
                        </button>

                        <button
                            type="button"
                            className="toolbar-action-btn"
                            onClick={onCreateFolderClick}
                            title="Create new subdirectory"
                        >
                            <FolderPlus size={14} />
                            <span>New Folder</span>
                        </button>

                        <button
                            type="button"
                            className="toolbar-action-btn secondary"
                            onClick={onChunkFolderClick}
                            disabled={isExecuting}
                            title="Chunk and index all documents in this folder"
                        >
                            <Play size={14} />
                            <span>Chunk Folder</span>
                        </button>

                        <button
                            type="button"
                            className="toolbar-action-btn"
                            onClick={onSyncStorageClick}
                            disabled={isExecuting}
                            title="Scan storage disk and sync metadata with MongoDB"
                        >
                            <RefreshCw size={14} className={isExecuting ? "spinning" : ""} />
                            <span>Sync</span>
                        </button>
                    </div>
                )}

                <div className="toolbar-divider" />

                {/* Sort Dropdown */}
                <div className="toolbar-sort-dropdown">
                    <ArrowUpDown size={14} className="sort-icon" />
                    <select
                        value={`${sortBy}-${sortOrder}`}
                        onChange={(e) => {
                            const [newSort, newOrder] = e.target.value.split("-");
                            onSortChange(newSort, newOrder);
                        }}
                        className="toolbar-sort-select"
                        title="Sort files by"
                    >
                        <option value="name-asc">Name (A → Z)</option>
                        <option value="name-desc">Name (Z → A)</option>
                        <option value="size-desc">Size (Largest first)</option>
                        <option value="size-asc">Size (Smallest first)</option>
                        <option value="mtime-desc">Modified (Newest first)</option>
                        <option value="mtime-asc">Modified (Oldest first)</option>
                        <option value="status-asc">Status</option>
                    </select>
                </div>

                {/* View Mode Toggle: List vs Grid */}
                <div className="toolbar-view-toggle">
                    <button
                        type="button"
                        className={`view-mode-btn ${viewMode === "list" ? "active" : ""}`}
                        onClick={() => onViewModeChange("list")}
                        title="List view (Details table)"
                    >
                        <List size={15} />
                    </button>
                    <button
                        type="button"
                        className={`view-mode-btn ${viewMode === "grid" ? "active" : ""}`}
                        onClick={() => onViewModeChange("grid")}
                        title="Grid view (Card tiles)"
                    >
                        <LayoutGrid size={15} />
                    </button>
                </div>
            </div>
        </div>
    );
}
