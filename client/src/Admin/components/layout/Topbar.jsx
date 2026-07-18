import "./Topbar.css";

import {
    Bell,
    ChevronDown,
    Menu,
    RefreshCcw,
    Search,
    Sun,
    Zap
} from "lucide-react";

function Topbar({
    activeSection,
    activeFolderLabel,
    adminUser,
    refreshSection,
    busy,
    savingKeys,
    search,
    setSearch,
    onToggleSidebar
}) {

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

                <div>
                    <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
                        <span>Admin</span>
                        <span>/</span>
                        <strong>{activeSection === "files" ? activeFolderLabel : activeSection}</strong>
                    </nav>

                    <h1>EduMate Admin Console</h1>

                    <p>
                        Manage documents, users, storage and system settings.
                    </p>

                </div>

            </div>

            <div className="topbar-right">

                <div className="global-search">

                    <Search size={18} />

                    <input
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={(e)=>setSearch(e.target.value)}
                    />

                </div>

                <button
                    className="icon-button"
                    title="Theme"
                    type="button"
                >
                    <Sun size={18}/>
                </button>

                <button
                    className="icon-button notification-button"
                    title="Notifications"
                    type="button"
                >

                    <Bell size={18}/>

                    <span>3</span>

                </button>

                <div className="admin-profile">

                    <div className="profile-avatar">

                        {adminUser?.fullName
                            ? adminUser.fullName.charAt(0).toUpperCase()
                            : "A"}

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

                </div>

                <button
                    className="refresh-btn"
                    type="button"
                    onClick={refreshSection}
                    disabled={busy || savingKeys}
                >

                    {busy || savingKeys ? <Zap size={17}/> : <RefreshCcw size={17}/>}

                    Refresh

                </button>

            </div>

        </header>

    );

}

export default Topbar;
