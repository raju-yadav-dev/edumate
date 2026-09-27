import React, { useEffect, useRef } from "react";
import {
    Upload,
    Play,
    RotateCcw,
    RefreshCw,
    Edit3,
    Trash2,
    Copy,
    FolderOpen,
    FolderPlus,
    FileText,
    Check
} from "lucide-react";

/**
 * FolderContextMenu — Right-Click Context Menu for Directories
 */
export default function FolderContextMenu({
    x,
    y,
    folder,
    onClose,
    onUploadHere,
    onScanFolder,
    onChunkFolder,
    onReindexFolder,
    onRefresh,
    onRename,
    onDelete,
    onNewSubfolder
}) {
    const menuRef = useRef(null);

    // Close on click outside or escape key
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);

    if (!folder) return null;

    // Adjust position to stay inside screen bounds
    const menuWidth = 200;
    const menuHeight = 280;
    const posX = Math.min(x, window.innerWidth - menuWidth - 10);
    const posY = Math.min(y, window.innerHeight - menuHeight - 10);

    const handleCopyPath = (e) => {
        e.stopPropagation();
        const displayPath = folder.path === "storage" ? "storage" : `storage/${folder.path}`;
        navigator.clipboard.writeText(displayPath);
        onClose();
    };

    return (
        <div
            ref={menuRef}
            className="storage-context-menu"
            style={{ top: `${posY}px`, left: `${posX}px` }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="context-menu-header">
                <FolderOpen size={14} className="text-neon-cyan" />
                <span className="context-menu-title" title={folder.name || folder.path}>
                    {folder.name || folder.path}
                </span>
            </div>

            <div className="context-menu-divider" />

            <button
                type="button"
                className="context-menu-item"
                onClick={() => {
                    onUploadHere(folder.path);
                    onClose();
                }}
            >
                <Upload size={14} />
                <span>Upload Here</span>
            </button>

            <button
                type="button"
                className="context-menu-item"
                onClick={() => {
                    onNewSubfolder(folder.path);
                    onClose();
                }}
            >
                <FolderPlus size={14} />
                <span>New Subfolder</span>
            </button>

            <div className="context-menu-divider" />

            <button
                type="button"
                className="context-menu-item"
                onClick={() => {
                    onChunkFolder(folder.path, false);
                    onClose();
                }}
            >
                <Play size={14} className="text-neon-cyan" />
                <span>Chunk Folder</span>
            </button>

            <button
                type="button"
                className="context-menu-item"
                onClick={() => {
                    onReindexFolder(folder.path, true);
                    onClose();
                }}
            >
                <RotateCcw size={14} className="text-neon-green" />
                <span>Reindex Folder</span>
            </button>

            <button
                type="button"
                className="context-menu-item"
                onClick={() => {
                    onScanFolder(folder.path);
                    onClose();
                }}
            >
                <RefreshCw size={14} />
                <span>Scan & Sync</span>
            </button>

            <div className="context-menu-divider" />

            <button
                type="button"
                className="context-menu-item"
                onClick={handleCopyPath}
            >
                <Copy size={14} />
                <span>Copy Path</span>
            </button>

            {!folder.isRoot && folder.path !== "storage" && (
                <>
                    <button
                        type="button"
                        className="context-menu-item"
                        onClick={() => {
                            onRename(folder);
                            onClose();
                        }}
                    >
                        <Edit3 size={14} />
                        <span>Rename Folder</span>
                    </button>

                    <button
                        type="button"
                        className="context-menu-item danger"
                        onClick={() => {
                            onDelete(folder);
                            onClose();
                        }}
                    >
                        <Trash2 size={14} />
                        <span>Delete Folder</span>
                    </button>
                </>
            )}
        </div>
    );
}
