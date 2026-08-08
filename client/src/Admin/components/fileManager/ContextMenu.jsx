import "./ContextMenu.css";
import {
    Copy,
    Download,
    Eye,
    Trash2,
    Edit2,
    FolderOpen,
    UploadCloud,
    Scissors,
    Clipboard,
    RefreshCw,
    Info,
    FolderPlus,
    Files,
    Play
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
    onMoveFolder,
    onDuplicate,
    onReindex,
    onReindexFolder,
    onProperties,
    selectedCount = 0
}) {
    if (!menu) {
        return null;
    }

    const hasClipboard = clipboard && (
        (clipboard.fileIds && clipboard.fileIds.length > 0) || 
        (clipboard.folderValues && clipboard.folderValues.length > 0)
    );

    const isMultiSelect = selectedCount > 1;

    // Determine the context target
    const targetFile = menu.file;
    const targetFolder = menu.folder;
    const isFolder = !!targetFolder;

    // Handle clicks securely
    const handleAction = (callback, ...args) => {
        if (callback) callback(...args);
        onClose();
    };

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
            {isMultiSelect ? (
                // Multiple items selected context menu
                <>
                    <div className="context-menu-header">
                        <span>Selected ({selectedCount})</span>
                    </div>
                    <div className="context-divider" />
                    
                    <button onClick={() => handleAction(onCopy)}>
                        <Copy size={16} />
                        <span>Copy Selection</span>
                    </button>

                    <button onClick={() => handleAction(onCut)}>
                        <Scissors size={16} />
                        <span>Cut Selection</span>
                    </button>

                    <button onClick={() => handleAction(onReindex)}>
                        <RefreshCw size={16} />
                        <span>Re-index Selection</span>
                    </button>

                    <div className="context-divider" />

                    <button className="danger" onClick={() => handleAction(onDelete)}>
                        <Trash2 size={16} />
                        <span>Delete Selection</span>
                    </button>
                </>
            ) : isFolder ? (
                // Single Folder Context Menu
                <>
                    <button onClick={() => handleAction(onSelectFolder, targetFolder.value)}>
                        <FolderOpen size={16} />
                        <span>Open Folder</span>
                    </button>

                    <button onClick={() => handleAction(onCopy, `folder:${targetFolder.value}`)}>
                        <Copy size={16} />
                        <span>Copy Folder</span>
                    </button>

                    <button onClick={() => handleAction(onCut, `folder:${targetFolder.value}`)}>
                        <Scissors size={16} />
                        <span>Cut Folder</span>
                    </button>

                    {hasClipboard && (
                        <button onClick={() => handleAction(onPaste, targetFolder.value)}>
                            <Clipboard size={16} />
                            <span>Paste Here</span>
                        </button>
                    )}

                    <button onClick={() => handleAction(onRenameFolder, targetFolder.value)}>
                        <Edit2 size={16} />
                        <span>Rename Folder</span>
                    </button>

                    <button onClick={() => handleAction(onMoveFolder, targetFolder.value)}>
                        <FolderSymlink size={16} />
                        <span>Move Folder</span>
                    </button>

                    <button onClick={() => handleAction(onDownload, targetFolder)}>
                        <Download size={16} />
                        <span>Download Zip</span>
                    </button>

                    <button onClick={() => handleAction(onReindexFolder, targetFolder.value)}>
                        <RefreshCw size={16} />
                        <span>Re-index Folder</span>
                    </button>

                    <div className="context-divider" />

                    <button onClick={() => handleAction(onProperties, targetFolder)}>
                        <Info size={16} />
                        <span>Properties</span>
                    </button>

                    <button className="danger" onClick={() => handleAction(onDeleteFolder, targetFolder.value)}>
                        <Trash2 size={16} />
                        <span>Delete Folder</span>
                    </button>
                </>
            ) : targetFile ? (
                // Single File Context Menu
                <>
                    <button onClick={() => handleAction(onOpen, targetFile)}>
                        <Eye size={16} />
                        <span>Open / Preview</span>
                    </button>

                    <button onClick={() => handleAction(onCopy, targetFile._id)}>
                        <Copy size={16} />
                        <span>Copy</span>
                    </button>

                    <button onClick={() => handleAction(onCut, targetFile._id)}>
                        <Scissors size={16} />
                        <span>Cut</span>
                    </button>

                    <button onClick={() => handleAction(onRename, targetFile._id, targetFile.originalName || targetFile.title)}>
                        <Edit2 size={16} />
                        <span>Rename</span>
                    </button>

                    <button onClick={() => handleAction(onMove, targetFile._id, targetFile.category)}>
                        <FolderSymlink size={16} />
                        <span>Move to Folder</span>
                    </button>

                    <button onClick={() => handleAction(onDuplicate, targetFile._id)}>
                        <Files size={16} />
                        <span>Duplicate</span>
                    </button>

                    <button onClick={() => handleAction(onDownload, targetFile)}>
                        <Download size={16} />
                        <span>Download</span>
                    </button>

                    <button onClick={() => handleAction(onReindex, targetFile._id)}>
                        <RefreshCw size={16} />
                        <span>Re-index File</span>
                    </button>

                    <div className="context-divider" />

                    <button onClick={() => {
                        document.querySelector(".upload-dropzone input")?.click();
                        onClose();
                    }}>
                        <UploadCloud size={16} />
                        <span>Upload File</span>
                    </button>

                    <button onClick={() => handleAction(onCreateFolder)}>
                        <FolderPlus size={16} />
                        <span>New Folder</span>
                    </button>

                    <button onClick={() => handleAction(onProperties, targetFile)}>
                        <Info size={16} />
                        <span>Properties</span>
                    </button>

                    <button className="danger" onClick={() => handleAction(onDelete, targetFile._id)}>
                        <Trash2 size={16} />
                        <span>Delete</span>
                    </button>
                </>
            ) : (
                // Empty Space Context Menu
                <>
                    <button onClick={() => handleAction(onCreateFolder)}>
                        <FolderPlus size={16} />
                        <span>New Folder</span>
                    </button>

                    <button onClick={() => {
                        document.querySelector(".upload-dropzone input")?.click();
                        onClose();
                    }}>
                        <UploadCloud size={16} />
                        <span>Upload File</span>
                    </button>

                    {hasClipboard && (
                        <button onClick={() => handleAction(onPaste)}>
                            <Clipboard size={16} />
                            <span>Paste Here</span>
                        </button>
                    )}

                    <div className="context-divider" />

                    <button onClick={() => handleAction(onProperties, "currentFolder")}>
                        <Info size={16} />
                        <span>Folder Properties</span>
                    </button>
                </>
            )}
        </div>
    );
}

// Simple fallback icon in case FolderSymlink is not found in standard Lucide
function FolderSymlink({ size = 16, ...props }) {
    return <FolderOpen size={size} {...props} style={{ opacity: 0.8, color: "var(--admin-gold)" }} />;
}

export default ContextMenu;
