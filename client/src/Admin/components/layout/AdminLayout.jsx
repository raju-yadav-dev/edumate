import "./AdminLayout.css";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import PageContainer from "./PageContainer";

function AdminLayout({
    children,
    adminUser,
    activeSection,
    setActiveSection,
    refreshSection,
    busy,
    savingKeys,
    logoutAdmin,
    storagePercent,
    storageLimit,
    usedStorage,
    mongoStats,
    supabaseStats,
    combinedStats,
    search,
    setSearch
}) {

    return (
        <div className="admin-layout">

            <Sidebar
                activeSection={activeSection}
                setActiveSection={setActiveSection}
                logoutAdmin={logoutAdmin}
                storagePercent={storagePercent}
                storageLimit={storageLimit}
                usedStorage={usedStorage}
                mongoStats={mongoStats}
                supabaseStats={supabaseStats}
                combinedStats={combinedStats}
            />

            <div className="admin-content">

                <Topbar
                    adminUser={adminUser}
                    refreshSection={refreshSection}
                    busy={busy}
                    savingKeys={savingKeys}
                    search={search}
                    setSearch={setSearch}
                />

                <PageContainer>

                    {children}

                </PageContainer>

            </div>

        </div>
    );
}

export default AdminLayout;