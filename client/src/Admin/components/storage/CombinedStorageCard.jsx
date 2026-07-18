import { Database } from "lucide-react";

import { formatBytes } from "../../utils/formatBytes";

function CombinedStorageCard({ combined = {}, mongodb = {}, supabase = {} }) {
    const total = Number(combined.total || 0);
    const mongoWidth = total ? Math.min((Number(mongodb.used || 0) / total) * 100, 100) : 0;
    const supabaseWidth = total ? Math.min((Number(supabase.used || 0) / total) * 100, 100 - mongoWidth) : 0;

    return (
        <article className="storage-dashboard-card combined-storage-card">
            <div className="panel-title">
                <div>
                    <h2>Combined Storage</h2>
                    <p>MongoDB and Supabase from one backend source</p>
                </div>
                <Database size={20} />
            </div>

            <div className="combined-meter" aria-label="Combined storage usage">
                <span className="mongo" style={{ width: `${mongoWidth}%` }} />
                <span className="supabase" style={{ width: `${supabaseWidth}%` }} />
            </div>

            <div className="storage-kpis">
                <span><small>Combined Used Storage</small><b>{formatBytes(combined.used)}</b></span>
                <span><small>Combined Remaining Storage</small><b>{formatBytes(combined.remaining)}</b></span>
                <span><small>Combined Usage</small><b>{Number(combined.usage || 0).toFixed(1)}%</b></span>
            </div>

            <div className="storage-legend">
                <span><i className="legend-dot mongo" />MongoDB (Green)</span>
                <span><i className="legend-dot supabase" />Supabase (Blue)</span>
            </div>
        </article>
    );
}

export default CombinedStorageCard;
