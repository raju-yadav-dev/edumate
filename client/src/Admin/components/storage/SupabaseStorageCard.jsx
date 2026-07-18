import { UploadCloud } from "lucide-react";

import ProgressBar from "./ProgressBar";
import { formatBytes } from "../../utils/formatBytes";

function SupabaseStorageCard({ supabase = {} }) {
    const largestFile = supabase.largestFile?.path || supabase.largestFile?.name || supabase.largestFile?.originalName || "None";

    return (
        <article className="storage-dashboard-card">
            <div className="panel-title">
                <div>
                    <h2>Supabase Storage</h2>
                    <p>Actual bucket object sizes</p>
                </div>
                <UploadCloud size={20} />
            </div>

            <ProgressBar usage={supabase.usage} tone="supabase" />

            <div className="storage-kpis">
                <span><small>Bucket Name</small><b>{supabase.bucket || "Not configured"}</b></span>
                <span><small>Number of Files</small><b>{supabase.files || 0}</b></span>
                <span><small>Storage Used</small><b>{formatBytes(supabase.used)}</b></span>
                <span><small>Remaining Storage</small><b>{formatBytes(supabase.remaining)}</b></span>
                <span><small>Average File Size</small><b>{formatBytes(supabase.averageFileSize)}</b></span>
                <span><small>Largest File</small><b title={largestFile}>{largestFile}</b></span>
                <span><small>Quota</small><b>{formatBytes(supabase.quota)}</b></span>
                <span><small>Usage</small><b>{Number(supabase.usage || 0).toFixed(1)}%</b></span>
            </div>
        </article>
    );
}

export default SupabaseStorageCard;
