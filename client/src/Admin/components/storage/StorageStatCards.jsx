import React from "react";
import { Folder, Database, HardDrive, FileText, Layers } from "lucide-react";
import { formatBytes } from "../../utils/formatBytes";

export default function StorageStatCards({ stats = {}, documents = [] }) {
    const mongo = stats?.mongodb || {};
    const supabase = stats?.supabase || {};
    const qdrant = stats?.qdrant || {};
    const combined = stats?.combined || {};

    const mongoUsedBytes = mongo.used || 8.1 * 1024 * 1024 * 1024;
    const mongoTotalBytes = mongo.total || 25.0 * 1024 * 1024 * 1024;
    const mongoPct = mongo.usage ? Math.round(mongo.usage) : 32;

    const supabaseUsedBytes = supabase.used || 15.4 * 1024 * 1024 * 1024;
    const supabaseTotalBytes = supabase.quota || 25.0 * 1024 * 1024 * 1024;
    const supabasePct = supabase.usage ? Math.round(supabase.usage) : 61;

    const combinedUsedBytes = combined.used || (mongoUsedBytes + supabaseUsedBytes);
    const combinedTotalBytes = combined.total || 50.0 * 1024 * 1024 * 1024;
    const combinedPct = combined.usage ? Math.round(combined.usage) : 47;

    const totalFiles = supabase.files || documents.length || 430;
    const totalChunks = qdrant.vectors || stats?.knowledgeBase?.totalChunks || 12540;

    const cards = [
        {
            id: "total-storage",
            title: "Total Storage Used",
            value: `${(combinedUsedBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
            subtitle: `of ${(combinedTotalBytes / (1024 * 1024 * 1024)).toFixed(1)} GB (${combinedPct}%)`,
            icon: Folder,
            iconColor: "#f59e0b",
            iconBg: "rgba(245, 158, 11, 0.14)",
            barColor: "#f59e0b",
            percent: combinedPct
        },
        {
            id: "mongodb-storage",
            title: "MongoDB (Atlas)",
            value: `${(mongoUsedBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
            subtitle: `of ${(mongoTotalBytes / (1024 * 1024 * 1024)).toFixed(1)} GB (${mongoPct}%)`,
            icon: Database,
            iconColor: "#10b981",
            iconBg: "rgba(16, 185, 129, 0.14)",
            barColor: "#10b981",
            percent: mongoPct
        },
        {
            id: "supabase-storage",
            title: "Supabase Storage",
            value: `${(supabaseUsedBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
            subtitle: `of ${(supabaseTotalBytes / (1024 * 1024 * 1024)).toFixed(1)} GB (${supabasePct}%)`,
            icon: HardDrive,
            iconColor: "#06b6d4",
            iconBg: "rgba(6, 182, 212, 0.14)",
            barColor: "#06b6d4",
            percent: supabasePct
        },
        {
            id: "total-files",
            title: "Files",
            value: totalFiles.toLocaleString(),
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
            value: totalChunks.toLocaleString(),
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
