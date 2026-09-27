import React, { useState, useMemo } from "react";
import {
    Folder,
    FolderOpen,
    ChevronRight,
    ChevronDown,
    Plus,
    Edit3,
    Trash2,
    Move,
    FileText,
    FolderPlus
} from "lucide-react";

export default function FolderTreeSidebar({
    documents = [],
    activeFolder = "all",
    onSelectFolder,
    onCreateFolder,
    onCreateFile,
    onRenameFolder,
    onDeleteFolder
}) {
    const [expandedFolders, setExpandedFolders] = useState({ root: true });

    // Build tree structure from document categories
    const folderTree = useMemo(() => {
        const root = { name: "All Knowledge", path: "all", count: documents.length, children: {} };
        
        documents.forEach((doc) => {
            const cat = String(doc.category || doc.folder || "others").trim();
            const parts = cat.split("/").filter(Boolean);
            let current = root;
            let currentPath = "";

            parts.forEach((part, index) => {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                if (!current.children[part]) {
                    current.children[part] = {
                        name: part,
                        path: currentPath,
                        count: 0,
                        children: {}
                    };
                }
                current.children[part].count += 1;
                current = current.children[part];
            });
        });

        return root;
    }, [documents]);

    const toggleExpand = (path, e) => {
        e.stopPropagation();
        setExpandedFolders((prev) => ({
            ...prev,
            [path]: !prev[path]
        }));
    };

    const renderTreeNodes = (node, depth = 0) => {
        const childKeys = Object.keys(node.children);
        const hasChildren = childKeys.length > 0;
        const isExpanded = !!expandedFolders[node.path];
        const isActive = activeFolder === node.path;

        return (
            <div key={node.path} className="tree-node-wrapper" style={{ paddingLeft: `${depth * 14}px` }}>
                <div
                    className={`tree-node-item ${isActive ? "active-tree-node" : ""}`}
                    onClick={() => onSelectFolder(node.path)}
                >
                    <div className="tree-node-left">
                        {hasChildren ? (
                            <button
                                type="button"
                                className="tree-expand-btn"
                                onClick={(e) => toggleExpand(node.path, e)}
                            >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                        ) : (
                            <span className="tree-indent-spacer" />
                        )}

                        {isExpanded || isActive ? (
                            <FolderOpen size={16} className="tree-folder-icon active-icon" />
                        ) : (
                            <Folder size={16} className="tree-folder-icon" />
                        )}

                        <span className="tree-node-name" title={node.name}>
                            {node.name}
                        </span>
                    </div>

                    <div className="tree-node-right">
                        <span className="tree-node-badge">{node.count}</span>

                        {node.path !== "all" && (
                            <div className="tree-hover-actions">
                                <button
                                    type="button"
                                    className="tree-action-icon-btn"
                                    title="Rename folder"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRenameFolder(node.path);
                                    }}
                                >
                                    <Edit3 size={12} />
                                </button>
                                <button
                                    type="button"
                                    className="tree-action-icon-btn danger"
                                    title="Delete folder"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteFolder(node.path, node.count);
                                    }}
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {hasChildren && isExpanded && (
                    <div className="tree-children-container">
                        {childKeys.map((key) => renderTreeNodes(node.children[key], depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <aside className="chunking-tree-sidebar">
            <div className="tree-sidebar-header">
                <div className="tree-sidebar-title-row">
                    <span className="tree-sidebar-title">Explorer</span>
                    <div className="tree-sidebar-tools">
                        <button
                            type="button"
                            className="tree-tool-btn"
                            title="Create new folder"
                            onClick={() => onCreateFolder(activeFolder === "all" ? "" : activeFolder)}
                        >
                            <FolderPlus size={14} />
                            <span>Folder</span>
                        </button>
                        <button
                            type="button"
                            className="tree-tool-btn primary"
                            title="Create knowledge document placeholder"
                            onClick={() => onCreateFile(activeFolder === "all" ? "admissions" : activeFolder)}
                        >
                            <Plus size={14} />
                            <span>Doc</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="tree-sidebar-body">
                {renderTreeNodes(folderTree)}
            </div>
        </aside>
    );
}
