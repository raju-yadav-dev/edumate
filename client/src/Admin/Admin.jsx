import "./Admin.css";
import "./Login/AdminLogin.css";
import "./AdminTheme.css";

import { AlertTriangle, Database, FileText, Folder, Shield, UserRoundCheck } from "lucide-react";
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
import { getDocumentUrl } from "./utils/documentUtils";
import { recordActivityLog } from "../services/activityLogService";
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
            if (Array.isArray(parsed) && parsed.length > 0) return sanitizeFolders(parsed);
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
    const [storageStats, setStorageStats] = useState(DEMO_STORAGE_STATS);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [clipboard, setClipboard] = useState({ action: null, fileIds: [], sourceCategory: null });
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
    const [uploadQueue, setUploadQueue] = useState([]);
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [jobs, setJobs] = useState({ queue: [], running: [], failed: [], completedCount: 0, totalCount: 0 });
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
                    if (key && !nextFolders.some((f) => f.value === key)) {
                        const label = formatFolderLabel(key);
                        nextFolders.push({ label, value: key });
                        updated = true;
                    }
                });

                return sanitizeFolders(updated ? nextFolders : currentFolders);
            });
        }
    }, [storageStats]);

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

    const handleUploadFile = useCallback((files) => {
        if (!files) return;
        const fileList = files instanceof FileList || Array.isArray(files) ? Array.from(files) : [files];

        const newQueueItems = fileList.map((file) => {
            if (file.size > 50 * MB) {
                setError(`File ${file.name} exceeds the 50 MB limit.`);
                return null;
            }
            return {
                id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
                file,
                name: file.name,
                size: file.size,
                category: activeFolder || "admissions",
                progress: 0,
                status: "queued",
                speed: "",
                error: "",
                uploadedBytes: 0,
                startTime: null,
                xhr: null
            };
        }).filter(Boolean);

        if (newQueueItems.length > 0) {
            setUploadQueue(current => [...current, ...newQueueItems]);
            setNotice(`Added ${newQueueItems.length} file(s) to the upload queue.`);
        }
    }, [activeFolder]);

    const handleUploadDragOver = useCallback((event) => {
        event.preventDefault();
        setIsDropActive(true);
    }, []);

    const handleUploadDragLeave = useCallback(() => {
        setIsDropActive(false);
    }, []);

    const handleUploadDrop = useCallback(async (event) => {
        event.preventDefault();
        setIsDropActive(false);

        const items = event.dataTransfer.items;
        if (!items) return;

        const filesToUpload = [];
        const foldersToCreate = [];

        const traverseEntry = async (entry, path = "") => {
            if (entry.isFile) {
                const file = await new Promise((resolve) => entry.file(resolve));
                filesToUpload.push({ file, path });
            } else if (entry.isDirectory) {
                const dirName = entry.name;
                const slug = slugifyFolder(dirName);
                const parentVal = path ? path.replace(/\//g, "_") : (activeFolder !== "root" && activeFolder !== "" ? activeFolder : null);
                const value = parentVal ? `${parentVal}_${slug}` : slug;

                foldersToCreate.push({ label: dirName, value, parent: parentVal });

                const dirReader = entry.createReader();
                const readEntries = async () => {
                    const entries = await new Promise((resolve) => dirReader.readEntries(resolve));
                    if (entries.length > 0) {
                        for (const child of entries) {
                            await traverseEntry(child, path ? `${path}/${slug}` : slug);
                        }
                        await readEntries();
                    }
                };
                await readEntries();
            }
        };

        const entriesPromises = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === "file") {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                    entriesPromises.push(traverseEntry(entry));
                }
            }
        }
        await Promise.all(entriesPromises);

        if (foldersToCreate.length > 0) {
            setFolders(currentFolders => {
                const next = [...currentFolders];
                foldersToCreate.forEach(f => {
                    if (!next.some(item => item.value === f.value)) {
                        next.push(f);
                    }
                });
                const sanitized = sanitizeFolders(next);
                window.localStorage.setItem("edumate-admin-folders", JSON.stringify(sanitized));
                return sanitized;
            });
        }

        const newQueueItems = filesToUpload.map(({ file, path }) => {
            let cat = activeFolder || "admissions";
            if (path) {
                const parentPath = activeFolder !== "root" && activeFolder !== "" ? activeFolder : null;
                cat = parentPath ? `${parentPath}_${path.replace(/\//g, "_")}` : path.replace(/\//g, "_");
            }
            return {
                id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
                file,
                name: file.name,
                size: file.size,
                category: cat,
                progress: 0,
                status: "queued",
                speed: "",
                error: "",
                uploadedBytes: 0,
                startTime: null,
                xhr: null
            };
        });

        if (newQueueItems.length > 0) {
            setUploadQueue(current => [...current, ...newQueueItems]);
            setNotice(`Added ${newQueueItems.length} file(s) to the upload queue.`);
        }
    }, [activeFolder]);

    const startUpload = useCallback((itemId) => {
        let currentItem = null;
        setUploadQueue(current => {
            const found = current.find(item => item.id === itemId);
            if (found) currentItem = { ...found, status: "uploading", startTime: Date.now() };
            return current.map(item => item.id === itemId ? currentItem : item);
        });

        if (!currentItem) return;

        const token = getAdminAccessToken();
        const formData = new FormData();
        formData.append("document", currentItem.file);
        formData.append("title", currentItem.name.replace(/\.[^/.]+$/, ""));
        formData.append("category", currentItem.category);
        formData.append("institution", adminUser?.institution || "");
        formData.append("department", adminUser?.department || "");
        formData.append("version", "1");
        formData.append("notes", "Bulk upload");

        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${getApiRootUrl()}/documents`);
        if (token) {
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }

        let lastUploadedBytes = 0;
        let lastTime = Date.now();

        xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
                const percentage = Math.round((event.loaded / event.total) * 100);
                const now = Date.now();
                const timeDiff = (now - lastTime) / 1000;
                let speedText = "";
                if (timeDiff > 0.2) {
                    const byteDiff = event.loaded - lastUploadedBytes;
                    const speedBytes = byteDiff / timeDiff;
                    speedText = formatBytes(speedBytes) + "/s";
                    lastUploadedBytes = event.loaded;
                    lastTime = now;
                }

                setUploadQueue(current => current.map(item => {
                    if (item.id === itemId) {
                        return {
                            ...item,
                            progress: percentage,
                            uploadedBytes: event.loaded,
                            speed: speedText || item.speed
                        };
                    }
                    return item;
                }));
            }
        });

        xhr.onload = () => {
            let response = {};
            try { response = JSON.parse(xhr.responseText); } catch (e) {}

            if (xhr.status >= 200 && xhr.status < 300) {
                setUploadQueue(current => current.map(item =>
                    item.id === itemId ? { ...item, status: "completed", progress: 100, speed: "" } : item
                ));
                void loadDocuments();
                void loadStorageStats();
            } else {
                setUploadQueue(current => current.map(item =>
                    item.id === itemId ? { ...item, status: "failed", error: response.message || "Upload failed." } : item
                ));
            }
        };

        xhr.onerror = () => {
            setUploadQueue(current => current.map(item =>
                item.id === itemId ? { ...item, status: "failed", error: "Network error occurred." } : item
            ));
        };

        xhr.onabort = () => {
            setUploadQueue(current => current.map(item =>
                item.id === itemId ? { ...item, status: "cancelled", speed: "" } : item
            ));
        };

        setUploadQueue(current => current.map(item =>
            item.id === itemId ? { ...item, xhr } : item
        ));

        xhr.send(formData);
    }, [adminUser, loadDocuments, loadStorageStats]);

    const pauseUpload = useCallback((itemId) => {
        setUploadQueue(current => current.map(item => {
            if (item.id === itemId) {
                if (item.status === "uploading" && item.xhr) {
                    item.xhr.abort();
                }
                return { ...item, status: "paused", speed: "" };
            }
            return item;
        }));
    }, []);

    const resumeUpload = useCallback((itemId) => {
        setUploadQueue(current => current.map(item =>
            item.id === itemId ? { ...item, status: "queued", error: "", progress: 0 } : item
        ));
    }, []);

    const cancelUpload = useCallback((itemId) => {
        setUploadQueue(current => {
            const item = current.find(i => i.id === itemId);
            if (item && item.xhr && item.status === "uploading") {
                item.xhr.abort();
            }
            return current.filter(i => i.id !== itemId);
        });
    }, []);

    const retryUpload = useCallback((itemId) => {
        setUploadQueue(current => current.map(item =>
            item.id === itemId ? { ...item, status: "queued", error: "", progress: 0 } : item
        ));
    }, []);

    // Concurrency Scheduler Effect
    useEffect(() => {
        const uploadingCount = uploadQueue.filter(item => item.status === "uploading").length;
        if (uploadingCount >= 3) return;

        const nextQueued = uploadQueue.find(item => item.status === "queued");
        if (!nextQueued) return;

        startUpload(nextQueued.id);
    }, [uploadQueue, startUpload]);

    // History and Undo/Redo Engine
    const executeHistoryAction = useCallback(async (action, isUndo) => {
        if (action.type === "rename") {
            const targetName = isUndo ? action.oldName : action.newName;
            await renameAdminDocument(action.fileId, targetName);
            await loadDocuments();
            return { ...action, oldName: targetName, newName: isUndo ? action.newName : action.oldName };
        }
        if (action.type === "move") {
            const targetCat = isUndo ? action.oldCategory : action.newCategory;
            await bulkMoveAdminDocuments(action.fileIds, targetCat);
            await loadDocuments();
            await loadStorageStats();
            return { ...action, oldCategory: targetCat, newCategory: isUndo ? action.newCategory : action.oldCategory };
        }
        if (action.type === "delete") {
            if (isUndo) {
                for (const id of action.fileIds) {
                    await restoreAdminDocument(id);
                }
            } else {
                await bulkDeleteAdminDocuments(action.fileIds);
            }
            await loadDocuments();
            await loadStorageStats();
            return action;
        }
        if (action.type === "renameFolder") {
            const targetLabel = isUndo ? action.oldLabel : action.newLabel;
            setFolders(current => current.map(f => f.value === action.folderValue ? { ...f, label: targetLabel } : f));
            return { ...action, oldLabel: targetLabel, newLabel: isUndo ? action.newLabel : action.oldLabel };
        }
        if (action.type === "moveFolder") {
            const targetParent = isUndo ? action.oldParent : action.newParent;
            const renames = isUndo ? Object.fromEntries(Object.entries(action.categoryRenames).map(([k, v]) => [v, k])) : action.categoryRenames;

            for (const [oldCat, newCat] of Object.entries(renames)) {
                if (oldCat === newCat) continue;
                const response = await listAdminDocuments({ category: oldCat, limit: 1000, ignoreInstitution: "true" });
                if (response && response.data && response.data.length > 0) {
                    await bulkMoveAdminDocuments(response.data.map(d => d._id), newCat);
                }
            }

            setFolders(current => current.map(f => {
                if (renames[f.value] !== undefined) {
                    const newValue = renames[f.value];
                    const newParent = f.value === action.folderValue ? targetParent : renames[f.parent];
                    return { ...f, value: newValue, parent: newParent };
                }
                return f;
            }));

            await loadDocuments();
            await loadStorageStats();
            return { ...action, oldParent: targetParent, newParent: isUndo ? action.newParent : action.oldParent };
        }
        return null;
    }, [loadDocuments, loadStorageStats]);

    const pushToUndo = useCallback((action) => {
        setUndoStack(current => [...current, action]);
        setRedoStack([]);
    }, []);

    const handleUndo = useCallback(async () => {
        if (undoStack.length === 0) return;
        const action = undoStack[undoStack.length - 1];
        setUndoStack(current => current.slice(0, -1));

        try {
            setBusy(true);
            const redoAction = await executeHistoryAction(action, true);
            if (redoAction) {
                setRedoStack(current => [...current, redoAction]);
            }
            setNotice(`Undone: ${action.label}`);
        } catch (err) {
            setError(`Undo failed: ${err.message}`);
        } finally {
            setBusy(false);
        }
    }, [undoStack, executeHistoryAction]);

    const handleRedo = useCallback(async () => {
        if (redoStack.length === 0) return;
        const action = redoStack[redoStack.length - 1];
        setRedoStack(current => current.slice(0, -1));

        try {
            setBusy(true);
            const undoAction = await executeHistoryAction(action, false);
            if (undoAction) {
                setUndoStack(current => [...current, undoAction]);
            }
            setNotice(`Redone: ${action.label}`);
        } catch (err) {
            setError(`Redo failed: ${err.message}`);
        } finally {
            setBusy(false);
        }
    }, [redoStack, executeHistoryAction]);

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
            pushToUndo({ type: "delete", fileIds: [id], label: "Delete document" });
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
            pushToUndo({ type: "move", fileIds: [id], oldCategory: currentCategory, newCategory: newCategory, label: `Move file to "${newCategoryLabel.trim()}"` });
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

    async function bulkDeleteDocuments() {
        if (!selectedIds.length || !window.confirm(`Delete ${selectedIds.length} selected file(s)?`)) {
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

    function handleCreateFolder(parentVal = null) {
        const parentString = typeof parentVal === "string" ? parentVal : null;
        const targetParent = parentString !== null ? parentString : (activeFolder && activeFolder !== "root" ? activeFolder : null);
        const parentFolder = folders.find(f => f.value === targetParent);
        const folderName = window.prompt(
            parentFolder
                ? `New subfolder name inside "${parentFolder.label}"`
                : "New root folder name"
        );

        if (!folderName) {
            return;
        }

        const slug = slugifyFolder(folderName);

        if (!slug) {
            setError("Folder name is required.");
            return;
        }

        const value = targetParent ? `${targetParent}_${slug}` : slug;
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

    async function handleRenameFolder(folderValue) {
        const folder = folders.find((f) => f.value === folderValue);
        if (!folder) return;

        const newName = window.prompt("Rename folder to:", folder.label);
        if (!newName || newName.trim() === "" || newName.trim() === folder.label) return;

        const nextFolders = sanitizeFolders(folders.map((f) => {
            if (f.value === folderValue) {
                return { ...f, label: newName.trim() };
            }
            return f;
        }));

        setFolders(nextFolders);
        window.localStorage.setItem("edumate-admin-folders", JSON.stringify(nextFolders));
        pushToUndo({ type: "renameFolder", folderValue, oldLabel: folder.label, newLabel: newName.trim(), label: `Rename folder to "${newName.trim()}"` });
        setNotice(`Folder renamed to ${newName.trim()}.`);
    }

    async function handleDeleteFolder(folderValue) {
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

        if (!window.confirm(confirmMsg)) {
            return;
        }

        try {
            setBusy(true);
            setError("");
            const defaultFolder = folders.find((f) => !descendantFolderValues.includes(f.value))?.value || "admissions";

            if (filesToMove.length > 0) {
                for (const doc of filesToMove) {
                    await moveAdminDocument(doc._id, defaultFolder);
                }
            }

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

    async function handleMoveFolder(folderValue) {
        const folder = folders.find((f) => f.value === folderValue);
        if (!folder) return;

        const descendantValues = getDescendantFolders(folders, folderValue);

        const eligibleParents = folders.filter(f => !descendantValues.includes(f.value));
        const parentOptionsStr = ["Root", ...eligibleParents.map(f => f.label)].join(", ");

        const targetParentLabel = window.prompt(
            `Move folder "${folder.label}" to parent (${parentOptionsStr}):`,
            folder.parent ? (folders.find(f => f.value === folder.parent)?.label || "Root") : "Root"
        );

        if (targetParentLabel === null) return;

        let targetParentValue = null;
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

    function handleCopy(singleId = null) {
        const ids = singleId ? [singleId] : selectedIds;
        if (ids.length === 0) return;
        setClipboard({
            action: "copy",
            fileIds: [...ids],
            sourceCategory: activeFolder
        });
        setNotice(`${ids.length} file(s) copied to clipboard.`);
    }

    function handleCut(singleId = null) {
        const ids = singleId ? [singleId] : selectedIds;
        if (ids.length === 0) return;
        setClipboard({
            action: "cut",
            fileIds: [...ids],
            sourceCategory: activeFolder
        });
        setNotice(`${ids.length} file(s) cut to clipboard.`);
    }

    async function handlePaste(targetCategory = activeFolder) {
        const pasteCategory = targetCategory === "root" ? "root" : targetCategory;
        if (!clipboard.action || clipboard.fileIds.length === 0) {
            return;
        }

        try {
            setBusy(true);
            setError("");

            if (clipboard.action === "copy") {
                await bulkCopyAdminDocuments(clipboard.fileIds, pasteCategory);
            } else if (clipboard.action === "cut") {
                await bulkMoveAdminDocuments(clipboard.fileIds, pasteCategory);
                pushToUndo({
                    type: "move",
                    fileIds: [...clipboard.fileIds],
                    oldCategory: clipboard.sourceCategory,
                    newCategory: pasteCategory,
                    label: `Move ${clipboard.fileIds.length} document(s)`
                });
            }

            const actionLabel = clipboard.action === "copy" ? "copied" : "moved";
            setNotice(`${clipboard.fileIds.length} file(s) successfully ${actionLabel}.`);

            if (clipboard.action === "cut") {
                setClipboard({ action: null, fileIds: [], sourceCategory: null });
            }

            setSelectedIds([]);
            await loadDocuments();
            await loadStorageStats();
        } catch (err) {
            setError(err.message || "Failed to paste files.");
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
                            folderIndexStats={folderIndexStats}
                            uploadQueue={uploadQueue}
                            onPauseUpload={pauseUpload}
                            onResumeUpload={resumeUpload}
                            onCancelUpload={cancelUpload}
                            onRetryUpload={retryUpload}
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

                {activeSection === "tools" ? (
                    <DataTools
                        setActiveSection={setActiveSection}
                        documents={documents}
                        storageStats={storageStats}
                        users={users}
                        onRefresh={refreshSection}
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

                {activeSection === "crawler" ? (
                    <CrawlerManager
                        user={adminUser}
                        setNotice={setNotice}
                        setError={setError}
                    />
                ) : null}

                {activeSection === "knowledge_sources" ? (
                    <KnowledgeSources
                        setNotice={setNotice}
                        setError={setError}
                    />
                ) : null}

                <div className="notification-banner">
                    {notice ? <div className="status-pill success">{notice}</div> : null}
                    {error ? <div className="status-pill error">{error}</div> : null}
                </div>
            </main>
        </div>
    );
}

export default Admin;
