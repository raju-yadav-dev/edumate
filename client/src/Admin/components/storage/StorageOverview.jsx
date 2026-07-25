import "./Storage.css";

import { useEffect, useState } from "react";
import { ChevronDown, RefreshCcw } from "lucide-react";

import CombinedStorageCard from "./CombinedStorageCard";
import DatabaseStorageCard from "./DatabaseStorageCard";
import SupabaseStorageCard from "./SupabaseStorageCard";

function StorageOverview({ stats = {}, onRefresh }) {
    const [service, setService] = useState("all");
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    async function refreshStats() {
        if (typeof onRefresh !== "function" || refreshing) {
            return;
        }

        try {
            setRefreshing(true);
            await onRefresh();
        } finally {
            setRefreshing(false);
        }
    }

    useEffect(() => {
        if (!autoRefresh || typeof onRefresh !== "function") {
            return undefined;
        }

        const timer = window.setInterval(() => {
            void refreshStats();
        }, 30000);
        return () => window.clearInterval(timer);
    }, [autoRefresh, onRefresh, refreshing]);

    return (

        <section className="storage-section">

            <div className="storage-header">

                <div>

                    <h2>Storage Overview</h2>

                    <p>
                        Real-time storage usage across all services
                    </p>

                </div>

                <div className="storage-controls">
                    <label className="service-select">
                        <select value={service} onChange={(event) => setService(event.target.value)}>
                            <option value="all">All Services</option>
                            <option value="database">MongoDB (Atlas)</option>
                            <option value="files">Supabase Storage</option>
                            <option value="combined">Combined Storage</option>
                        </select>
                        <ChevronDown size={14} />
                    </label>
                    <button
                        type="button"
                        className={autoRefresh ? "auto-refresh active" : "auto-refresh"}
                        onClick={() => setAutoRefresh((current) => !current)}
                    >
                        <RefreshCcw className={refreshing ? "is-spinning" : ""} size={14} />
                        Auto refresh: <b>{autoRefresh ? "ON" : "OFF"}</b>
                        <i />
                    </button>
                </div>

            </div>

            <div className={service === "all" ? "storage-grid" : "storage-grid single-service"}>

                {service === "all" || service === "database" ? <DatabaseStorageCard mongodb={stats.mongodb} /> : null}

                {service === "all" || service === "files" ? <SupabaseStorageCard supabase={stats.supabase} /> : null}

                {service === "all" || service === "combined" ? (
                    <CombinedStorageCard
                        combined={stats.combined}
                        mongodb={stats.mongodb}
                        supabase={stats.supabase}
                    />
                ) : null}

            </div>

        </section>

    );

}

export default StorageOverview;
