import "./PreviewPanel.css";

import {
    Download,
    Eye as PreviewEye,
    FileText,
    X
} from "lucide-react";

import { formatDate } from "../../utils/formatData";
import { formatBytes } from "../../utils/formatBytes";
import {
    getDocumentUrl,
    getFileType,
    normalizeStatus,
} from "../../utils/documentUtils";

function PreviewPanel({ file, onClose, onOpen, onDownload }) {

    if (!file) {

        return (

            <aside className="preview-panel">

                <div className="preview-empty">

                    <FileText size={60} />

                    <h3>No File Selected</h3>

                    <p>Select a document from the table to preview it.</p>

                </div>

            </aside>

        );

    }

    const type = getFileType(file);

    const url = getDocumentUrl(file);

    return (

        <aside className="preview-panel">

            {/* Header */}

            <div className="preview-head">

                <div>

                    <strong>{file.originalName}</strong>

                    <span>{type} Document</span>

                </div>

                <button
                    type="button"
                    className="preview-close"
                    onClick={onClose}
                >
                    <X size={18} />
                </button>

            </div>

            {/* Preview */}

            <div className="preview-surface">

                {type === "PDF" && url ? (

                    <iframe
                        title={file.originalName}
                        src={url}
                    />

                ) : (

                    <div className="preview-placeholder">

                        <FileText size={60} />

                        <span>No Preview Available</span>

                    </div>

                )}

            </div>

            {/* Metadata */}

            <div className="metadata-grid">

                <div className="metadata-item">
                    <small>Size</small>
                    <strong>{formatBytes(file.fileSize || file.size)}</strong>
                </div>

                <div className="metadata-item">
                    <small>Type</small>
                    <strong>{type}</strong>
                </div>

                <div className="metadata-item">
                    <small>Pages</small>
                    <strong>{file.pages || "Unknown"}</strong>
                </div>

                <div className="metadata-item">
                    <small>Created</small>
                    <strong>{formatDate(file.createdAt)}</strong>
                </div>

                <div className="metadata-item">
                    <small>Modified</small>
                    <strong>{formatDate(file.updatedAt || file.createdAt)}</strong>
                </div>

                <div className="metadata-item">
                    <small>Status</small>
                    <strong className={`status-${normalizeStatus(file)}`}>
                        {normalizeStatus(file)}
                    </strong>
                </div>

            </div>

            {/* Actions */}

            <div className="preview-actions">

                <button
                    className="primary-action"
                    onClick={() => onOpen(file)}
                >
                    <PreviewEye size={16} />
                    Open
                </button>

                <button
                    className="secondary-action"
                    onClick={() => onDownload(file)}
                >
                    <Download size={16} />
                    Download
                </button>

            </div>

        </aside>

    );

}

export default PreviewPanel;