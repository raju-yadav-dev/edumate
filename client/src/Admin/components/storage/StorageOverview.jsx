import React from "react";
import { RefreshCw } from "lucide-react";
import StorageStatCards from "./StorageStatCards";
import StorageMiddleSection from "./StorageMiddleSection";
import DatabaseDetailsTable from "./DatabaseDetailsTable";
import StorageDistributionChart from "./StorageDistributionChart";
import RecentLargeFilesList from "./RecentLargeFilesList";
import "./Storage.css";

export default function StorageOverview({ stats = {}, onRefresh, documents = [] }) {
    const [refreshing, setRefreshing] = React.useState(false);

    const handleRefreshClick = async () => {
        if (typeof onRefresh === "function" && !refreshing) {
            setRefreshing(true);
            try {
                await onRefresh(true);
            } finally {
                setTimeout(() => setRefreshing(false), 500);
            }
        }
    };

    return (
        <div className="storage-page-wrapper">
            {/* Top 5 Stat Cards Row */}
            <StorageStatCards stats={stats} documents={documents} />

            {/* Middle Row (4 Cards) */}
            <StorageMiddleSection stats={stats} />

            {/* Bottom Row (3 Columns: Database Details, Storage Distribution, Recent Large Files) */}
            <div className="storage-bottom-grid">
                <DatabaseDetailsTable documents={documents} />
                <StorageDistributionChart stats={stats} />
                <RecentLargeFilesList documents={documents} />
            </div>
        </div>
    );
}
