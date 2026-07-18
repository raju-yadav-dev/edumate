import { Database } from "lucide-react";

import ProgressBar from "./ProgressBar";
import { formatBytes } from "../../utils/formatBytes";

function DatabaseStorageCard({ mongodb = {} }) {
    return (
        <article className="storage-dashboard-card">
            <div className="panel-title">
                <div>
                    <h2>Database Storage</h2>
                    <p>MongoDB metadata only</p>
                </div>
                <Database size={20} />
            </div>

            <ProgressBar usage={mongodb.usage} tone="mongo" />

            <div className="storage-kpis">
                <span><small>Total Database Limit</small><b>{formatBytes(mongodb.total)}</b></span>
                <span><small>Database Used</small><b>{formatBytes(mongodb.used)}</b></span>
                <span><small>Database Remaining</small><b>{formatBytes(mongodb.remaining)}</b></span>
                <span><small>Collections</small><b>{mongodb.collections || 0}</b></span>
                <span><small>Documents Count</small><b>{mongodb.documents || 0}</b></span>
                <span><small>Indexes Size</small><b>{formatBytes(mongodb.indexesSize)}</b></span>
                <span><small>Usage</small><b>{Number(mongodb.usage || 0).toFixed(1)}%</b></span>
            </div>
        </article>
    );
}

export default DatabaseStorageCard;
