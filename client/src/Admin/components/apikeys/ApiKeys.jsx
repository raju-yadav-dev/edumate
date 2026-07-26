import { useState, useMemo, useEffect } from "react";
import {
    Key,
    ShieldCheck,
    AlertTriangle,
    Activity,
    Search,
    Plus,
    RefreshCw,
    Edit2,
    Eye,
    EyeOff,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Cpu,
    Layers,
    X,
    Copy,
    Check
} from "lucide-react";
import "./ApiKeys.css";

const STORAGE_KEY = "edumate-admin-api-keys";

const INITIAL_KEYS = [
    {
        id: "key-1",
        provider: "Gemini API",
        providerType: "gemini",
        name: "Gemini Production Key",
        secret: "AIzaSyB_demo_gemini_prod_key_99812",
        status: "Active",
        created: "10 Apr 2025",
        lastUsed: "16 May 2025, 11:02 AM",
        quota: "10,000 req/day",
        usageCount: 1245,
        quotaMax: 10000,
        usagePercent: 12
    },
    {
        id: "key-2",
        provider: "OpenAI API",
        providerType: "openai",
        name: "OpenAI Main Key",
        secret: "sk-proj-demo_openai_main_key_4431",
        status: "Active",
        created: "05 Apr 2025",
        lastUsed: "16 May 2025, 10:58 AM",
        quota: "50,000 req/day",
        usageCount: 23441,
        quotaMax: 50000,
        usagePercent: 51
    },
    {
        id: "key-3",
        provider: "Anthropic API",
        providerType: "anthropic",
        name: "Claude API Key",
        secret: "sk-ant-api03_demo_claude_key_7712",
        status: "Warning",
        created: "20 Apr 2025",
        lastUsed: "16 May 2025, 09:47 AM",
        quota: "5,000 req/day",
        usageCount: 532,
        quotaMax: 5000,
        usagePercent: 10
    },
    {
        id: "key-4",
        provider: "Cohere API",
        providerType: "cohere",
        name: "Cohere Key",
        secret: "co_demo_cohere_production_key_1120",
        status: "Inactive",
        created: "15 Apr 2025",
        lastUsed: "12 May 2025, 02:15 PM",
        quota: "2,000 req/day",
        usageCount: 0,
        quotaMax: 2000,
        usagePercent: 0
    },
    {
        id: "key-5",
        provider: "Groq API",
        providerType: "groq",
        name: "Groq Server Key",
        secret: "gsk_demo_groq_fast_inference_key_884",
        status: "Active",
        created: "01 May 2025",
        lastUsed: "16 May 2025, 11:15 AM",
        quota: "100,000 req/day",
        usageCount: 45210,
        quotaMax: 100000,
        usagePercent: 45
    },
    {
        id: "key-6",
        provider: "OpenRouteService",
        providerType: "ors",
        name: "ORS Navigation Key",
        secret: "5b3ce3597851110001cf6248_demo_ors_key",
        status: "Active",
        created: "02 May 2025",
        lastUsed: "16 May 2025, 10:30 AM",
        quota: "40,000 req/day",
        usageCount: 12300,
        quotaMax: 40000,
        usagePercent: 31
    }
];

function readStoredKeys() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch {}
    return INITIAL_KEYS;
}

function getProviderType(providerName = "") {
    const p = String(providerName).toLowerCase();
    if (p.includes("gemini")) return "gemini";
    if (p.includes("openai")) return "openai";
    if (p.includes("anthropic") || p.includes("claude")) return "anthropic";
    if (p.includes("cohere")) return "cohere";
    if (p.includes("groq")) return "groq";
    return "ors";
}

function generateSecretForProvider(providerType = "gemini") {
    const rand1 = Math.random().toString(36).substring(2, 12);
    const rand2 = Math.random().toString(36).substring(2, 10);
    switch (providerType) {
        case "gemini":
            return `AIzaSyB_${rand1}_${rand2}`;
        case "openai":
            return `sk-proj-${rand1}-${rand2}`;
        case "anthropic":
            return `sk-ant-api03-${rand1}-${rand2}`;
        case "cohere":
            return `co_${rand1}_${rand2}`;
        case "groq":
            return `gsk_live_${rand1}_${rand2}`;
        case "ors":
            return `5b3ce3597851110001cf6248_${rand1}`;
        default:
            return `sk_live_${rand1}_${rand2}`;
    }
}

function ApiKeys({ apiKeys = {}, setApiKeys, saveKeys, savingKeys }) {
    const [keys, setKeys] = useState(() => readStoredKeys());
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedProviderFilter, setSelectedProviderFilter] = useState("All Providers");
    const [page, setPage] = useState(1);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [visibleSecretId, setVisibleSecretId] = useState(null);
    const [copiedSecret, setCopiedSecret] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingKey, setEditingKey] = useState(null);
    const [formData, setFormData] = useState({
        provider: "Gemini API",
        name: "",
        secret: "",
        status: "Active",
        quota: "10,000 req/day"
    });

    const pageSize = 4;

    // Save keys to localStorage when keys change
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
        } catch {}
    }, [keys]);

    // Live auto-refresh effect for service activity
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            setKeys((currentKeys) =>
                currentKeys.map((item) => {
                    if (item.status !== "Active") return item;
                    // Slightly increment random usage count for real-time live feeling
                    const increment = Math.floor(Math.random() * 3);
                    if (increment === 0) return item;
                    const newUsage = item.usageCount + increment;
                    const newPercent = Math.min(100, Math.round((newUsage / (item.quotaMax || 10000)) * 100));
                    return {
                        ...item,
                        usageCount: newUsage,
                        usagePercent: newPercent,
                        lastUsed: "Just now"
                    };
                })
            );
        }, 12000);

        return () => clearInterval(interval);
    }, [autoRefresh]);

    const filteredKeys = useMemo(() => {
        return keys.filter((item) => {
            const query = searchQuery.trim().toLowerCase();
            const matchesSearch =
                !query ||
                item.name.toLowerCase().includes(query) ||
                item.provider.toLowerCase().includes(query) ||
                item.secret.toLowerCase().includes(query);
            const matchesFilter =
                selectedProviderFilter === "All Providers" ||
                item.provider.toLowerCase() === selectedProviderFilter.toLowerCase();
            return matchesSearch && matchesFilter;
        });
    }, [keys, searchQuery, selectedProviderFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredKeys.length / pageSize));
    const paginatedKeys = filteredKeys.slice((page - 1) * pageSize, page * pageSize);

    // Dynamic metrics
    const totalKeysCount = keys.length;
    const activeKeysCount = keys.filter((k) => k.status === "Active").length;
    const failedRequestsCount = keys.filter((k) => k.status !== "Active").length * 12 || 24;
    const totalMonthlyUsage = useMemo(() => {
        const total = keys.reduce((sum, k) => sum + (k.usageCount || 0), 0);
        return total > 1000 ? `${(total / 1000).toFixed(1)}K` : `${total}`;
    }, [keys]);

    // Health overview cards generated dynamically from registered keys
    const healthServices = useMemo(() => {
        const providers = ["Gemini API", "OpenAI API", "Anthropic API"];
        return providers.map((provName) => {
            const matched = keys.filter((k) => k.provider.toLowerCase().includes(provName.toLowerCase().split(" ")[0]));
            const activeMatch = matched.find((k) => k.status === "Active") || matched[0];
            const pType = getProviderType(provName);

            const requestsToday = activeMatch ? activeMatch.usageCount.toLocaleString() : "1,245";
            const quotaMax = activeMatch ? (activeMatch.quotaMax / 1000).toFixed(0) : "10";
            const remaining = activeMatch ? (activeMatch.quotaMax - activeMatch.usageCount).toLocaleString() : "8,755";
            const status = activeMatch ? activeMatch.status === "Active" ? "Healthy" : activeMatch.status : "Healthy";
            const avgTime = pType === "gemini" ? "1.2s" : pType === "openai" ? "1.6s" : "2.1s";
            const progressPercent = activeMatch ? Math.max(10, 100 - activeMatch.usagePercent) : 88;
            const tone = status === "Healthy" || status === "Active" ? "green" : status === "Warning" ? "amber" : "red";

            return {
                provider: provName,
                providerType: pType,
                status,
                requestsToday,
                quotaRemaining: `${remaining} / ${quotaMax}K`,
                avgResponseTime: avgTime,
                lastUsed: activeMatch?.lastUsed || "16 May 2025, 11:02 AM",
                progressPercent,
                tone
            };
        });
    }, [keys]);

    const handleRefresh = () => {
        setSearchQuery("");
        setSelectedProviderFilter("All Providers");
        setPage(1);
    };

    const handleOpenAddModal = () => {
        setEditingKey(null);
        setFormData({
            provider: "Gemini API",
            name: "",
            secret: generateSecretForProvider("gemini"),
            status: "Active",
            quota: "10,000 req/day"
        });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (keyItem) => {
        setEditingKey(keyItem);
        setFormData({
            provider: keyItem.provider,
            name: keyItem.name,
            secret: keyItem.secret,
            status: keyItem.status || "Active",
            quota: keyItem.quota || "10,000 req/day"
        });
        setIsModalOpen(true);
    };

    const handleDeleteKey = (id) => {
        if (window.confirm("Are you sure you want to delete this API key?")) {
            setKeys((current) => current.filter((k) => k.id !== id));
        }
    };

    const handleGenerateKey = () => {
        const pType = getProviderType(formData.provider);
        const secret = generateSecretForProvider(pType);
        setFormData((current) => ({
            ...current,
            secret,
            name: current.name || `${current.provider} Live Key`
        }));
        if (!isModalOpen) {
            setEditingKey(null);
            setIsModalOpen(true);
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const providerType = getProviderType(formData.provider);

        let updatedKeysList = [];

        if (editingKey) {
            updatedKeysList = keys.map((k) =>
                k.id === editingKey.id
                    ? {
                          ...k,
                          provider: formData.provider,
                          providerType,
                          name: formData.name || k.name,
                          secret: formData.secret || k.secret,
                          status: formData.status || k.status,
                          quota: formData.quota || k.quota
                      }
                    : k
            );
        } else {
            const quotaVal = parseInt(formData.quota.replace(/[^0-9]/g, ""), 10) || 10000;
            const newKey = {
                id: `key-${Date.now()}`,
                provider: formData.provider,
                providerType,
                name: formData.name || `${formData.provider} Key`,
                secret: formData.secret || generateSecretForProvider(providerType),
                status: formData.status || "Active",
                created: "Today",
                lastUsed: "Just now",
                quota: formData.quota || "10,000 req/day",
                usageCount: 0,
                quotaMax: quotaVal,
                usagePercent: 0
            };
            updatedKeysList = [newKey, ...keys];
        }

        setKeys(updatedKeysList);

        // Update root apiKeys state if provided
        if (setApiKeys) {
            if (providerType === "groq") {
                setApiKeys((current) => ({ ...current, groqApiKey: formData.secret }));
            } else if (providerType === "ors") {
                setApiKeys((current) => ({ ...current, openRouteServiceKey: formData.secret }));
            }
        }

        // Call root saveKeys if provided
        if (saveKeys) {
            try {
                await saveKeys(e);
            } catch (err) {
                console.warn("API key save sync notification:", err);
            }
        }

        setIsModalOpen(false);
    };

    const handleCopySecret = (secretText) => {
        if (navigator.clipboard && secretText) {
            navigator.clipboard.writeText(secretText);
            setCopiedSecret(true);
            setTimeout(() => setCopiedSecret(false), 2000);
        }
    };

    const renderProviderLogo = (type, name) => {
        if (type === "gemini") return <div className="provider-logo gemini"><Sparkles size={16} /></div>;
        if (type === "openai") return <div className="provider-logo openai"><Cpu size={16} /></div>;
        if (type === "anthropic") return <div className="provider-logo anthropic">A\</div>;
        if (type === "cohere") return <div className="provider-logo cohere"><Layers size={16} /></div>;
        if (type === "groq") return <div className="provider-logo groq"><Activity size={16} /></div>;
        return <div className="provider-logo ors"><Key size={16} /></div>;
    };

    return (
        <section className="api-keys-page" aria-label="API Keys management screen">

            {/* Top Metric Cards */}
            <div className="api-keys-metrics">
                <div className="key-metric-card">
                    <div className="key-metric-icon gold">
                        <Key size={24} />
                    </div>
                    <div className="key-metric-content">
                        <label>Total API Keys</label>
                        <strong>{totalKeysCount}</strong>
                        <small>All Configured Keys</small>
                    </div>
                </div>

                <div className="key-metric-card">
                    <div className="key-metric-icon green">
                        <ShieldCheck size={24} />
                    </div>
                    <div className="key-metric-content">
                        <label>Active Keys</label>
                        <strong>{activeKeysCount}</strong>
                        <small>Currently Active</small>
                    </div>
                </div>

                <div className="key-metric-card">
                    <div className="key-metric-icon red">
                        <AlertTriangle size={24} />
                    </div>
                    <div className="key-metric-content">
                        <label>Failed Requests</label>
                        <strong>{failedRequestsCount}</strong>
                        <small>Last 24 Hours</small>
                    </div>
                </div>

                <div className="key-metric-card">
                    <div className="key-metric-icon purple">
                        <Activity size={24} />
                    </div>
                    <div className="key-metric-content">
                        <label>Monthly Usage</label>
                        <strong>{totalMonthlyUsage}</strong>
                        <small>Total Requests</small>
                    </div>
                </div>
            </div>

            {/* API Health Overview */}
            <section className="health-overview-section">
                <div className="health-overview-top">
                    <div>
                        <h3>API Health Overview</h3>
                        <p>Real-time status of all integrated services</p>
                    </div>
                    <div className="health-overview-controls">
                        <select
                            className="provider-select"
                            value={selectedProviderFilter}
                            onChange={(e) => {
                                setSelectedProviderFilter(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="All Providers">All Providers</option>
                            <option value="Gemini API">Gemini API</option>
                            <option value="OpenAI API">OpenAI API</option>
                            <option value="Anthropic API">Anthropic API</option>
                            <option value="Cohere API">Cohere API</option>
                            <option value="Groq API">Groq API</option>
                            <option value="OpenRouteService">OpenRouteService</option>
                        </select>
                        <button
                            type="button"
                            className="auto-refresh-toggle"
                            style={{ cursor: "pointer" }}
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            title={autoRefresh ? "Pause live auto refresh" : "Turn on live auto refresh"}
                        >
                            <span className={autoRefresh ? "pulse-dot" : "pulse-dot off"} style={{ background: autoRefresh ? "#54de68" : "#8ca0b9" }} />
                            Auto refresh: {autoRefresh ? "ON" : "OFF"}
                        </button>
                    </div>
                </div>

                <div className="health-cards-grid">
                    {healthServices.map((item) => (
                        <article className="health-card" key={item.provider}>
                            <div className="health-card-header">
                                <div className="health-card-title">
                                    {renderProviderLogo(item.providerType, item.provider)}
                                    <span>{item.provider}</span>
                                </div>
                                <span className={`status-badge ${item.status.toLowerCase()}`}>
                                    {item.status}
                                </span>
                            </div>
                            <div className="health-card-body">
                                <div className="health-data-row">
                                    <span>Requests Today</span>
                                    <strong>{item.requestsToday}</strong>
                                </div>
                                <div className="health-data-row">
                                    <span>Quota Remaining</span>
                                    <strong>{item.quotaRemaining}</strong>
                                </div>
                                <div className="health-data-row">
                                    <span>Avg Response Time</span>
                                    <strong>{item.avgResponseTime}</strong>
                                </div>
                                <div className="health-data-row">
                                    <span>Last Used</span>
                                    <strong>{item.lastUsed}</strong>
                                </div>
                            </div>
                            <div className="health-card-progress">
                                <div
                                    className={`health-card-progress-bar ${item.tone}`}
                                    style={{ width: `${item.progressPercent}%` }}
                                />
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            {/* API Key Management Table */}
            <section className="keys-management-section">
                <div className="keys-management-header">
                    <div>
                        <h3>API Key Management</h3>
                        <p>View, add and manage all API keys</p>
                    </div>
                </div>

                <div className="keys-action-bar">
                    <div className="search-box">
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Search API keys..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>

                    <button type="button" className="btn-primary-action" onClick={handleOpenAddModal}>
                        <Plus size={16} /> Add API Key
                    </button>

                    <button type="button" className="btn-secondary-action" onClick={handleGenerateKey}>
                        <Key size={15} /> Generate Key
                    </button>
                </div>

                <div className="keys-table-wrap">
                    <table className="keys-table">
                        <thead>
                            <tr>
                                <th>Provider</th>
                                <th>Key Name</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Last Used</th>
                                <th>Quota</th>
                                <th>Usage</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedKeys.length ? (
                                paginatedKeys.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <div className="provider-cell">
                                                {renderProviderLogo(item.providerType, item.provider)}
                                                <span>{item.provider}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="key-name-cell">{item.name}</div>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${item.status.toLowerCase()}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td>{item.created}</td>
                                        <td>{item.lastUsed}</td>
                                        <td>{item.quota}</td>
                                        <td>
                                            <div className="usage-cell">
                                                <span className="usage-text">
                                                    {item.usageCount.toLocaleString()} ({item.usagePercent}%)
                                                </span>
                                                <div className="usage-bar-track">
                                                    <div
                                                        className="usage-bar-fill"
                                                        style={{
                                                            width: `${item.usagePercent}%`,
                                                            background:
                                                                item.usagePercent > 80 ? "#f87171" :
                                                                item.usagePercent > 40 ? "#ffb51d" : "#54de68"
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="actions-cell">
                                                <button
                                                    type="button"
                                                    className="action-icon-btn"
                                                    title="Edit key"
                                                    onClick={() => handleOpenEditModal(item)}
                                                >
                                                    <Edit2 size={15} />
                                                </button>

                                                <button
                                                    type="button"
                                                    className="action-icon-btn"
                                                    title={visibleSecretId === item.id ? "Hide secret key" : "View secret key"}
                                                    onClick={() =>
                                                        setVisibleSecretId(visibleSecretId === item.id ? null : item.id)
                                                    }
                                                >
                                                    {visibleSecretId === item.id ? <EyeOff size={15} /> : <Eye size={15} />}
                                                </button>

                                                <button
                                                    type="button"
                                                    className="action-icon-btn delete"
                                                    title="Delete key"
                                                    onClick={() => handleDeleteKey(item.id)}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: "center", padding: "30px", color: "var(--um-muted)" }}>
                                        No API keys matched your search filter.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <footer className="keys-pagination">
                    <span>
                        Showing {filteredKeys.length ? (page - 1) * pageSize + 1 : 0} to{" "}
                        {Math.min(page * pageSize, filteredKeys.length)} of {totalKeysCount} API keys
                    </span>
                    <div className="pagination-controls">
                        <button
                            type="button"
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                            aria-label="Previous page"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        {[...Array(totalPages)].map((_, i) => (
                            <button
                                key={i + 1}
                                type="button"
                                className={page === i + 1 ? "active" : ""}
                                onClick={() => setPage(i + 1)}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            type="button"
                            disabled={page === totalPages}
                            onClick={() => setPage(page + 1)}
                            aria-label="Next page"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </footer>
            </section>

            {/* Modal for View Secret Key */}
            {visibleSecretId ? (
                <div className="key-modal-overlay" onClick={() => setVisibleSecretId(null)}>
                    <div className="key-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="key-modal-header">
                            <h3>Secret Key Details</h3>
                            <button type="button" className="modal-close-btn" onClick={() => setVisibleSecretId(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <p style={{ fontSize: "0.82rem", color: "var(--um-muted)", margin: 0 }}>
                            {keys.find((k) => k.id === visibleSecretId)?.name} (
                            {keys.find((k) => k.id === visibleSecretId)?.provider})
                        </p>
                        <div
                            style={{
                                background: "rgba(3, 12, 23, 0.6)",
                                border: "1px solid var(--um-border)",
                                padding: "12px 14px",
                                borderRadius: "8px",
                                fontFamily: "monospace",
                                fontSize: "0.85rem",
                                wordBreak: "break-all",
                                color: "#ffc137",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "10px"
                            }}
                        >
                            <span>{keys.find((k) => k.id === visibleSecretId)?.secret}</span>
                            <button
                                type="button"
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    color: copiedSecret ? "#54de68" : "var(--um-text)",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    fontSize: "0.78rem"
                                }}
                                onClick={() => handleCopySecret(keys.find((k) => k.id === visibleSecretId)?.secret)}
                            >
                                {copiedSecret ? <Check size={16} /> : <Copy size={16} />}
                                {copiedSecret ? "Copied" : "Copy"}
                            </button>
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn-primary-action" onClick={() => setVisibleSecretId(null)}>
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Modal for Add / Edit API Key */}
            {isModalOpen ? (
                <div className="key-modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="key-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="key-modal-header">
                            <h3>{editingKey ? "Edit API Key" : "Add New API Key"}</h3>
                            <button type="button" className="modal-close-btn" onClick={() => setIsModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <form className="key-modal-form" onSubmit={handleFormSubmit}>
                            <div className="form-group">
                                <label>Provider</label>
                                <select
                                    value={formData.provider}
                                    onChange={(e) => {
                                        const p = e.target.value;
                                        setFormData({
                                            ...formData,
                                            provider: p,
                                            secret: editingKey ? formData.secret : generateSecretForProvider(getProviderType(p))
                                        });
                                    }}
                                >
                                    <option value="Gemini API">Gemini API</option>
                                    <option value="OpenAI API">OpenAI API</option>
                                    <option value="Anthropic API">Anthropic API</option>
                                    <option value="Cohere API">Cohere API</option>
                                    <option value="Groq API">Groq API</option>
                                    <option value="OpenRouteService">OpenRouteService</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Key Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Production Key"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>API Secret Key</label>
                                <div style={{ display: "flex", gap: "8px" }}>
                                    <input
                                        type="text"
                                        placeholder="Paste API secret or click Generate"
                                        required
                                        style={{ flex: 1 }}
                                        value={formData.secret}
                                        onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                                    />
                                    <button
                                        type="button"
                                        className="btn-secondary-action"
                                        style={{ padding: "0 12px", height: "auto" }}
                                        onClick={handleGenerateKey}
                                        title="Auto-generate secure secret key"
                                    >
                                        Auto Key
                                    </button>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <option value="Active">Active</option>
                                    <option value="Warning">Warning</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Daily Quota Limit</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 10,000 req/day"
                                    value={formData.quota}
                                    onChange={(e) => setFormData({ ...formData, quota: e.target.value })}
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary-action" onClick={() => setIsModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary-action" disabled={savingKeys}>
                                    {savingKeys ? "Saving..." : editingKey ? "Update Key" : "Save API Key"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}
        </section>
    );
}

export default ApiKeys;
