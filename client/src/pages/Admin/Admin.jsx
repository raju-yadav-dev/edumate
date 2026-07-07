import "./Admin.css";

import { Database, FileText, KeyRound, Lock, RefreshCcw, Trash2, UploadCloud, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
    bootstrapAdmin,
    deleteAdminDocument,
    deleteAdminUser,
    getAdminStatus,
    listAdminDocuments,
    listAdminUsers,
    loginAdmin,
    saveProviderApiKeys,
    uploadAdminDocument
} from "../../services/adminService";
import useAuth from "../../hooks/useAuth";

const emptyForm = {
    fullName: "",
    email: "",
    password: "",
    institution: ""
};

function Admin() {
    const { user, login, accessToken } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [adminStatus, setAdminStatus] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [upload, setUpload] = useState({ category: "admissions", institution: "", department: "", notes: "", file: null });
    const [apiSettings, setApiSettings] = useState({ groqApiKey: "", openRouteServiceKey: "" });
    const [documents, setDocuments] = useState([]);
    const [users, setUsers] = useState([]);
    const [documentSearch, setDocumentSearch] = useState("");
    const [userSearch, setUserSearch] = useState("");
    const [activeSection, setActiveSection] = useState("files");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const isAdmin = ["admin", "super_admin"].includes(user?.role);
    const isPanelRoute = location.pathname === "/admin/panel";

    useEffect(() => {
        getAdminStatus()
            .then((response) => setAdminStatus(response.data))
            .catch((statusError) => setError(statusError.message));
    }, []);

    const refreshDocuments = async () => {
        const response = await listAdminDocuments({ search: documentSearch });
        setDocuments(response.data || []);
    };

    const refreshUsers = async () => {
        const response = await listAdminUsers({ search: userSearch });
        setUsers(response.data || []);
    };

    useEffect(() => {
        if (isAdmin && isPanelRoute) {
            refreshDocuments().catch((loadError) => setError(loadError.message));
            refreshUsers().catch((loadError) => setError(loadError.message));
        }
    }, [isAdmin, isPanelRoute]);

    useEffect(() => {
        if (isAdmin && !isPanelRoute) {
            navigate("/admin/panel", { replace: true });
        }
    }, [isAdmin, isPanelRoute, navigate]);

    const submitAdminAuth = async (event) => {
        event.preventDefault();
        setMessage("");
        setError("");

        try {
            const response = adminStatus?.signupOpen
                ? await bootstrapAdmin(form)
                : await loginAdmin({ email: form.email, password: form.password });

            login(response.data, response.metadata?.accessToken);
            setMessage(response.message);
            navigate("/admin/panel", { replace: true });
        } catch (authError) {
            setError(authError.message);
        }
    };

    const submitUpload = async (event) => {
        event.preventDefault();
        setMessage("");
        setError("");

        if (!upload.file) {
            setError("Please choose a document.");
            return;
        }

        try {
            const response = await uploadAdminDocument(upload);
            setMessage(response.message);
            setUpload({ category: "admissions", institution: "", department: "", notes: "", file: null });
            await refreshDocuments();
        } catch (uploadError) {
            setError(uploadError.message);
        }
    };

    const removeDocument = async (documentId) => {
        setMessage("");
        setError("");

        try {
            const response = await deleteAdminDocument(documentId);
            setMessage(response.message);
            await refreshDocuments();
        } catch (deleteError) {
            setError(deleteError.message);
        }
    };

    const removeUser = async (userId) => {
        setMessage("");
        setError("");

        try {
            const response = await deleteAdminUser(userId);
            setMessage(response.message);
            await refreshUsers();
        } catch (deleteError) {
            setError(deleteError.message);
        }
    };

    if (isPanelRoute && !isAdmin) {
        return (
            <main className="admin-page">
                <section className="admin-auth-panel">
                    <p className="admin-eyebrow">Admin panel</p>
                    <h1>Admin sign in required</h1>
                    <p>Please sign in with an admin account before opening the control panel.</p>
                    <button className="admin-panel-primary" type="button" onClick={() => navigate("/admin")}>
                        Go to admin login
                    </button>
                </section>
            </main>
        );
    }

    const saveApiSettings = async (event) => {
        event.preventDefault();
        setMessage("");
        setError("");

        try {
            const response = await saveProviderApiKeys(apiSettings);
            setMessage(response.message);
        } catch (settingsError) {
            setError(settingsError.message);
        }
    };

    return (
        <main className="admin-page">
            <section className="admin-auth-panel">
                <div>
                    <p className="admin-eyebrow">Admin access</p>
                    <h1>{isAdmin ? "EduMate Admin Console" : "Admin sign in"}</h1>
                    <p>
                        {adminStatus?.signupOpen
                            ? "No admin exists yet. Create the first super admin account."
                            : "Sign in as admin to manage documents, API setup, and knowledge data."}
                    </p>
                </div>

                {!isAdmin ? (
                    <form className="admin-form" onSubmit={submitAdminAuth}>
                        {adminStatus?.signupOpen ? (
                            <>
                                <input placeholder="Full name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
                                <input placeholder="Institution" value={form.institution} onChange={(event) => setForm({ ...form, institution: event.target.value })} />
                            </>
                        ) : null}
                        <input placeholder="Admin email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                        <input placeholder="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                        <button type="submit">
                            <Lock size={16} />
                            {adminStatus?.signupOpen ? "Create super admin" : "Sign in to admin"}
                        </button>
                    </form>
                ) : (
                    <div className="admin-panel">
                        <aside className="admin-sidebar">
                            <button className={activeSection === "files" ? "active" : ""} type="button" onClick={() => setActiveSection("files")}>
                                <FileText size={16} /> File manager
                            </button>
                            <button className={activeSection === "users" ? "active" : ""} type="button" onClick={() => setActiveSection("users")}>
                                <Users size={16} /> Users
                            </button>
                            <button className={activeSection === "api" ? "active" : ""} type="button" onClick={() => setActiveSection("api")}>
                                <KeyRound size={16} /> API keys
                            </button>
                            <button className={activeSection === "data" ? "active" : ""} type="button" onClick={() => setActiveSection("data")}>
                                <Database size={16} /> Data tools
                            </button>
                        </aside>

                        <div className="admin-panel-content">
                            {activeSection === "files" ? (
                                <div className="admin-section-grid">
                                    <form className="admin-card" onSubmit={submitUpload}>
                                        <UploadCloud size={22} />
                                        <h2>Upload knowledge document</h2>
                                        <select value={upload.category} onChange={(event) => setUpload({ ...upload, category: event.target.value })}>
                                            <option value="admissions">Admissions</option>
                                            <option value="fees">Fees</option>
                                            <option value="hostel">Hostel</option>
                                            <option value="transport">Transport</option>
                                            <option value="notices">Notices</option>
                                            <option value="others">Others</option>
                                        </select>
                                        <input placeholder="Institution" value={upload.institution} onChange={(event) => setUpload({ ...upload, institution: event.target.value })} />
                                        <input placeholder="Department" value={upload.department} onChange={(event) => setUpload({ ...upload, department: event.target.value })} />
                                        <input type="file" onChange={(event) => setUpload({ ...upload, file: event.target.files?.[0] || null })} />
                                        <textarea placeholder="Notes" value={upload.notes} onChange={(event) => setUpload({ ...upload, notes: event.target.value })} />
                                        <button type="submit">Upload file</button>
                                    </form>

                                    <div className="admin-card admin-table-card">
                                        <div className="admin-table-toolbar">
                                            <h2>Files</h2>
                                            <button type="button" onClick={refreshDocuments}><RefreshCcw size={15} /> Refresh</button>
                                        </div>
                                        <input placeholder="Search files" value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && refreshDocuments()} />
                                        <div className="admin-table">
                                            {documents.map((document) => (
                                                <div className="admin-table-row" key={document._id}>
                                                    <div>
                                                        <strong>{document.originalName}</strong>
                                                        <span>{document.category} · {document.embeddingStatus}</span>
                                                    </div>
                                                    <button type="button" onClick={() => removeDocument(document._id)}><Trash2 size={15} /></button>
                                                </div>
                                            ))}
                                            {!documents.length ? <p>No files found.</p> : null}
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {activeSection === "users" ? (
                                <div className="admin-card admin-table-card">
                                    <div className="admin-table-toolbar">
                                        <h2>User management</h2>
                                        <button type="button" onClick={refreshUsers}><RefreshCcw size={15} /> Refresh</button>
                                    </div>
                                    <input placeholder="Search users" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && refreshUsers()} />
                                    <div className="admin-table">
                                        {users.map((account) => (
                                            <div className="admin-table-row" key={account.id}>
                                                <div>
                                                    <strong>{account.fullName}</strong>
                                                    <span>{account.email} · {account.role}</span>
                                                </div>
                                                <button type="button" onClick={() => removeUser(account.id)}><Trash2 size={15} /></button>
                                            </div>
                                        ))}
                                        {!users.length ? <p>No users found.</p> : null}
                                    </div>
                                </div>
                            ) : null}

                            {activeSection === "api" ? (
                                <form className="admin-card" onSubmit={saveApiSettings}>
                                    <KeyRound size={22} />
                                    <h2>API key setup</h2>
                                    <input placeholder="Groq API key or comma-separated keys" value={apiSettings.groqApiKey} onChange={(event) => setApiSettings({ ...apiSettings, groqApiKey: event.target.value })} />
                                    <input placeholder="OpenRouteService key" value={apiSettings.openRouteServiceKey} onChange={(event) => setApiSettings({ ...apiSettings, openRouteServiceKey: event.target.value })} />
                                    <button type="submit">Save provider keys</button>
                                    <p>Environment keys still take priority, but saved admin keys are used when `.env` keys are absent.</p>
                                </form>
                            ) : null}

                            {activeSection === "data" ? (
                                <div className="admin-card">
                                    <Database size={22} />
                                    <h2>Data controls</h2>
                                    <p>Use file manager and user management for deletion today. Re-indexing, backups, announcements, courses, fees, and transport data tools can plug into this panel next without changing the admin login flow.</p>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}

                {message ? <p className="admin-message success">{message}</p> : null}
                {error ? <p className="admin-message error">{error}</p> : null}
                {accessToken && !isAdmin ? <p className="admin-message error">This account is signed in but does not have admin permission.</p> : null}
            </section>
        </main>
    );
}

export default Admin;
