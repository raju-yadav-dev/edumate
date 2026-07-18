import "./FolderTree.css";

import { ChevronDown, Folder, FolderPlus } from "lucide-react";

function FolderTree({
    folders,
    activeFolder,
    documentCounts,
    onSelectFolder,
    onCreateFolder,
}) {
    return (
        <aside className="folder-panel">

            <header className="panel-title">

                <div>
                    <h2>Folder Tree</h2>
                    <p>Root knowledge folders</p>
                </div>

                <button
                    type="button"
                    className="folder-add-button"
                    onClick={onCreateFolder}
                    aria-label="Create folder"
                >
                    <FolderPlus size={16} />
                </button>

            </header>

            <div className="folder-list">

                <div className="folder-root">
                    <ChevronDown size={15} />
                    <span>Root</span>
                </div>

                {folders.map((folder) => (

                    <button
                        key={folder.value}
                        type="button"
                        className={`folder-item ${
                            activeFolder === folder.value ? "active" : ""
                        }`}
                        onClick={() => onSelectFolder(folder.value)}
                    >
                        <div className="folder-info">

                            <Folder size={18} />

                            <span>{folder.label}</span>

                        </div>

                        <span className="folder-count">
                            {documentCounts[folder.value] || 0}
                        </span>

                    </button>

                ))}

            </div>

        </aside>
    );
}

export default FolderTree;