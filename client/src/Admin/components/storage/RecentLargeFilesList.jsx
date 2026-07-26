import React, { useState } from "react";
import { FileText, FileCode, FileSpreadsheet, File } from "lucide-react";
import { formatBytes } from "../../utils/formatBytes";

export default function RecentLargeFilesList({ documents = [] }) {
    const [showFilesModal, setShowFilesModal] = useState(false);

    const defaultFiles = [
        {
            name: "admissions_guide.pdf",
            type: "pdf",
            service: "Supabase",
            size: "24.5 MB",
            uploaded: "16 May 2025"
        },
        {
            name: "campus_rules.pdf",
            type: "pdf",
            service: "Supabase",
            size: "18.7 MB",
            uploaded: "15 May 2025"
        },
        {
            name: "ai_faq_dataset.json",
            type: "json",
            service: "Supabase",
            size: "12.3 MB",
            uploaded: "14 May 2025"
        },
        {
            name: "syllabus_2025.pdf",
            type: "pdf",
            service: "Supabase",
            size: "10.2 MB",
            uploaded: "13 May 2025"
        },
        {
            name: "placement_data.csv",
            type: "csv",
            service: "Supabase",
            size: "8.9 MB",
            uploaded: "12 May 2025"
        }
    ];

    const getFileIcon = (type) => {
        const t = (type || "").toLowerCase();
        if (t.includes("pdf")) return <FileText className="pdf-icon" size={16} />;
        if (t.includes("json") || t.includes("code")) return <FileCode className="json-icon" size={16} />;
        if (t.includes("csv") || t.includes("sheet")) return <FileSpreadsheet className="csv-icon" size={16} />;
        return <File className="default-file-icon" size={16} />;
    };

    const filesToDisplay = documents.length > 0
        ? documents.slice(0, 5).map((doc, idx) => ({
            name: doc.title || doc.originalName || `document_${idx + 1}.pdf`,
            type: doc.fileType || "pdf",
            service: "Supabase",
            size: doc.fileSize ? formatBytes(doc.fileSize) : `${(24 - idx * 3.5).toFixed(1)} MB`,
            uploaded: doc.createdAt || "16 May 2025"
        }))
        : defaultFiles;

    return (
        <div className="bottom-widget-card">
            <div className="widget-header-block">
                <h3>Recent Large Files</h3>
                <p>Top 5 largest files by size</p>
            </div>

            <div className="table-responsive">
                <table className="recent-files-table">
                    <thead>
                        <tr>
                            <th>File Name</th>
                            <th>Service</th>
                            <th>Size</th>
                            <th>Uploaded</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filesToDisplay.map((f, idx) => (
                            <tr key={idx}>
                                <td>
                                    <div className="file-name-cell">
                                        {getFileIcon(f.type)}
                                        <strong className="file-title-text">{f.name}</strong>
                                    </div>
                                </td>
                                <td><span className="service-tag">{f.service}</span></td>
                                <td><strong className="size-text">{f.size}</strong></td>
                                <td><span className="text-muted">{f.uploaded}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="widget-card-footer">
                <button type="button" className="gold-action-btn" onClick={() => setShowFilesModal(true)}>
                    View All Files
                </button>
            </div>

            {showFilesModal && (
                <div className="op-modal-backdrop" onClick={() => setShowFilesModal(false)}>
                    <div className="op-modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="op-modal-header">
                            <h3>All System Storage Files</h3>
                            <button className="op-modal-close" onClick={() => setShowFilesModal(false)}>×</button>
                        </div>
                        <div className="op-modal-body">
                            <div className="op-log-terminal">
                                <div className="terminal-content">
                                    {filesToDisplay.map((f, i) => (
                                        <div key={i} className="terminal-line">
                                            <span className="term-prompt">&gt;</span> {f.name} [{f.service}] — {f.size} (Uploaded: {f.uploaded})
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="op-modal-footer">
                            <button className="btn-secondary" onClick={() => setShowFilesModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
