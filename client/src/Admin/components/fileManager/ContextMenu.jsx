import "./ContextMenu.css";

import {
    Copy,
    Download,
    Eye as PreviewEye,
    Trash2,
    Edit2,
    FolderSymlink,
    UploadCloud
} from "lucide-react";

function ContextMenu({
    menu,
    onClose,
    onOpen,
    onDownload,
    onRename,
    onMove,
    onDelete,
    onCreateFolder
}) {
    if (!menu) {
        return null;
    }

    const copyPath = () => {
        if (menu.file) {
            navigator.clipboard?.writeText(
                menu.file.filePath ||
                menu.file.originalName ||
                ""
            );
        }
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
            {menu.file ? (
                <>
                    <button onClick={() => { onOpen(menu.file); onClose(); }}>
                        <PreviewEye size={16} />
                        <span>Open</span>
                    </button>

                    <button onClick={() => { copyPath(); onClose(); }}>
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

                    <button onClick={() => {
                        document.querySelector(".upload-dropzone input")?.click();
                        onClose();
                    }}>
                        <UploadCloud size={16} />
                        <span>Upload File</span>
                    </button>

                    <button onClick={() => { onDownload(menu.file); onClose(); }}>
                        <Download size={16} />
                        <span>Download</span>
                    </button>

                    <button
                        className="danger"
                        onClick={() => { onDelete(menu.file._id); onClose(); }}
                    >
                        <Trash2 size={16} />
                        <span>Delete</span>
                    </button>
                </>
            ) : (
                <>
                    <button onClick={() => {
                        document.querySelector(".upload-dropzone input")?.click();
                        onClose();
                    }}>
                        <UploadCloud size={16} />
                        <span>Upload File</span>
                    </button>

                    {onCreateFolder && (
                        <button onClick={() => { onCreateFolder(); onClose(); }}>
                            <FolderSymlink size={16} />
                            <span>New Folder</span>
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

export default ContextMenu;

