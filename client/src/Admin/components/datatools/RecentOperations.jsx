import React, { useState } from "react";
import { Eye, ArrowRight, CheckCircle2, RefreshCw, Layers, Database, HardDrive, X } from "lucide-react";

export default function RecentOperations({ operations, setOperations }) {
    const [selectedOp, setSelectedOp] = useState(null);

    const initialOperations = [
        {
            id: 1,
            name: "Generate Embeddings",
            type: "Embedding",
            status: "Completed",
            startedAt: "16 May 2025, 11:02 AM",
            duration: "2m 34s",
            details: "1,245 documents",
            icon: BoxIcon,
            logTrace: [
                "11:02:00 AM - Initiated embedding pipeline v2.4",
                "11:02:15 AM - Batched 1,245 text fragments across 8 workers",
                "11:03:50 AM - Model text-embedding-3-small vectors generated",
                "11:04:34 AM - Vector store upsert completed successfully (0 errors)"
            ]
        },
        {
            id: 2,
            name: "Re-index Database",
            type: "Indexing",
            status: "Completed",
            startedAt: "16 May 2025, 10:45 AM",
            duration: "4m 12s",
            details: "12,540 chunks",
            icon: IndexIcon,
            logTrace: [
                "10:45:00 AM - Triggered full ChromaDB HNSW re-index",
                "10:47:30 AM - Built 12,540 spatial graph nodes",
                "10:49:12 AM - Cache flush & atomic index swap completed"
            ]
        },
        {
            id: 3,
            name: "Sync Documents",
            type: "Sync",
            status: "Completed",
            startedAt: "16 May 2025, 10:15 AM",
            duration: "1m 08s",
            details: "78 new documents",
            icon: SyncIcon,
            logTrace: [
                "10:15:00 AM - Initialized Local Storage Root 'storage/'",
                "10:15:40 AM - Detected 78 new PDF files",
                "10:16:08 AM - Sync complete, queue updated"
            ]
        },
        {
            id: 4,
            name: "Clear Cache",
            type: "Maintenance",
            status: "Completed",
            startedAt: "16 May 2025, 09:50 AM",
            duration: "18s",
            details: "Cache cleared",
            icon: CleanIcon,
            logTrace: [
                "09:50:00 AM - Purging Redis query response cache",
                "09:50:18 AM - Freed 420 MB cache memory"
            ]
        },
        {
            id: 5,
            name: "Import Data",
            type: "Import",
            status: "Completed",
            startedAt: "15 May 2025, 04:32 PM",
            duration: "3m 21s",
            details: "320 documents",
            icon: ImportIcon,
            logTrace: [
                "04:32:00 PM - Bulk JSON/ZIP archive uploaded",
                "04:34:10 PM - Extracted & validated metadata schemas",
                "04:35:21 PM - 320 records inserted into MongoDB"
            ]
        }
    ];

    const currentOps = operations || initialOperations;

    return (
        <section className="recent-ops-section">
            <div className="section-header-block">
                <div className="header-titles">
                    <h2>Recent Operations</h2>
                    <p>Latest data operations and activities</p>
                </div>
            </div>

            <div className="ops-table-card">
                <div className="table-responsive">
                    <table className="ops-table">
                        <thead>
                            <tr>
                                <th>Operation</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Started At</th>
                                <th>Duration</th>
                                <th>Details</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentOps.map((op) => (
                                <tr key={op.id}>
                                    <td className="op-name-cell">
                                        <span className={`op-bullet ${op.type.toLowerCase()}`}></span>
                                        <strong>{op.name}</strong>
                                    </td>
                                    <td>
                                        <span className="op-type-tag">{op.type}</span>
                                    </td>
                                    <td>
                                        <span className={`status-pill ${op.status.toLowerCase()}`}>
                                            <CheckCircle2 size={12} /> {op.status}
                                        </span>
                                    </td>
                                    <td className="text-muted">{op.startedAt}</td>
                                    <td className="text-muted">{op.duration}</td>
                                    <td className="text-secondary">{op.details}</td>
                                    <td>
                                        <button
                                            type="button"
                                            className="action-eye-btn"
                                            title="View Operation Details"
                                            onClick={() => setSelectedOp(op)}
                                        >
                                            <Eye size={15} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="ops-table-footer">
                    <button type="button" className="view-all-logs-btn">
                        View All Logs <ArrowRight size={14} />
                    </button>
                </div>
            </div>

            {/* Modal for operation log trace */}
            {selectedOp && (
                <div className="op-modal-backdrop" onClick={() => setSelectedOp(null)}>
                    <div className="op-modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="op-modal-header">
                            <div>
                                <h3>{selectedOp.name} - Detailed Trace</h3>
                                <span className="op-modal-sub">{selectedOp.startedAt} | Duration: {selectedOp.duration}</span>
                            </div>
                            <button className="op-modal-close" onClick={() => setSelectedOp(null)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="op-modal-body">
                            <div className="op-summary-chips">
                                <div><span>Type:</span> <strong>{selectedOp.type}</strong></div>
                                <div><span>Status:</span> <strong className="green-text">{selectedOp.status}</strong></div>
                                <div><span>Scope:</span> <strong>{selectedOp.details}</strong></div>
                            </div>
                            <div className="op-log-terminal">
                                <div className="terminal-bar">Log Terminal Stream</div>
                                <div className="terminal-content">
                                    {(selectedOp.logTrace || [
                                        "Operation initialized.",
                                        "Executed step 1 successfully.",
                                        "Job completed with exit code 0."
                                    ]).map((line, idx) => (
                                        <div key={idx} className="terminal-line">
                                            <span className="term-prompt">&gt;</span> {line}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="op-modal-footer">
                            <button className="btn-secondary" onClick={() => setSelectedOp(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

function BoxIcon() { return <Database size={14} />; }
function IndexIcon() { return <Layers size={14} />; }
function SyncIcon() { return <RefreshCw size={14} />; }
function CleanIcon() { return <HardDrive size={14} />; }
function ImportIcon() { return <Database size={14} />; }
