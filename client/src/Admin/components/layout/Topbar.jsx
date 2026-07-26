import "./Topbar.css";

import {
    Bell,
    ChevronDown,
    LogOut,
    Menu,
    Moon,
    RefreshCcw,
    Search,
    Sun,
    Zap
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

function Topbar({
    activeSection,
    activeFolderLabel,
    adminUser,
    refreshSection,
    busy,
    savingKeys,
    search,
    setSearch,
    onToggleSidebar,
    adminTheme,
    onToggleTheme
}) {
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const profileMenuRef = useRef(null);
    const notificationMenuRef = useRef(null);
    const searchRef = useRef(null);
    const initials = useMemo(() => {
        const source = adminUser?.fullName || adminUser?.name || adminUser?.email || "Admin";
        return source
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join("") || "AD";
    }, [adminUser]);

    useEffect(() => {
        function handlePointerDown(event) {
            if (!profileMenuRef.current?.contains(event.target)) {
                setShowProfileMenu(false);
            }

            if (!notificationMenuRef.current?.contains(event.target)) {
                setShowNotifications(false);
            }
        }

        window.addEventListener("pointerdown", handlePointerDown);
        return () => window.removeEventListener("pointerdown", handlePointerDown);
    }, []);

    useEffect(() => {
        function handleKeyDown(event) {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                searchRef.current?.focus();
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    return (

        <header className="admin-topbar">

            <div className="topbar-left">
                <button
                    type="button"
                    className="admin-menu-button"
                    aria-label="Open sidebar"
                    onClick={onToggleSidebar}
                >
                    <Menu size={20} />
                </button>

                {activeSection === "users" ? (
                    <div>
                        <h1>Users</h1>

                        <p>
                            Manage all registered users and their permissions.
                        </p>
                    </div>
                ) : (
                    <div>
                        <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
                            <span>Admin</span>
                            <span>/</span>
                            <strong>{activeSection === "files" ? activeFolderLabel : activeSection}</strong>
                        </nav>

                        <h1>EduMate Admin Console</h1>

                        <p>
                            Manage documents, API setup, and knowledge data.
                        </p>
                    </div>
                )}

            </div>

            <div className="topbar-right">

                <div className="global-search">

                    <Search size={18} />

                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Search anything..."
                        value={search}
                        onChange={(e)=>setSearch(e.target.value)}
                    />

                    <kbd>Ctrl K</kbd>

                </div>

                <button
                    className="icon-button"
                    title={adminTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                    type="button"
                    onClick={onToggleTheme}
                >
                    {adminTheme === "dark" ? <Sun size={18}/> : <Moon size={18}/>}
                </button>

                <div className="topbar-menu-wrap" ref={notificationMenuRef}>
                    <button
                        className="icon-button notification-button"
                        title="Notifications"
                        type="button"
                        onClick={() => setShowNotifications((current) => !current)}
                    >

                        <Bell size={18}/>

                        <span>3</span>

                    </button>

                    {showNotifications ? (
                        <div className="topbar-popover notification-popover">
                            <strong>System Updates</strong>
                            <button type="button" onClick={refreshSection}>Refresh storage metrics</button>
                            <button type="button" onClick={() => setSearch("failed")}>Show failed jobs</button>
                            <button type="button" onClick={() => setSearch("processing")}>Show processing files</button>
                        </div>
                    ) : null}
                </div>

                <div className="topbar-menu-wrap" ref={profileMenuRef}>
                <button
                    type="button"
                    className="admin-profile"
                    onClick={() => setShowProfileMenu((current) => !current)}
                >

                    <div className="profile-avatar">

                        {initials}

                    </div>

                    <div className="profile-info">

                        <strong>
                            {adminUser?.fullName || "Admin"}
                        </strong>

                        <small>
                            {adminUser?.role === "super_admin"
                                ? "Super Admin"
                                : "Administrator"}
                        </small>

                    </div>

                    <ChevronDown size={16}/>

                </button>

                    {showProfileMenu ? (
                        <div className="topbar-popover profile-popover">
                            <strong>{adminUser?.email || "admin@edumate.local"}</strong>
                            <button type="button" onClick={() => setSearch("")}>Clear search</button>
                            <button type="button" onClick={() => window.location.assign("/")}>
                                <LogOut size={15} />
                                Back to site
                            </button>
                        </div>
                    ) : null}
                </div>

                {activeSection !== "users" ? (
                    <button
                        className="refresh-btn"
                        type="button"
                        onClick={refreshSection}
                        disabled={busy || savingKeys}
                    >
                        {busy || savingKeys ? <Zap size={17}/> : <RefreshCcw size={17}/>}
                        Refresh
                    </button>
                ) : null}

            </div>

        </header>

    );

}

export default Topbar;
