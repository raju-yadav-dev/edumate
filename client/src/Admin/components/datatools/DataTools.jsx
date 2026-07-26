import React, { useState } from "react";
import DataStatCards from "./DataStatCards";
import DatabaseHealth from "./DatabaseHealth";
import DocumentsOverview from "./DocumentsOverview";
import RecentOperations from "./RecentOperations";
import ToolActions from "./ToolActions";
import "./DataTools.css";

export default function DataTools({ setActiveSection, documents = [], storageStats = {}, users = [], onRefresh }) {
    const [operations, setOperations] = useState(null);

    const handleOperationComplete = (newOp) => {
        setOperations((prevOps) => {
            const currentList = prevOps || [
                {
                    id: 1,
                    name: "Generate Embeddings",
                    type: "Embedding",
                    status: "Completed",
                    startedAt: "16 May 2025, 11:02 AM",
                    duration: "2m 34s",
                    details: `${documents.length || 126} documents`,
                    logTrace: [
                        "11:02:00 AM - Initiated embedding pipeline v2.4",
                        "11:02:15 AM - Batched text fragments across workers",
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
                    logTrace: [
                        "10:45:00 AM - Triggered full ChromaDB HNSW re-index",
                        "10:47:30 AM - Built spatial graph nodes",
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
                    details: `${documents.length} active documents`,
                    logTrace: [
                        "10:15:00 AM - Connected to storage provider",
                        "10:15:40 AM - Sync completed with 0 errors"
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
                    logTrace: [
                        "09:50:00 AM - Purged local query response cache",
                        "09:50:18 AM - Memory freed"
                    ]
                },
                {
                    id: 5,
                    name: "Import Data",
                    type: "Import",
                    status: "Completed",
                    startedAt: "15 May 2025, 04:32 PM",
                    duration: "3m 21s",
                    details: `${documents.length} documents indexed`,
                    logTrace: [
                        "04:32:00 PM - Data uploaded",
                        "04:35:21 PM - Database records inserted"
                    ]
                }
            ];
            return [newOp, ...currentList.slice(0, 4)];
        });
    };

    return (
        <div className="datatools-page-wrapper">
            {/* Top 4 Stat Cards Row - Dynamic from storageStats & documents */}
            <DataStatCards documents={documents} storageStats={storageStats} />

            {/* Main Content Grid: Left Column & Right Column */}
            <div className="datatools-two-col-layout">
                {/* Left Side: DB Health, Docs Overview, Recent Operations */}
                <div className="datatools-left-col">
                    <DatabaseHealth storageStats={storageStats} />
                    <DocumentsOverview documents={documents} storageStats={storageStats} />
                    <RecentOperations operations={operations} setOperations={setOperations} />
                </div>

                {/* Right Side: Tool Actions */}
                <div className="datatools-right-col">
                    <ToolActions
                        onOperationComplete={handleOperationComplete}
                        documents={documents}
                        onRefresh={onRefresh}
                    />
                </div>
            </div>
        </div>
    );
}
