import React, { useState, useMemo } from "react";

export default function DocumentsOverview({ documents = [], storageStats = {} }) {
    const [timeframe, setTimeframe] = useState("This Month");

    const kb = storageStats?.knowledgeBase || {};

    const filteredDocs = useMemo(() => {
        if (!documents || documents.length === 0) return [];
        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        const startOfThisYear = new Date(now.getFullYear(), 0, 1);

        return documents.filter((doc) => {
            const date = doc.createdAt ? new Date(doc.createdAt) : doc.updatedAt ? new Date(doc.updatedAt) : null;
            if (!date) return true;

            if (timeframe === "This Month") {
                return date >= startOfThisMonth;
            } else if (timeframe === "Last Month") {
                return date >= startOfLastMonth && date <= endOfLastMonth;
            } else if (timeframe === "This Year") {
                return date >= startOfThisYear;
            }
            return true;
        });
    }, [documents, timeframe]);

    // Dynamically calculate status breakdown from filtered documents array
    let indexed = 0;
    let processing = 0;
    let pending = 0;
    let failed = 0;

    if (filteredDocs && filteredDocs.length > 0) {
        filteredDocs.forEach((doc) => {
            const st = (doc.embeddingStatus || doc.status || "indexed").toLowerCase();
            if (st === "indexed" || st === "ready" || st === "active") indexed++;
            else if (st === "processing") processing++;
            else if (st === "pending") pending++;
            else if (st === "failed" || st === "error") failed++;
            else indexed++;
        });
    } else {
        indexed = kb.successfulDocuments || 78;
        processing = kb.processingQueue || 18;
        pending = kb.pendingDocuments || 20;
        failed = kb.failedDocuments || 10;
    }

    const totalDocs = indexed + processing + pending + failed || 1;
    const indexedPct = ((indexed / totalDocs) * 100).toFixed(1);
    const processingPct = ((processing / totalDocs) * 100).toFixed(1);
    const pendingPct = ((pending / totalDocs) * 100).toFixed(1);
    const failedPct = ((failed / totalDocs) * 100).toFixed(1);

    const statusData = [
        { label: "Indexed", count: indexed, percent: `${indexedPct}%`, color: "#10b981" },
        { label: "Processing", count: processing, percent: `${processingPct}%`, color: "#3b82f6" },
        { label: "Pending", count: pending, percent: `${pendingPct}%`, color: "#f59e0b" },
        { label: "Failed", count: failed, percent: `${failedPct}%`, color: "#ef4444" }
    ];

    // Data points for Chunks Processed chart
    const chartPoints = [
        { date: "May 10", val: "2.1K", x: 20, y: 110 },
        { date: "May 11", val: "4.5K", x: 70, y: 75 },
        { date: "May 12", val: "3.8K", x: 120, y: 88 },
        { date: "May 13", val: "6.2K", x: 170, y: 52 },
        { date: "May 14", val: "5.4K", x: 220, y: 64 },
        { date: "May 15", val: "8.9K", x: 270, y: 35 },
        { date: "May 16", val: (kb.totalChunks ? kb.totalChunks.toLocaleString() : "12,540"), x: 320, y: 15 }
    ];

    const pathD = `M 20,110 Q 45,75 70,75 T 120,88 T 170,52 T 220,64 T 270,35 T 320,15`;
    const areaD = `${pathD} L 320,130 L 20,130 Z`;

    // SVG stroke calculations for donut
    const circ = 314; // 2 * pi * 50
    const dashIndexed = (indexed / totalDocs) * circ;
    const dashProcessing = (processing / totalDocs) * circ;
    const dashPending = (pending / totalDocs) * circ;
    const dashFailed = (failed / totalDocs) * circ;

    return (
        <section className="documents-overview-section">
            <div className="overview-header-row">
                <div>
                    <h2>Documents Overview</h2>
                    <p>Overview of documents and processing status</p>
                </div>
                <div className="timeframe-select-wrapper">
                    <select
                        className="timeframe-select"
                        value={timeframe}
                        onChange={(e) => setTimeframe(e.target.value)}
                    >
                        <option value="This Month">This Month</option>
                        <option value="Last Month">Last Month</option>
                        <option value="This Year">This Year</option>
                    </select>
                </div>
            </div>

            <div className="overview-cards-wrapper">
                {/* Donut Chart Block */}
                <div className="overview-sub-card">
                    <h4 className="sub-card-title">Documents by Status</h4>
                    <div className="donut-content-row">
                        <div className="donut-svg-container">
                            <svg viewBox="0 0 140 140" className="donut-chart">
                                <circle cx="70" cy="70" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="18" />
                                
                                <circle
                                    cx="70" cy="70" r="50" fill="none"
                                    stroke="#10b981" strokeWidth="18"
                                    strokeDasharray={`${dashIndexed} ${circ - dashIndexed}`}
                                    strokeDashoffset="0"
                                    strokeLinecap="round"
                                />
                                <circle
                                    cx="70" cy="70" r="50" fill="none"
                                    stroke="#3b82f6" strokeWidth="18"
                                    strokeDasharray={`${dashProcessing} ${circ - dashProcessing}`}
                                    strokeDashoffset={-dashIndexed}
                                    strokeLinecap="round"
                                />
                                <circle
                                    cx="70" cy="70" r="50" fill="none"
                                    stroke="#f59e0b" strokeWidth="18"
                                    strokeDasharray={`${dashPending} ${circ - dashPending}`}
                                    strokeDashoffset={-(dashIndexed + dashProcessing)}
                                    strokeLinecap="round"
                                />
                                <circle
                                    cx="70" cy="70" r="50" fill="none"
                                    stroke="#ef4444" strokeWidth="18"
                                    strokeDasharray={`${dashFailed} ${circ - dashFailed}`}
                                    strokeDashoffset={-(dashIndexed + dashProcessing + dashPending)}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="donut-center-text">
                                <strong className="donut-total">{totalDocs}</strong>
                                <span className="donut-label">Documents</span>
                            </div>
                        </div>

                        <div className="donut-legend">
                            {statusData.map((item, idx) => (
                                <div key={idx} className="legend-row">
                                    <div className="legend-label-group">
                                        <span className="legend-dot" style={{ backgroundColor: item.color }}></span>
                                        <span className="legend-name">{item.label}</span>
                                    </div>
                                    <div className="legend-val-group">
                                        <strong className="legend-count">{item.count}</strong>
                                        <span className="legend-pct">({item.percent})</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Line / Area Chart Block */}
                <div className="overview-sub-card">
                    <h4 className="sub-card-title">Chunks Processed</h4>
                    <div className="line-chart-container">
                        <div className="y-axis-labels">
                            <span>8K</span>
                            <span>6K</span>
                            <span>4K</span>
                            <span>2K</span>
                            <span>0</span>
                        </div>
                        <div className="chart-svg-wrapper">
                            <svg viewBox="0 0 350 140" className="area-chart">
                                <defs>
                                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                                    </linearGradient>
                                </defs>

                                <line x1="10" y1="15" x2="340" y2="15" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                                <line x1="10" y1="43" x2="340" y2="43" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                                <line x1="10" y1="72" x2="340" y2="72" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                                <line x1="10" y1="101" x2="340" y2="101" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                                <line x1="10" y1="130" x2="340" y2="130" stroke="rgba(255,255,255,0.06)" />

                                <path d={areaD} fill="url(#areaGradient)" />
                                <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2.5" />

                                <g transform="translate(320, 15)">
                                    <circle r="4" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                                    <rect x="-26" y="-22" width="52" height="17" rx="3" fill="#10b981" />
                                    <text x="0" y="-10" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">
                                        {kb.totalChunks ? kb.totalChunks.toLocaleString() : "12,540"}
                                    </text>
                                </g>
                            </svg>
                            
                            <div className="x-axis-labels">
                                {chartPoints.map((pt, idx) => (
                                    <span key={idx}>{pt.date}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
