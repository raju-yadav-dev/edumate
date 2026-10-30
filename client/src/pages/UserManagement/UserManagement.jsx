import { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
    Users,
    UserPlus,
    Shield,
    Search,
    Trash2,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    X,
    Clock,
    ArrowLeft,
    ExternalLink
} from "lucide-react";
import useAuth from "../../hooks/useAuth";
import { fetchUsers, updateUser, createUser, deleteUser } from "../../services/userService";
import "./UserManagement.css";

const ROLE_OPTIONS = [
    { value: "student", label: "Student" },
    { value: "teacher", label: "Teacher" },
    { value: "faculty", label: "Faculty" },
    { value: "admin", label: "Admin" },
    { value: "super_admin", label: "Super Admin" }
];

const STATUS_OPTIONS = [
    { value: "active", label: "Active" },
    { value: "suspended", label: "Suspended" },
    { value: "pending_verification", label: "Pending Verification" }
];

export default function UserManagement() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRole, setSelectedRole] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("");

    // Modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
        role: "student",
        department: "",
        institution: "EduMate University"
    });

    // Delete confirmation modal
    const [userToDelete, setUserToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const data = await fetchUsers({
                search: searchQuery,
                role: selectedRole,
                status: selectedStatus,
                limit: 100
            });
            setUsers(data.users || []);
        } catch (err) {
            setError(err.message || "Failed to load user list.");
        } finally {
            setLoading(false);
        }
    }, [searchQuery, selectedRole, selectedStatus]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadUsers();
        }, 250);
        return () => clearTimeout(timer);
    }, [loadUsers]);

    const showToast = (msg) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(""), 4000);
    };

    const handleRoleChange = async (targetUser, newRole) => {
        if (targetUser.role === newRole) return;
        try {
            const updated = await updateUser(targetUser.id, { role: newRole });
            setUsers((prev) =>
                prev.map((u) => (u.id === targetUser.id ? { ...u, role: updated.role } : u))
            );
            showToast(`Updated ${targetUser.fullName}'s role to ${newRole}.`);
        } catch (err) {
            setError(err.message || "Failed to change role.");
        }
    };

    const handleStatusToggle = async (targetUser) => {
        const newStatus = targetUser.status === "active" ? "suspended" : "active";
        try {
            const updated = await updateUser(targetUser.id, { status: newStatus });
            setUsers((prev) =>
                prev.map((u) => (u.id === targetUser.id ? { ...u, status: updated.status } : u))
            );
            showToast(`User account status set to ${newStatus}.`);
        } catch (err) {
            setError(err.message || "Failed to change status.");
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreating(true);
        setError("");
        try {
            const created = await createUser(formData);
            setUsers((prev) => [created, ...prev]);
            setShowAddModal(false);
            setFormData({
                fullName: "",
                email: "",
                password: "",
                role: "student",
                department: "",
                institution: "EduMate University"
            });
            showToast(`Created user account for ${created.fullName}.`);
        } catch (err) {
            setError(err.message || "Failed to create user.");
        } finally {
            setCreating(false);
        }
    };

    const confirmDelete = async () => {
        if (!userToDelete) return;
        setDeleting(true);
        setError("");
        try {
            await deleteUser(userToDelete.id);
            setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
            showToast(`Deleted user ${userToDelete.fullName}.`);
            setUserToDelete(null);
        } catch (err) {
            setError(err.message || "Failed to delete user.");
        } finally {
            setDeleting(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "Never";
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "Never";
        return date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    // Metrics
    const stats = useMemo(() => {
        const total = users.length;
        const active = users.filter((u) => u.status === "active").length;
        const admins = users.filter((u) => u.role === "admin" || u.role === "super_admin").length;
        return { total, active, admins };
    }, [users]);

    return (
        <div className="user-management-page">
            {/* Top Navigation & Breadcrumb */}
            <header className="um-header">
                <div className="um-header-left">
                    <Link to="/" className="um-back-btn" title="Back to Home">
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <h1 className="um-title">User Management</h1>
                        <p className="um-subtitle">
                            Monitor accounts, permissions, sessions, and roles across the institution.
                        </p>
                    </div>
                </div>

                <div className="um-header-actions">
                    <Link
                        to="/studio"
                        className="um-studio-link"
                    >
                        <span>Knowledge Studio</span>
                        <ExternalLink size={15} />
                    </Link>
                    <button
                        className="um-btn um-btn-primary"
                        onClick={() => setShowAddModal(true)}
                    >
                        <UserPlus size={16} />
                        <span>Add User</span>
                    </button>
                    <button
                        className="um-btn um-btn-secondary"
                        onClick={loadUsers}
                        title="Refresh user list"
                    >
                        <RefreshCw size={16} className={loading ? "spin" : ""} />
                    </button>
                </div>
            </header>

            {/* Notification Alerts */}
            {successMessage && (
                <div className="um-banner um-banner-success">
                    <CheckCircle2 size={18} />
                    <span>{successMessage}</span>
                    <button className="um-banner-close" onClick={() => setSuccessMessage("")}>
                        <X size={15} />
                    </button>
                </div>
            )}
            {error && (
                <div className="um-banner um-banner-error">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                    <button className="um-banner-close" onClick={() => setError("")}>
                        <X size={15} />
                    </button>
                </div>
            )}

            {/* Metrics Cards */}
            <div className="um-stats-grid">
                <div className="um-stat-card">
                    <div className="um-stat-icon um-stat-icon-blue">
                        <Users size={22} />
                    </div>
                    <div>
                        <div className="um-stat-value">{stats.total}</div>
                        <div className="um-stat-label">Total Users</div>
                    </div>
                </div>

                <div className="um-stat-card">
                    <div className="um-stat-icon um-stat-icon-green">
                        <CheckCircle2 size={22} />
                    </div>
                    <div>
                        <div className="um-stat-value">{stats.active}</div>
                        <div className="um-stat-label">Active Accounts</div>
                    </div>
                </div>

                <div className="um-stat-card">
                    <div className="um-stat-icon um-stat-icon-purple">
                        <Shield size={22} />
                    </div>
                    <div>
                        <div className="um-stat-value">{stats.admins}</div>
                        <div className="um-stat-label">Admins & Staff</div>
                    </div>
                </div>
            </div>

            {/* Controls Bar: Search & Filter */}
            <div className="um-controls-bar">
                <div className="um-search-box">
                    <Search size={16} className="um-search-icon" />
                    <input
                        type="text"
                        placeholder="Search by full name or email address..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="um-search-clear" onClick={() => setSearchQuery("")}>
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="um-filters">
                    <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="um-select"
                    >
                        <option value="">All Roles</option>
                        {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                                {r.label}
                            </option>
                        ))}
                    </select>

                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="um-select"
                    >
                        <option value="">All Statuses</option>
                        {STATUS_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>
                                {s.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Users Table */}
            <div className="um-table-container">
                <table className="um-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Role & Permissions</th>
                            <th>Status</th>
                            <th>Last Login</th>
                            <th>Joined</th>
                            <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && users.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="um-empty-state">
                                    <RefreshCw size={24} className="spin" />
                                    <span>Loading accounts...</span>
                                </td>
                            </tr>
                        ) : users.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="um-empty-state">
                                    <Users size={32} />
                                    <span>No matching users found.</span>
                                </td>
                            </tr>
                        ) : (
                            users.map((u) => {
                                const isSelf = currentUser?.id === u.id;
                                const avatarInitial = u.fullName?.charAt(0)?.toUpperCase() || "U";
                                return (
                                    <tr key={u.id} className={isSelf ? "um-row-self" : ""}>
                                        {/* User Name & Email */}
                                        <td>
                                            <div className="um-user-cell">
                                                {u.avatar ? (
                                                    <img src={u.avatar} alt={u.fullName} className="um-avatar" />
                                                ) : (
                                                    <div className="um-avatar-placeholder">{avatarInitial}</div>
                                                )}
                                                <div>
                                                    <div className="um-user-name">
                                                        {u.fullName}
                                                        {isSelf && <span className="um-badge-self">You</span>}
                                                    </div>
                                                    <div className="um-user-email">{u.email}</div>
                                                    {u.department && (
                                                        <div className="um-user-dept">{u.department}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Role Dropdown */}
                                        <td>
                                            <select
                                                className={`um-role-select um-role-${u.role}`}
                                                value={u.role}
                                                disabled={isSelf && u.role === "super_admin"}
                                                onChange={(e) => handleRoleChange(u, e.target.value)}
                                            >
                                                {ROLE_OPTIONS.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>

                                        {/* Status Toggle Badge */}
                                        <td>
                                            <button
                                                className={`um-status-btn um-status-${u.status}`}
                                                disabled={isSelf}
                                                onClick={() => handleStatusToggle(u)}
                                                title={isSelf ? "Cannot modify your own status" : "Click to toggle active/suspended"}
                                            >
                                                <span className="um-status-dot" />
                                                <span>{u.status === "active" ? "Active" : "Suspended"}</span>
                                            </button>
                                        </td>

                                        {/* Last Login Time */}
                                        <td>
                                            <div className="um-time-cell">
                                                <Clock size={14} className="um-time-icon" />
                                                <span>{formatDate(u.lastLoginAt)}</span>
                                            </div>
                                        </td>

                                        {/* Registered / Joined Date */}
                                        <td>
                                            <span className="um-date-text">{formatDate(u.createdAt)}</span>
                                        </td>

                                        {/* Actions */}
                                        <td style={{ textAlign: "right" }}>
                                            <button
                                                className="um-action-btn um-delete-btn"
                                                disabled={isSelf}
                                                onClick={() => setUserToDelete(u)}
                                                title={isSelf ? "Cannot delete own account" : "Delete user"}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add User Modal */}
            {showAddModal && (
                <div className="um-modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="um-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="um-modal-header">
                            <div className="um-modal-title">
                                <UserPlus size={20} />
                                <span>Create New User</span>
                            </div>
                            <button className="um-modal-close" onClick={() => setShowAddModal(false)}>
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="um-modal-form">
                            <div className="um-form-group">
                                <label>Full Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Rahul Sharma"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                />
                            </div>

                            <div className="um-form-group">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="e.g. student@edumate.edu"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div className="um-form-group">
                                <label>Password (Min 8 chars, 1 uppercase, 1 number, 1 special)</label>
                                <input
                                    type="password"
                                    required
                                    placeholder="••••••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>

                            <div className="um-form-row">
                                <div className="um-form-group">
                                    <label>Role</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        {ROLE_OPTIONS.map((r) => (
                                            <option key={r.value} value={r.value}>
                                                {r.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="um-form-group">
                                    <label>Department</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Computer Science"
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="um-modal-actions">
                                <button
                                    type="button"
                                    className="um-btn um-btn-secondary"
                                    onClick={() => setShowAddModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="um-btn um-btn-primary"
                                    disabled={creating}
                                >
                                    {creating ? "Creating..." : "Create Account"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {userToDelete && (
                <div className="um-modal-overlay" onClick={() => setUserToDelete(null)}>
                    <div className="um-modal um-modal-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="um-modal-header">
                            <div className="um-modal-title" style={{ color: "var(--danger)" }}>
                                <Trash2 size={20} />
                                <span>Delete User Account</span>
                            </div>
                            <button className="um-modal-close" onClick={() => setUserToDelete(null)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="um-modal-body">
                            <p>
                                Are you sure you want to delete account <strong>{userToDelete.fullName}</strong> ({userToDelete.email})?
                            </p>
                            <p className="um-warning-text">
                                This will deactivate the user and revoke all active sessions.
                            </p>
                        </div>
                        <div className="um-modal-actions">
                            <button
                                type="button"
                                className="um-btn um-btn-secondary"
                                onClick={() => setUserToDelete(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="um-btn um-btn-danger"
                                disabled={deleting}
                                onClick={confirmDelete}
                            >
                                {deleting ? "Deleting..." : "Confirm Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

