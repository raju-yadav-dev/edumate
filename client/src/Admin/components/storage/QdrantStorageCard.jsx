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
                            <b>{formatBytes(qdrant.used)}</b> of {formatBytes(qdrant.total)} used
                        </p>
                        <strong style={{ color: isConnected ? "var(--admin-green)" : "var(--admin-muted)" }}>
                            {Number(qdrant.usage || 0).toFixed(0)}%
                        </strong>
                    </div>
                </div>
                <span className="storage-badge qdrant">Vector Storage</span>
                <BrainCircuit size={20} />
            </div>

            <ProgressBar usage={qdrant.usage} tone="qdrant" />

            <div className="storage-kpis">
                <span>
                    <small>Indexed Chunks</small>
                    <b>{Number(qdrant.vectors || 0).toLocaleString()}</b>
                </span>
                <span>
                    <small>Remaining</small>
                    <b>{formatBytes(qdrant.remaining)}</b>
                </span>
                <span>
                    <small>Status</small>
                    <b
                        className={qdrant.status || "unknown"}
                        style={{
                            color: qdrant.status === "green" ? "var(--admin-green)" : (qdrant.status === "yellow" ? "var(--admin-gold)" : "var(--admin-muted)")
                        }}
                    >
                        {qdrant.status || "unknown"}
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
