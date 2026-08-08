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
    storageStats
}) {
    const isExpanded = !!expandedFolders[folder.value];
    const isLoading = !!loading[folder.value];
    const docs = folderDocs[folder.value] || [];
    const subfolders = folders
        .filter((f) => f.parent === folder.value)
        .sort((a, b) => (a.label || "").localeCompare(b.label || ""));

    const hasFailedDoc = (folderVal) => {
        if (storageStats?.categoryCounts?.[folderVal]?.failed > 0) {
            return true;
        }
        const children = folders.filter((f) => f.parent === folderVal);
        for (const child of children) {
            if (hasFailedDoc(child.value)) {
                return true;
            }
        }
        return false;
    };

    const isFailedFolder = hasFailedDoc(folder.value);

    return (
        <div className="folder-node">
            <div
                className={`folder-item-row ${activeFolder === folder.value ? "active" : ""}`}
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
                    <div className="folder-info" style={isFailedFolder ? { color: "var(--danger, #ef4444)" } : {}}>
                        <Folder size={18} style={isFailedFolder ? { color: "var(--danger, #ef4444)" } : {}} />
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
                            storageStats={storageStats}
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
                            const isFailed = doc.embeddingStatus === "failed";
                            return (
                                <button
                                    key={doc._id}
                                    type="button"
                                    className={`folder-child-doc ${selectedDocument?._id === doc._id ? "active" : ""} ${isFailed ? "failed" : ""}`}
                                    style={isFailed ? { color: "var(--danger, #ef4444)" } : {}}
                                    onClick={() => {
                                        onSelectTreeDoc?.(doc);
                                    }}
                                >
                                    <File size={12} className="doc-icon" style={isFailed ? { color: "var(--danger, #ef4444)" } : {}} />
                                    <span>{doc.title || doc.originalName}</span>
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
        storageStats
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
                        storageStats={storageStats}
                    />
                ))}
            </div>
        </aside>
    );
}

export default FolderTree;