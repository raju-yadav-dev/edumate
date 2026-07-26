import "./Admin.css";
import "./Login/AdminLogin.css";
import "./AdminTheme.css";

import { AlertTriangle, Database, FileText, Folder, Shield, UserRoundCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";

import useAdminAuth from "../hooks/useAdminAuth";
import {
    deleteAdminDocument,
    deleteAdminUser,
    getAdminStorageStats,
    loginAdmin,
    listAdminDocuments,
    listAdminUsers,
    rebuildAdminDocumentEmbeddings,
    replaceAdminDocument,
    saveProviderApiKeys,
    uploadAdminDocument,
    renameAdminDocument,
    moveAdminDocument
} from "../services/adminService";

import DashboardStats from "./components/dashboard/DashboardStats";
import DocumentManager from "./components/fileManager/DocumentManager";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import ApiKeys from "./components/settings/ApiKeys";
import StorageOverview from "./components/storage/StorageOverview";
import DataTools from "./components/tools/DataTools";
import UserManagement from "./components/users/UserManagement";
import { getDocumentUrl } from "./utils/documentUtils";
import { formatBytes } from "./utils/formatBytes";
import slugifyFolder from "./utils/slugify";

const DEFAULT_FOLDERS = [
    { label: "Admissions", value: "admissions" },
    { label: "Academics", value: "academics" },
    { label: "Hostel", value: "hostel" },
    { label: "Fees", value: "fees" },
    { label: "Placements", value: "placements" },
    { label: "Faculty", value: "faculty" },
    { label: "Scholarships", value: "scholarships" },
    { label: "Transport", value: "transport" },
    { label: "Policies", value: "policies" },
    { label: "Notices", value: "notices" }
];

const MB = 1024 * 1024;

const DEMO_STORAGE_STATS = {
    mongodb: {
        used: 8.12 * 1024 * 1024 * 1024,
        total: 25 * 1024 * 1024 * 1024,
        usage: 34,
        remaining: 16.88 * 1024 * 1024 * 1024,
        collections: 12,
        documents: 12540,
        indexesSize: 0.42 * 1024 * 1024 * 1024
    },
    supabase: {
        used: 15.36 * 1024 * 1024 * 1024,
        quota: 25 * 1024 * 1024 * 1024,
        usage: 66,
        remaining: 9.64 * 1024 * 1024 * 1024,
        files: 126,
        averageFileSize: 124.7 * MB,
        largestFile: { size: 28.4 * MB }
    },
    combined: {
        used: 23.48 * 1024 * 1024 * 1024,
        total: 50 * 1024 * 1024 * 1024,
        usage: 46.96
    },
    knowledgeBase: {
        totalDocuments: 12540,
        totalPages: 342,
        totalChunks: 12540,
        failedDocuments: 0
    },
    userCount: 18,
    adminCount: 0,
    qdrant: {
        connected: true,
        status: "green",
        vectors: 12540,
        collection: "edumate"
    },
    systemStatus: { groq: "online", qdrant: "online" }
};

const DEMO_DOCUMENTS = [
    ["admission_procedure.pdf", "PDF", 2.45 * MB, "17 Jul 2025, 10:30 AM"],
    ["admission_requirements.docx", "DOCX", 1.12 * MB, "17 Jul 2025, 09:15 AM"],
    ["important_dates.md", "MD", 85 * 1024, "16 Jul 2025, 04:20 PM"],
    ["fee_structure.csv", "CSV", 45 * 1024, "16 Jul 2025, 02:10 PM"],
    ["notes.txt", "TXT", 12 * 1024, "15 Jul 2025, 11:05 AM"],
    ["brochure.pdf", "PDF", 5.78 * MB, "14 Jul 2025, 03:45 PM"]
].map(([name, type, size, date], index) => ({
    _id: `demo-document-${index + 1}`,
    title: name,
    originalName: name,
    fileType: type,
    fileSize: size,
    category: "admissions",
    createdAt: date,
    updatedAt: date,
    status: index === 5 ? "processing" : "indexed",
    createdBy: { fullName: "Raju Admin" }
}));

function Admin({ mode = "auto" }) {
    const { adminUser, loginAdmin: setAdminSession, logoutAdmin, isAdminAuthenticated } = useAdminAuth();

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
    const [documents, setDocuments] = useState(DEMO_DOCUMENTS);
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState({
        department: "",
        institution: "",
        version: "",
        processingStatus: ""
    });
    const [userSearch, setUserSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [busy, setBusy] = useState(false);
    const [savingKeys, setSavingKeys] = useState(false);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const [storageStats, setStorageStats] = useState(DEMO_STORAGE_STATS);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [contextMenu, setContextMenu] = useState(null);
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState("");
    const [showAdminPassword, setShowAdminPassword] = useState(false);
    const [isAdminDrawerOpen, setIsAdminDrawerOpen] = useState(false);
    const [apiKeys, setApiKeys] = useState({
        groqApiKey: "",
        openRouteServiceKey: ""
    });
    const [adminTheme, setAdminTheme] = useState("dark");
    const [upload, setUpload] = useState({
        title: "",
        category: initialActive,
        file: null,
        institution: "",
        department: "",
        version: "1",
        notes: ""
    });
    const [isDropActive, setIsDropActive] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(null);
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

    useEffect(() => {
        try {
            window.localStorage.setItem("edumate-admin-folders", JSON.stringify(folders));
        } catch {
            // ignore persistence failures
        }
    }, [folders]);

    const handleAuthError = useCallback((fetchError) => {
        console.error("API error encountered:", fetchError);
        if (fetchError.status === 401 || fetchError.status === 403) {
            logoutAdmin();
            setError("Session expired or unauthorized. Please log in again.");
        } else {
            setError(fetchError.message || "An error occurred while connecting to the server.");
        }
    }, [logoutAdmin]);

    const loadDocuments = useCallback(async () => {
        try {
            setBusy(true);
            setError("");
            const response = await listAdminDocuments({
                search,
                category: activeFolder,
                ...filters
            });

            setDocuments(response.data || []);
        } catch (fetchError) {
            console.error("Failed to load documents:", fetchError);
            handleAuthError(fetchError);
            setDocuments(activeFolder === "admissions" ? DEMO_DOCUMENTS : []);
        } finally {
            setBusy(false);
        }
    }, [search, activeFolder, filters, handleAuthError]);

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
            console.error("Failed to load users:", fetchError);
            handleAuthError(fetchError);
        } finally {
            setBusy(false);
        }
    }, [userSearch, roleFilter, handleAuthError]);

    const loadStorageStats = useCallback(async () => {
        try {
            const response = await getAdminStorageStats();
            setStorageStats(response.data || null);
        } catch (statsError) {
            console.error("Failed to load storage stats:", statsError);
            handleAuthError(statsError);
            setStorageStats(DEMO_STORAGE_STATS);
        }
    }, [handleAuthError]);

    const handleShowStorageOverview = useCallback(() => {
        setActiveSection("files");
        void loadStorageStats();
        setTimeout(() => {
            const element = document.querySelector(".storage-section");
            if (element) {
                element.scrollIntoView({ behavior: "smooth" });
            }
        }, 100);
    }, [loadStorageStats]);

    useEffect(() => {
        if (activeSection === "files") {
            void Promise.resolve().then(() => loadDocuments());
        }

        if (activeSection === "users") {
            void Promise.resolve().then(() => loadUsers());
        }
    }, [activeSection, loadDocuments, loadUsers]);

    useEffect(() => {
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

    const mongoStats = storageStats?.mongodb || {};
    const supabaseStats = storageStats?.supabase || {};
    const combinedStats = storageStats?.combined || {};
    const knowledgeStats = storageStats?.knowledgeBase || {};
    const systemStatus = storageStats?.systemStatus || {};
    const storageLimit = Number(combinedStats.total || 0);
    const usedStorage = Number(combinedStats.used || 0);
    const storagePercent = Number(combinedStats.usage || 0);
    const activeFolderLabel = folders.find((folder) => folder.value === activeFolder)?.label || "Admissions";

    const stats = [
        {
            label: "Documents",
            value: knowledgeStats.totalDocuments ?? documents.length,
            note: "Total files",
            tone: "gold",
            Icon: Folder
        },
        {
            label: "Pages",
            value: knowledgeStats.totalPages ?? 0,
            note: "Indexed pages",
            tone: "blue",
            Icon: FileText
        },
        {
            label: "Chunks",
            value: knowledgeStats.totalChunks ?? 0,
            note: "Qdrant vectors",
            tone: "violet",
            Icon: Database
        },
        {
            label: "Users",
            value: (storageStats?.userCount || 0) + (storageStats?.adminCount || 0) || users.length,
            note: "Active users",
            tone: "rose",
            Icon: UserRoundCheck
        },
        {
            label: "API Status",
            value: systemStatus.groq === "offline" || systemStatus.qdrant === "offline" ? "Issue" : "Healthy",
            note: "All systems",
            tone: "emerald",
            Icon: Shield
        },
        {
            label: "Failed Jobs",
            value: knowledgeStats.failedDocuments ?? 0,
            note: "In queue",
            tone: "danger",
            Icon: AlertTriangle
        }
    ];

    function handleUploadFile(file) {
        if (!file) {
            return;
        }

        if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
            setError("Only PDF files can be uploaded.");
            return;
        }

        if (file.size > 50 * MB) {
            setError("PDF uploads are limited to 50 MB.");
            return;
        }

        setUpload((current) => ({
            ...current,
            category: activeFolder,
            title: current.title || file.name.replace(/\.pdf$/i, ""),
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
            setUploadProgress(0);
            await uploadAdminDocument(upload, (percent) => {
                setUploadProgress(percent);
            });
            setNotice("File uploaded successfully.");
            setUpload({
                title: "",
                category: activeFolder,
                file: null,
                institution: "",
                department: "",
                version: "1",
                notes: ""
            });
            await loadDocuments();
            await loadStorageStats();
        } catch (uploadError) {
            setError(uploadError.message || "Unable to upload file.");
        } finally {
            setBusy(false);
            setUploadProgress(null);
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

    async function replaceDocument(id, file) {
        if (!id || !file) {
            return;
        }

        try {
            setBusy(true);
            setError("");
            await replaceAdminDocument(id, {
                ...upload,
                file
            });
            setNotice("Document replaced.");
            await loadDocuments();
            await loadStorageStats();
        } catch (replaceError) {
            setError(replaceError.message || "Unable to replace document.");
        } finally {
            setBusy(false);
        }
    }

    async function renameDocument(id, currentName) {
        const newName = window.prompt("Rename file:", currentName);
        if (!newName || newName.trim() === "" || newName === currentName) {
            return;
        }

        try {
            setBusy(true);
            setError("");
            await renameAdminDocument(id, newName.trim());
            setNotice("Document renamed.");
            await loadDocuments();
            await loadStorageStats();
        } catch (err) {
            setError(err.message || "Unable to rename document.");
        } finally {
            setBusy(false);
        }
    }

    async function moveDocument(id, currentCategory) {
        const folderOptions = folders.map(f => f.label).join(", ");
        const newCategoryLabel = window.prompt(
            `Move to folder (${folderOptions}):`,
            folders.find(f => f.value === currentCategory)?.label || currentCategory
        );
        if (!newCategoryLabel || newCategoryLabel.trim() === "") {
            return;
        }

        const matchedFolder = folders.find(
            f => f.label.toLowerCase() === newCategoryLabel.trim().toLowerCase() ||
                 f.value.toLowerCase() === newCategoryLabel.trim().toLowerCase()
        );
        const newCategory = matchedFolder ? matchedFolder.value : slugifyFolder(newCategoryLabel);

        if (newCategory === currentCategory) {
            return;
        }

        try {
            setBusy(true);
            setError("");
            await moveAdminDocument(id, newCategory);
            setNotice("Document moved.");
            await loadDocuments();
            await loadStorageStats();
        } catch (err) {
            setError(err.message || "Unable to move document.");
        } finally {
            setBusy(false);
        }
    }

    async function rebuildDocument(id) {
        try {
            setBusy(true);
            setError("");
            await rebuildAdminDocumentEmbeddings(id);
            setNotice("Embeddings rebuild requested.");
            await loadDocuments();
            await loadStorageStats();
        } catch (rebuildError) {
            setError(rebuildError.message || "Unable to rebuild embeddings.");
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

    function toggleSelectedDocument(id) {
        setSelectedIds((current) => (
            current.includes(id)
                ? current.filter((item) => item !== id)
                : [...current, id]
        ));
    }

    function openContextMenu(event, file) {
        event.preventDefault();
        setContextMenu({
            file,
            x: event.clientX,
            y: event.clientY
        });
    }

    function closeContextMenu() {
        setContextMenu(null);
    }

    async function bulkDeleteDocuments() {
        if (!selectedIds.length || !window.confirm(`Delete ${selectedIds.length} selected file(s)?`)) {
            return;
        }

        try {
            setBusy(true);
            setError("");
            await Promise.all(selectedIds.map((id) => deleteAdminDocument(id)));
            setSelectedIds([]);
            setNotice("Selected files deleted.");
            await loadDocuments();
            await loadStorageStats();
        } catch (deleteError) {
            setError(deleteError.message || "Unable to delete selected files.");
        } finally {
            setBusy(false);
        }
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
        setFilters({
            department: "",
            institution: "",
            version: "",
            processingStatus: ""
        });
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
        <div className={`admin-page${activeSection === "users" ? " admin-page--users" : ""}`} data-admin-theme={adminTheme}>
            <Sidebar
                activeSection={activeSection}
                setActiveSection={(section) => {
                    setActiveSection(section);
                    setIsAdminDrawerOpen(false);
                }}
                storagePercent={storagePercent}
                usedStorage={usedStorage}
                storageLimit={storageLimit}
                mongoStats={mongoStats}
                supabaseStats={supabaseStats}
                combinedStats={combinedStats}
                loadStorageStats={handleShowStorageOverview}
                refreshSection={refreshSection}
                logoutAdmin={logoutAdmin}
                formatBytes={formatBytes}
                isMobileOpen={isAdminDrawerOpen}
                onCloseMobile={() => setIsAdminDrawerOpen(false)}
            />

            <main className="admin-main">
                <Topbar
                    activeSection={activeSection}
                    activeFolderLabel={activeFolderLabel}
                    adminUser={adminUser}
                    search={search}
                    setSearch={setSearch}
                    refreshSection={refreshSection}
                    busy={busy}
                    savingKeys={savingKeys}
                    onToggleSidebar={() => setIsAdminDrawerOpen(true)}
                    adminTheme={adminTheme}
                    onToggleTheme={() => setAdminTheme((current) => current === "dark" ? "light" : "dark")}
                />

                {activeSection === "files" ? <DashboardStats stats={stats} /> : null}

                {activeSection === "files" ? (
                    <>
                        <StorageOverview
                            stats={storageStats || {}}
                            onRefresh={loadStorageStats}
                        />

                        <DocumentManager
                            folders={folders}
                            activeFolder={activeFolder}
                            activeFolderLabel={activeFolderLabel}
                            documentCounts={documentCounts}
                            documents={documents}
                            visibleFolderStorage={visibleFolderStorage}
                            upload={upload}
                            uploadProgress={uploadProgress}
                            busy={busy}
                            isDropActive={isDropActive}
                            search={search}
                            filters={filters}
                            selectedIds={selectedIds}
                            selectedDocument={selectedDocument}
                            contextMenu={contextMenu}
                            setSearch={setSearch}
                            setFilters={setFilters}
                            setUpload={setUpload}
                            setSelectedDocument={setSelectedDocument}
                            closeContextMenu={closeContextMenu}
                            onSelectFolder={(value) => {
                                setActiveFolder(value);
                                setSelectedIds([]);
                                setUpload((current) => ({ ...current, category: value }));
                            }}
                            onCreateFolder={handleCreateFolder}
                            onDrop={handleUploadDrop}
                            onDragOver={handleUploadDragOver}
                            onDragLeave={handleUploadDragLeave}
                            onFile={handleUploadFile}
                            onSubmit={submitUpload}
                            onRefresh={refreshSection}
                            onReset={handleReset}
                            onToggleSelected={toggleSelectedDocument}
                            onOpenDocument={handleOpenDocument}
                            onDownload={handleDownload}
                            onReplace={replaceDocument}
                            onRename={renameDocument}
                            onMove={moveDocument}
                            onRebuild={rebuildDocument}
                            onDelete={removeDocument}
                            onBulkDelete={bulkDeleteDocuments}
                            onContextMenu={openContextMenu}
                        />
                    </>
                ) : null}

                {activeSection === "users" ? (
                    <UserManagement
                        users={users}
                        userSearch={userSearch}
                        setUserSearch={setUserSearch}
                        roleFilter={roleFilter}
                        setRoleFilter={setRoleFilter}
                        loadUsers={loadUsers}
                        removeUser={removeUser}
                    />
                ) : null}

                {activeSection === "keys" ? (
                    <ApiKeys
                        apiKeys={apiKeys}
                        setApiKeys={setApiKeys}
                        saveKeys={saveKeys}
                        savingKeys={savingKeys}
                    />
                ) : null}

                {activeSection === "tools" ? <DataTools setActiveSection={setActiveSection} /> : null}

                <div className="notification-banner">
                    {notice ? <div className="status-pill success">{notice}</div> : null}
                    {error ? <div className="status-pill error">{error}</div> : null}
                </div>
            </main>
        </div>
    );
}

export default Admin;
