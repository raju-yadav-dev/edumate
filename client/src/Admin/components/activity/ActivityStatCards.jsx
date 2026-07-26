import React from "react";
import { FileText, CheckCircle2, AlertTriangle, XCircle, Users } from "lucide-react";

export default function ActivityStatCards({ logs = [], activeUserCount = 18 }) {
    const totalLogsCount = logs.length || 1248;
    const successCount = logs.filter((l) => (l.status || "").toLowerCase() === "success" || (l.status || "").toLowerCase() === "completed").length || 1076;
    const warningCount = logs.filter((l) => (l.status || "").toLowerCase() === "warning").length || 128;
    const failedCount = logs.filter((l) => (l.status || "").toLowerCase() === "failed" || (l.status || "").toLowerCase() === "error").length || 44;

    const successPct = totalLogsCount > 0 ? ((successCount / totalLogsCount) * 100).toFixed(1) : "86.2";
    const warningPct = totalLogsCount > 0 ? ((warningCount / totalLogsCount) * 100).toFixed(1) : "10.3";
    const failedPct = totalLogsCount > 0 ? ((failedCount / totalLogsCount) * 100).toFixed(1) : "3.5";

    const cards = [
        {
            id: "total-logs",
            title: "Total Logs",
            value: totalLogsCount.toLocaleString(),
            subtitle: "All Activities",
            icon: FileText,
            iconColor: "#06b6d4",
            iconBg: "rgba(6, 182, 212, 0.14)"
        },
        {
            id: "successful",
            title: "Successful",
            value: successCount.toLocaleString(),
            subtitle: `${successPct}% of total`,
            icon: CheckCircle2,
            iconColor: "#10b981",
            iconBg: "rgba(16, 185, 129, 0.14)"
        },
        {
            id: "warnings",
            title: "Warnings",
            value: warningCount.toLocaleString(),
            subtitle: `${warningPct}% of total`,
            icon: AlertTriangle,
            iconColor: "#f59e0b",
            iconBg: "rgba(245, 158, 11, 0.14)"
        },
        {
            id: "failed",
            title: "Failed",
            value: failedCount.toLocaleString(),
            subtitle: `${failedPct}% of total`,
            icon: XCircle,
            iconColor: "#ef4444",
            iconBg: "rgba(239, 68, 68, 0.14)"
        },
        {
            id: "active-users",
            title: "Active Users",
            value: String(activeUserCount),
            subtitle: "In Selected Period",
            icon: Users,
            iconColor: "#a855f7",
            iconBg: "rgba(168, 85, 247, 0.14)"
        }
    ];

    return (
        <div className="activity-stats-grid">
            {cards.map((c) => {
                const IconComp = c.icon;
                return (
                    <div key={c.id} className="activity-stat-card">
                        <div className="stat-card-left">
                            <div className="activity-icon-box" style={{ backgroundColor: c.iconBg, color: c.iconColor }}>
                                <IconComp size={22} />
                            </div>
                        </div>
                        <div className="stat-card-right">
                            <span className="activity-card-label">{c.title}</span>
                            <h3 className="activity-card-value">{c.value}</h3>
                            <span className="activity-card-sub">{c.subtitle}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
