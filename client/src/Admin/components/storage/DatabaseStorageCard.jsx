import { Leaf } from "lucide-react";

import ProgressBar from "./ProgressBar";
import { formatBytes } from "../../utils/formatBytes";

function DatabaseStorageCard({ mongodb = {} }) {
    return (
        <article className="storage-dashboard-card">
            <div className="panel-title">
                <div>
                    <h2>MongoDB (Atlas)</h2>
                    <div className="storage-value-row">
                        <p><b>{formatBytes(mongodb.used)}</b> of {formatBytes(mongodb.total)} used</p>
                        <strong>{Number(mongodb.usage || 0).toFixed(0)}%</strong>
                    </div>
                </div>
                <span className="storage-badge mongo">Database Storage</span>
                <Leaf size={20} />
            </div>

            <ProgressBar usage={mongodb.usage} tone="mongo" />

            <div className="storage-kpis">
                <span><small>Collections</small><b>{mongodb.collections || 0}</b></span>
                <span><small>Documents</small><b>{mongodb.documents || 0}</b></span>
                <span><small>Indexes Size</small><b>{formatBytes(mongodb.indexesSize)}</b></span>
                <span><small>Remaining</small><b>{formatBytes(mongodb.remaining)}</b></span>
            </div>
        </article>
    );
}

export default DatabaseStorageCard;
