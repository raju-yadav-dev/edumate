import "./FolderTree.css";
import { useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderPlus, File, Loader2, Edit2, Trash2, FolderSymlink } from "lucide-react";
import { listAdminDocuments } from "../../../services/adminService";

function FolderNode({
    folder,
    folders,
    activeFolder,
    documentCounts,
    onSelectFolder,
    onSelectTreeDoc,
    onRenameFolder,
    onDeleteFolder,
    onContextMenu,
    expandedFolders,
    toggleFolder,
    folderDocs,
    loading,
    selectedDocument,
    onMoveFolder,
    folderIndexStats,
    onMoveFolderDirect,
    onMoveDocuments,
    onRefresh
}) {
    const isExpanded = !!expandedFolders[folder.value];
    const isLoading = !!loading[folder.value];
    const docs = folderDocs[folder.value] || [];
    const subfolders = folders
        .filter((f) => f.parent === folder.value)
        .sort((a, b) => (a.label || "").localeCompare(b.label || ""));

    const stats = folderIndexStats?.[folder.value] || { status: "empty", failedCount: 0, failedFiles: [] };
    const hasError = stats.status === "failed";
    const failedFiles = stats.failedFiles || [];
    const tooltipText = hasError
        ? `Failed files inside: ${failedFiles.join(", ")}`
        : stats.status === "processing"
        ? "Indexing files in folder..."
        : stats.status === "indexed"
        ? "All files indexed successfully"
        : "Empty folder";

    return (
        <div className="folder-node">
            <div
                className={`folder-item-row ${activeFolder === folder.value ? "active" : ""} ${hasError ? "has-error" : ""}`}
                title={tooltipText}
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
                            await onMoveFolderDirect(data.value, folder.value);
                        }
                    } catch (err) {
                        console.error("Drop failed:", err);
                    }
                }}
                onContextMenu={(e) => {
                    if (onContextMenu) {
                        onContextMenu(e, folder, true);
                    }
                }}
            >
                <button
                    type="button"
                    className={`folder-arrow-btn ${isExpanded ? "expanded" : ""}`}
                    onClick={() => toggleFolder(folder.value)}
                    aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
                >
                    <ChevronRight size={14} />
                </button>

                <button
                    type="button"
                    className="folder-item"
                    onClick={() => onSelectFolder(folder.value)}
                >
                    <div className="folder-info">
                        <span className={`folder-status-indicator ${stats.status}`} />
                        <Folder size={18} />
                        <span>{folder.label}</span>
                    </div>
                </button>

                <div className="folder-meta-actions">
                    <button
                        type="button"
                        className="folder-action-btn edit"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRenameFolder?.(folder.value);
                        }}
                        title="Rename folder"
                    >
                        <Edit2 size={12} />
                    </button>

                    <button
                        type="button"
                        className="folder-action-btn move"
                        onClick={(e) => {
                            e.stopPropagation();
                            onMoveFolder?.(folder.value);
                        }}
                        title="Move folder"
                    >
                        <FolderSymlink size={12} />
                    </button>

                    <button
                        type="button"
                        className="folder-action-btn delete"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDeleteFolder?.(folder.value);
                        }}
                        title="Delete folder"
                    >
                        <Trash2 size={12} />
                    </button>

                    <span className="folder-count">
                        {documentCounts[folder.value] || 0}
                    </span>
                </div>
            </div>

            {isExpanded && (
                <div className="folder-children">
                    {/* Subfolders */}
                    {subfolders.map((sub) => (
                        <FolderNode
                            key={sub.value}
                            folder={sub}
                            folders={folders}
                            activeFolder={activeFolder}
                            documentCounts={documentCounts}
                            onSelectFolder={onSelectFolder}
                            onSelectTreeDoc={onSelectTreeDoc}
                            onRenameFolder={onRenameFolder}
                            onDeleteFolder={onDeleteFolder}
                            onContextMenu={onContextMenu}
                            expandedFolders={expandedFolders}
                            toggleFolder={toggleFolder}
                            folderDocs={folderDocs}
                            loading={loading}
                            selectedDocument={selectedDocument}
                            onMoveFolder={onMoveFolder}
                            folderIndexStats={folderIndexStats}
                            onMoveFolderDirect={onMoveFolderDirect}
                            onMoveDocuments={onMoveDocuments}
                            onRefresh={onRefresh}
                        />
                    ))}

                    {/* Files */}
                    {isLoading ? (
                        <div className="folder-child loading">
                            <Loader2 size={12} className="animate-spin" />
                            <span>Loading...</span>
                        </div>
                    ) : docs.length === 0 && subfolders.length === 0 ? (
                        <div className="folder-child empty">No documents</div>
                    ) : (
                        docs.map((doc) => {
                            const fileStatus = doc.embeddingStatus === "indexed" ? "✅" : doc.embeddingStatus === "failed" ? "❌" : "⏳";
                            return (
                                <button
                                    key={doc._id}
                                    type="button"
                                    className={`folder-child-doc ${selectedDocument?._id === doc._id ? "active" : ""}`}
                                    draggable
                                    onDragStart={(e) => {
                                        e.stopPropagation();
                                        e.dataTransfer.setData("text/plain", JSON.stringify({ type: "file", id: doc._id }));
                                    }}
                                    onClick={() => {
                                        onSelectTreeDoc?.(doc);
                                    }}
                                >
                                    <File size={12} className="doc-icon" />
                                    <span>{doc.title || doc.originalName}</span>
                                    <span className="file-status-icon" title={`Indexing Status: ${doc.embeddingStatus || 'pending'}`}>{fileStatus}</span>
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

function FolderTree(props) {
    const {
        folders,
        activeFolder,
        documentCounts,
        onSelectFolder,
        onCreateFolder,
        onRenameFolder,
        onDeleteFolder,
        onContextMenu,
        selectedDocument,
        onSelectTreeDoc,
        onMoveFolder,
        folderIndexStats,
        onMoveFolderDirect,
        onMoveDocuments,
        onRefresh
    } = props;

    const [expandedFolders, setExpandedFolders] = useState({});
    const [folderDocs, setFolderDocs] = useState({});
    const [loading, setLoading] = useState({});

    async function toggleFolder(folderValue) {
        const isExpanded = !!expandedFolders[folderValue];
        setExpandedFolders((prev) => ({ ...prev, [folderValue]: !isExpanded }));

        // Fetch documents for the folder if expanding and not already loaded
        if (!isExpanded && !folderDocs[folderValue]) {
            try {
                setLoading((prev) => ({ ...prev, [folderValue]: true }));
                const response = await listAdminDocuments({ category: folderValue });
                setFolderDocs((prev) => ({ ...prev, [folderValue]: response.data || [] }));
            } catch (err) {
                console.error("Failed to load documents for folder tree:", err);
            } finally {
                setLoading((prev) => ({ ...prev, [folderValue]: false }));
            }
        }
    }

    const rootFolders = folders
        .filter((f) => !f.parent)
        .sort((a, b) => (a.label || "").localeCompare(b.label || ""));

    return (
        <aside className="folder-panel">
            <header className="panel-title">
                <div>
                    <h2>Folder Tree</h2>
                    <p>Root knowledge folders</p>
                </div>
                <button
                    type="button"
                    className="folder-add-button"
                    onClick={() => onCreateFolder?.()}
                    aria-label="Create folder"
                >
                    <FolderPlus size={16} />
                </button>
            </header>

            <div className="folder-list">
                <button
                    type="button"
                    className={`folder-root-btn ${activeFolder === "root" || activeFolder === "" ? "active" : ""}`}
                    onClick={() => onSelectFolder("root")}
                >
                    <ChevronDown size={15} />
                    <span>Root</span>
                </button>

                {rootFolders.map((folder) => (
                    <FolderNode
                        key={folder.value}
                        folder={folder}
                        folders={folders}
                        activeFolder={activeFolder}
                        documentCounts={documentCounts}
                        onSelectFolder={onSelectFolder}
                        onSelectTreeDoc={onSelectTreeDoc}
                        onRenameFolder={onRenameFolder}
                        onDeleteFolder={onDeleteFolder}
                        onContextMenu={onContextMenu}
                        expandedFolders={expandedFolders}
                        toggleFolder={toggleFolder}
                        folderDocs={folderDocs}
                        loading={loading}
                        selectedDocument={selectedDocument}
                        onMoveFolder={onMoveFolder}
                        folderIndexStats={folderIndexStats}
                        onMoveFolderDirect={onMoveFolderDirect}
                        onMoveDocuments={onMoveDocuments}
                        onRefresh={onRefresh}
                    />
                ))}
            </div>
        </aside>
    );
}

export default FolderTree;