import "./ContextMenu.css";

import {
    Copy,
    Download,
    Eye as PreviewEye,
    Trash2,
    Edit2,
    FolderSymlink,
    UploadCloud,
    Scissors,
    Clipboard
} from "lucide-react";

function ContextMenu({
    menu,
    onClose,
    onOpen,
    onDownload,
    onRename,
    onMove,
    onDelete,
    onCreateFolder,
    clipboard,
    onCopy,
    onCut,
    onPaste,
    onSelectFolder,
    onRenameFolder,
    onDeleteFolder,
    onMoveFolder
}) {
    if (!menu) {
        return null;
    }

    const hasClipboard = clipboard && clipboard.fileIds && clipboard.fileIds.length > 0;

    return (
        <div
            className="context-menu"
            style={{
                left: menu.x,
                top: menu.y,
                position: "fixed",
                zIndex: 9999
            }}
            onMouseLeave={onClose}
        >
            {menu.file ? (
                <>
                    <button onClick={() => { onOpen(menu.file); onClose(); }}>
                        <PreviewEye size={16} />
                        <span>Open</span>
                    </button>

                    <button onClick={() => { onCopy?.(menu.file._id); onClose(); }}>
                        <Copy size={16} />
                        <span>Copy</span>
                    </button>

                    <button onClick={() => { onCut?.(menu.file._id); onClose(); }}>
                        <Scissors size={16} />
                        <span>Cut</span>
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
            ) : menu.folder ? (
                <>
                    <button onClick={() => { onSelectFolder(menu.folder.value); onClose(); }}>
                        <PreviewEye size={16} />
                        <span>Open Folder</span>
                    </button>

                    {hasClipboard && (
                        <button onClick={() => { onPaste(menu.folder.value); onClose(); }}>
                            <Clipboard size={16} />
                            <span>Paste Here</span>
                        </button>
                    )}

                    <button onClick={() => { onRenameFolder?.(menu.folder.value); onClose(); }}>
                        <Edit2 size={16} />
                        <span>Rename</span>
                    </button>

                    <button onClick={() => { onMoveFolder?.(menu.folder.value); onClose(); }}>
                        <FolderSymlink size={16} />
                        <span>Move Folder</span>
                    </button>

                    <button
                        className="danger"
                        onClick={() => { onDeleteFolder?.(menu.folder.value); onClose(); }}
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

                    {hasClipboard && (
                        <button onClick={() => { onPaste(); onClose(); }}>
                            <Clipboard size={16} />
                            <span>Paste Here</span>
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

export default ContextMenu;
