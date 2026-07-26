import { useEffect, useMemo, useState } from "react";
import {
    ChevronLeft,
    ChevronRight,
    Crown,
    Filter,
    Mail,
    Search,
    ShieldCheck,
    Trash2,
    UserPlus,
    Users
} from "lucide-react";
import "./UserManagement.css";

const PAGE_SIZE = 6;

const normaliseRole = (role = "user") => String(role).replace(/_/g, " ");
const titleCase = (value) => normaliseRole(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
const isActive = (user) => {
    const status = String(user?.status || user?.userStatus || "active").toLowerCase();
    return status === "active" || status === "online" || status === "enabled";
};
const initials = (name = "User") => {
    const str = String(name || "User").trim();
    return str.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
};
const roleClass = (role) => `role-${String(role || "user").toLowerCase().replace(/[^a-z]/g, "")}`;
const dateValue = (value) => {
    const parsed = value ? new Date(value) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};
const formatDate = (value, withTime = false) => {
    const date = dateValue(value);
    if (!date) return "—";
    return new Intl.DateTimeFormat(undefined, withTime
        ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
        : { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

function UserManagement({ users = [], userSearch, setUserSearch, roleFilter, setRoleFilter, loadUsers, removeUser }) {
    const [page, setPage] = useState(1);
    const [metricFilter, setMetricFilter] = useState("all");
    const totalUsers = users.length;
    const activeUsers = users.filter(isActive).length;
    const adminUsers = users.filter((user) => ["admin", "super_admin", "superadmin"].includes(String(user.role || "").toLowerCase())).length;
    const newToday = users.filter((user) => {
        const created = dateValue(user.createdAt || user.joinedAt || user.registeredAt);
        if (!created) return false;
        return created.toDateString() === new Date().toDateString();
    }).length;

    const availableRoles = useMemo(() => {
        const defaultRoles = ["student", "teacher", "faculty", "admin", "super_admin"];
        const customRoles = users.map((u) => String(u.role || "").toLowerCase()).filter(Boolean);
        return Array.from(new Set([...defaultRoles, ...customRoles]));
    }, [users]);

    const roleBreakdown = useMemo(() => {
        const counts = users.reduce((result, user) => {
            const role = String(user.role || "user").toLowerCase();
            result[role] = (result[role] || 0) + 1;
            return result;
        }, {});
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [users]);

    const sevenDayActivity = useMemo(() => Array.from({ length: 7 }, (_, index) => {
        const day = new Date();
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() - (6 - index));
        const nextDay = new Date(day);
        nextDay.setDate(day.getDate() + 1);
        const count = users.filter((user) => {
            const activityDate = dateValue(user.lastLogin || user.lastActiveAt || user.updatedAt || user.createdAt || user.joinedAt);
            return activityDate && activityDate >= day && activityDate < nextDay && isActive(user);
        }).length;
        return { label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day), count };
    }), [users]);

    const registrations = useMemo(() => sevenDayActivity.map(({ label }, index) => {
        const day = new Date();
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() - (6 - index));
        const nextDay = new Date(day);
        nextDay.setDate(day.getDate() + 1);
        return { label, count: users.filter((user) => { const created = dateValue(user.createdAt || user.joinedAt || user.registeredAt); return created && created >= day && created < nextDay; }).length };
    }), [users, sevenDayActivity]);

    const activityMax = Math.max(1, ...sevenDayActivity.map(({ count }) => count));
    const registrationMax = Math.max(1, ...registrations.map(({ count }) => count));

    const filteredUsers = useMemo(() => users.filter((user) => {
        const query = String(userSearch || "").trim().toLowerCase();
        const userName = user.fullName || user.name || user.username || "";
        const userDept = user.department || user.departmentName || user.dept || "";
        const userEmail = user.email || "";
        const userRole = user.role || "";
        const userStatus = user.status || "";

        const matchesSearch = !query || [userName, userEmail, userDept, userRole, userStatus]
            .some((value) => String(value || "").toLowerCase().includes(query));
        const matchesRole = !roleFilter || String(user.role || "").toLowerCase() === roleFilter.toLowerCase();
        const created = dateValue(user.createdAt || user.joinedAt || user.registeredAt);
        const isToday = created && created.toDateString() === new Date().toDateString();
        const matchesMetric = metricFilter === "all"
            || (metricFilter === "active" && isActive(user))
            || (metricFilter === "admins" && ["admin", "super_admin", "superadmin"].includes(String(user.role || "").toLowerCase()))
            || (metricFilter === "today" && isToday);
        return matchesSearch && matchesRole && matchesMetric;
    }), [users, userSearch, roleFilter, metricFilter]);

    const pages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
    useEffect(() => setPage((current) => Math.min(current, pages)), [pages]);
    const visibleUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const metricCards = [
        { label: "Total Users", value: totalUsers, caption: "Registered accounts", icon: Users, tone: "blue", filter: "all" },
        { label: "Active Users", value: activeUsers, caption: "Currently active", icon: ShieldCheck, tone: "green", filter: "active" },
        { label: "Admin Users", value: adminUsers, caption: "Administrators", icon: Crown, tone: "purple", filter: "admins" },
        { label: "New Today", value: newToday, caption: "New registrations", icon: UserPlus, tone: "amber", filter: "today" }
    ];

    return (
        <section className="user-management" aria-label="User management">
            <div className="user-metrics">
                {metricCards.map(({ label, value, caption, icon: Icon, tone, filter }) => (
                    <button type="button" aria-pressed={metricFilter === filter} className={`user-metric user-metric--${tone} ${metricFilter === filter ? "is-selected" : ""}`} key={label} onClick={() => { setMetricFilter(filter); setPage(1); }}>
                        <span className="metric-icon"><Icon size={25} /></span>
                        <div><span>{label}</span><strong>{value}</strong><small>{caption}</small></div>
                    </button>
                ))}
            </div>

            <section className="user-analytics" aria-label="User analytics">
                <div className="analytics-title"><h3>User Analytics</h3><p>Live overview of user activity and distribution</p></div>
                <div className="analytics-grid">
                    <article className="analytics-card activity-card">
                        <h4>Active Users <span>(Last 7 Days)</span></h4>
                        <div className="activity-plot">
                            {sevenDayActivity.map(({ label, count }) => <div className="activity-point" key={label}><span style={{ height: `${Math.max(7, (count / activityMax) * 100)}%` }} title={`${count} active users`} /><b>{count}</b><small>{label}</small></div>)}
                        </div>
                    </article>
                    <article className="analytics-card user-role-card">
                        <h4>Role distribution</h4>
                        <div className="role-bars">
                            {roleBreakdown.length ? roleBreakdown.map(([role, count]) => (
                                <button type="button" className="role-bar" key={role} onClick={() => { setRoleFilter(role); setMetricFilter("all"); setPage(1); }}>
                                    <div><span className={`role-dot ${roleClass(role)}`} /><b>{titleCase(role)}</b><em>{count} ({Math.round((count / (totalUsers || 1)) * 100)}%)</em></div>
                                    <i><i className={roleClass(role)} style={{ width: `${(count / (totalUsers || 1)) * 100}%` }} /></i>
                                </button>
                            )) : <p className="analytics-empty">User role data will appear here.</p>}
                        </div>
                    </article>
                    <article className="analytics-card registration-card">
                        <h4>New registrations <span>Last 7 days</span></h4>
                        <div className="registration-plot">
                            {registrations.map(({ label, count }) => <div key={label}><i style={{ height: `${Math.max(5, (count / registrationMax) * 100)}%` }} title={`${count} registrations`} /><b>{count}</b><small>{label}</small></div>)}
                        </div>
                    </article>
                    <article className="analytics-card login-card">
                        <h4>Login statistics</h4>
                        <div className="login-ring" style={{ "--success-rate": `${totalUsers ? (activeUsers / totalUsers) * 100 : 0}%` }}><b>{totalUsers ? Math.round((activeUsers / totalUsers) * 100) : 0}%</b><span>Active rate</span></div>
                        <div className="login-copy"><span><i className="online-dot" />Active users <b>{activeUsers}</b></span><span><i className="offline-dot" />Inactive users <b>{totalUsers - activeUsers}</b></span></div>
                    </article>
                </div>
            </section>

            <section className="users-table-panel">
                <div className="table-topline"><div><h3>User Management</h3><p>View and manage all users</p></div><span>{filteredUsers.length} user{filteredUsers.length === 1 ? "" : "s"}</span></div>
                <div className="user-tools">
                    <label><Search size={17} /><input value={userSearch} onChange={(event) => { setUserSearch(event.target.value); setPage(1); }} placeholder="Search users..." /></label>
                    <label className="role-filter"><Filter size={16} /><select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }} aria-label="Filter users by role"><option value="">All roles</option>{availableRoles.map((role) => <option key={role} value={role}>{titleCase(role)}</option>)}</select></label>
                </div>
                <div className="users-table-wrap">
                    <table className="users-table"><thead><tr><th>#</th><th>User</th><th>Email</th><th>Department</th><th>Role</th><th>Status</th><th>Last Login</th><th>Joined Date</th><th aria-label="Actions" /></tr></thead>
                        <tbody>{visibleUsers.length ? visibleUsers.map((user, index) => <tr key={user._id || user.id || user.email || index}><td>{(page - 1) * PAGE_SIZE + index + 1}</td><td><div className="table-user"><span className="user-avatar">{initials(user.fullName || user.name || user.username || user.email)}</span><b>{user.fullName || user.name || user.username || "Unnamed user"}</b></div></td><td><small className="email-cell"><Mail size={13} />{user.email || "No email address"}</small></td><td>{user.department || user.departmentName || user.dept || "—"}</td><td><span className={`role-badge ${roleClass(user.role)}`}>{titleCase(user.role)}</span></td><td><span className={`status-badge ${isActive(user) ? "is-active" : "is-inactive"}`}>{isActive(user) ? "Active" : titleCase(user.status || "Inactive")}</span></td><td>{formatDate(user.lastLogin || user.lastActiveAt || user.updatedAt, true)}</td><td>{formatDate(user.createdAt || user.joinedAt || user.registeredAt)}</td><td><button type="button" className="user-remove" onClick={() => removeUser(user._id || user.id)} title={`Remove ${user.fullName || user.name || user.username || "user"}`}><Trash2 size={16} /><span>Remove</span></button></td></tr>) : <tr><td className="no-users" colSpan="9">No users match the current search and filter.</td></tr>}</tbody>
                    </table>
                </div>
                <footer className="users-pagination"><span>Showing {filteredUsers.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} users</span><div><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button><b>{page}</b><button type="button" disabled={page === pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={17} /></button></div></footer>
            </section>
        </section>
    );
}

export default UserManagement;

