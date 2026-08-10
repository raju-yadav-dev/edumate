import { useEffect, useRef, useState } from "react";
import { ChevronDown, RefreshCcw } from "lucide-react";
import CombinedStorageCard from "./CombinedStorageCard";
import DatabaseStorageCard from "./DatabaseStorageCard";
import SupabaseStorageCard from "./SupabaseStorageCard";
import QdrantStorageCard from "./QdrantStorageCard";
import "./Storage.css";

const serviceOptions = [
    { value: "all", label: "All Services" },
    { value: "database", label: "MongoDB (Atlas)" },
    { value: "files", label: "Supabase Storage" },
    { value: "qdrant", label: "Qdrant Vector DB" },
    { value: "combined", label: "Combined Storage" },
];

export default function StorageOverviewSummary({ stats = {}, onRefresh }) {
    const [service, setService] = useState("all");
    const [isServiceMenuOpen, setIsServiceMenuOpen] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const serviceSelectRef = useRef(null);

    const selectedService = serviceOptions.find((option) => option.value === service) ?? serviceOptions[0];

    async function refreshStats(force = false) {
        if (typeof onRefresh !== "function" || refreshing) {
            return;
        }

        try {
            setRefreshing(true);
            await onRefresh(force);
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

    useEffect(() => {
        function closeServiceMenu(event) {
            if (serviceSelectRef.current && !serviceSelectRef.current.contains(event.target)) {
                setIsServiceMenuOpen(false);
            }
        }

        document.addEventListener("mousedown", closeServiceMenu);
        return () => document.removeEventListener("mousedown", closeServiceMenu);
    }, []);

    return (
        <section className="storage-section">
            <div className="storage-header">
                <div>
                    <h2>Storage Overview</h2>
                    <p>Real-time storage usage across all services</p>
                </div>

                <div className="storage-controls">
                    <div className="service-select" ref={serviceSelectRef}>
                        <button
                            type="button"
                            className="service-select-trigger"
                            aria-haspopup="listbox"
                            aria-expanded={isServiceMenuOpen}
                            onClick={() => setIsServiceMenuOpen((open) => !open)}
                            onKeyDown={(event) => {
                                if (event.key === "Escape") setIsServiceMenuOpen(false);
                            }}
                        >
                            <span>{selectedService.label}</span>
                            <ChevronDown size={14} />
                        </button>
                        {isServiceMenuOpen ? (
                            <div className="service-select-menu" role="listbox" aria-label="Storage service">
                                {serviceOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        role="option"
                                        aria-selected={service === option.value}
                                        className={service === option.value ? "selected" : ""}
                                        onClick={() => {
                                            setService(option.value);
                                            setIsServiceMenuOpen(false);
                                        }}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>

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
                {service === "all" || service === "qdrant" ? <QdrantStorageCard qdrant={stats.qdrant} /> : null}
                {service === "all" || service === "combined" ? (
                    <CombinedStorageCard
                        combined={stats.combined}
                        mongodb={stats.mongodb}
                        supabase={stats.supabase}
                        qdrant={stats.qdrant}
                    />
                ) : null}
            </div>
        </section>
    );
}
