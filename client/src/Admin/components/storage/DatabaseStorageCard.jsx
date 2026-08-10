import { Leaf } from "lucide-react";

import ProgressBar from "./ProgressBar";
import { formatBytes } from "../../utils/formatBytes";

function DatabaseStorageCard({ mongodb = {} }) {
    const isConnected = mongodb.connected;

    return (
        <article className="storage-dashboard-card mongodb-card">
            <div className="panel-title">
                <div>
                    <h2>MongoDB (Atlas)</h2>
                    <div className="storage-value-row">
                        <p>
                            {isConnected ? (
                                <><b>{formatBytes(mongodb.used)}</b> of {formatBytes(mongodb.total)} used</>
                            ) : (
                                <span style={{ color: "var(--admin-red)" }}>Unavailable</span>
                            )}
                        </p>
                        <strong style={{ color: isConnected ? "var(--admin-green)" : "var(--admin-muted)" }}>
                            {isConnected ? `${Number(mongodb.usage || 0).toFixed(0)}%` : "Unavailable"}
                        </strong>
                    </div>
                </div>
                <span className="storage-badge mongo">Database Storage</span>
                <Leaf size={20} />
            </div>

            <ProgressBar usage={isConnected ? mongodb.usage : 0} tone="mongo" />

            <div className="storage-kpis">
                <span><small>Collections</small><b>{isConnected ? (mongodb.collections || 0) : "Unavailable"}</b></span>
                <span><small>Documents</small><b>{isConnected ? (mongodb.documents || 0) : "Unavailable"}</b></span>
                <span><small>Indexes Size</small><b>{isConnected ? formatBytes(mongodb.indexesSize) : "Unavailable"}</b></span>
                <span><small>Remaining</small><b>{isConnected ? formatBytes(mongodb.remaining) : "Unavailable"}</b></span>
            </div>
        </article>
    );
}

export default DatabaseStorageCard;
