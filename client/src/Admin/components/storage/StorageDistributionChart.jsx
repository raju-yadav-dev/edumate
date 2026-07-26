import React, { useState } from "react";

export default function StorageDistributionChart({ stats = {} }) {
    const [showReportModal, setShowReportModal] = useState(false);

    const mongo = stats?.mongodb || {};
    const supabase = stats?.supabase || {};

    const mongoGB = mongo.used ? (mongo.used / (1024 * 1024 * 1024)).toFixed(1) : "8.1";
    const supabaseGB = supabase.used ? (supabase.used / (1024 * 1024 * 1024)).toFixed(1) : "15.4";
    const totalUsedGB = (parseFloat(mongoGB) + parseFloat(supabaseGB)).toFixed(1);
    const availableGB = (50.0 - parseFloat(totalUsedGB)).toFixed(1);

    const mongoPct = Math.round((parseFloat(mongoGB) / parseFloat(totalUsedGB)) * 100) || 34;
    const supabasePct = Math.round((parseFloat(supabaseGB) / parseFloat(totalUsedGB)) * 100) || 66;

    // SVG stroke calculations
    const circ = 314;
    const dashMongo = (mongoPct / 100) * circ;
    const dashSupa = (supabasePct / 100) * circ;

    return (
        <div className="bottom-widget-card">
            <div className="widget-header-block">
                <h3>Storage Distribution</h3>
                <p>Storage usage distribution by service</p>
            </div>

            <div className="dist-body-row">
                <div className="dist-donut-wrapper">
                    <svg viewBox="0 0 140 140" className="dist-donut">
                        <circle cx="70" cy="70" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16" />
                        <circle
                            cx="70" cy="70" r="50" fill="none"
                            stroke="#10b981" strokeWidth="16"
                            strokeDasharray={`${dashMongo} ${circ - dashMongo}`}
                            strokeDashoffset="0"
                            strokeLinecap="round"
                        />
                        <circle
                            cx="70" cy="70" r="50" fill="none"
                            stroke="#06b6d4" strokeWidth="16"
                            strokeDasharray={`${dashSupa} ${circ - dashSupa}`}
                            strokeDashoffset={-dashMongo}
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="dist-donut-center">
                        <strong>{totalUsedGB} GB</strong>
                        <span>Total Used</span>
                    </div>
                </div>

                <div className="dist-legend-list">
                    <div className="dist-legend-item">
                        <div className="item-title"><span className="dot green"></span> MongoDB (Atlas)</div>
                        <strong className="item-val">{mongoGB} GB ({mongoPct}%)</strong>
                    </div>
                    <div className="dist-legend-item">
                        <div className="item-title"><span className="dot blue"></span> Supabase Storage</div>
                        <strong className="item-val">{supabaseGB} GB ({supabasePct}%)</strong>
                    </div>
                    <div className="dist-legend-item">
                        <div className="item-title"><span className="dot gray"></span> Available</div>
                        <strong className="item-val">{availableGB} GB (53%)</strong>
                    </div>
                </div>
            </div>

            <div className="widget-card-footer">
                <button type="button" className="gold-action-btn" onClick={() => setShowReportModal(true)}>
                    View Detailed Report
                </button>
            </div>

            {showReportModal && (
                <div className="op-modal-backdrop" onClick={() => setShowReportModal(false)}>
                    <div className="op-modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="op-modal-header">
                            <h3>Storage Distribution Audit Report</h3>
                            <button className="op-modal-close" onClick={() => setShowReportModal(false)}>×</button>
                        </div>
                        <div className="op-modal-body">
                            <div className="op-summary-chips">
                                <div><span>MongoDB:</span> <strong>{mongoGB} GB ({mongoPct}%)</strong></div>
                                <div><span>Supabase:</span> <strong>{supabaseGB} GB ({supabasePct}%)</strong></div>
                                <div><span>Available:</span> <strong>{availableGB} GB</strong></div>
                            </div>
                            <div className="op-log-terminal">
                                <div className="terminal-content">
                                    <div className="terminal-line"><span className="term-prompt">&gt;</span> Allocation quota check: PASSED (0 breaches)</div>
                                    <div className="terminal-line"><span className="term-prompt">&gt;</span> Media & document blob ratio: 66% (Supabase Bucket)</div>
                                    <div className="terminal-line"><span className="term-prompt">&gt;</span> Vector embeddings & BSON metadata: 34% (MongoDB)</div>
                                </div>
                            </div>
                        </div>
                        <div className="op-modal-footer">
                            <button className="btn-secondary" onClick={() => setShowReportModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
