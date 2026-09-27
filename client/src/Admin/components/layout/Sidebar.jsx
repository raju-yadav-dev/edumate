import "./Sidebar.css";

import {
    Activity,
    Database,
    Folder,
    GraduationCap,
    KeyRound,
    List,
    LogOut,
    PanelLeftClose,
    PanelLeftOpen,
    Settings,
    Users,
    Globe,
    BookOpen,
    Layers
} from "lucide-react";
import { useState } from "react";

function Sidebar({
    activeSection,
    setActiveSection,
    storagePercent = 0,
    usedStorage = 0,
    storageLimit = 0,
    mongoStats = {},
    supabaseStats = {},
    combinedStats = {},
    loadStorageStats,
    refreshSection,
    logoutAdmin,
    formatBytes,
    isMobileOpen = false,
    onCloseMobile
}) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const sidebarClassName = [
        "admin-left",
        isCollapsed ? "collapsed" : "",
        isMobileOpen ? "mobile-open" : ""
    ].filter(Boolean).join(" ");

    return (
        <>
            <button
                type="button"
                className={isMobileOpen ? "admin-sidebar-backdrop visible" : "admin-sidebar-backdrop"}
                aria-label="Close sidebar"
                onClick={onCloseMobile}
            />
            <aside className={sidebarClassName}>
                <div className="admin-brand">
                    <div className="brand-mark">
                        <GraduationCap size={28} />
                        <strong>EduMate</strong>
                    </div>

                    <span>ADMIN CONSOLE</span>

                    <button
                        type="button"
                        className="sidebar-collapse"
                        onClick={() => setIsCollapsed((current) => !current)}
                        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {isCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
                    </button>
                </div>

                <p className="nav-section-label">Main menu</p>

                <nav className="admin-nav">
                    <button
                        type="button"
                        className={activeSection === "files" ? "active" : ""}
                        onClick={() => setActiveSection("files")}
                        title="File Manager"
                    >
                        <Folder />
                        <span>File Manager</span>
                    </button>

                    <button
                        type="button"
                        className={activeSection === "chunking" ? "active" : ""}
                        onClick={() => setActiveSection("chunking")}
                        title="Chunking Studio"
                    >
                        <Layers />
                        <span>Chunking Studio</span>
                    </button>

                    <button
                        type="button"
                        className={activeSection === "users" ? "active" : ""}
                        onClick={() => setActiveSection("users")}
                        title="Users"
                    >
                        <Users />
                        <span>Users</span>
                    </button>

                    <button
                        type="button"
                        className={activeSection === "keys" ? "active" : ""}
                        onClick={() => setActiveSection("keys")}
                        title="API Keys"
                    >
                        <KeyRound />
                        <span>API Keys</span>
                    </button>

                    <button
                        type="button"
                        className={activeSection === "tools" ? "active" : ""}
                        onClick={() => setActiveSection("tools")}
                        title="Data Tools"
                    >
                        <Database />
                        <span>Data Tools</span>
                    </button>

                    <button
                        type="button"
                        className={activeSection === "benchmark" ? "active" : ""}
                        onClick={() => setActiveSection("benchmark")}
                        title="AI Performance & LLM Benchmarks"
                    >
                        <Activity />
                        <span>AI Performance</span>
                    </button>

                    <button
                        type="button"
                        className={activeSection === "analytics" ? "active" : ""}
                        onClick={() => setActiveSection("analytics")}
                        title="Knowledge Base & AI Analytics"
                    >
                        <BookOpen />
                        <span>Knowledge Analytics</span>
                    </button>
                </nav>

                <p className="nav-section-label">System</p>

                <nav className="admin-nav admin-system-nav">
                    <button
                        type="button"
                        className={activeSection === "storage" ? "active" : ""}
                        onClick={() => {
                            setActiveSection("storage");
                            if (typeof loadStorageStats === "function") loadStorageStats();
                        }}
                        title="Storage Overview"
                    >
                        <Activity />
                        <span>Storage Overview</span>
                    </button>

                    <button
                        type="button"
                        className={activeSection === "activity" ? "active" : ""}
                        onClick={() => {
                            setActiveSection("activity");
                            if (typeof refreshSection === "function") refreshSection();
                        }}
                        title="Activity Logs"
                    >
                        <List />
                        <span>Activity Logs</span>
                    </button>

                    <button
                        type="button"
                        className={activeSection === "settings" ? "active" : ""}
                        onClick={() => setActiveSection("settings")}
                        title="Settings"
                    >
                        <Settings />
                        <span>Settings</span>
                    </button>
                </nav>

                <div
                    className="storage-box"
                    onClick={() => {
                        setActiveSection("storage");
                        if (typeof loadStorageStats === "function") loadStorageStats();
                    }}
                    style={{ cursor: "pointer" }}
                    title="Click to view Storage Overview"
                >
                    <h4>Storage Overview</h4>

                    <div
                        className="storage-circle"
                        style={{
                            background: `conic-gradient(var(--admin-gold) ${storagePercent}%, rgba(255,255,255,.06) 0)`
                        }}
                    >
                        <div className="storage-inner">
                            <h2>{formatBytes ? formatBytes(usedStorage) : `${usedStorage} B`}</h2>
                            <p>of {formatBytes ? formatBytes(storageLimit) : `${storageLimit} B`} used</p>
                        </div>
                    </div>

                    <strong>{storagePercent ? storagePercent.toFixed(0) : 47}% Used</strong>

                    <div className="storage-breakdown">
                        <span>
                            <small>MongoDB</small>
                            <b>{formatBytes ? formatBytes(mongoStats.used) : "8.1 GB"}</b>
                        </span>

                        <span>
                            <small>Local Storage</small>
                            <b>{formatBytes ? formatBytes(supabaseStats.used) : "15.4 GB"}</b>
                        </span>

                        <span>
                            <small>Available</small>
                            <b>{formatBytes ? formatBytes(combinedStats.remaining) : "26.5 GB"}</b>
                        </span>
                    </div>

                    <button
                        type="button"
                        className="back-site"
                        onClick={() => {
                            if (logoutAdmin) logoutAdmin();
                            window.location.assign("/");
                        }}
                    >
                        <LogOut size={16} />
                        <span>Back to Site</span>
                    </button>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;
