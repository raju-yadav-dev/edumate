import { Archive } from "lucide-react";

import ProgressBar from "./ProgressBar";
import { formatBytes } from "../../utils/formatBytes";

function SupabaseStorageCard({ supabase = {} }) {
    const isConnected = supabase.connected;
    const largestFileSize = Number(supabase.largestFile?.size || supabase.largestFile?.fileSize || 0);

    return (
        <article className="storage-dashboard-card supabase-card">
            <div className="panel-title">
                <div>
                    <h2>Supabase Storage</h2>
                    <div className="storage-value-row">
                        <p>
                            {isConnected ? (
                                <><b>{formatBytes(supabase.used)}</b> of {formatBytes(supabase.quota || supabase.total)} used</>
                            ) : (
                                <span style={{ color: "var(--admin-red)" }}>Unavailable</span>
                            )}
                        </p>
                        <strong style={{ color: isConnected ? "var(--admin-green)" : "var(--admin-muted)" }}>
                            {isConnected ? `${Number(supabase.usage || 0).toFixed(0)}%` : "Unavailable"}
                        </strong>
                    </div>
                </div>
                <span className="storage-badge supabase">File Storage</span>
                <Archive size={20} />
            </div>

            <ProgressBar usage={isConnected ? supabase.usage : 0} tone="supabase" />

            <div className="storage-kpis">
                <span><small>Files</small><b>{isConnected ? (supabase.files || 0) : "Unavailable"}</b></span>
                <span><small>Average File Size</small><b>{isConnected ? formatBytes(supabase.averageFileSize) : "Unavailable"}</b></span>
                <span><small>Largest File</small><b>{isConnected ? (largestFileSize ? formatBytes(largestFileSize) : "0 B") : "Unavailable"}</b></span>
                <span><small>Remaining</small><b>{isConnected ? formatBytes(supabase.remaining) : "Unavailable"}</b></span>
            </div>
        </article>
    );
}

export default SupabaseStorageCard;
