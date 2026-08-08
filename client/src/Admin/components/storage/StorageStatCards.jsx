import React from "react";
import { Folder, Database, HardDrive, FileText, Layers } from "lucide-react";
import { formatBytes } from "../../utils/formatBytes";

export default function StorageStatCards({ stats = {}, documents = [] }) {
    const mongo = stats?.mongodb || {};
    const supabase = stats?.supabase || {};
    const qdrant = stats?.qdrant || {};
    const combined = stats?.combined || {};

    const mongoConnected = mongo.connected;
    const mongoUsedBytes = mongoConnected ? mongo.used || 0 : null;
    const mongoTotalBytes = mongoConnected ? mongo.total || 0 : null;
    const mongoPct = mongoConnected ? Math.round(mongo.usage || 0) : 0;

    const supabaseConnected = supabase.connected;
    const supabaseUsedBytes = supabaseConnected ? supabase.used || 0 : null;
    const supabaseTotalBytes = supabaseConnected ? supabase.quota || 0 : null;
    const supabasePct = supabaseConnected ? Math.round(supabase.usage || 0) : 0;

    const combinedConnected = combined.used !== null && combined.total !== null;
    const combinedUsedBytes = combinedConnected ? combined.used || 0 : null;
    const combinedTotalBytes = combinedConnected ? combined.total || 0 : null;
    const combinedPct = combinedConnected ? Math.round(combined.usage || 0) : 0;

    const totalFiles = supabaseConnected ? supabase.files : documents.length;
    const totalChunks = qdrant.connected ? qdrant.vectors : (stats?.knowledgeBase?.totalChunks || 0);

    const cards = [
        {
            id: "total-storage",
            title: "Total Storage Used",
            value: combinedConnected ? `${(combinedUsedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB` : "—",
            subtitle: combinedConnected ? `of ${(combinedTotalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB (${combinedPct}%)` : "Disconnected",
            icon: Folder,
            iconColor: "#f59e0b",
            iconBg: "rgba(245, 158, 11, 0.14)",
            barColor: combinedConnected ? "#f59e0b" : null,
            percent: combinedPct
        },
        {
            id: "mongodb-storage",
            title: "MongoDB (Atlas)",
            value: mongoConnected ? `${(mongoUsedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB` : "—",
            subtitle: mongoConnected ? `of ${(mongoTotalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB (${mongoPct}%)` : "Disconnected",
            icon: Database,
            iconColor: "#10b981",
            iconBg: "rgba(16, 185, 129, 0.14)",
            barColor: mongoConnected ? "#10b981" : null,
            percent: mongoPct
        },
        {
            id: "supabase-storage",
            title: "Supabase Storage",
            value: supabaseConnected ? `${(supabaseUsedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB` : "—",
            subtitle: supabaseConnected ? `of ${(supabaseTotalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB (${supabasePct}%)` : "Disconnected",
            icon: HardDrive,
            iconColor: "#06b6d4",
            iconBg: "rgba(6, 182, 212, 0.14)",
            barColor: supabaseConnected ? "#06b6d4" : null,
            percent: supabasePct
        },
        {
            id: "total-files",
            title: "Files",
            value: supabaseConnected ? totalFiles.toLocaleString() : "—",
            subtitle: "Total Files",
            icon: FileText,
            iconColor: "#a855f7",
            iconBg: "rgba(168, 85, 247, 0.14)",
            barColor: null,
            percent: null
        },
        {
            id: "total-chunks",
            title: "Chunks / Records",
            value: qdrant.connected ? totalChunks.toLocaleString() : "—",
            subtitle: "Total Chroma Records",
            icon: Layers,
            iconColor: "#6366f1",
            iconBg: "rgba(99, 102, 241, 0.14)",
            barColor: null,
            percent: null
        }
    ];

    return (
        <div className="storage-top-stats-grid">
            {cards.map((c) => {
                const IconComp = c.icon;
                return (
                    <div key={c.id} className="storage-top-card">
                        <div className="card-header-row">
                            <div className="top-card-icon" style={{ backgroundColor: c.iconBg, color: c.iconColor }}>
                                <IconComp size={20} />
                            </div>
                        </div>
                        <div className="top-card-body">
                            <span className="card-label">{c.title}</span>
                            <h3 className="card-val">{c.value}</h3>
                            <span className="card-sub">{c.subtitle}</span>
                        </div>
                        {c.barColor && (
                            <div className="top-card-progress">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${c.percent}%`, backgroundColor: c.barColor }}
                                ></div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
