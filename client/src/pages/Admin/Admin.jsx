import "./Admin.css";
import "../Login/Login.css";
import "./AdminTheme.css";

import {
    Activity,
    Bell,
    ChevronDown,
    Database,
    Download,
    Eye as PreviewEye,
    Filter,
    FileText,
    Folder,
    GraduationCap,
    Home,
    KeyRound,
    LayoutGrid,
    List,
    LogOut,
    MoreVertical,
    Plus,
    RefreshCcw,
    Search,
    Settings,
    Shield,
    Sun,
    Trash2,
    UploadCloud,
    Users
} from "lucide-react";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";

import { FaEye, FaEyeSlash } from "react-icons/fa";

import useAdminAuth from "../../hooks/useAdminAuth";

import {
    deleteAdminDocument,
    deleteAdminUser,
    getAdminStorageStats,
    loginAdmin,
    listAdminDocuments,
    listAdminUsers,
    saveProviderApiKeys,
    uploadAdminDocument
} from "../../services/adminService";

const DEFAULT_FOLDERS = [
    { label: "Admissions", value: "admissions" },
    { label: "Notices", value: "notices" },
    { label: "Forms", value: "forms" },
    { label: "Previous Years", value: "previous_years" },
    { label: "Documents", value: "documents" },
    { label: "Archives", value: "archives" },
    { label: "Policies", value: "policies" },
    { label: "Reports", value: "reports" }
];

const STORAGE_LIMIT = 10 * 1024 * 1024 * 1024;

const formatBytes = (value) => {
    const size = Number(value || 0);

    if (!size) {
        return "—";
    }

    if (size >= 1024 * 1024 * 1024) {
        return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }

    if (size >= 1024 * 1024) {
        return `${Math.round(size / (1024 * 1024))} MB`;
    }

    if (size >= 1024) {
        return `${Math.round(size / 1024)} KB`;
    }

    return `${size} B`;
};

const formatDate = (value) => {
    if (!value) {
        return "—";
    }

    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(value));
};

const getDocumentUrl = (file) => file.url || file.fileUrl || file.storageUrl || "";

const slugifyFolder = (label) => label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function Admin({ mode = "auto" }) {
    const {
        adminUser,
        loginAdmin: setAdminSession,
        logoutAdmin,
        isAdminAuthenticated
    } = useAdminAuth();
    const initialFolders = (() => {
        try {
            const stored = window?.localStorage?.getItem("edumate-admin-folders");
            if (!stored) return DEFAULT_FOLDERS;
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            return DEFAULT_FOLDERS;
        } catch {
            return DEFAULT_FOLDERS;
        }
    })();

    const initialActive = initialFolders[0]?.value || "admissions";

    const [activeSection, setActiveSection] = useState("files");
    const [activeFolder, setActiveFolder] = useState(initialActive);
    const [folders, setFolders] = useState(initialFolders);
    const [documents, setDocuments] = useState([]);
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState("");
    const [userSearch, setUserSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [viewMode, setViewMode] = useState("list");
    const [busy, setBusy] = useState(false);
    const [savingKeys, setSavingKeys] = useState(false);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const [storageStats, setStorageStats] = useState(null);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState("");
    const [showAdminPassword, setShowAdminPassword] = useState(false);
    const [apiKeys, setApiKeys] = useState({
        groqApiKey: "",
        openRouteServiceKey: ""
    });
    const [upload, setUpload] = useState({
        category: initialActive,
        file: null,
        institution: "",
        department: "",
        notes: ""
    });
    const [isDropActive, setIsDropActive] = useState(false);
    const adminEmailRef = useRef(null);
    const adminPasswordRef = useRef(null);

    const documentCounts = useMemo(() => {
        if (storageStats?.categoryCounts) {
            return folders.reduce((counts, folder) => {
                counts[folder.value] = storageStats.categoryCounts[folder.value]?.count || 0;
                return counts;
            }, {});
        }

        return folders.reduce((counts, folder) => {
            counts[folder.value] = documents.filter((file) => file.category === folder.value).length;
            return counts;
        }, {});
    }, [documents, folders, storageStats]);

    // keep folders persisted whenever they change
    useEffect(() => {
        try {
            window.localStorage.setItem("edumate-admin-folders", JSON.stringify(folders));
        } catch {
            // ignore
        }
    }, [folders]);

    const loadDocuments = useCallback(async () => {
        try {
            setBusy(true);
            setError("");
            const response = await listAdminDocuments({
                search,
                category: activeFolder
            });

            setDocuments(response.data || []);
        } catch (fetchError) {
            setError(fetchError.message || "Unable to load files.");
        } finally {
            setBusy(false);
        }
    }, [search, activeFolder]);

    const loadUsers = useCallback(async () => {
        try {
            setBusy(true);
            setError("");
            const response = await listAdminUsers({
                search: userSearch,
                role: roleFilter
            });

            setUsers(response.data || []);
        } catch (fetchError) {
            setError(fetchError.message || "Unable to load users.");
        } finally {
            setBusy(false);
        }
    }, [userSearch, roleFilter]);

    useEffect(() => {
        // calling loaders from effect is intentional (data fetch)
        if (activeSection === "files") {
            void Promise.resolve().then(() => loadDocuments());
        }

        if (activeSection === "users") {
            void Promise.resolve().then(() => loadUsers());
        }
    }, [activeSection, loadDocuments, loadUsers]);

    const loadStorageStats = useCallback(async () => {
        try {
            const response = await getAdminStorageStats();
            setStorageStats(response.data || null);
        } catch (statsError) {
            setError(statsError.message || "Unable to load storage stats.");
        }
    }, []);

    useEffect(() => {
        // fetching storage stats when auth ready
        if (isAdminAuthenticated) {
            void Promise.resolve().then(() => loadStorageStats());
        }
    }, [isAdminAuthenticated, loadStorageStats]);

    useEffect(() => {
        if (activeSection !== "files") {
            return;
        }

        const timer = window.setTimeout(() => {
            loadDocuments();
        }, 250);

        return () => window.clearTimeout(timer);
    }, [search, activeSection, loadDocuments]);

    useEffect(() => {
        if (activeSection !== "users") {
            return;
        }

        const timer = window.setTimeout(() => {
            loadUsers();
        }, 250);

        return () => window.clearTimeout(timer);
    }, [userSearch, roleFilter, activeSection, loadUsers]);

    const visibleFolderStorage = useMemo(() => {
        return documents.reduce((total, file) => total + Number(file.fileSize || file.size || 0), 0);
    }, [documents]);

    const storageLimit = storageStats?.limitBytes || STORAGE_LIMIT;
    const usedStorage = storageStats?.usedBytes ?? visibleFolderStorage;
    const availableStorage = storageStats?.availableBytes ?? Math.max(storageLimit - usedStorage, 0);
    const documentStorage = storageStats?.documentBytes ?? visibleFolderStorage;
    const userStorage = storageStats?.userBytes || 0;
    const adminStorage = storageStats?.adminBytes || 0;
    const explorerRecordStorage = storageStats?.explorerRecordBytes || 0;
    const usedGB = (usedStorage / (1024 * 1024 * 1024)).toFixed(1);
    const storagePercent = Math.min((usedStorage / storageLimit) * 100, 100);
    const activeFolderLabel = folders.find((folder) => folder.value === activeFolder)?.label || "Admissions";

    const stats = [
        {
            label: "Total Folders",
            value: folders.length,
            note: "All directories",
            tone: "gold",
            Icon: Folder
        },
        {
            label: "Total Files",
            value: storageStats?.documentCount ?? documents.length,
            note: "Across all folders",
            tone: "blue",
            Icon: FileText
        },
        {
            label: "Total Size",
            value: formatBytes(usedStorage),
            note: "Storage used",
            tone: "violet",
            Icon: Database
        },
        {
            label: "Users",
            value: (storageStats?.userCount || 0) + (storageStats?.adminCount || 0) || users.length,
            note: "Active users",
            tone: "rose",
            Icon: Users
        },
        {
            label: "API Usage",
            value: `${Math.max(Math.round(storagePercent), 0)}%`,
            note: "Storage used",
            tone: "cyan",
            Icon: KeyRound
        },
        {
            label: "Last Backup",
            value: "2h ago",
            note: "All systems normal",
            tone: "emerald",
            Icon: Shield
        }
    ];

    function handleUploadFile(file) {
        if (!file) {
            return;
        }

        setUpload((current) => ({
            ...current,
            category: activeFolder,
            file
        }));
    }

    function handleUploadDragOver(event) {
        event.preventDefault();
        setIsDropActive(true);
    }

    function handleUploadDragLeave() {
        setIsDropActive(false);
    }

    function handleUploadDrop(event) {
        event.preventDefault();
        setIsDropActive(false);

        const file = event.dataTransfer.files?.[0];
        handleUploadFile(file);
    }

    async function handleAdminLogin(event) {
        event.preventDefault();

        const email = adminEmailRef.current?.value?.trim();
        const password = adminPasswordRef.current?.value || "";

        if (!email || !password) {
            setAuthError("Enter your admin email and password.");
            return;
        }

        try {
            setAuthLoading(true);
            setAuthError("");

            const response = await loginAdmin({ email, password });

            if (response.data) {
                setAdminSession(response.data, response.metadata?.accessToken);
            }
        } catch (loginError) {
            setAuthError(loginError.message || "Unable to sign in as admin.");
        } finally {
            setAuthLoading(false);
        }
    }

    

    async function refreshSection() {
        await loadStorageStats();

        if (activeSection === "files") {
            await loadDocuments();
            return;
        }

        if (activeSection === "users") {
            await loadUsers();
        }
    }

    async function submitUpload(event) {
        event.preventDefault();

        if (!upload.file) {
            setError("Choose a file first.");
            return;
        }

        try {
            setBusy(true);
            setError("");
            await uploadAdminDocument(upload);
            setNotice("File uploaded successfully.");
            setUpload({
                category: activeFolder,
                file: null,
                institution: "",
                department: "",
                notes: ""
            });
            await loadDocuments();
            await loadStorageStats();
        } catch (uploadError) {
            setError(uploadError.message || "Unable to upload file.");
        } finally {
            setBusy(false);
        }
    }

    async function removeDocument(id) {
        if (!window.confirm("Delete this document?")) {
            return;
        }

        try {
            setBusy(true);
            setError("");
            await deleteAdminDocument(id);
            setNotice("Document deleted.");
            await loadDocuments();
            await loadStorageStats();
        } catch (deleteError) {
            setError(deleteError.message || "Unable to delete document.");
        } finally {
            setBusy(false);
        }
    }

    async function removeUser(id) {
        if (!window.confirm("Delete this user?")) {
            return;
        }

        try {
            setBusy(true);
            setError("");
            await deleteAdminUser(id);
            setNotice("User deleted.");
            await loadUsers();
            await loadStorageStats();
        } catch (deleteError) {
            setError(deleteError.message || "Unable to delete user.");
        } finally {
            setBusy(false);
        }
    }

    async function saveKeys(event) {
        event.preventDefault();

        try {
            setSavingKeys(true);
            setError("");
            await saveProviderApiKeys(apiKeys);
            setNotice("API keys saved.");
        } catch (saveError) {
            setError(saveError.message || "Unable to save keys.");
        } finally {
            setSavingKeys(false);
        }
    }

    function handleOpenDocument(file) {
        const url = getDocumentUrl(file);

        if (!url) {
            setError("This document does not have a downloadable URL.");
            return;
        }

        window.open(url, "_blank", "noopener,noreferrer");
    }

    function handleDownload(file) {
        const url = getDocumentUrl(file);

        if (!url) {
            setError("This document does not have a downloadable URL.");
            return;
        }

        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.originalName || "document";
        anchor.rel = "noreferrer";
        anchor.click();
    }

    function handleCreateFolder() {
        const folderName = window.prompt("New folder name");

        if (!folderName) {
            return;
        }

        const value = slugifyFolder(folderName);

        if (!value) {
            setError("Folder name is required.");
            return;
        }

        const exists = folders.some((folder) => folder.value === value);

        if (exists) {
            setActiveFolder(value);
            setUpload((current) => ({ ...current, category: value }));
            setNotice("Folder already exists.");
            return;
        }

        const nextFolders = [...folders, { label: folderName.trim(), value }];
        setFolders(nextFolders);
        window.localStorage.setItem("edumate-admin-folders", JSON.stringify(nextFolders));
        setActiveFolder(value);
        setUpload((current) => ({ ...current, category: value }));
        setNotice(`Folder ${folderName.trim()} created.`);
    }

    function handleReset() {
        setSearch("");
        setUserSearch("");
        setRoleFilter("");
        setNotice("");
        setError("");
    }

    const shouldShowLogin = mode === "login" || !isAdminAuthenticated;

    if (shouldShowLogin) {
        return (
            <div className="login-page admin-auth-screen">
                <section className="login-card admin-auth-card">
                    <h1>EduMate</h1>

                    <p>Admin access only</p>

                    <form onSubmit={handleAdminLogin}>
                        <input ref={adminEmailRef} type="email" placeholder="Admin email" defaultValue={adminUser?.email || ""} />

                        <div className="login-password-box admin-password-box">
                            <input
                                ref={adminPasswordRef}
                                type={showAdminPassword ? "text" : "password"}
                                placeholder="Password"
                            />

                            <span onClick={() => setShowAdminPassword((current) => !current)}>
                                {showAdminPassword ? <FaEyeSlash /> : <FaEye />}
                            </span>
                        </div>

                        <button type="submit" disabled={authLoading}>
                            {authLoading ? "Signing in..." : "Enter admin panel"}
                        </button>

                        {authError ? <p className="login-message error admin-auth-error">{authError}</p> : null}
                    </form>
                </section>
            </div>
        );
    }

    return (
        <div className="admin-page">
            <aside className="admin-left">
                <div className="admin-brand">
                    <div className="brand-mark">
                        <GraduationCap size={28} />
                        <strong>EduMate</strong>
                    </div>
                    <span>ADMIN CONSOLE</span>
                </div>

                <p className="nav-section-label">Main menu</p>
                <nav className="admin-nav">
                    <button type="button" className={activeSection === "files" ? "active" : ""} onClick={() => setActiveSection("files")}>
                        <Folder />
                        File manager
                    </button>
                    <button type="button" className={activeSection === "users" ? "active" : ""} onClick={() => setActiveSection("users")}>
                        <Users />
                        Users
                    </button>
                    <button type="button" className={activeSection === "keys" ? "active" : ""} onClick={() => setActiveSection("keys")}>
                        <KeyRound />
                        API keys
                    </button>
                    <button type="button" className={activeSection === "tools" ? "active" : ""} onClick={() => setActiveSection("tools")}>
                        <Database />
                        Data tools
                    </button>
                </nav>

                <p className="nav-section-label">System</p>
                <nav className="admin-nav admin-system-nav">
                    <button type="button" onClick={loadStorageStats}>
                        <Activity />
                        Storage Overview
                    </button>
                    <button type="button" onClick={refreshSection}>
                        <List />
                        Activity Logs
                    </button>
                    <button type="button" onClick={() => setActiveSection("keys")}>
                        <Settings />
                        Settings
                    </button>
                </nav>

                <div className="storage-box">
                    <h4>Storage Overview</h4>

                    <div
                        className="storage-circle"
                        style={{
                            background: `conic-gradient(var(--admin-gold) ${storagePercent}%, rgba(255,255,255,.06) 0)`
                        }}
                    >
                        <div className="storage-inner">
                            <h2>{usedGB} GB</h2>
                            <p>of {formatBytes(storageLimit)} used</p>
                        </div>
                    </div>

                    <strong>{storagePercent.toFixed(0)}% Used</strong>

                    <div className="storage-breakdown">
                        <span>
                            <small>Documents / explorer</small>
                            <b>{formatBytes(documentStorage + explorerRecordStorage)}</b>
                        </span>
                        <span>
                            <small>User data</small>
                            <b>{formatBytes(userStorage)}</b>
                        </span>
                        <span>
                            <small>Admin data</small>
                            <b>{formatBytes(adminStorage)}</b>
                        </span>
                        <span>
                            <small>Available</small>
                            <b>{formatBytes(availableStorage)}</b>
                        </span>
                    </div>

                    <button
                        type="button"
                        className="back-site"
                        onClick={() => {
                            logoutAdmin();
                            window.location.assign("/");
                        }}
                    >
                        <LogOut size={16} />
                        Back to site
                    </button>
                </div>
            </aside>

            <main className="admin-main">
                <header className="admin-header">
                    <div>
                        <h1>EduMate Admin Console</h1>
                        <p>Manage documents, API setup, and knowledge data.</p>
                    </div>

                    <div className="admin-topbar">
                        <div className="global-search">
                            <Search size={17} />
                            <input placeholder="Search anything..." value={search} onChange={(event) => setSearch(event.target.value)} />
                            <Search size={17} />
                        </div>
                        <button type="button" className="utility-button" aria-label="Theme settings">
                            <Sun size={18} />
                        </button>
                        <button type="button" className="utility-button notification-button" aria-label="Notifications">
                            <Bell size={18} />
                            <span>3</span>
                        </button>
                        <div className="admin-profile">
                            <div className="profile-avatar">AD</div>
                            <div>
                                <strong>{adminUser?.fullName || "Admin"}</strong>
                                <span>{adminUser?.role === "super_admin" ? "Super Admin" : "Admin"}</span>
                            </div>
                            <ChevronDown size={16} />
                        </div>
                        <button type="button" className="refresh-pill" onClick={refreshSection} disabled={busy || savingKeys}>
                            <RefreshCcw size={16} />
                            Refresh
                        </button>
                    </div>
                </header>

                <div className="admin-banner-row">
                    {stats.map((item) => (
                        <div className={`stat-chip tone-${item.tone}`} key={item.label}>
                            <div className="stat-icon">
                                <item.Icon size={20} />
                            </div>
                            <div className="stat-copy">
                                <span>{item.label}</span>
                                <strong>{item.value}</strong>
                                <small>{item.note}</small>
                            </div>
                        </div>
                    ))}
                </div>

                {activeSection === "files" ? (
                    <div className="explorer">
                        <section className="folder-panel">
                            <div className="panel-title">
                                <h2>Folders</h2>
                                <button type="button" onClick={handleCreateFolder} aria-label="Create folder">
                                    <Plus size={16} />
                                </button>
                            </div>

                            <div className="folder-list">
                                {folders.map((folder) => (
                                    <button
                                        type="button"
                                        className={activeFolder === folder.value ? "folder-item active" : "folder-item"}
                                        key={folder.value}
                                        onClick={() => {
                                            setActiveFolder(folder.value);
                                            setUpload((current) => ({ ...current, category: folder.value }));
                                        }}
                                    >
                                        <Folder />
                                        <span>{folder.label}</span>
                                        <strong>{documentCounts[folder.value] || 0}</strong>
                                    </button>
                                ))}
                            </div>

                            <form className="upload-area" onSubmit={submitUpload}>
                                <label
                                    className={isDropActive ? "upload-dropzone active" : "upload-dropzone"}
                                    onDragOver={handleUploadDragOver}
                                    onDragLeave={handleUploadDragLeave}
                                    onDrop={handleUploadDrop}
                                >
                                    <UploadCloud />
                                    <span>
                                        <strong>Select Files</strong>
                                        <small>{upload.file ? upload.file.name : "PDF, docs, or images"}</small>
                                    </span>
                                    <input
                                        hidden
                                        type="file"
                                        onChange={(event) => handleUploadFile(event.target.files?.[0] || null)}
                                    />
                                </label>

                                <div className="upload-meta-grid">
                                    <input
                                        type="text"
                                        placeholder="Institution"
                                        value={upload.institution}
                                        onChange={(event) => setUpload((current) => ({ ...current, institution: event.target.value }))}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Department"
                                        value={upload.department}
                                        onChange={(event) => setUpload((current) => ({ ...current, department: event.target.value }))}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Notes"
                                        value={upload.notes}
                                        onChange={(event) => setUpload((current) => ({ ...current, notes: event.target.value }))}
                                    />
                                </div>

                                <button type="submit" className="upload-submit" disabled={busy}>
                                    Upload File
                                </button>
                            </form>
                        </section>

                        <section className="file-panel">
                            <div className="toolbar">
                                <div className="path">
                                    <Home size={16} />
                                    <span>Home</span>
                                    <span>›</span>
                                    <span>{activeFolderLabel}</span>
                                </div>

                                <div className="search">
                                    <input
                                        placeholder={`Search in ${activeFolderLabel}...`}
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                    />
                                    <button type="button" className="icon-button" onClick={loadDocuments} aria-label="Search">
                                        <Search size={16} />
                                    </button>
                                </div>

                                <div className="toolbar-icons">
                                    <button
                                        type="button"
                                        className={viewMode === "list" ? "icon-button active" : "icon-button"}
                                        onClick={() => setViewMode("list")}
                                        aria-label="List view"
                                    >
                                        <List size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        className={viewMode === "grid" ? "icon-button active" : "icon-button"}
                                        onClick={() => setViewMode("grid")}
                                        aria-label="Grid view"
                                    >
                                        <LayoutGrid size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        className={viewMode === "compact" ? "icon-button active" : "icon-button"}
                                        onClick={() => setViewMode("compact")}
                                        aria-label="Compact view"
                                    >
                                        <Filter size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className={`table ${viewMode}-mode`}>
                                {viewMode !== "grid" ? (
                                    <div className="table-head">
                                        <span>Name</span>
                                        <span>Type</span>
                                        <span>Size</span>
                                        <span>Modified</span>
                                        <span>Actions</span>
                                    </div>
                                ) : null}

                                <div className="file-rows">
                                    {documents.map((file) => (
                                        <article className="file-row" key={file._id}>
                                            <button type="button" className="row-main" onClick={() => setSelectedDocument(file)}>
                                                <FileText className="pdf" />
                                                <div>
                                                    <strong>{file.originalName}</strong>
                                                    <span>in {file.category}</span>
                                                </div>
                                            </button>
                                            <span>{String(file.mimeType || "PDF").includes("pdf") ? "PDF" : "File"}</span>
                                            <span>{formatBytes(file.fileSize || file.size)}</span>
                                            <span>{formatDate(file.updatedAt || file.createdAt)}</span>
                                            <span className="actions">
                                                <button type="button" className="icon-button" onClick={() => handleOpenDocument(file)} aria-label="Preview file">
                                                    <PreviewEye size={16} />
                                                </button>
                                                <button type="button" className="icon-button" onClick={() => handleDownload(file)} aria-label="Download file">
                                                    <Download size={16} />
                                                </button>
                                                <button type="button" className="icon-button" onClick={() => removeDocument(file._id)} aria-label="Delete file">
                                                    <MoreVertical size={16} />
                                                </button>
                                            </span>
                                        </article>
                                    ))}
                                </div>
                            </div>

                            <div className="table-footer">
                                <span>Showing 1 to {documents.length} of {documents.length} files</span>
                                <button type="button" onClick={handleReset}>
                                    Reset filters
                                </button>
                                <span>Total size: {formatBytes(visibleFolderStorage)}</span>
                            </div>
                        </section>
                    </div>
                ) : null}

                {activeSection === "users" ? (
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
                ) : null}

                {activeSection === "keys" ? (
                    <section className="admin-panel-card">
                        <div className="panel-header-row">
                            <div>
                                <h2>API keys</h2>
                                <p>Store Groq and OpenRouteService credentials for the server.</p>
                            </div>
                        </div>

                        <form className="keys-form" onSubmit={saveKeys}>
                            <label>
                                <span>Groq API key(s)</span>
                                <textarea
                                    rows="4"
                                    value={apiKeys.groqApiKey}
                                    onChange={(event) => setApiKeys((current) => ({ ...current, groqApiKey: event.target.value }))}
                                    placeholder="Comma-separated keys"
                                />
                            </label>
                            <label>
                                <span>OpenRouteService API key</span>
                                <input
                                    type="text"
                                    value={apiKeys.openRouteServiceKey}
                                    onChange={(event) =>
                                        setApiKeys((current) => ({ ...current, openRouteServiceKey: event.target.value }))
                                    }
                                    placeholder="Paste API key"
                                />
                            </label>

                            <button type="submit" className="primary-action" disabled={savingKeys}>
                                {savingKeys ? "Saving..." : "Save keys"}
                            </button>
                        </form>
                    </section>
                ) : null}

                {activeSection === "tools" ? (
                    <section className="admin-panel-card">
                        <div className="panel-header-row">
                            <div>
                                <h2>Data tools</h2>
                                <p>Operational shortcuts for the knowledge base.</p>
                            </div>
                        </div>

                        <div className="tool-card-grid">
                            <button type="button" className="tool-card" onClick={() => setActiveSection("files")}>
                                <FileText />
                                <strong>Open file manager</strong>
                                <span>Browse, upload, preview, and delete documents.</span>
                            </button>
                            <button type="button" className="tool-card" onClick={() => setActiveSection("users")}>
                                <Users />
                                <strong>Open user manager</strong>
                                <span>Inspect accounts and remove inactive users.</span>
                            </button>
                            <button type="button" className="tool-card" onClick={() => setActiveSection("keys")}>
                                <KeyRound />
                                <strong>Configure keys</strong>
                                <span>Update provider credentials without leaving the panel.</span>
                            </button>
                        </div>
                    </section>
                ) : null}

                <div className="admin-banner-row">
                    {notice ? <div className="status-pill success">{notice}</div> : null}
                    {error ? <div className="status-pill error">{error}</div> : null}
                </div>
            </main>

            {selectedDocument ? (
                <div className="preview-modal" role="dialog" aria-modal="true" onClick={() => setSelectedDocument(null)}>
                    <div className="preview-card" onClick={(event) => event.stopPropagation()}>
                        <div className="preview-head">
                            <strong>{selectedDocument.originalName}</strong>
                            <button type="button" onClick={() => setSelectedDocument(null)}>
                                ×
                            </button>
                        </div>
                        <p>Category: {selectedDocument.category}</p>
                        <p>Size: {formatBytes(selectedDocument.fileSize || selectedDocument.size)}</p>
                        <p>Modified: {formatDate(selectedDocument.updatedAt || selectedDocument.createdAt)}</p>
                        <div className="preview-actions">
                            <button type="button" className="primary-action" onClick={() => handleOpenDocument(selectedDocument)}>
                                <PreviewEye size={16} />
                                Preview
                            </button>
                            <button type="button" className="secondary-action" onClick={() => handleDownload(selectedDocument)}>
                                <Download size={16} />
                                Download
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default Admin;
