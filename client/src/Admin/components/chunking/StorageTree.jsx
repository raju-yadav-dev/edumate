import React, { useState, useEffect, useMemo } from "react";
import {
    Folder,
    FolderOpen,
    FolderPlus,
    RefreshCw,
    ChevronsDown,
    ChevronsRight,
    Search,
    HardDrive,
    Database,
    Boxes,
    Layers,
    ChevronDown,
    ChevronRight
} from "lucide-react";
import StorageTreeNode from "./StorageTreeNode";

const STORAGE_EXPANDED_KEY = "edumate_storage_tree_expanded_v1";

/**
 * StorageTree — Windows Explorer / VS Code Style Recursive Sidebar
 * 
 * Strict Root Rules:
 * - Root is strictly: `edumate`
 * - Child is strictly: `storage`
 * - Children inside `storage` dynamically reflect the real filesystem tree
 */
export default function StorageTree({
    treeData = [],
    stats = {},
    activePath = "storage",
    onSelectFolder,
    onCreateFolder,
    onRefreshTree,
    onContextMenu,
    onDropFiles,
    isLoading = false
}) {
    const [searchFilter, setSearchFilter] = useState("");
    const [expandedPaths, setExpandedPaths] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_EXPANDED_KEY);
            if (saved) return JSON.parse(saved);
        } catch (_) {}
        return { edumate: true, storage: true };
    });

    // Save expanded states
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_EXPANDED_KEY, JSON.stringify(expandedPaths));
        } catch (_) {}
    }, [expandedPaths]);

    // Auto-expand path leading to activeFolder
    useEffect(() => {
        if (!activePath || activePath === "storage" || activePath === "edumate") return;
        const segments = activePath.split("/").filter(Boolean);
        let curr = "";
        const toExpand = { edumate: true, storage: true };
        segments.forEach((seg) => {
            curr = curr ? `${curr}/${seg}` : seg;
            toExpand[curr] = true;
        });
        setExpandedPaths((prev) => ({ ...prev, ...toExpand }));
    }, [activePath]);

    const toggleExpand = (path) => {
        setExpandedPaths((prev) => ({
            ...prev,
            [path]: !prev[path]
        }));
    };

    const expandAll = () => {
        const all = { edumate: true, storage: true };
        const collect = (nodes, prefix = "") => {
            if (!Array.isArray(nodes)) return;
            nodes.forEach((n) => {
                if (n.type === "folder") {
                    all[n.path] = true;
                    if (n.children) collect(n.children, n.path);
                }
            });
        };
        collect(treeData);
        setExpandedPaths(all);
    };

    const collapseAll = () => {
        setExpandedPaths({ edumate: true, storage: true });
    };

    // Filtered tree nodes
    const filteredTree = useMemo(() => {
        if (!searchFilter.trim()) return treeData;
        const query = searchFilter.toLowerCase().trim();

        const filterNodes = (nodes) => {
            const result = [];
            for (const node of nodes) {
                if (node.type === "folder") {
                    const matches = node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query);
                    const filteredChildren = node.children ? filterNodes(node.children) : [];
                    if (matches || filteredChildren.length > 0) {
                        result.push({
                            ...node,
                            children: filteredChildren
                        });
                    }
                }
            }
            return result;
        };

        return filterNodes(treeData);
    }, [treeData, searchFilter]);

    // Count total folders & files in tree
    const totalMetrics = useMemo(() => {
        let files = 0;
        let folders = 0;
        const scan = (nodes) => {
            if (!Array.isArray(nodes)) return;
            nodes.forEach((n) => {
                if (n.type === "folder") {
                    folders++;
                    if (n.children) scan(n.children);
                } else if (n.type === "file") {
                    files++;
                }
            });
        };
        scan(treeData);
        return { files, folders };
    }, [treeData]);

    const isStorageSelected = !activePath || activePath === "storage" || activePath === "all" || activePath === "";

    return (
        <aside className="storage-explorer-sidebar">
            {/* 1. Sidebar Header */}
            <div className="storage-tree-header">
                <div className="tree-title-group">
                    <Boxes size={18} className="text-neon-cyan" />
                    <div>
                        <h3 className="tree-header-heading">Knowledge Explorer</h3>
                        <span className="tree-header-sub">
                            {totalMetrics.folders} folders • {stats.files || totalMetrics.files} files
                        </span>
                    </div>
                </div>

                <div className="tree-header-actions">
                    <button
                        type="button"
                        className="tree-icon-btn"
                        onClick={expandAll}
                        title="Expand All Folders"
                    >
                        <ChevronsDown size={14} />
                    </button>
                    <button
                        type="button"
                        className="tree-icon-btn"
                        onClick={collapseAll}
                        title="Collapse All Folders"
                    >
                        <ChevronsRight size={14} />
                    </button>
                    <button
                        type="button"
                        className={`tree-icon-btn ${isLoading ? "spinning" : ""}`}
                        onClick={onRefreshTree}
                        title="Refresh Storage Tree"
                    >
                        <RefreshCw size={14} />
                    </button>
                    <button
                        type="button"
                        className="tree-icon-btn highlight"
                        onClick={() => onCreateFolder(activePath === "storage" ? "" : activePath)}
                        title="New Folder in Selected Directory"
                    >
                        <FolderPlus size={14} />
                    </button>
                </div>
            </div>

            {/* 2. Folder Search Input */}
            <div className="storage-tree-search-bar">
                <Search size={14} className="search-icon" />
                <input
                    type="text"
                    placeholder="Filter folders..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="tree-search-input"
                />
                {searchFilter && (
                    <button
                        type="button"
                        className="clear-search-btn"
                        onClick={() => setSearchFilter("")}
                    >
                        ×
                    </button>
                )}
            </div>

            {/* 3. Recursive Tree View */}
            <div className="storage-tree-content scrollable-tree">
                {/* Fixed Root Node 1: edumate */}
                <div className="root-project-node">
                    <div
                        className="storage-tree-node-item root-node"
                        onClick={() => onSelectFolder("storage")}
                    >
                        <button
                            type="button"
                            className="node-expand-toggle"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand("edumate");
                            }}
                        >
                            {expandedPaths.edumate ? (
                                <ChevronDown size={14} className="chevron-icon expanded" />
                            ) : (
                                <ChevronRight size={14} className="chevron-icon" />
                            )}
                        </button>
                        <HardDrive size={16} className="text-neon-cyan node-folder-icon" />
                        <span className="node-name-text root-name">edumate</span>
                        <span className="root-badge">Workspace</span>
                    </div>

                    {expandedPaths.edumate && (
                        <div className="root-storage-subnode" style={{ paddingLeft: "14px" }}>
                            {/* Fixed Root Node 2: storage */}
                            <div
                                className={`storage-tree-node-item storage-root-node ${isStorageSelected ? "selected-node" : ""}`}
                                onClick={() => onSelectFolder("storage")}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onContextMenu(e, { name: "storage", path: "storage", type: "folder", isRoot: true });
                                }}
                            >
                                <button
                                    type="button"
                                    className="node-expand-toggle"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleExpand("storage");
                                    }}
                                >
                                    {expandedPaths.storage ? (
                                        <ChevronDown size={14} className="chevron-icon expanded" />
                                    ) : (
                                        <ChevronRight size={14} className="chevron-icon" />
                                    )}
                                </button>
                                {expandedPaths.storage ? (
                                    <FolderOpen size={16} className="node-folder-icon open text-neon-green" />
                                ) : (
                                    <Folder size={16} className="node-folder-icon text-neon-green" />
                                )}
                                <span className="node-name-text">storage</span>
                                <span className="node-count-badge">{stats.files || totalMetrics.files}</span>
                            </div>

                            {/* Dynamic Subfolders inside storage */}
                            {expandedPaths.storage && (
                                <div className="dynamic-storage-subfolders">
                                    {filteredTree.length === 0 ? (
                                        <div className="tree-empty-notice">
                                            {searchFilter ? "No matching folders." : "No folders found in storage/."}
                                        </div>
                                    ) : (
                                        filteredTree
                                            .filter(c => c.type === "folder")
                                            .map((folderNode) => (
                                                <StorageTreeNode
                                                    key={folderNode.path || folderNode.name}
                                                    node={folderNode}
                                                    depth={1}
                                                    activePath={activePath}
                                                    expandedPaths={expandedPaths}
                                                    onToggleExpand={toggleExpand}
                                                    onSelectPath={onSelectFolder}
                                                    onContextMenu={onContextMenu}
                                                    onDropFiles={onDropFiles}
                                                />
                                            ))
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 4. Sidebar Footer Summary */}
            <div className="storage-tree-footer">
                <div className="storage-capacity-summary">
                    <div className="capacity-label-row">
                        <span>Local Disk</span>
                        <strong>{stats.usedFormatted || "0 MB"}</strong>
                    </div>
                    <div className="storage-progress-bar">
                        <div
                            className="storage-progress-fill"
                            style={{ width: `${Math.min(100, Math.max(2, stats.usage || 5))}%` }}
                        />
                    </div>
                </div>
            </div>
        </aside>
    );
}
