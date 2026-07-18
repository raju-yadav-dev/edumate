import { RefreshCcw, Trash2 } from "lucide-react";

function UserManagement({
    users,
    userSearch,
    setUserSearch,
    roleFilter,
    setRoleFilter,
    loadUsers,
    removeUser
}) {
    return (
        <section className="admin-panel-card">
            <div className="panel-header-row">
                <div>
                    <h2>User management</h2>
                    <p>Search, filter, and remove accounts from the admin console.</p>
                </div>
                <button type="button" onClick={loadUsers} className="secondary-action">
                    <RefreshCcw size={16} />
                    Refresh users
                </button>
            </div>

            <div className="filters-row">
                <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search users..." />
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                    <option value="">All roles</option>
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="faculty">Faculty</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super admin</option>
                </select>
            </div>

            <div className="admin-list">
                {users.map((user) => (
                    <article className="admin-card-row" key={user._id}>
                        <div className="avatar-badge">{String(user.fullName || "U").slice(0, 1).toUpperCase()}</div>
                        <div className="row-copy">
                            <strong>{user.fullName}</strong>
                            <span>{user.email}</span>
                        </div>
                        <div className="pill-group">
                            <span>{user.role}</span>
                            <span>{user.status}</span>
                        </div>
                        <button type="button" className="danger-action" onClick={() => removeUser(user._id)}>
                            <Trash2 size={16} />
                            Remove
                        </button>
                    </article>
                ))}
            </div>
        </section>
    );
}

export default UserManagement;
