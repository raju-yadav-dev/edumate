import { BrainCircuit } from "lucide-react";

import ProgressBar from "./ProgressBar";
import { formatBytes } from "../../utils/formatBytes";

function QdrantStorageCard({ qdrant = {} }) {
    const isConnected = qdrant.connected;

    return (
        <article className="storage-dashboard-card qdrant-card">
            <div className="panel-title">
                <div>
                    <h2>Qdrant Vector DB</h2>
                    <div className="storage-value-row">
                        <p>
                            {isConnected ? (
                                <><b>{formatBytes(qdrant.used)}</b> of {formatBytes(qdrant.total)} used</>
                            ) : (
                                <span style={{ color: "var(--admin-red)" }}>Unavailable</span>
                            )}
                        </p>
                        <strong style={{ color: isConnected ? "var(--admin-green)" : "var(--admin-muted)" }}>
                            {isConnected ? `${Number(qdrant.usage || 0).toFixed(0)}%` : "Unavailable"}
                        </strong>
                    </div>
                </div>
                <span className="storage-badge qdrant">Vector Storage</span>
                <BrainCircuit size={20} />
            </div>

            <ProgressBar usage={isConnected ? qdrant.usage : 0} tone="qdrant" />

            <div className="storage-kpis">
                <span>
                    <small>Indexed Chunks</small>
                    <b>{isConnected ? Number(qdrant.vectors || 0).toLocaleString() : "Unavailable"}</b>
                </span>
                <span>
                    <small>Remaining</small>
                    <b>{isConnected ? formatBytes(qdrant.remaining) : "Unavailable"}</b>
                </span>
                <span>
                    <small>Status</small>
                    <b
                        className={qdrant.status || "unknown"}
                        style={{
                            color: qdrant.status === "green" ? "var(--admin-green)" : (qdrant.status === "yellow" ? "var(--admin-gold)" : "var(--admin-red)")
                        }}
                    >
                        {isConnected ? (qdrant.status || "unknown") : "offline"}
                    </b>
                </span>
                <span>
                    <small>Connection</small>
                    <b style={{ color: isConnected ? "var(--admin-green)" : "var(--admin-red)" }}>
                        {isConnected ? "Healthy" : "Offline"}
                    </b>
                </span>
            </div>
        </article>
    );
}

export default QdrantStorageCard;
