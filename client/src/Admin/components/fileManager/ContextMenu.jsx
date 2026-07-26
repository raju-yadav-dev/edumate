import "./ContextMenu.css";

import {
    Copy,
    Download,
    Eye as PreviewEye,
    Trash2,
    Edit2,
    FolderSymlink
} from "lucide-react";

function ContextMenu({
    menu,
    onClose,
    onOpen,
    onDownload,
    onRename,
    onMove,
    onDelete,
}) {
    if (!menu?.file) {
        return null;
    }

    const copyPath = () => {
        navigator.clipboard?.writeText(
            menu.file.filePath ||
            menu.file.originalName ||
            ""
        );
    };

    return (
        <div
            className="context-menu"
            style={{
                left: menu.x,
                top: menu.y,
            }}
            onMouseLeave={onClose}
        >

            <button onClick={() => onOpen(menu.file)}>
                <PreviewEye size={16} />
                <span>Open</span>
            </button>

            <button onClick={copyPath}>
                <Copy size={16} />
                <span>Copy Path</span>
            </button>

            <button onClick={() => { onRename(menu.file._id, menu.file.originalName || menu.file.title); onClose(); }}>
                <Edit2 size={16} />
                <span>Rename</span>
            </button>

            <button onClick={() => { onMove(menu.file._id, menu.file.category); onClose(); }}>
                <FolderSymlink size={16} />
                <span>Move to Folder</span>
            </button>

            <div className="context-divider" />

            <button onClick={() => onDownload(menu.file)}>
                <Download size={16} />
                <span>Download</span>
            </button>

            <button
                className="danger"
                onClick={() => onDelete(menu.file._id)}
            >
                <Trash2 size={16} />
                <span>Delete</span>
            </button>

        </div>
    );
}

export default ContextMenu;
