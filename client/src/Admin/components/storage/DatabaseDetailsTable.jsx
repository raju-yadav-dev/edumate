import React, { useState } from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default function DatabaseDetailsTable({ documents = [] }) {
    const [showModal, setShowModal] = useState(false);

    const collections = [
        {
            name: "edumate_db (MongoDB)",
            documents: "12,540",
            size: "8.1 GB",
            indexes: "23",
            status: "Healthy"
        },
        {
            name: "chroma_db (ChromaDB)",
            documents: "12,540",
            size: "6.3 GB",
            indexes: "-",
            status: "Healthy"
        },
        {
            name: "analytics_db (MongoDB)",
            documents: "2,340",
            size: "1.2 GB",
            indexes: "12",
            status: "Healthy"
        },
        {
            name: "logs_db (MongoDB)",
            documents: "15,210",
            size: "512 MB",
            indexes: "8",
            status: "Healthy"
        }
    ];

    return (
        <div className="bottom-widget-card">
            <div className="widget-header-block">
                <h3>Database Details</h3>
                <p>Overview of all database collections and sizes</p>
            </div>

            <div className="table-responsive">
                <table className="db-details-table">
                    <thead>
                        <tr>
                            <th>Database / Collection</th>
                            <th>Documents</th>
                            <th>Size</th>
                            <th>Indexes</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {collections.map((c, idx) => (
                            <tr key={idx}>
                                <td><strong className="db-col-name">{c.name}</strong></td>
                                <td>{c.documents}</td>
                                <td>{c.size}</td>
                                <td>{c.indexes}</td>
                                <td>
                                    <span className="status-pill healthy">
                                        <CheckCircle2 size={12} /> {c.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="widget-card-footer">
                <button type="button" className="gold-action-btn" onClick={() => setShowModal(true)}>
                    View All Collections
                </button>
            </div>

            {showModal && (
                <div className="op-modal-backdrop" onClick={() => setShowModal(false)}>
                    <div className="op-modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="op-modal-header">
                            <h3>Database Collections Overview</h3>
                            <button className="op-modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <div className="op-modal-body">
                            <p style={{ fontSize: 13, color: '#9ca3af' }}>
                                Active collections connected to EduMate Atlas & Chroma Vector engines:
                            </p>
                            <div className="op-log-terminal">
                                <div className="terminal-content">
                                    {collections.map((c, i) => (
                                        <div key={i} className="terminal-line">
                                            <span className="term-prompt">&gt;</span> {c.name} — {c.documents} records ({c.size}) [STATUS: OK]
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="op-modal-footer">
                            <button className="btn-secondary" onClick={() => setShowModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
