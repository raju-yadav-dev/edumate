import React, { useState } from "react";
import { Database, HardDrive, Layers } from "lucide-react";

export default function StorageMiddleSection({ stats = {} }) {
    const [trendDays, setTrendDays] = useState("7 Days");

    const mongo = stats?.mongodb || {};
    const supabase = stats?.supabase || {};
    const qdrant = stats?.qdrant || {};
    const combined = stats?.combined || {};

    const mongoConnected = mongo.connected;
    const mongoUsedGB = mongoConnected && mongo.used !== null ? (mongo.used / (1024 * 1024 * 1024)).toFixed(2) : "—";
    const mongoTotalGB = mongoConnected && mongo.total !== null ? (mongo.total / (1024 * 1024 * 1024)).toFixed(2) : "—";
    const mongoRemainingGB = mongoConnected && mongo.remaining !== null ? (mongo.remaining / (1024 * 1024 * 1024)).toFixed(2) : "—";
    const mongoPct = mongoConnected ? Math.round(mongo.usage || 0) : 0;

    const supabaseConnected = supabase.connected;
    const supabaseUsedGB = supabaseConnected && supabase.used !== null ? (supabase.used / (1024 * 1024 * 1024)).toFixed(2) : "—";
    const supabaseTotalGB = supabaseConnected && supabase.quota !== null ? (supabase.quota / (1024 * 1024 * 1024)).toFixed(2) : "—";
    const supabaseRemainingGB = supabaseConnected && supabase.remaining !== null ? (supabase.remaining / (1024 * 1024 * 1024)).toFixed(2) : "—";
    const supabasePct = supabaseConnected ? Math.round(supabase.usage || 0) : 0;

    const combinedConnected = combined.used !== null && combined.total !== null;
    const combinedUsedGB = combinedConnected ? (combined.used / (1024 * 1024 * 1024)).toFixed(2) : "—";
    const combinedTotalGB = combinedConnected ? (combined.total / (1024 * 1024 * 1024)).toFixed(2) : "—";
    const combinedRemainingGB = combinedConnected ? (combined.remaining / (1024 * 1024 * 1024)).toFixed(2) : "—";
    const combinedPct = combinedConnected ? Math.round(combined.usage || 0) : 0;

    // Chart trend points for 7 Days
    const trendPoints = [
        { date: "May 10", val: "10 GB", y: 100 },
        { date: "May 11", val: "15 GB", y: 75 },
        { date: "May 12", val: "18 GB", y: 60 },
        { date: "May 13", val: "22 GB", y: 40 },
        { date: "May 14", val: "19 GB", y: 55 },
        { date: "May 15", val: "21 GB", y: 45 },
        { date: "May 16", val: combinedConnected ? `${combinedUsedGB} GB` : "0 GB", y: 30 }
    ];

    const pathD = `M 15,100 Q 35,75 60,75 T 105,60 T 150,40 T 195,55 T 240,45 T 285,30`;

    return (
        <div className="storage-middle-grid">
            {/* MongoDB Card */}
            <div className="middle-widget-card">
                <div className="widget-head">
                    <div className="widget-title-group">
                        <Database size={16} className="green-icon" />
                        <strong>MongoDB (Atlas)</strong>
                    </div>
                    <span className={`status-pill ${mongoConnected ? "healthy" : "offline"}`}>
                        <span className="dot"></span> {mongoConnected ? "Healthy" : "Offline"}
                    </span>
                </div>

                <div className="widget-body-row">
                    <div className="donut-chart-col">
                        <div className="mini-donut-wrapper">
                            <svg viewBox="0 0 100 100" className="mini-donut">
                                <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
                                <circle
                                    cx="50" cy="50" r="38" fill="none"
                                    stroke="#10b981" strokeWidth="12"
                                    strokeDasharray={`${(mongoPct / 100) * 238} 238`}
                                    strokeDashoffset="0"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="donut-inner-text">
                                <strong>{mongoConnected ? `${mongoUsedGB} GB` : "—"}</strong>
                                <span>Used</span>
                            </div>
                        </div>
                        <span className="pct-tag green">{mongoPct}% Used</span>
                    </div>

                    <div className="metrics-list-col">
                        <div className="m-row"><span>Collections</span> <strong>{mongoConnected ? mongo.collections : "—"}</strong></div>
                        <div className="m-row"><span>Documents</span> <strong>{mongoConnected ? mongo.documents : "—"}</strong></div>
                        <div className="m-row"><span>Storage Used</span> <strong>{mongoConnected ? `${mongoUsedGB} GB` : "—"}</strong></div>
                        <div className="m-row"><span>Remaining</span> <strong>{mongoConnected ? `${mongoRemainingGB} GB` : "—"}</strong></div>
                    </div>
                </div>
            </div>

            {/* Supabase Storage Card */}
            <div className="middle-widget-card">
                <div className="widget-head">
                    <div className="widget-title-group">
                        <HardDrive size={16} className="blue-icon" />
                        <strong>Supabase Storage</strong>
                    </div>
                    <span className={`status-pill ${supabaseConnected ? "healthy" : "offline"}`}>
                        <span className="dot"></span> {supabaseConnected ? "Healthy" : "Offline"}
                    </span>
                </div>

                <div className="widget-body-row">
                    <div className="donut-chart-col">
                        <div className="mini-donut-wrapper">
                            <svg viewBox="0 0 100 100" className="mini-donut">
                                <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
                                <circle
                                    cx="50" cy="50" r="38" fill="none"
                                    stroke="#06b6d4" strokeWidth="12"
                                    strokeDasharray={`${(supabasePct / 100) * 238} 238`}
                                    strokeDashoffset="0"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="donut-inner-text">
                                <strong>{supabaseConnected ? `${supabaseUsedGB} GB` : "—"}</strong>
                                <span>Used</span>
                            </div>
                        </div>
                        <span className="pct-tag blue">{supabasePct}% Used</span>
                    </div>

                    <div className="metrics-list-col">
                        <div className="m-row"><span>Buckets</span> <strong>{supabaseConnected ? supabase.bucket ? 1 : 0 : "—"}</strong></div>
                        <div className="m-row"><span>Files</span> <strong>{supabaseConnected ? supabase.files : "—"}</strong></div>
                        <div className="m-row"><span>Storage Used</span> <strong>{supabaseConnected ? `${supabaseUsedGB} GB` : "—"}</strong></div>
                        <div className="m-row"><span>Remaining</span> <strong>{supabaseConnected ? `${supabaseRemainingGB} GB` : "—"}</strong></div>
                    </div>
                </div>
            </div>

            {/* Combined Storage Card */}
            <div className="middle-widget-card">
                <div className="widget-head">
                    <div className="widget-title-group">
                        <Layers size={16} className="gold-icon" />
                        <strong>Combined Storage</strong>
                    </div>
                </div>

                <div className="combined-body">
                    <div className="combined-headline">
                        <h2>{combinedConnected ? `${combinedUsedGB} GB` : "—"}</h2>
                        <span>of {combinedConnected ? `${combinedTotalGB} GB` : "—"} used</span>
                        <span className="pct-badge">{combinedPct}% Used</span>
                    </div>

                    <div className="multi-progress-track">
                        <div className="seg mongo" style={{ width: `${mongoPct}%` }}></div>
                        <div className="seg supabase" style={{ width: `${supabasePct}%` }}></div>
                        <div className="seg empty" style={{ width: `${100 - mongoPct - supabasePct}%` }}></div>
                    </div>

                    <div className="combined-legend">
                        <div className="l-item">
                            <div className="l-left"><span className="dot green"></span> MongoDB (Atlas)</div>
                            <span className="l-val">{mongoConnected ? `${mongoUsedGB} GB (${mongoPct}%)` : "—"}</span>
                        </div>
                        <div className="l-item">
                            <div className="l-left"><span className="dot blue"></span> Supabase Storage</div>
                            <span className="l-val">{supabaseConnected ? `${supabaseUsedGB} GB (${supabasePct}%)` : "—"}</span>
                        </div>
                        <div className="l-item">
                            <div className="l-left"><span className="dot gray"></span> Remaining</div>
                            <span className="l-val">{combinedConnected ? `${combinedRemainingGB} GB (${100 - combinedPct}%)` : "—"}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Storage Trend Card */}
            <div className="middle-widget-card">
                <div className="widget-head">
                    <div className="widget-title-group">
                        <strong>Storage Trend ({trendDays})</strong>
                    </div>
                    <select
                        className="trend-select"
                        value={trendDays}
                        onChange={(e) => setTrendDays(e.target.value)}
                    >
                        <option value="7 Days">7 Days</option>
                        <option value="30 Days">30 Days</option>
                        <option value="3 Months">3 Months</option>
                    </select>
                </div>

                <div className="trend-chart-wrapper">
                    <div className="trend-y-axis">
                        <span>40 GB</span>
                        <span>30 GB</span>
                        <span>20 GB</span>
                        <span>10 GB</span>
                        <span>0 GB</span>
                    </div>
                    <div className="trend-svg-box">
                        <svg viewBox="0 0 300 120" className="trend-chart-svg">
                            {/* Grid lines */}
                            <line x1="0" y1="10" x2="300" y2="10" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                            <line x1="0" y1="35" x2="300" y2="35" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                            <line x1="0" y1="60" x2="300" y2="60" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                            <line x1="0" y1="85" x2="300" y2="85" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />

                            <path d={pathD} fill="none" stroke="#f59e0b" strokeWidth="2.5" />

                            {/* Glow dots */}
                            <circle cx="15" cy="100" r="3" fill="#f59e0b" />
                            <circle cx="60" cy="75" r="3" fill="#f59e0b" />
                            <circle cx="105" cy="60" r="3" fill="#f59e0b" />
                            <circle cx="150" cy="40" r="3" fill="#f59e0b" />
                            <circle cx="195" cy="55" r="3" fill="#f59e0b" />
                            <circle cx="240" cy="45" r="3" fill="#f59e0b" />

                            {/* Peak dot with label */}
                            <g transform="translate(285, 30)">
                                <circle r="4" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                                <rect x="-24" y="-20" width="48" height="15" rx="3" fill="#f59e0b" />
                                <text x="0" y="-9" fill="#0b0f17" fontSize="8" fontWeight="bold" textAnchor="middle">
                                    {combinedUsedGB} GB
                                </text>
                            </g>
                        </svg>

                        <div className="trend-x-axis">
                            {trendPoints.map((pt, idx) => (
                                <span key={idx}>{pt.date}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
