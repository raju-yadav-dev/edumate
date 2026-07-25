import { Archive } from "lucide-react";

import ProgressBar from "./ProgressBar";
import { formatBytes } from "../../utils/formatBytes";

function SupabaseStorageCard({ supabase = {} }) {
    const largestFileSize = Number(supabase.largestFile?.size || supabase.largestFile?.fileSize || 0);

    return (
        <article className="storage-dashboard-card">
            <div className="panel-title">
                <div>
                    <h2>Supabase Storage</h2>
                    <div className="storage-value-row">
                        <p><b>{formatBytes(supabase.used)}</b> of {formatBytes(supabase.quota || supabase.total)} used</p>
                        <strong>{Number(supabase.usage || 0).toFixed(0)}%</strong>
                    </div>
                </div>
                <span className="storage-badge supabase">File Storage</span>
                <Archive size={20} />
            </div>

            <ProgressBar usage={supabase.usage} tone="supabase" />

            <div className="storage-kpis">
                <span><small>Files</small><b>{supabase.files || 0}</b></span>
                <span><small>Average File Size</small><b>{formatBytes(supabase.averageFileSize)}</b></span>
                <span><small>Largest File</small><b>{largestFileSize ? formatBytes(largestFileSize) : "0 B"}</b></span>
                <span><small>Remaining</small><b>{formatBytes(supabase.remaining)}</b></span>
            </div>
        </article>
    );
}

export default SupabaseStorageCard;
