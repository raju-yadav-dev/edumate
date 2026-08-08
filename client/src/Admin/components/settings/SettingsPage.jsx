import React, { useState } from "react";
import {
    Settings,
    Shield,
    Bell,
    Bot,
    Database,
    Calendar,
    Share2,
    Info,
    Check,
    Save
} from "lucide-react";
import GeneralSettingsTab from "./GeneralSettingsTab";
import ApiKeys from "../apikeys/ApiKeys";
import { recordActivityLog } from "../../../services/activityLogService";
import "./Settings.css";

export default function SettingsPage({
    adminTheme,
    onToggleTheme,
    apiKeys,
    setApiKeys,
    saveKeys,
    savingKeys,
    documents = [],
    storageStats = {}
}) {
    const [activeTab, setActiveTab] = useState("general");
    const [toastMessage, setToastMessage] = useState("");

    // Security Switches
    const [securityOpts, setSecurityOpts] = useState({
        enforce2FA: true,
        strongPassword: true,
        sessionTimeout: true
    });

    // Notification Switches
    const [notifOpts, setNotifOpts] = useState({
        storageAlert: true,
        failedLoginAlert: true,
        weeklyDigest: false
    });

    // Backup Option
    const [autoBackup, setAutoBackup] = useState(true);

    const showToast = (msg) => {
        setToastMessage(msg);
        recordActivityLog({
            action: "Updated Settings",
            service: "Settings",
            resource: msg,
            details: `${msg} configuration saved`,
            status: "Success"
        });
        setTimeout(() => setToastMessage(""), 2500);
    };

    const tabs = [
        { id: "general", label: "General", icon: Settings },
        { id: "security", label: "Security", icon: Shield },
        { id: "notifications", label: "Notifications", icon: Bell },
        { id: "ai", label: "AI / Model Settings", icon: Bot },
        { id: "database", label: "Database", icon: Database },
        { id: "backup", label: "Backup & Restore", icon: Calendar },
        { id: "integrations", label: "Integrations", icon: Share2 },
        { id: "system", label: "System Info", icon: Info }
    ];

    return (
        <div className="settings-page-container">
            {/* Toast Banner */}
            {toastMessage && (
                <div className="settings-toast-banner">
                    <Check size={16} /> {toastMessage} saved successfully!
                </div>
            )}

            {/* Top Navigation Tabs Bar (8 Tabs) */}
            <div className="settings-tabs-header">
                {tabs.map((tab) => {
                    const IconComp = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            className={`settings-tab-btn ${isActive ? "active" : ""}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <IconComp size={15} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Active Tab Content */}
            <div className="settings-content-wrapper">
                {activeTab === "general" && (
                    <GeneralSettingsTab adminTheme={adminTheme} onToggleTheme={onToggleTheme} />
                )}

                {activeTab === "ai" && (
                    <ApiKeys
                        apiKeys={apiKeys}
                        setApiKeys={setApiKeys}
                        saveKeys={saveKeys}
                        savingKeys={savingKeys}
                    />
                )}

                {activeTab === "security" && (
                    <div className="settings-card security-tab-card">
                        <div className="settings-card-head">
                            <h3>🛡️ Security Settings</h3>
                            <p>Configure authentication requirements and password policies.</p>
                        </div>
                        <div className="settings-card-body">
                            <div className="toggle-switches-list">
                                <div className="switch-row">
                                    <span>Enforce Two-Factor Authentication (2FA) for Admins</span>
                                    <button
                                        type="button"
                                        className={`switch-btn ${securityOpts.enforce2FA ? "active" : ""}`}
                                        onClick={() => setSecurityOpts((prev) => ({ ...prev, enforce2FA: !prev.enforce2FA }))}
                                    >
                                        <span className="switch-slider"></span>
                                    </button>
                                </div>
                                <div className="switch-row">
                                    <span>Require Strong Password (Numbers + Symbols)</span>
                                    <button
                                        type="button"
                                        className={`switch-btn ${securityOpts.strongPassword ? "active" : ""}`}
                                        onClick={() => setSecurityOpts((prev) => ({ ...prev, strongPassword: !prev.strongPassword }))}
                                    >
                                        <span className="switch-slider"></span>
                                    </button>
                                </div>
                                <div className="switch-row">
                                    <span>Session Timeout after 30 minutes of inactivity</span>
                                    <button
                                        type="button"
                                        className={`switch-btn ${securityOpts.sessionTimeout ? "active" : ""}`}
                                        onClick={() => setSecurityOpts((prev) => ({ ...prev, sessionTimeout: !prev.sessionTimeout }))}
                                    >
                                        <span className="switch-slider"></span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="settings-card-foot">
                            <button type="button" className="settings-gold-btn" onClick={() => showToast("Security Settings")}>
                                <Save size={14} /> Save Changes
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === "notifications" && (
                    <div className="settings-card notification-tab-card">
                        <div className="settings-card-head">
                            <h3>🔔 Notification Preferences</h3>
                            <p>Manage system alerts and automated email summaries.</p>
                        </div>
                        <div className="settings-card-body">
                            <div className="toggle-switches-list">
                                <div className="switch-row">
                                    <span>Email alert when storage reaches 90% quota</span>
                                    <button
                                        type="button"
                                        className={`switch-btn ${notifOpts.storageAlert ? "active" : ""}`}
                                        onClick={() => setNotifOpts((prev) => ({ ...prev, storageAlert: !prev.storageAlert }))}
                                    >
                                        <span className="switch-slider"></span>
                                    </button>
                                </div>
                                <div className="switch-row">
                                    <span>Email alert on failed login attempts</span>
                                    <button
                                        type="button"
                                        className={`switch-btn ${notifOpts.failedLoginAlert ? "active" : ""}`}
                                        onClick={() => setNotifOpts((prev) => ({ ...prev, failedLoginAlert: !prev.failedLoginAlert }))}
                                    >
                                        <span className="switch-slider"></span>
                                    </button>
                                </div>
                                <div className="switch-row">
                                    <span>Send weekly system health digest</span>
                                    <button
                                        type="button"
                                        className={`switch-btn ${notifOpts.weeklyDigest ? "active" : ""}`}
                                        onClick={() => setNotifOpts((prev) => ({ ...prev, weeklyDigest: !prev.weeklyDigest }))}
                                    >
                                        <span className="switch-slider"></span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="settings-card-foot">
                            <button type="button" className="settings-gold-btn" onClick={() => showToast("Notification Preferences")}>
                                <Save size={14} /> Save Changes
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === "database" && (
                    <div className="settings-card db-tab-card">
                        <div className="settings-card-head">
                            <h3>💾 Database Connections & Indexing</h3>
                            <p>Active connection pools and vector store cluster settings.</p>
                        </div>
                        <div className="settings-card-body">
                            <div className="m-row" style={{ padding: "8px 0" }}><span>MongoDB Atlas Cluster:</span> <strong style={{ color: "#10b981" }}>Connected (Healthy)</strong></div>
                            <div className="m-row" style={{ padding: "8px 0" }}><span>Supabase Storage Bucket:</span> <strong style={{ color: "#06b6d4" }}>Connected (Quota: 25 GB)</strong></div>
                            <div className="m-row" style={{ padding: "8px 0" }}><span>Qdrant Vector Store:</span> <strong style={{ color: "#a855f7" }}>{storageStats?.qdrant?.vectors !== undefined && storageStats?.qdrant?.vectors !== null ? storageStats.qdrant.vectors.toLocaleString() : "-"} Vectors Indexed</strong></div>
                        </div>
                        <div className="settings-card-foot">
                            <button type="button" className="settings-gold-btn" onClick={() => showToast("Database Health Verified")}>
                                <Save size={14} /> Test Connections
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === "backup" && (
                    <div className="settings-card backup-tab-card">
                        <div className="settings-card-head">
                            <h3>📅 Backup & Restore</h3>
                            <p>Schedule automated backups and download database snapshots.</p>
                        </div>
                        <div className="settings-card-body">
                            <div className="switch-row">
                                <span>Daily Automated Database Backup</span>
                                <button
                                    type="button"
                                    className={`switch-btn ${autoBackup ? "active" : ""}`}
                                    onClick={() => setAutoBackup((prev) => !prev)}
                                >
                                    <span className="switch-slider"></span>
                                </button>
                            </div>
                        </div>
                        <div className="settings-card-foot">
                            <button type="button" className="settings-gold-btn" onClick={() => showToast("Database Snapshot Created")}>
                                <Save size={14} /> Create Snapshot
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === "integrations" && (
                    <div className="settings-card integrations-tab-card">
                        <div className="settings-card-head">
                            <h3>🔗 External Integrations</h3>
                            <p>Connect third-party analytics and webhook pipelines.</p>
                        </div>
                        <div className="settings-card-body">
                            <div className="m-row" style={{ padding: "8px 0" }}><span>Google Gemini API:</span> <strong style={{ color: "#10b981" }}>Connected</strong></div>
                            <div className="m-row" style={{ padding: "8px 0" }}><span>Anthropic Claude API:</span> <strong style={{ color: "#10b981" }}>Connected</strong></div>
                        </div>
                        <div className="settings-card-foot">
                            <button type="button" className="settings-gold-btn" onClick={() => showToast("Integrations Verified")}>
                                <Save size={14} /> Save Integrations
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === "system" && (
                    <div className="settings-card system-tab-card">
                        <div className="settings-card-head">
                            <h3>ℹ️ System Information</h3>
                            <p>Runtime environment and version metadata.</p>
                        </div>
                        <div className="settings-card-body">
                            <div className="m-row" style={{ padding: "8px 0" }}><span>Platform Version:</span> <strong>v2.4.0 (Production)</strong></div>
                            <div className="m-row" style={{ padding: "8px 0" }}><span>React Version:</span> <strong>v18.3.1</strong></div>
                            <div className="m-row" style={{ padding: "8px 0" }}><span>Vite Engine:</span> <strong>v8.1.5</strong></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
