import React, { useState } from "react";
import {
    Folder,
    FolderOpen,
    ChevronRight,
    ChevronDown,
    Layers,
    FileText,
    MoreVertical
} from "lucide-react";

/**
 * StorageTreeNode — Recursive Windows Explorer Tree Node Item
 * 
 * Features:
 * - Dynamic chevron expand/collapse
 * - Active selected folder neon-cyan highlight
 * - Drag-and-drop destination hover highlight
 * - Right-click context menu positioning
 * - File count & indexed badges
 */
export default function StorageTreeNode({
    node,
    depth = 0,
    activePath = "",
    expandedPaths = {},
    onToggleExpand,
    onSelectPath,
    onContextMenu,
    onDropFiles
}) {
    const [isDragOver, setIsDragOver] = useState(false);

    if (!node || node.type !== "folder") return null;

    const isExpanded = !!expandedPaths[node.path];
    const isSelected = activePath === node.path || (node.path === "storage" && (!activePath || activePath === "storage" || activePath === "all"));
    const hasChildren = Array.isArray(node.children) && node.children.some(c => c.type === "folder");

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragOver) setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (typeof onDropFiles === "function" && e.dataTransfer?.files?.length > 0) {
            onDropFiles(e.dataTransfer.files, node.path);
        }
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof onContextMenu === "function") {
            onContextMenu(e, node);
        }
    };

    return (
        <div className="storage-tree-node-wrapper" style={{ paddingLeft: `${depth * 14}px` }}>
            <div
                className={`storage-tree-node-item ${isSelected ? "selected-node" : ""} ${isDragOver ? "drag-over-node" : ""}`}
                onClick={() => onSelectPath(node.path)}
                onContextMenu={handleContextMenu}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="node-item-left">
                    {hasChildren ? (
                        <button
                            type="button"
                            className="node-expand-toggle"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleExpand(node.path);
                            }}
                            title={isExpanded ? "Collapse" : "Expand"}
                        >
                            {isExpanded ? (
                                <ChevronDown size={14} className="chevron-icon expanded" />
                            ) : (
                                <ChevronRight size={14} className="chevron-icon" />
                            )}
                        </button>
                    ) : (
                        <span className="node-indent-spacer" />
                    )}

                    {isExpanded || isSelected ? (
                        <FolderOpen size={16} className="node-folder-icon open" />
                    ) : (
                        <Folder size={16} className="node-folder-icon" />
                    )}

                    <span className="node-name-text" title={node.path || node.name}>
                        {node.name}
                    </span>
                </div>

                <div className="node-item-right">
                    {node.fileCount > 0 && (
                        <span className="node-count-badge" title={`${node.fileCount} file(s)`}>
                            {node.fileCount}
                        </span>
                    )}
                    <button
                        type="button"
                        className="node-menu-trigger"
                        onClick={handleContextMenu}
                        title="Folder Options"
                    >
                        <MoreVertical size={12} />
                    </button>
                </div>
            </div>

            {hasChildren && isExpanded && (
                <div className="storage-tree-children">
                    {node.children
                        .filter(c => c.type === "folder")
                        .map(child => (
                            <StorageTreeNode
                                key={child.path || child.name}
                                node={child}
                                depth={depth + 1}
                                activePath={activePath}
                                expandedPaths={expandedPaths}
                                onToggleExpand={onToggleExpand}
                                onSelectPath={onSelectPath}
                                onContextMenu={onContextMenu}
                                onDropFiles={onDropFiles}
                            />
                        ))}
                </div>
            )}
        </div>
    );
}
