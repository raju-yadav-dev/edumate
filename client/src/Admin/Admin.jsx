import "./Admin.css";
import "./Login/AdminLogin.css";
import "./AdminTheme.css";

import { AlertTriangle, Database, FileText, Folder, Shield, UserRoundCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";

import useAdminAuth from "../hooks/useAdminAuth";
import useAuth from "../hooks/useAuth";
import { getApiRootUrl } from "../services/apiConfig";
import { getAdminAccessToken } from "../services/adminSession";
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
    moveAdminDocument,
    copyAdminDocument,
    bulkMoveAdminDocuments,
    bulkCopyAdminDocuments,
    bulkDeleteAdminDocuments,
    bulkReindexAdminDocuments,
    getJobsStatus,
    retryFailedDocuments,
    ignoreFailedDocument,
    restoreAdminDocument,
    permanentDeleteAdminDocument,
    duplicateAdminDocument
} from "../services/adminService";

import DashboardStats from "./components/dashboard/DashboardStats";
import DocumentManager from "./components/fileManager/DocumentManager";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import ApiKeys from "./components/apikeys/ApiKeys";
import StorageOverview from "./components/storage/StorageOverview";
import StorageOverviewSummary from "./components/storage/StorageOverviewSummary";
import DataTools from "./components/datatools/DataTools";
import ActivityLogs from "./components/activity/ActivityLogs";
import UserManagement from "./components/users/UserManagement";
import SettingsPage from "./components/settings/SettingsPage";
import CrawlerManager from "../crawler/CrawlerManager";
import KnowledgeSources from "./components/knowledge/KnowledgeSources";
import ChunkingStudio from "./components/chunking/ChunkingStudio";
import LlmBenchmarkDashboard from "./components/benchmark/LlmBenchmarkDashboard";
import KnowledgeAnalyticsDashboard from "./components/analytics/KnowledgeAnalyticsDashboard";
import SmartCacheDashboard from "./components/cache/SmartCacheDashboard";
import SecurityDashboard from "./components/security/SecurityDashboard";
import DeveloperMode from "./components/developer/DeveloperMode";
import { getDocumentUrl } from "./utils/documentUtils";
import { recordActivityLog } from "../services/activityLogService";
import { formatBytes } from "./utils/formatBytes";
import slugifyFolder from "./utils/slugify";

const DEFAULT_FOLDERS = [
    { label: "Crawled", value: "crawled" },
    { label: "Admissions", value: "admissions" },
    { label: "Academics", value: "academics" },
    { label: "Hostel", value: "hostel" },
    { label: "Fees", value: "fees" },
    { label: "Placements", value: "placements" },
    { label: "Faculty", value: "faculty" },
    { label: "Scholarships", value: "scholarships" },
    { label: "Transport", value: "transport" },
    { label: "Policies", value: "policies" },
    { label: "Notices", value: "notices" },
    { label: "Campus Navigation", value: "campus_navigation" },
    { label: "Building 1", value: "campus_navigation_building_1", parent: "campus_navigation" },
    { label: "Building 2", value: "campus_navigation_building_2", parent: "campus_navigation" },
    { label: "Building 3", value: "campus_navigation_building_3", parent: "campus_navigation" },
    { label: "Building 4", value: "campus_navigation_building_4", parent: "campus_navigation" },
    { label: "Building 5", value: "campus_navigation_building_5", parent: "campus_navigation" },
    { label: "Building 6", value: "campus_navigation_building_6", parent: "campus_navigation" },
    { label: "Building 7", value: "campus_navigation_building_7", parent: "campus_navigation" },
    { label: "Building 8", value: "campus_navigation_building_8", parent: "campus_navigation" },
    { label: "Building 9", value: "campus_navigation_building_9", parent: "campus_navigation" }
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

function getActiveLoggedInUsers(adminUser, authUser) {
    const list = [];
    const addIfValid = (u, defaultRole = "user") => {
        if (!u || typeof u !== "object") return;
        const email = u.email || u.userEmail || "";
        const name = u.fullName || u.name || u.username || u.displayName || (email ? email.split("@")[0] : "Logged-in User");
        const id = u._id || u.id || u.userId || (email ? `user-${email}` : "session-user");

        if (!list.some((item) => (email && item.email.toLowerCase() === email.toLowerCase()) || item._id === id)) {
            list.push({
                _id: id,
                fullName: name,
                email: email || "admin@edumate.edu",
                role: u.role || defaultRole,
                department: u.department || u.departmentName || u.dept || "Administration",
                status: u.status || "active",
                lastLogin: u.lastLogin || u.lastActiveAt || new Date().toISOString(),
                createdAt: u.createdAt || u.joinedAt || new Date().toISOString()
            });
        }
    };

    addIfValid(adminUser, "super_admin");
    addIfValid(authUser, "student");

    try {
        const storedAdmin = localStorage.getItem("edumate-admin-user");
        if (storedAdmin) addIfValid(JSON.parse(storedAdmin), "super_admin");
    } catch { }

    try {
        const storedUser = localStorage.getItem("edumate-user");
        if (storedUser) addIfValid(JSON.parse(storedUser), "student");
    } catch { }

    try {
        const genericUser = localStorage.getItem("user");
        if (genericUser) addIfValid(JSON.parse(genericUser), "user");
    } catch { }

    return list;
}

function formatFolderLabel(value) {
    if (!value) return "";
    return value
        .split(/[_-]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function breakFolderCycles(list) {
    if (!Array.isArray(list)) return [];
    const adj = {};
    list.forEach(f => {
        if (f && f.value) {
            adj[f.value] = f.parent || null;
        }
    });

    return list.map(f => {
        if (!f) return f;
        let current = f.value;
        const visited = new Set();
        while (current) {
            if (visited.has(current)) {
                return { ...f, parent: null };
            }
            visited.add(current);
            current = adj[current] || null;
        }
        return f;
    });
}

function sanitizeFolders(list) {
    if (!Array.isArray(list)) return [];
    const sanitized = list.map(f => {
        if (!f || typeof f !== "object") return null;
        return {
            label: String(f.label || "").trim(),
            value: String(f.value || "").trim(),
            parent: (f.parent && typeof f.parent === "string") ? f.parent : null
        };
    }).filter(Boolean);

    return breakFolderCycles(sanitized);
}

function getDescendantFolders(foldersList, parentVal) {
    const visited = new Set();
    const recurse = (val) => {
        if (visited.has(val)) return [];
        visited.add(val);
        let desc = [val];
        const children = foldersList.filter(f => f.parent === val);
        children.forEach(child => {
            desc = [...desc, ...recurse(child.value)];
        });
        return desc;
    };
    return recurse(parentVal);
}

function Admin({ mode = "auto" }) {
    const { adminUser, loginAdmin: setAdminSession, logoutAdmin, isAdminAuthenticated } = useAdminAuth();
    const { user: authUser } = useAuth();

    const initialFolders = (() => {
        try {
            const stored = window?.localStorage?.getItem("edumate-admin-folders");
            if (!stored) return DEFAULT_FOLDERS;
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const sanitized = sanitizeFolders(parsed);
                DEFAULT_FOLDERS.forEach((def) => {
                    if (!sanitized.some((f) => f.value === def.value)) {
                        sanitized.push(def);
                    }
                });
                return sanitized;
            }
            return DEFAULT_FOLDERS;
        } catch {
            return DEFAULT_FOLDERS;
        }
    })();

    const getQueryParam = (name) => {
        const match = window.location.search.match(new RegExp('[?&]' + name + '=([^&]+)'));
        return match ? decodeURIComponent(match[1]) : null;
    };
    const urlFolder = getQueryParam("folder");
    const initialActive = urlFolder || initialFolders[0]?.value || "admissions";

    const [activeSection, setActiveSection] = useState("files");
    const [activeFolder, setActiveFolder] = useState(initialActive);
    const [folders, setFolders] = useState(initialFolders);
    const [documents, setDocuments] = useState(DEMO_DOCUMENTS);
    const [users, setUsers] = useState(() => getActiveLoggedInUsers(adminUser, authUser));
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
    const [storageStats, setStorageStats] = useState(null);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [clipboard, setClipboard] = useState({ action: null, fileIds: [], folderValues: [], sourceCategory: null });
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
        files: [],
        institution: "",
        department: "",
        version: "1",
        notes: ""
    });
    const [isDropActive, setIsDropActive] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(null);
    const [uploadQueue, setUploadQueue] = useState([]);
    const [activeConflict, setActiveConflict] = useState(null);
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [jobs, setJobs] = useState({ queue: [], running: [], failed: [], completedCount: 0, totalCount: 0 });
    const [deletedFolders, setDeletedFolders] = useState(() => {
        try {
            const saved = window.localStorage.getItem("edumate-admin-deleted-folders");
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem("edumate-admin-deleted-folders", JSON.stringify(deletedFolders));
        } catch {
            // ignore
        }
    }, [deletedFolders]);
    
    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // Reset page when folder changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeFolder]);
    const adminEmailRef = useRef(null);
    const adminPasswordRef = useRef(null);

    const documentCounts = useMemo(() => {
        const directCounts = {};
        folders.forEach(folder => {
            if (storageStats?.categoryCounts) {
                directCounts[folder.value] = storageStats.categoryCounts[folder.value]?.count || 0;
            } else {
                directCounts[folder.value] = documents.filter((file) => file.category === folder.value).length;
            }
        });

        const recursiveCounts = {};
        const visited = new Set();
        const getCount = (val) => {
            if (recursiveCounts[val] !== undefined) return recursiveCounts[val];
            if (visited.has(val)) return 0;
            visited.add(val);

            let sum = directCounts[val] || 0;
            const children = folders.filter(f => f.parent === val);
            children.forEach(child => {
                sum += getCount(child.value);
            });
            visited.delete(val);
            recursiveCounts[val] = sum;
            return sum;
        };

        folders.forEach(folder => {
            getCount(folder.value);
        });

        return recursiveCounts;
    }, [documents, folders, storageStats]);

    const folderIndexStats = useMemo(() => {
        const statsMap = {};
        const visited = new Set();
        const getStats = (val) => {
            if (statsMap[val]) return statsMap[val];
            if (visited.has(val)) {
                return {
                    indexed: 0,
                    failed: 0,
                    pending: 0,
                    total: 0,
                    bytes: 0,
                    totalChunks: 0,
                    totalEmbeddings: 0,
                    lastIndexed: null,
                    status: "empty",
                    failedFiles: []
                };
            }
            visited.add(val);

            const category = storageStats?.categoryCounts?.[val] || {};
            let indexed = Number(category.indexed || 0);
            let failed = Number(category.failed || 0);
            let pending = Number(category.pending || category.processing || 0);
            let total = Number(category.count || 0);
            let bytes = Number(category.bytes || 0);
            let totalChunks = Number(category.totalChunks || 0);
            let totalEmbeddings = Number(category.totalEmbeddings || 0);
            let lastIndexed = category.lastIndexed ? new Date(category.lastIndexed) : null;
            let failedFiles = [];

            if (!storageStats?.categoryCounts) {
                const docs = documents.filter(d => d.category === val && d.status !== "deleted");
                total = docs.length;
                docs.forEach(d => {
                    bytes += Number(d.fileSize || d.size || 0);
                    totalChunks += Number(d.chunkCount || 0);
                    if (d.embeddingStatus === "indexed") {
                        indexed++;
                        totalEmbeddings += Number(d.chunkCount || 0);
                        if (!lastIndexed || new Date(d.updatedAt) > lastIndexed) {
                            lastIndexed = new Date(d.updatedAt);
                        }
                    } else if (d.embeddingStatus === "failed") {
                        failed++;
                        failedFiles.push(d.originalName || d.title);
                    } else if (d.embeddingStatus === "pending" || d.embeddingStatus === "processing") {
                        pending++;
                    }
                });
            } else {
                const docs = documents.filter(d => d.category === val && d.status !== "deleted" && d.embeddingStatus === "failed");
                docs.forEach(d => {
                    failedFiles.push(d.originalName || d.title);
                });
            }

            const children = folders.filter(f => f.parent === val);
            children.forEach(child => {
                const childStats = getStats(child.value);
                indexed += childStats.indexed;
                failed += childStats.failed;
                pending += childStats.pending;
                total += childStats.total;
                bytes += childStats.bytes;
                totalChunks += childStats.totalChunks;
                totalEmbeddings += childStats.totalEmbeddings;
                failedFiles = [...failedFiles, ...(childStats.failedFiles || [])];
                if (childStats.lastIndexed) {
                    if (!lastIndexed || childStats.lastIndexed > lastIndexed) {
                        lastIndexed = childStats.lastIndexed;
                    }
                }
            });

            let status = "empty";
            if (total > 0) {
                if (failed > 0) {
                    status = "failed";
                } else if (pending > 0) {
                    status = "indexing";
                } else {
                    status = "success";
                }
            }

            const result = {
                indexed,
                failed,
                pending,
                total,
                bytes,
                totalChunks,
                totalEmbeddings,
                lastIndexed,
                status,
                failedFiles: Array.from(new Set(failedFiles))
            };
            visited.delete(val);
            statsMap[val] = result;
            return result;
        };

        folders.forEach(f => getStats(f.value));
        return statsMap;
    }, [folders, documents, storageStats]);

    useEffect(() => {
        try {
            window.localStorage.setItem("edumate-admin-folders", JSON.stringify(folders));
        } catch {
            // ignore persistence failures
        }
    }, [folders]);

    useEffect(() => {
        if (notice) {
            const timer = window.setTimeout(() => setNotice(""), 4000);
            return () => window.clearTimeout(timer);
        }
    }, [notice]);

    useEffect(() => {
        if (error) {
            const timer = window.setTimeout(() => setError(""), 5000);
            return () => window.clearTimeout(timer);
        }
    }, [error]);

    useEffect(() => {
        if (storageStats?.categoryCounts) {
            const countsKeys = Object.keys(storageStats.categoryCounts);

            setFolders((currentFolders) => {
                let updated = false;
                const nextFolders = [...currentFolders];

                countsKeys.forEach((key) => {
                    if (key && !deletedFolders.includes(key) && !nextFolders.some((f) => f.value === key)) {
                        const label = formatFolderLabel(key);
                        nextFolders.push({ label, value: key });
                        updated = true;
                    }
                });

                return sanitizeFolders(updated ? nextFolders : currentFolders);
            });
        }
    }, [storageStats, deletedFolders]);

    const handleAuthError = useCallback((fetchError) => {
        console.warn("API operation status:", fetchError);
        if (fetchError?.status === 401 || fetchError?.status === 403) {
            logoutAdmin();
            setError("Session expired or unauthorized. Please log in again.");
            return;
        }

        const msg = String(fetchError?.message || "").toLowerCase();
        if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed")) {
            return;
        }

        setError(fetchError?.message || "An error occurred while connecting to the server.");
    }, [logoutAdmin]);

    const loadDocuments = useCallback(async () => {
        try {
            setBusy(true);
            setError("");
            const response = await listAdminDocuments({
                search,
                category: activeFolder === "root" ? "" : activeFolder,
                page: currentPage,
                limit: pageSize,
                ignoreInstitution: "true",
                ...filters
            });

            const docs = response.data || [];
            setDocuments(docs);
            if (response.pagination) {
                setTotalItems(response.pagination.total || 0);
                setTotalPages(response.pagination.pages || 1);
            } else {
                setTotalItems(docs.length || 0);
                setTotalPages(1);
            }

            // Auto-detect and register missing folders from document categories
            if (docs.length > 0) {
                setFolders((currentFolders) => {
                    let updated = false;
                    const nextFolders = [...currentFolders];
                    docs.forEach(doc => {
                        const cat = doc.category;
                        if (cat && !deletedFolders.includes(cat) && !nextFolders.some(f => f.value === cat)) {
                            const label = formatFolderLabel(cat);
                            nextFolders.push({ label, value: cat });
                            updated = true;
                        }
                    });
                    return updated ? sanitizeFolders(nextFolders) : currentFolders;
                });
            }
        } catch (fetchError) {
            console.error("Failed to load documents:", fetchError);
            setError(fetchError?.message || "Unable to load documents.");
            handleAuthError(fetchError);
            setDocuments(activeFolder === "admissions" ? DEMO_DOCUMENTS : []);
            setTotalItems(activeFolder === "admissions" ? DEMO_DOCUMENTS.length : 0);
            setTotalPages(1);
        } finally {
            setBusy(false);
        }
    }, [search, activeFolder, filters, currentPage, pageSize, handleAuthError]);

    const loadUsers = useCallback(async () => {
        try {
            setBusy(true);
            setError("");
            const response = await listAdminUsers({
                search: userSearch,
                role: roleFilter
            });

            const fetchedUsers = Array.isArray(response.data) ? response.data : [];
            const loggedInUsers = getActiveLoggedInUsers(adminUser, authUser);

            const combined = [...fetchedUsers];
            loggedInUsers.forEach((lUser) => {
                if (!combined.some((u) => u._id === lUser._id || (u.email && lUser.email && u.email.toLowerCase() === lUser.email.toLowerCase()))) {
                    combined.unshift(lUser);
                }
            });

            setUsers(combined);
        } catch (fetchError) {
            console.error("Failed to load users:", fetchError);
            handleAuthError(fetchError);
            const loggedInUsers = getActiveLoggedInUsers(adminUser, authUser);
            setUsers(loggedInUsers);
        } finally {
            setBusy(false);
        }
    }, [userSearch, roleFilter, adminUser, authUser, handleAuthError]);

    const loadStorageStats = useCallback(async (force = false) => {
        try {
            const response = await getAdminStorageStats(force);
            setStorageStats(response.data || null);
        } catch (statsError) {
            console.error("Failed to load storage stats:", statsError);
            handleAuthError(statsError);
            setStorageStats(null);
        }
    }, [handleAuthError]);

    const loadJobs = useCallback(async () => {
        try {
            const response = await getJobsStatus();
            if (response && response.data) {
                setJobs(response.data);
            }
        } catch (e) {
            console.error("Failed to load background jobs:", e);
        }
    }, []);

    useEffect(() => {
        if (isAdminAuthenticated && activeSection === "files") {
            loadJobs();
            const interval = setInterval(loadJobs, 8000);
            return () => clearInterval(interval);
        }
    }, [isAdminAuthenticated, activeSection, loadJobs]);

    const handleShowStorageOverview = useCallback(() => {
        setActiveSection("storage");
        void loadStorageStats();
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

    useEffect(() => {
        document.body.classList.add("admin-theme-active");
        return () => {
            document.body.classList.remove("admin-theme-active");
        };
    }, []);

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
    const activeFolderLabel = folders.find((folder) => folder.value === activeFolder)?.label || (activeFolder === "root" || activeFolder === "" ? "Root" : "Admissions");

    const stats = [
        {
            label: "Documents",
            value: knowledgeStats.totalDocuments !== undefined && knowledgeStats.totalDocuments !== null ? knowledgeStats.totalDocuments : (documents.length || "-"),
            note: "Total files",
            tone: "gold",
            Icon: Folder
        },
        {
            label: "Pages",
            value: knowledgeStats.totalPages !== undefined && knowledgeStats.totalPages !== null ? knowledgeStats.totalPages : "-",
            note: "Indexed pages",
            tone: "blue",
            Icon: FileText
        },
        {
            label: "Chunks",
            value: knowledgeStats.totalChunks !== undefined && knowledgeStats.totalChunks !== null ? knowledgeStats.totalChunks : "-",
            note: "Qdrant vectors",
            tone: "violet",
            Icon: Database
        },
        {
            label: "Users",
            value: storageStats?.userCount !== undefined || storageStats?.adminCount !== undefined 
                ? (Number(storageStats?.userCount || 0) + Number(storageStats?.adminCount || 0)) 
                : (users.length || "-"),
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
            value: knowledgeStats.failedDocuments !== undefined && knowledgeStats.failedDocuments !== null ? knowledgeStats.failedDocuments : "-",
            note: "In queue",
            tone: "danger",
            Icon: AlertTriangle
        }
    ];

    async function getFilesFromEntryRecursive(entry, currentPath = "") {
        let results = [];
        if (entry.isFile) {
            const file = await new Promise((resolve) => entry.file(resolve));
            file.relativePath = currentPath ? `${currentPath}/${file.name}` : file.name;
            results.push(file);
        } else if (entry.isDirectory) {
            const dirReader = entry.createReader();
            const entries = await new Promise((resolve) => {
                const allEntries = [];
                const readAll = () => {
                    dirReader.readEntries((results) => {
                        if (results.length === 0) {
                            resolve(allEntries);
                        } else {
                            allEntries.push(...results);
                            readAll();
                        }
                    }, () => resolve(allEntries));
                };
                readAll();
            });

            for (const ent of entries) {
                const subFiles = await getFilesFromEntryRecursive(ent, currentPath ? `${currentPath}/${entry.name}` : entry.name);
                results.push(...subFiles);
            }
        }
        return results;
    }

    function createNestedFolders(folderParts, startParent = activeFolder) {
        let currentParent = startParent === "root" ? "" : startParent;
        let updatedFolders = [...folders];

        for (const part of folderParts) {
            const slug = slugifyFolder(part);
            if (!slug) continue;

            const value = currentParent ? `${currentParent}_${slug}` : slug;
            const exists = updatedFolders.find(f => f.value === value);

            if (!exists) {
                const newFolder = {
                    label: part.trim(),
                    value,
                    parent: currentParent
                };
                updatedFolders.push(newFolder);
            }
            currentParent = value;
        }

        const sanitized = sanitizeFolders(updatedFolders);
        setFolders(sanitized);
        window.localStorage.setItem("edumate-admin-folders", JSON.stringify(sanitized));
        return currentParent;
    }

    const enqueueFiles = useCallback((filesList) => {
        if (!filesList || filesList.length === 0) return;

        const allowedExtensions = [
            ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
            ".csv", ".txt", ".md", ".markdown", ".json", ".xml",
            ".png", ".jpg", ".jpeg", ".webp", ".gif", ".zip"
        ];

        const validFiles = [];
        const invalidNames = [];

        for (const file of filesList) {
            const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
            if (!allowedExtensions.includes(ext)) {
                invalidNames.push(file.name);
                continue;
            }
            if (file.size > 100 * MB) {
                setError(`File ${file.name} exceeds the 100 MB limit.`);
                return;
            }
            validFiles.push(file);
        }

        if (invalidNames.length > 0) {
            setError(`Unsupported formats for: ${invalidNames.join(", ")}`);
        }

        if (validFiles.length > 0) {
            setUploadQueue(currQueue => {
                const newQueueItems = [];
                for (const file of validFiles) {
                    const isDuplicate = currQueue.some(item => 
                        item.name === file.name && 
                        item.size === file.size &&
                        (item.status === "queued" || item.status === "uploading" || item.status === "paused" || item.status === "conflict")
                    );
                    if (isDuplicate) continue;

                    const pathParts = file.relativePath ? file.relativePath.split("/").slice(0, -1) : [];
                    const itemCategory = pathParts.length > 0 ? createNestedFolders(pathParts) : activeFolder;

                    newQueueItems.push({
                        id: `${Date.now()}-${crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9)}-${file.name}`,
                        file,
                        name: file.name,
                        relativePath: file.relativePath || file.name,
                        category: itemCategory,
                        size: file.size,
                        progress: 0,
                        status: "queued",
                        error: "",
                        institution: upload.institution || "",
                        department: upload.department || "",
                        version: upload.version || "1",
                        notes: upload.notes || ""
                    });
                }

                if (newQueueItems.length > 0) {
                    setTimeout(() => setNotice(`Added ${newQueueItems.length} file(s) to the upload queue.`), 50);
                    return [...currQueue, ...newQueueItems];
                }
                return currQueue;
            });
        }
    }, [folders, activeFolder, upload]);

    async function handleUploadFiles(selectedFiles) {
        enqueueFiles(selectedFiles);
    }

    const handleUploadDragOver = useCallback((event) => {
        event.preventDefault();
        setIsDropActive(true);
    }, []);

    const handleUploadDragLeave = useCallback(() => {
        setIsDropActive(false);
    }, []);

    async function handleUploadDrop(event) {
        event.preventDefault();
        setIsDropActive(false);

        const items = event.dataTransfer.items;
        let files = [];
        if (items) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (typeof item.webkitGetAsEntry === "function") {
                    const entry = item.webkitGetAsEntry();
                    if (entry) {
                        const entryFiles = await getFilesFromEntryRecursive(entry);
                        files = [...files, ...entryFiles];
                    }
                } else {
                    const file = item.getAsFile();
                    if (file) files.push(file);
                }
            }
        } else {
            files = Array.from(event.dataTransfer.files || []);
        }

        enqueueFiles(files);
    }

    async function submitUpload(event) {
        event.preventDefault();
        const filesToEnqueue = upload.files && upload.files.length > 0 ? upload.files : (upload.file ? [upload.file] : []);
        if (filesToEnqueue.length === 0) {
            setError("No files selected.");
            return;
        }

        enqueueFiles(filesToEnqueue);
        
        setUpload({
            title: "",
            category: activeFolder,
            file: null,
            files: [],
            institution: "",
            department: "",
            version: "1",
            notes: ""
        });
    }

    // Parallel Background Upload Queue processing logic
    useEffect(() => {
        const MAX_CONCURRENT = 3;
        const uploadingCount = uploadQueue.filter(item => item.status === "uploading").length;
        if (uploadingCount >= MAX_CONCURRENT) return;

        const nextItem = uploadQueue.find(item => item.status === "queued");
        if (!nextItem) return;

        const itemId = nextItem.id;
        
        setUploadQueue(curr => curr.map(item => item.id === itemId ? { ...item, status: "uploading" } : item));

        let xhrRef = null;
        const uploadPayload = {
            file: nextItem.file,
            title: nextItem.file.name.substring(0, nextItem.file.name.lastIndexOf(".")),
            category: nextItem.category,
            institution: nextItem.institution || "",
            department: nextItem.department || "",
            version: nextItem.version || "1",
            notes: nextItem.notes || ""
        };

        uploadAdminDocument(
            uploadPayload,
            (progress) => {
                setUploadQueue(curr => curr.map(item => item.id === itemId && item.status === "uploading" ? { ...item, progress } : item));
            },
            (xhr) => {
                xhrRef = xhr;
                setUploadQueue(curr => curr.map(item => item.id === itemId ? { ...item, xhr } : item));
            }
        ).then(() => {
            setUploadQueue(curr => curr.map(item => item.id === itemId ? { ...item, status: "completed", progress: 100, xhr: null } : item));
            void loadDocuments();
            void loadStorageStats();
        }).catch((err) => {
            const wasAborted = xhrRef && xhrRef.status === 0;
            if (wasAborted) {
                console.log(`Upload for item ${itemId} was aborted.`);
            } else if (err.status === 409 && err.duplicateDocument) {
                setUploadQueue(curr => curr.map(item => item.id === itemId ? { ...item, status: "conflict", error: err.message, xhr: null } : item));
                setActiveConflict({
                    itemId,
                    file: nextItem.file,
                    duplicateDocument: err.duplicateDocument,
                    category: nextItem.category
                });
            } else {
                setUploadQueue(curr => curr.map(item => item.id === itemId ? { ...item, status: "failed", error: err.message || "Upload failed", xhr: null } : item));
            }
        });
    }, [uploadQueue, loadDocuments, loadStorageStats]);

    // Polling background indexing jobs
    useEffect(() => {
        let intervalId = null;

        const pollJobs = async () => {
            try {
                const response = await getJobsStatus();
                if (response && response.data) {
                    setJobs(response.data);
                    const activeJobsCount = (response.data.queue?.length || 0) + (response.data.running?.length || 0);
                    if (activeJobsCount > 0) {
                        void loadDocuments();
                    }
                }
            } catch (err) {
                console.error("Jobs polling error:", err);
            }
        };

        if (activeSection === "files") {
            pollJobs();
            intervalId = setInterval(pollJobs, 4000);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [activeSection, loadDocuments]);

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

    async function deleteBatch(fileIds, folderValues, skipConfirm = false) {
        if (fileIds.length === 0 && folderValues.length === 0) return;

        const totalItemsCount = fileIds.length + folderValues.length;
        if (!skipConfirm && !window.confirm(`Are you sure you want to delete ${totalItemsCount} selected item(s)?`)) {
            return;
        }

        try {
            setBusy(true);
            setError("");

            const oldFoldersSnapshot = [...folders];
            const mutableFolders = [...folders];
            const allFileIdsToDelete = [...fileIds];

            for (const fVal of folderValues) {
                const descendants = getDescendantFolders(folders, fVal);
                const allFoldersToDelete = [fVal, ...descendants];

                for (const cat of allFoldersToDelete) {
                    const response = await listAdminDocuments({ category: cat, limit: 1000, ignoreInstitution: "true" });
                    if (response && response.data && response.data.length > 0) {
                        allFileIdsToDelete.push(...response.data.map(d => d._id));
                    }
                }

                allFoldersToDelete.forEach(val => {
                    const idx = mutableFolders.findIndex(f => f.value === val);
                    if (idx !== -1) mutableFolders.splice(idx, 1);
                });
            }

            if (allFileIdsToDelete.length > 0) {
                await bulkDeleteAdminDocuments(allFileIdsToDelete);
            }

            const sanitized = sanitizeFolders(mutableFolders);
            setFolders(sanitized);
            window.localStorage.setItem("edumate-admin-folders", JSON.stringify(sanitized));

            pushToUndo({
                type: "delete",
                fileIds: allFileIdsToDelete,
                folderValues,
                oldFolders: oldFoldersSnapshot,
                newFolders: sanitized,
                label: `Delete ${totalItemsCount} item(s)`
            });

            setSelectedIds([]);
            setSelectedDocument(null);
            setNotice("Deleted items successfully.");
            await loadDocuments();
            await loadStorageStats();
        } catch (err) {
            setError(err.message || "Failed to delete items.");
        } finally {
            setBusy(false);
        }
    }

    async function removeDocument(id) {
        if (id.startsWith("folder:")) {
            await deleteBatch([], [id.replace("folder:", "")]);
        } else {
            await deleteBatch([id], []);
        }
    }

    async function handleDuplicateDocument(documentId) {
        try {
            setBusy(true);
            setError("");
            await duplicateAdminDocument(documentId);
            setNotice("Document duplicated successfully.");
            await loadDocuments();
        } catch (err) {
            setError(err.message || "Failed to duplicate document.");
        } finally {
            setBusy(false);
        }
    }

    async function handleReindexFolder(folderValue) {
        try {
            setBusy(true);
            setError("");
            await bulkReindexAdminDocuments({ category: folderValue });
            setNotice(`Re-indexing folder "${folderValue}" initiated.`);
            await loadDocuments();
        } catch (err) {
            setError(err.message || "Failed to reindex folder.");
        } finally {
            setBusy(false);
        }
    }

    async function handleReindexRoot() {
        try {
            setBusy(true);
            setError("");
            await bulkReindexAdminDocuments({ category: "root" });
            setNotice("Re-indexing entire Root initiated.");
            await loadDocuments();
        } catch (err) {
            setError(err.message || "Failed to reindex root.");
        } finally {
            setBusy(false);
        }
    }

    async function handleReindexFailedJobs() {
        try {
            setBusy(true);
            setError("");
            await retryFailedDocuments();
            setNotice("Re-indexing failed jobs initiated.");
            await loadDocuments();
        } catch (err) {
            setError(err.message || "Failed to retry indexing failed jobs.");
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

    async function renameDocument(id, currentName, newNameInput = null) {
        const newName = newNameInput !== null ? newNameInput : window.prompt("Rename file:", currentName);
        if (!newName || newName.trim() === "" || newName === currentName) {
            return;
        }

        try {
            setBusy(true);
            setError("");
            await renameAdminDocument(id, newName.trim());
            pushToUndo({ type: "rename", fileId: id, oldName: currentName, newName: newName.trim(), label: `Rename file to "${newName.trim()}"` });
            setNotice("Document renamed.");
            await loadDocuments();
            await loadStorageStats();
        } catch (err) {
            setError(err.message || "Unable to rename document.");
        } finally {
            setBusy(false);
        }
    }

    async function moveDocument(id, currentCategory, newCategoryVal = null) {
        let newCategory = newCategoryVal;
        if (newCategory === null) {
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
            newCategory = matchedFolder ? matchedFolder.value : slugifyFolder(newCategoryLabel);
        }

        if (newCategory === currentCategory) {
            return;
        }

        try {
            setBusy(true);
            setError("");
            await moveAdminDocument(id, newCategory);
            pushToUndo({ type: "move", fileIds: [id], oldCategory: currentCategory, newCategory: newCategory, label: `Move file` });
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

    async function removeUser(id, skipConfirm = false) {
        if (!skipConfirm && !window.confirm("Delete this user?")) {
            return;
        }

        try {
            setBusy(true);
            setError("");
            await deleteAdminUser(id).catch((err) => {
                console.warn("Backend user delete endpoint unavailable:", err);
            });
            setUsers((current) => current.filter((u) => u._id !== id && u.id !== id));
            setNotice("User deleted.");
            await loadStorageStats().catch(() => { });
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

    async function handleDownload(file) {
        const url = getDocumentUrl(file);

        if (!url) {
            setError("This document does not have a downloadable URL.");
            return;
        }

        try {
            setBusy(true);
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch file content.");
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);

            const anchor = document.createElement("a");
            anchor.href = blobUrl;
            anchor.download = file.originalName || "document.pdf";
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);

            // Clean up the object URL
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error("Blob download failed, using fallback navigation:", err);
            window.open(url, "_blank", "noopener,noreferrer");
        } finally {
            setBusy(false);
        }
    }

    function toggleSelectedDocument(id) {
        setSelectedIds((current) => (
            current.includes(id)
                ? current.filter((item) => item !== id)
                : [...current, id]
        ));
    }

    function openContextMenu(event, item, isFolder = false) {
        event.preventDefault();
        setContextMenu({
            file: !isFolder ? item : null,
            folder: isFolder ? item : null,
            x: event.clientX,
            y: event.clientY
        });
    }

    function closeContextMenu() {
        setContextMenu(null);
    }

    async function bulkDeleteDocuments(skipConfirm = false) {
        if (!selectedIds.length || (!skipConfirm && !window.confirm(`Delete ${selectedIds.length} selected file(s)?`))) {
            return;
        }

        try {
            setBusy(true);
            setError("");
            await bulkDeleteAdminDocuments(selectedIds);
            pushToUndo({ type: "delete", fileIds: [...selectedIds], label: `Delete ${selectedIds.length} document(s)` });
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

    function handleCreateFolder(parentVal = null, folderNameInput = null) {
        const parentString = typeof parentVal === "string" ? parentVal : null;
        const targetParent = parentString !== null ? parentString : (activeFolder && activeFolder !== "root" ? activeFolder : null);
        const parentFolder = folders.find(f => f.value === targetParent);
        
        let folderName = folderNameInput;
        if (folderName === null) {
            folderName = window.prompt(
                parentFolder
                    ? `New subfolder name inside "${parentFolder.label}"`
                    : "New root folder name"
            );
        }

        if (!folderName) {
            return;
        }

        const slug = slugifyFolder(folderName);

        if (!slug) {
            setError("Folder name is required.");
            return;
        }

        const value = targetParent ? `${targetParent}_${slug}` : slug;
        
        // Remove from deleted blocklist if re-creating
        setDeletedFolders((prev) => prev.filter((v) => v !== value));

        const exists = folders.some((folder) => folder.value === value);

        if (exists) {
            setActiveFolder(value);
            setUpload((current) => ({ ...current, category: value }));
            setNotice("Folder already exists.");
            return;
        }

        const nextFolders = sanitizeFolders([...folders, { label: folderName.trim(), value, parent: targetParent }]);
        setFolders(nextFolders);
        window.localStorage.setItem("edumate-admin-folders", JSON.stringify(nextFolders));
        setActiveFolder(value);
        setUpload((current) => ({ ...current, category: value }));
        setNotice(`Folder ${folderName.trim()} created.`);
    }

    async function handleRenameFolder(folderValue, newName) {
        const folder = folders.find((f) => f.value === folderValue);
        if (!folder) return;

        let name = newName;
        if (!name) {
            name = window.prompt("Rename folder to:", folder.label);
        }
        if (!name || name.trim() === "" || name.trim() === folder.label) return;

        const nextFolders = sanitizeFolders(folders.map((f) => {
            if (f.value === folderValue) {
                return { ...f, label: name.trim() };
            }
            return f;
        }));

        setFolders(nextFolders);
        window.localStorage.setItem("edumate-admin-folders", JSON.stringify(nextFolders));
        pushToUndo({ type: "renameFolder", folderValue, oldLabel: folder.label, newLabel: name.trim(), label: `Rename folder to "${name.trim()}"` });
        setNotice(`Folder renamed to ${name.trim()}.`);
    }

    async function handleDeleteFolder(folderValue, skipConfirm = false) {
        const folder = folders.find((f) => f.value === folderValue);
        if (!folder) return;

        const descendantFolderValues = getDescendantFolders(folders, folderValue);

        let filesToMove = [];
        try {
            setBusy(true);
            for (const cat of descendantFolderValues) {
                const response = await listAdminDocuments({ category: cat, limit: 1000, ignoreInstitution: "true" });
                if (response && response.data) {
                    filesToMove = [...filesToMove, ...response.data];
                }
            }
        } catch (err) {
            console.error("Failed to check documents in folder structure:", err);
        } finally {
            setBusy(false);
        }

        let confirmMsg = `Delete folder "${folder.label}"?`;
        if (filesToMove.length > 0) {
            confirmMsg += ` This will move all ${filesToMove.length} file(s) inside this folder and its subfolders to Admissions.`;
        }

        if (!skipConfirm && !window.confirm(confirmMsg)) {
            return;
        }

        try {
            setBusy(true);
            setError("");
            const defaultFolder = folders.find((f) => !descendantFolderValues.includes(f.value))?.value || "admissions";

            if (filesToMove.length > 0) {
                const fileIds = filesToMove.map(d => d._id);
                await bulkMoveAdminDocuments(fileIds, defaultFolder);
            }

            // Register deleted folder values in deletedFolders blocklist so auto-sync never restores them
            setDeletedFolders((prev) => Array.from(new Set([...prev, ...descendantFolderValues])));

            const nextFolders = sanitizeFolders(folders.filter((f) => !descendantFolderValues.includes(f.value)));
            setFolders(nextFolders);
            window.localStorage.setItem("edumate-admin-folders", JSON.stringify(nextFolders));

            if (descendantFolderValues.includes(activeFolder)) {
                setActiveFolder(defaultFolder);
                setUpload((current) => ({ ...current, category: defaultFolder }));
            }

            setNotice(`Folder "${folder.label}" and its subfolders deleted.`);
            await loadDocuments();
            await loadStorageStats();
        } catch (err) {
            setError(err.message || "Failed to delete folder.");
        } finally {
            setBusy(false);
        }
    }

    async function handleMoveFolder(folderValue, targetParentValueInput = undefined) {
        const folder = folders.find((f) => f.value === folderValue);
        if (!folder) return;

        const descendantValues = getDescendantFolders(folders, folderValue);
        const eligibleParents = folders.filter(f => !descendantValues.includes(f.value));

        let targetParentValue = undefined;

        if (targetParentValueInput !== undefined) {
            targetParentValue = targetParentValueInput;
        } else {
            const parentOptionsStr = ["Root", ...eligibleParents.map(f => f.label)].join(", ");
            const targetParentLabel = window.prompt(
                `Move folder "${folder.label}" to parent (${parentOptionsStr}):`,
                folder.parent ? (folders.find(f => f.value === folder.parent)?.label || "Root") : "Root"
            );

            if (targetParentLabel === null) return;

            targetParentValue = null;
            if (targetParentLabel.trim().toLowerCase() !== "root") {
                const matchedParent = eligibleParents.find(
                    f => f.label.toLowerCase() === targetParentLabel.trim().toLowerCase() ||
                        f.value.toLowerCase() === targetParentLabel.trim().toLowerCase()
                );
                if (!matchedParent) {
                    setError("Invalid parent folder selected.");
                    return;
                }
                targetParentValue = matchedParent.value;
            }
        }

        if (targetParentValue === folder.parent) {
            return;
        }

        try {
            setBusy(true);
            setError("");

            const categoryRenames = {};

            const updateSubtree = (currentValue, newParentVal) => {
                const f = folders.find(item => item.value === currentValue);
                if (!f) return;

                const slug = currentValue.split("_").pop();
                const newCurrentValue = newParentVal ? `${newParentVal}_${slug}` : slug;

                categoryRenames[currentValue] = newCurrentValue;

                const children = folders.filter(item => item.parent === currentValue);
                children.forEach(child => {
                    updateSubtree(child.value, newCurrentValue);
                });
            };

            updateSubtree(folderValue, targetParentValue);

            for (const [oldCat, newCat] of Object.entries(categoryRenames)) {
                if (oldCat === newCat) continue;
                const response = await listAdminDocuments({ category: oldCat, limit: 1000, ignoreInstitution: "true" });
                if (response && response.data && response.data.length > 0) {
                    await bulkMoveAdminDocuments(response.data.map(d => d._id), newCat);
                }
            }

            const nextFolders = folders.map(f => {
                if (categoryRenames[f.value] !== undefined) {
                    const newValue = categoryRenames[f.value];
                    const newParent = f.value === folderValue ? targetParentValue : categoryRenames[f.parent];
                    return {
                        ...f,
                        value: newValue,
                        parent: newParent
                    };
                }
                return f;
            });

            const sanitized = sanitizeFolders(nextFolders);
            setFolders(sanitized);
            window.localStorage.setItem("edumate-admin-folders", JSON.stringify(sanitized));

            if (categoryRenames[activeFolder] !== undefined) {
                setActiveFolder(categoryRenames[activeFolder]);
                setUpload(current => ({ ...current, category: categoryRenames[activeFolder] }));
            }

            pushToUndo({
                type: "moveFolder",
                folderValue,
                oldParent: folder.parent,
                newParent: targetParentValue,
                categoryRenames,
                label: `Move folder "${folder.label}"`
            });

            setNotice(`Folder "${folder.label}" moved successfully.`);
            await loadDocuments();
            await loadStorageStats();
        } catch (err) {
            setError(err.message || "Failed to move folder.");
        } finally {
            setBusy(false);
        }
    }

    async function moveFolderDirect(folderValue, targetParentValue) {
        const folder = folders.find((f) => f.value === folderValue);
        if (!folder) return;

        const descendantValues = getDescendantFolders(folders, folderValue);
        if (descendantValues.includes(targetParentValue)) {
            setError("Cannot move a folder into itself or its subfolders.");
            return;
        }

        try {
            setBusy(true);
            setError("");

            const categoryRenames = {};

            const updateSubtree = (currentValue, newParentVal) => {
                const f = folders.find(item => item.value === currentValue);
                if (!f) return;

                const slug = currentValue.split("_").pop();
                const newCurrentValue = newParentVal ? `${newParentVal}_${slug}` : slug;

                categoryRenames[currentValue] = newCurrentValue;

                const children = folders.filter(item => item.parent === currentValue);
                children.forEach(child => {
                    updateSubtree(child.value, newCurrentValue);
                });
            };

            updateSubtree(folderValue, targetParentValue);

            for (const [oldCat, newCat] of Object.entries(categoryRenames)) {
                if (oldCat === newCat) continue;
                const response = await listAdminDocuments({ category: oldCat, limit: 1000, ignoreInstitution: "true" });
                if (response && response.data && response.data.length > 0) {
                    await bulkMoveAdminDocuments(response.data.map(d => d._id), newCat);
                }
            }

            const nextFolders = folders.map(f => {
                if (categoryRenames[f.value] !== undefined) {
                    const newValue = categoryRenames[f.value];
                    const newParent = f.value === folderValue ? targetParentValue : categoryRenames[f.parent];
                    return {
                        ...f,
                        value: newValue,
                        parent: newParent
                    };
                }
                return f;
            });

            const sanitized = sanitizeFolders(nextFolders);
            setFolders(sanitized);
            window.localStorage.setItem("edumate-admin-folders", JSON.stringify(sanitized));

            if (categoryRenames[activeFolder] !== undefined) {
                setActiveFolder(categoryRenames[activeFolder]);
                setUpload(current => ({ ...current, category: categoryRenames[activeFolder] }));
            }

            pushToUndo({
                type: "moveFolder",
                folderValue,
                oldParent: folder.parent,
                newParent: targetParentValue,
                categoryRenames,
                label: `Move folder "${folder.label}"`
            });

            setNotice(`Folder "${folder.label}" moved successfully.`);
            await loadDocuments();
            await loadStorageStats();
        } catch (err) {
            setError(err.message || "Failed to move folder.");
        } finally {
            setBusy(false);
        }
    }

    async function copyFolderRecursiveLocal(oldFolderValue, newParentValue, mutableFolders) {
        const oldFolder = folders.find(f => f.value === oldFolderValue);
        if (!oldFolder) return;

        const slug = slugifyFolder(oldFolder.label);
        const value = newParentValue && newParentValue !== "root" ? `${newParentValue}_${slug}` : slug;
        
        const newFolderObj = { label: oldFolder.label.trim(), value, parent: newParentValue === "root" ? "" : newParentValue };
        mutableFolders.push(newFolderObj);

        const response = await listAdminDocuments({ category: oldFolderValue, limit: 1000, ignoreInstitution: "true" });
        if (response && response.data && response.data.length > 0) {
            const fileIds = response.data.map(d => d._id);
            await bulkCopyAdminDocuments(fileIds, value);
        }

        const children = folders.filter(f => f.parent === oldFolderValue);
        for (const child of children) {
            await copyFolderRecursiveLocal(child.value, value, mutableFolders);
        }
    }

    function handleCopy(singleId = null) {
        const ids = singleId ? [singleId] : selectedIds;
        if (ids.length === 0) return;

        const fileIds = ids.filter(id => !id.startsWith("folder:"));
        const folderValues = ids.filter(id => id.startsWith("folder:")).map(id => id.replace("folder:", ""));

        setClipboard({
            action: "copy",
            fileIds,
            folderValues,
            sourceCategory: activeFolder
        });
        setNotice(`Copied selection to clipboard.`);
    }

    function handleCut(singleId = null) {
        const ids = singleId ? [singleId] : selectedIds;
        if (ids.length === 0) return;

        const fileIds = ids.filter(id => !id.startsWith("folder:"));
        const folderValues = ids.filter(id => id.startsWith("folder:")).map(id => id.replace("folder:", ""));

        setClipboard({
            action: "cut",
            fileIds,
            folderValues,
            sourceCategory: activeFolder
        });
        setNotice(`Cut selection to clipboard.`);
    }

    async function handlePaste(targetCategory = activeFolder) {
        const pasteCategory = targetCategory === "root" ? "root" : targetCategory;
        if (!clipboard.action || (clipboard.fileIds.length === 0 && clipboard.folderValues.length === 0)) {
            return;
        }

        try {
            setBusy(true);
            setError("");

            const oldFoldersSnapshot = [...folders];
            const mutableFolders = [...folders];

            if (clipboard.folderValues.length > 0) {
                for (const fVal of clipboard.folderValues) {
                    if (clipboard.action === "copy") {
                        await copyFolderRecursiveLocal(fVal, pasteCategory, mutableFolders);
                    } else if (clipboard.action === "cut") {
                        const descendants = getDescendantFolders(folders, fVal);
                        if (descendants.includes(pasteCategory)) {
                            throw new Error("Cannot move a folder into itself or its subfolders.");
                        }

                        const categoryRenames = {};
                        const updateSubtreeLocal = (currValue, newParentVal) => {
                            const f = mutableFolders.find(item => item.value === currValue);
                            if (!f) return;
                            const slug = currValue.split("_").pop();
                            const newCurrentValue = newParentVal && newParentVal !== "root" ? `${newParentVal}_${slug}` : slug;
                            categoryRenames[currValue] = newCurrentValue;

                            const children = mutableFolders.filter(item => item.parent === currValue);
                            children.forEach(child => {
                                updateSubtreeLocal(child.value, newCurrentValue);
                            });
                        };
                        updateSubtreeLocal(fVal, pasteCategory);

                        for (const [oldCat, newCat] of Object.entries(categoryRenames)) {
                            if (oldCat === newCat) continue;
                            const response = await listAdminDocuments({ category: oldCat, limit: 1000, ignoreInstitution: "true" });
                            if (response && response.data && response.data.length > 0) {
                                await bulkMoveAdminDocuments(response.data.map(d => d._id), newCat);
                            }
                        }

                        mutableFolders.forEach((f, idx) => {
                            if (categoryRenames[f.value] !== undefined) {
                                const parentFolder = folders.find(x => x.value === f.value);
                                const newParent = f.value === fVal ? pasteCategory : categoryRenames[parentFolder.parent];
                                mutableFolders[idx] = {
                                    ...f,
                                    value: categoryRenames[f.value],
                                    parent: newParent === "root" ? "" : newParent
                                };
                            }
                        });
                    }
                }
            }

            if (clipboard.fileIds.length > 0) {
                if (clipboard.action === "copy") {
                    await bulkCopyAdminDocuments(clipboard.fileIds, pasteCategory);
                } else if (clipboard.action === "cut") {
                    await bulkMoveAdminDocuments(clipboard.fileIds, pasteCategory);
                }
            }

            const sanitized = sanitizeFolders(mutableFolders);
            setFolders(sanitized);
            window.localStorage.setItem("edumate-admin-folders", JSON.stringify(sanitized));

            pushToUndo({
                type: clipboard.action === "copy" ? "copy" : "move",
                fileIds: [...clipboard.fileIds],
                folderValues: [...clipboard.folderValues],
                oldCategory: clipboard.sourceCategory,
                newCategory: pasteCategory,
                oldFolders: oldFoldersSnapshot,
                newFolders: sanitized,
                label: `${clipboard.action === "copy" ? "Copy" : "Move"} ${clipboard.fileIds.length + clipboard.folderValues.length} item(s)`
            });

            setNotice("Clipboard items pasted successfully.");
            if (clipboard.action === "cut") {
                setClipboard({ action: null, fileIds: [], folderValues: [], sourceCategory: null });
            }
            setSelectedIds([]);
            setSelectedDocument(null);
            await loadDocuments();
            await loadStorageStats();
        } catch (err) {
            setError(err.message || "Failed to paste clipboard items.");
        } finally {
            setBusy(false);
        }
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

    const pushToUndo = useCallback((action) => {
        setUndoStack((prev) => [...prev, action]);
        setRedoStack([]);
    }, []);

    const handleUndo = useCallback(async () => {
        if (undoStack.length === 0) return;
        const action = undoStack[undoStack.length - 1];
        setUndoStack((prev) => prev.slice(0, -1));
        setRedoStack((prev) => [...prev, action]);

        try {
            setBusy(true);
            setError("");
            if (action.type === "rename") {
                await renameAdminDocument(action.fileId, action.oldName);
                setNotice(`Undone: renamed back to "${action.oldName}"`);
            } else if (action.type === "move") {
                await bulkMoveAdminDocuments(action.fileIds, action.oldCategory);
                setNotice(`Undone: moved back to folder.`);
            } else if (action.type === "delete") {
                if (typeof restoreAdminDocument === "function") {
                    for (const id of action.fileIds) {
                        await restoreAdminDocument(id);
                    }
                    setNotice("Undone: restored deleted file(s).");
                }
            } else if (action.type === "renameFolder") {
                setFolders((prev) => prev.map((f) => f.value === action.folderValue ? { ...f, label: action.oldLabel } : f));
                setNotice(`Undone: renamed folder back to "${action.oldLabel}"`);
            }
            await loadDocuments();
            await loadStorageStats();
        } catch (err) {
            setError(err.message || "Failed to undo action.");
        } finally {
            setBusy(false);
        }
    }, [undoStack, loadDocuments, loadStorageStats]);

    const handleRedo = useCallback(async () => {
        if (redoStack.length === 0) return;
        const action = redoStack[redoStack.length - 1];
        setRedoStack((prev) => prev.slice(0, -1));
        setUndoStack((prev) => [...prev, action]);

        try {
            setBusy(true);
            setError("");
            if (action.type === "rename") {
                await renameAdminDocument(action.fileId, action.newName);
                setNotice(`Redone: renamed to "${action.newName}"`);
            } else if (action.type === "move") {
                await bulkMoveAdminDocuments(action.fileIds, action.newCategory);
                setNotice("Redone: moved file(s).");
            } else if (action.type === "delete") {
                await bulkDeleteAdminDocuments(action.fileIds);
                setNotice("Redone: deleted file(s).");
            } else if (action.type === "renameFolder") {
                setFolders((prev) => prev.map((f) => f.value === action.folderValue ? { ...f, label: action.newLabel } : f));
                setNotice(`Redone: renamed folder to "${action.newLabel}"`);
            }
            await loadDocuments();
            await loadStorageStats();
        } catch (err) {
            setError(err.message || "Failed to redo action.");
        } finally {
            setBusy(false);
        }
    }, [redoStack, loadDocuments, loadStorageStats]);

    const pauseUpload = useCallback((id) => {
        setUploadQueue((current) => current.map((item) => {
            if (item.id === id) {
                if (item.xhr) {
                    item.xhr.abort();
                }
                return { ...item, status: "paused", xhr: null };
            }
            return item;
        }));
    }, []);

    const resumeUpload = useCallback((id) => {
        setUploadQueue((current) => current.map((item) => item.id === id ? { ...item, status: "queued", progress: 0, error: "" } : item));
    }, []);

    const skipUpload = useCallback((id) => {
        setUploadQueue((current) => current.map((item) => {
            if (item.id === id) {
                if (item.xhr) {
                    item.xhr.abort();
                }
                return { ...item, status: "skipped", xhr: null };
            }
            return item;
        }));
    }, []);

    const cancelUpload = useCallback((id) => {
        setUploadQueue((current) => {
            const item = current.find(i => i.id === id);
            if (item && item.xhr) {
                item.xhr.abort();
            }
            return current.filter((i) => i.id !== id);
        });
    }, []);

    const retryUpload = useCallback((id) => {
        setUploadQueue((current) => current.map((item) => item.id === id ? { ...item, status: "queued", progress: 0, error: "" } : item));
    }, []);

    const onRetryFailedUploads = useCallback(() => {
        setUploadQueue((current) => current.map(item => item.status === "failed" ? { ...item, status: "queued", progress: 0, error: "" } : item));
    }, []);

    const onClearCompletedUploads = useCallback(() => {
        setUploadQueue((current) => current.filter(item => item.status !== "completed"));
    }, []);

    const onCancelAllUploads = useCallback(() => {
        setUploadQueue((current) => {
            current.forEach(item => {
                if (item.xhr) item.xhr.abort();
            });
            return [];
        });
    }, []);

    const handleConflictMove = useCallback(async () => {
        if (!activeConflict) return;
        try {
            setBusy(true);
            await moveAdminDocument(activeConflict.duplicateDocument.id, activeConflict.category);
            setUploadQueue(curr => curr.filter(item => item.id !== activeConflict.itemId));
            setNotice("File moved successfully.");
            void loadDocuments();
            void loadStorageStats();
        } catch (e) {
            console.error("Failed to move duplicate file:", e);
            setUploadQueue(curr => curr.map(item => item.id === activeConflict.itemId ? { ...item, status: "failed", error: e.message || "Move failed" } : item));
            setError(e.message || "Failed to move existing file.");
        } finally {
            setBusy(false);
            setActiveConflict(null);
        }
    }, [activeConflict, loadDocuments, loadStorageStats]);

    const handleConflictReplace = useCallback(async () => {
        if (!activeConflict) return;
        const confirmReplace = window.confirm("Are you sure you want to replace the existing file and generate new embeddings?");
        if (!confirmReplace) return;

        try {
            setBusy(true);
            setUploadQueue(curr => curr.map(item => item.id === activeConflict.itemId ? { ...item, status: "uploading", progress: 0 } : item));
            
            const uploadPayload = {
                file: activeConflict.file,
                category: activeConflict.category,
                institution: upload.institution || "",
                department: upload.department || "",
                version: upload.version || "1",
                notes: upload.notes || ""
            };
            
            await replaceAdminDocument(
                activeConflict.duplicateDocument.id,
                uploadPayload
            );

            setUploadQueue(curr => curr.filter(item => item.id !== activeConflict.itemId));
            setNotice("File replaced successfully.");
            void loadDocuments();
            void loadStorageStats();
        } catch (e) {
            console.error("Failed to replace file:", e);
            setUploadQueue(curr => curr.map(item => item.id === activeConflict.itemId ? { ...item, status: "failed", error: e.message || "Replace failed" } : item));
            setError(e.message || "Failed to replace existing file.");
        } finally {
            setBusy(false);
            setActiveConflict(null);
        }
    }, [activeConflict, upload, loadDocuments, loadStorageStats]);

    const handleConflictKeep = useCallback(() => {
        if (!activeConflict) return;
        setUploadQueue(curr => curr.filter(item => item.id !== activeConflict.itemId));
        setActiveConflict(null);
    }, [activeConflict]);

    const handleConflictCancel = useCallback(() => {
        if (!activeConflict) return;
        setUploadQueue(curr => curr.filter(item => item.id !== activeConflict.itemId));
        setActiveConflict(null);
    }, [activeConflict]);

    const handleAdminLogin = useCallback(async (event) => {
        event.preventDefault();
        
        const email = adminEmailRef.current?.value || "";
        const password = adminPasswordRef.current?.value || "";
        
        if (!email.trim() || !password.trim()) {
            setAuthError("Email and password are required.");
            return;
        }

        try {
            setAuthLoading(true);
            setAuthError("");
            const result = await loginAdmin({ email, password });
            
            if (result && result.data && result.metadata?.accessToken) {
                setAdminSession(result.data, result.metadata.accessToken);
            } else {
                throw new Error("Invalid response structure from server.");
            }
        } catch (err) {
            setAuthError(err.message || "Failed to log in. Please try again.");
        } finally {
            setAuthLoading(false);
        }
    }, [setAdminSession]);

    const shouldShowLogin = mode === "login" || !isAdminAuthenticated;

    if (shouldShowLogin) {
        return (
            <div className="login-page admin-auth-screen">
                <section className="login-card admin-auth-card">
                    <div className="admin-auth-header">
                        <h1>EduMate</h1>
                        <p>Admin access only</p>
                    </div>

                    <form onSubmit={handleAdminLogin} className="admin-auth-form">
                        <input ref={adminEmailRef} type="email" placeholder="Admin email" defaultValue={adminUser?.email || ""} />

                        <div className="admin-password-box">
                            <input
                                ref={adminPasswordRef}
                                type={showAdminPassword ? "text" : "password"}
                                placeholder="Password"
                            />
                            <button
                                type="button"
                                className="admin-password-toggle"
                                onClick={() => setShowAdminPassword((current) => !current)}
                                aria-label={showAdminPassword ? "Hide password" : "Show password"}
                                tabIndex={-1}
                            >
                                {showAdminPassword ? <FaEyeSlash /> : <FaEye />}
                            </button>
                        </div>

                        <button type="submit" className="admin-auth-submit-btn" disabled={authLoading}>
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

                {activeSection === "storage" ? (
                    <StorageOverview
                        stats={storageStats || {}}
                        onRefresh={loadStorageStats}
                        documents={documents}
                    />
                ) : null}

                {activeSection === "files" ? <DashboardStats stats={stats} /> : null}

                {activeSection === "files" ? (
                    <>
                        <StorageOverviewSummary
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
                            clipboard={clipboard}
                            onCopy={handleCopy}
                            onCut={handleCut}
                            onPaste={handlePaste}
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
                            onRenameFolder={handleRenameFolder}
                            onDeleteFolder={handleDeleteFolder}
                            onMoveFolder={handleMoveFolder}
                            onMoveFolderDirect={moveFolderDirect}
                            onDrop={handleUploadDrop}
                            onDragOver={handleUploadDragOver}
                            onDragLeave={handleUploadDragLeave}
                            onFile={handleUploadFiles}
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
                            folderIndexStats={folderIndexStats}
                            uploadQueue={uploadQueue}
                            onPauseUpload={pauseUpload}
                            onResumeUpload={resumeUpload}
                            onCancelUpload={cancelUpload}
                            onRetryUpload={retryUpload}
                            onSkipUpload={skipUpload}
                            onRetryFailedUploads={onRetryFailedUploads}
                            onClearCompletedUploads={onClearCompletedUploads}
                            onCancelAllUploads={onCancelAllUploads}
                            onUndo={handleUndo}
                            onRedo={handleRedo}
                            undoStack={undoStack}
                            redoStack={redoStack}
                            onMoveDocuments={bulkMoveAdminDocuments}
                            onCopyDocuments={bulkCopyAdminDocuments}
                            onDeleteDocuments={bulkDeleteAdminDocuments}
                            setSelectedIds={setSelectedIds}
                            setFolders={setFolders}
                            jobs={jobs}
                            currentPage={currentPage}
                            pageSize={pageSize}
                            totalItems={totalItems}
                            totalPages={totalPages}
                            onPageChange={(page) => setCurrentPage(page)}
                            onPageSizeChange={(size) => setPageSize(size)}
                            onDuplicate={handleDuplicateDocument}
                            onReindexFolder={handleReindexFolder}
                            onRetryFailedIndexing={handleReindexFailedJobs}
                        />
                    </>
                ) : null}

                {activeSection === "chunking" ? (
                    <ChunkingStudio
                        documents={documents}
                        onRefresh={refreshSection}
                        setNotice={setNotice}
                        setError={setError}
                    />
                ) : null}

                {activeSection === "benchmark" ? (
                    <LlmBenchmarkDashboard />
                ) : null}

                {activeSection === "analytics" ? (
                    <KnowledgeAnalyticsDashboard />
                ) : null}

                {activeSection === "cache" ? (
                    <SmartCacheDashboard />
                ) : null}

                {activeSection === "security" ? (
                    <SecurityDashboard />
                ) : null}

                {activeSection === "developer" ? (
                    <DeveloperMode />
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

                {activeSection === "tools" ? (
                    <DataTools
                        setActiveSection={setActiveSection}
                        documents={documents}
                        storageStats={storageStats}
                        users={users}
                        onRefresh={refreshSection}
                        user={adminUser}
                        setNotice={setNotice}
                        setError={setError}
                    />
                ) : null}

                {activeSection === "activity" ? (
                    <ActivityLogs
                        documents={documents}
                        users={users}
                        storageStats={storageStats}
                        onRefresh={refreshSection}
                    />
                ) : null}

                {activeSection === "settings" ? (
                    <SettingsPage
                        adminTheme={adminTheme}
                        onToggleTheme={() => setAdminTheme((current) => (current === "dark" ? "light" : "dark"))}
                        apiKeys={apiKeys}
                        setApiKeys={setApiKeys}
                        saveKeys={saveKeys}
                        savingKeys={savingKeys}
                        documents={documents}
                        storageStats={storageStats}
                    />
                ) : null}



                {activeConflict && (
                    <div className="rename-folder-modal-overlay" onClick={handleConflictCancel}>
                        <div className="rename-folder-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
                            <header className="rename-folder-modal-header">
                                <h3 style={{ margin: 0, color: "var(--admin-gold)", display: "flex", alignItems: "center", gap: "8px" }}>
                                    <AlertTriangle size={18} />
                                    File Already Exists
                                </h3>
                                <button className="rename-folder-modal-close-btn" onClick={handleConflictCancel}>
                                    <X size={16} />
                                </button>
                            </header>
                            
                            <div className="rename-folder-modal-body" style={{ display: "flex", flexDirection: "column", gap: "12px", color: "#ccc", fontSize: "13px" }}>
                                <p>The file <strong>{activeConflict.file.name}</strong> already exists in the knowledge base.</p>
                                
                                <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px", borderRadius: "6px", border: "1px solid var(--admin-line)" }}>
                                    <div style={{ marginBottom: "6px" }}>
                                        <span style={{ color: "var(--admin-muted)" }}>Current Location:</span>
                                        <div style={{ fontWeight: "600", color: "#fff" }}>{formatFolderLabel(activeConflict.duplicateDocument.category)}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: "var(--admin-muted)" }}>Selected Destination:</span>
                                        <div style={{ fontWeight: "600", color: "var(--admin-gold)" }}>{formatFolderLabel(activeConflict.category)}</div>
                                    </div>
                                </div>
                                
                                <p>What would you like to do?</p>
                            </div>
                            
                            <footer className="rename-folder-modal-footer" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                                    <button 
                                        className="admin-primary-btn" 
                                        onClick={handleConflictMove}
                                        style={{ flex: 1, padding: "8px", background: "var(--admin-gold)", color: "#000", border: "none", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}
                                    >
                                        Move Here
                                    </button>
                                    <button 
                                        className="admin-secondary-btn" 
                                        onClick={handleConflictReplace}
                                        style={{ flex: 1, padding: "8px", background: "rgba(255,82,82,0.1)", color: "#ff5252", border: "1px solid rgba(255,82,82,0.3)", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}
                                    >
                                        Replace Existing
                                    </button>
                                </div>
                                <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                                    <button 
                                        className="admin-secondary-btn" 
                                        onClick={handleConflictKeep}
                                        style={{ flex: 1, padding: "8px", background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid var(--admin-line)", borderRadius: "6px", cursor: "pointer" }}
                                    >
                                        Keep Existing
                                    </button>
                                    <button 
                                        className="admin-secondary-btn" 
                                        onClick={handleConflictCancel}
                                        style={{ flex: 1, padding: "8px", background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid var(--admin-line)", borderRadius: "6px", cursor: "pointer" }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </footer>
                        </div>
                    </div>
                )}

                <div className="notification-banner">
                    {notice ? <div className="status-pill success">{notice}</div> : null}
                    {error ? <div className="status-pill error">{error}</div> : null}
                </div>
            </main>
        </div>
    );
}

export default Admin;
