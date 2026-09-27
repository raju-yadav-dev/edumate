import React, { useEffect, useRef } from "react";
import {
    Eye,
    Layers,
    RotateCcw,
    Zap,
    Database,
    Trash2,
    Copy,
    FileText,
    Download
} from "lucide-react";

/**
 * FileContextMenu — Right-Click Context Menu for Documents & Files
 */
export default function FileContextMenu({
    x,
    y,
    file,
    onClose,
    onPreview,
    onViewChunks,
    onRechunk,
    onReEmbed,
    onReindexQdrant,
    onDelete
}) {
    const menuRef = useRef(null);

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

    if (!file) return null;

    const menuWidth = 200;
    const menuHeight = 270;
    const posX = Math.min(x, window.innerWidth - menuWidth - 10);
    const posY = Math.min(y, window.innerHeight - menuHeight - 10);

    const handleCopyPath = (e) => {
        e.stopPropagation();
        const displayPath = file.path || file.name;
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
                <FileText size={14} className="text-neon-cyan" />
                <span className="context-menu-title" title={file.name}>
                    {file.name}
                </span>
            </div>

            <div className="context-menu-divider" />

            <button
                type="button"
                className="context-menu-item"
                onClick={() => {
                    onPreview(file);
                    onClose();
                }}
            >
                <Eye size={14} className="text-neon-cyan" />
                <span>Preview Document</span>
            </button>

            <button
                type="button"
                className="context-menu-item"
                onClick={() => {
                    onViewChunks(file);
                    onClose();
                }}
            >
                <Layers size={14} className="text-neon-green" />
                <span>View Chunks ({file.totalChunks || file.indexedChunks || 0})</span>
            </button>

            <div className="context-menu-divider" />

            <button
                type="button"
                className="context-menu-item"
                onClick={() => {
                    onRechunk(file);
                    onClose();
                }}
            >
                <RotateCcw size={14} />
                <span>Re-chunk Document</span>
            </button>

            <button
                type="button"
                className="context-menu-item"
                onClick={() => {
                    onReindexQdrant(file);
                    onClose();
                }}
            >
                <Database size={14} />
                <span>Reindex Qdrant Vectors</span>
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

            <button
                type="button"
                className="context-menu-item danger"
                onClick={() => {
                    onDelete(file);
                    onClose();
                }}
            >
                <Trash2 size={14} />
                <span>Delete File</span>
            </button>
        </div>
    );
}
