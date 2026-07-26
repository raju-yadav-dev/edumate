import { Boxes } from "lucide-react";

import { formatBytes } from "../../utils/formatBytes";

function CombinedStorageCard({ combined = {}, mongodb = {}, supabase = {}, qdrant = {} }) {
    const total = Number(combined.total || 0);
    const mongoWidth = total ? Math.min((Number(mongodb.used || 0) / total) * 100, 100) : 0;
    const supabaseWidth = total ? Math.min((Number(supabase.used || 0) / total) * 100, 100 - mongoWidth) : 0;
    const qdrantWidth = total ? Math.min((Number(qdrant.used || 0) / total) * 100, 100 - mongoWidth - supabaseWidth) : 0;

    return (
        <article className="storage-dashboard-card combined-storage-card">
            <div className="panel-title">
                <div>
                    <h2>Combined Storage</h2>
                    <div className="storage-value-row">
                        <p><b>{formatBytes(combined.used)}</b> of {formatBytes(combined.total)} used</p>
                        <strong>{Number(combined.usage || 0).toFixed(2)}%</strong>
                    </div>
                </div>
                <span className="storage-badge total">Total</span>
                <Boxes size={20} />
            </div>

            <div className="combined-meter" aria-label="Combined storage usage">
                <span className="mongo" style={{ width: `${mongoWidth}%` }} />
                <span className="supabase" style={{ width: `${supabaseWidth}%` }} />
                <span className="qdrant" style={{ width: `${qdrantWidth}%` }} />
            </div>

            <div className="storage-kpis">
                <span><small>MongoDB (Atlas)</small><b>{formatBytes(mongodb.used)} ({Number(mongodb.usage || 0).toFixed(0)}%)</b></span>
                <span><small>Supabase Storage</small><b>{formatBytes(supabase.used)} ({Number(supabase.usage || 0).toFixed(0)}%)</b></span>
                <span><small>Qdrant Vector DB</small><b>{formatBytes(qdrant.used)} ({Number(qdrant.usage || 0).toFixed(0)}%)</b></span>
            </div>

            <div className="storage-legend">
                <span><i className="legend-dot mongo" />MongoDB (Green)</span>
                <span><i className="legend-dot supabase" />Supabase (Blue)</span>
                <span><i className="legend-dot qdrant" />Qdrant (Purple)</span>
            </div>
        </article>
    );
}

export default CombinedStorageCard;
