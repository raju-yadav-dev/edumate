import "./FolderTree.css";
import { useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderPlus, File, Loader2, Edit2, Trash2 } from "lucide-react";
import { listAdminDocuments } from "../../../services/adminService";

function FolderTree(props) {
    const {
        folders,
        activeFolder,
        documentCounts,
        onSelectFolder,
        onCreateFolder,
        onRenameFolder,
        onDeleteFolder,
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
                    onClick={onCreateFolder}
                    aria-label="Create folder"
                >
                    <FolderPlus size={16} />
                </button>
            </header>

            <div className="folder-list">
                <div className="folder-root">
                    <ChevronDown size={15} />
                    <span>Root</span>
                </div>

                {folders.map((folder) => {
                    const isExpanded = !!expandedFolders[folder.value];
                    const isLoading = !!loading[folder.value];
                    const docs = folderDocs[folder.value] || [];

                    return (
                        <div key={folder.value} className="folder-node">
                            <div className={`folder-item-row ${activeFolder === folder.value ? "active" : ""}`}>
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
                                    {isLoading ? (
                                        <div className="folder-child loading">
                                            <Loader2 size={12} className="animate-spin" />
                                            <span>Loading...</span>
                                        </div>
                                    ) : docs.length === 0 ? (
                                        <div className="folder-child empty">No documents</div>
                                    ) : (
                                        docs.map((doc) => (
                                            <button
                                                key={doc._id}
                                                type="button"
                                                className={`folder-child-doc ${
                                                    props.selectedDocument?._id === doc._id ? "active" : ""
                                                }`}
                                                onClick={() => {
                                                    props.onSelectTreeDoc?.(doc);
                                                }}
                                            >
                                                <File size={12} className="doc-icon" />
                                                <span>{doc.title || doc.originalName}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}

export default FolderTree;