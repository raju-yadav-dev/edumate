import "./ContextMenu.css";

import {
    Copy,
    Download,
    Edit3,
    Eye as PreviewEye,
    MoveRight,
    Trash2,
} from "lucide-react";

function ContextMenu({
    menu,
    onClose,
    onOpen,
    onDownload,
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

            <div className="context-divider" />

            <button onClick={() => onDownload(menu.file)}>
                <Download size={16} />
                <span>Download</span>
            </button>

            <button>
                <Edit3 size={16} />
                <span>Rename</span>
            </button>

            <button>
                <MoveRight size={16} />
                <span>Move</span>
            </button>

            <div className="context-divider" />

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
