import { FiPaperclip, FiTrash2 } from "react-icons/fi";

function FilePreview({ files, onRemove }) {
    if (!files.length) {
        return null;
    }

    return (
        <div className="edu-chat-file-preview-list" aria-label="Selected files">
            {files.map((file) => (
                <article className="edu-chat-file-preview" key={file.id}>
                    <span className="edu-chat-file-preview-icon">
                        <FiPaperclip />
                    </span>

                    <div className="edu-chat-file-preview-meta">
                        <strong>{file.name}</strong>
                        <span>{file.sizeLabel}</span>
                        {file.progress != null ? (
                            <div className="edu-chat-file-preview-progress" aria-hidden="true">
                                <span style={{ width: `${file.progress}%` }} />
                            </div>
                        ) : null}
                    </div>

                    <button type="button" className="edu-chat-icon-button" onClick={() => onRemove(file.id)} aria-label={`Remove ${file.name}`}>
                        <FiTrash2 />
                    </button>
                </article>
            ))}
        </div>
    );
}

export default FilePreview;