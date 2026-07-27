import React, { useState, useEffect, useMemo } from "react";
import { Download, RefreshCw } from "lucide-react";
import ActivityStatCards from "./ActivityStatCards";
import ActivityFilterBar from "./ActivityFilterBar";
import ActivityLogsTable from "./ActivityLogsTable";
import { buildRealLogsFromSystemState, fetchLiveActivityLogs } from "../../../services/activityLogService";
import "./ActivityLogs.css";

export default function ActivityLogs({ documents = [], users = [], storageStats = {}, onRefresh }) {
    const [allLogs, setAllLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [userFilter, setUserFilter] = useState("All Users");
    const [actionFilter, setActionFilter] = useState("All Actions");
    const [serviceFilter, setServiceFilter] = useState("All Services");
    const [dateRange, setDateRange] = useState("All Time");

    // Load real-time logs directly from live documents, users, and system state
    const loadLogs = async () => {
        setLoading(true);
        try {
            const fetched = await fetchLiveActivityLogs({ documents, users, storageStats });
            if (Array.isArray(fetched) && fetched.length > 0) {
                setAllLogs(fetched);
            } else {
                setAllLogs(buildRealLogsFromSystemState({ documents, users, storageStats }));
            }
        } catch (err) {
            setAllLogs(buildRealLogsFromSystemState({ documents, users, storageStats }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadLogs();
    }, [documents, users, storageStats]);

    // Filter logs dynamically
    const filteredLogs = useMemo(() => {
        return allLogs.filter((log) => {
            if (userFilter !== "All Users" && log.user !== userFilter) return false;
            if (actionFilter !== "All Actions" && log.action !== actionFilter) return false;
            if (serviceFilter !== "All Services" && log.service !== serviceFilter) return false;

            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchUser = (log.user || "").toLowerCase().includes(q);
                const matchAction = (log.action || "").toLowerCase().includes(q);
                const matchResource = (log.resource || "").toLowerCase().includes(q);
                const matchDetails = (log.details || "").toLowerCase().includes(q);
                const matchIp = (log.ipAddress || "").toLowerCase().includes(q);

                if (!matchUser && !matchAction && !matchResource && !matchDetails && !matchIp) {
                    return false;
                }
            }

            return true;
        });
    }, [allLogs, userFilter, actionFilter, serviceFilter, searchQuery]);

    const handleClearFilters = () => {
        setSearchQuery("");
        setUserFilter("All Users");
        setActionFilter("All Actions");
        setServiceFilter("All Services");
        setDateRange("All Time");
    };

    const handleExportLogs = () => {
        const headers = ["Time", "User", "Action", "Service", "Resource", "Details", "IP Address", "Status"];
        const rows = filteredLogs.map((l) => [
            `"${l.time}"`,
            `"${l.user}"`,
            `"${l.action}"`,
            `"${l.service}"`,
            `"${l.resource}"`,
            `"${l.details}"`,
            `"${l.ipAddress}"`,
            `"${l.status}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `activity_logs_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    return (
        <div className="activity-logs-page">
            {/* Top Header Export & Refresh Action Controls */}
            <div className="activity-page-header">
                <div></div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button
                        type="button"
                        className="export-logs-gold-btn"
                        onClick={loadLogs}
                        disabled={loading}
                    >
                        <RefreshCw size={14} className={loading ? "is-spinning" : ""} /> Refresh Logs
                    </button>
                    <button
                        type="button"
                        className="export-logs-gold-btn"
                        onClick={handleExportLogs}
                    >
                        <Download size={15} /> Export Logs
                    </button>
                </div>
            </div>

            {/* Dynamic Filter Bar */}
            <ActivityFilterBar
                logs={allLogs}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                userFilter={userFilter}
                setUserFilter={setUserFilter}
                actionFilter={actionFilter}
                setActionFilter={setActionFilter}
                serviceFilter={serviceFilter}
                setServiceFilter={setServiceFilter}
                dateRange={dateRange}
                setDateRange={setDateRange}
                onClearFilters={handleClearFilters}
            />

            {/* Dynamic Top Stat Cards */}
            <ActivityStatCards logs={filteredLogs} activeUserCount={users.length || 1} />

            {/* Dynamic Logs Table */}
            <ActivityLogsTable logs={filteredLogs} />
        </div>
    );
}
