import React, { useState, useEffect } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus, Loader2, Link2, FileText, Globe } from "lucide-react";
import {
    getKnowledgeSources,
    updateKnowledgeSource,
    updateKnowledgePriorities,
    addWebsiteSource,
    deleteKnowledgeSource
} from "../../../services/knowledgeService";
import { startCrawl } from "../../../crawler/crawlerService";
import "./KnowledgeSources.css";

export default function KnowledgeSources({ setNotice, setError }) {
    const [sources, setSources] = useState([]);
    const [urlName, setUrlName] = useState("");
    const [urlAddress, setUrlAddress] = useState("");
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);
    const [crawlingId, setCrawlingId] = useState(null);
    const [rowMaxPages, setRowMaxPages] = useState({});

    const loadSources = async () => {
        setLoading(true);
        try {
            const response = await getKnowledgeSources();
            setSources(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            console.error("Failed to load sources:", err);
            setError(err.message || "Failed to load knowledge sources.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadSources();
    }, []);

    const handleToggle = async (id, isEnabled) => {
        setError("");
        try {
            const updated = await updateKnowledgeSource(id, { isEnabled });
            setSources(prev => prev.map(s => s._id === id ? { ...s, isEnabled: updated.data.isEnabled } : s));
            setNotice(`Source settings updated.`);
        } catch (err) {
            setError(err.message || "Failed to toggle source state.");
        }
    };

    const handleCrawlNow = async (site) => {
        setCrawlingId(site._id);
        setError("");
        const limit = rowMaxPages[site._id] || 50;
        try {
            await startCrawl({
                url: site.url,
                maxPages: limit,
                category: "others"
            });
            setNotice(`Crawl job queued for ${site.url} (Limit: ${limit}).`);
            setSources(prev => prev.map(s => s._id === site._id ? { ...s, crawlStatus: "pending" } : s));
        } catch (err) {
            setError(err.message || "Failed to start crawl job.");
        } finally {
            setCrawlingId(null);
        }
    };

    const handleSyncIntervalChange = async (id, syncInterval) => {
        setError("");
        try {
            await updateKnowledgeSource(id, { syncInterval });
            setSources(prev => prev.map(s => s._id === id ? { ...s, syncInterval } : s));
            setNotice("Sync schedule interval updated successfully.");
        } catch (err) {
            setError(err.message || "Failed to update sync schedule.");
        }
    };

    const formatBytes = (bytes) => {
        if (!bytes) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const handleMove = async (index, direction) => {
        setError("");
        const newSources = [...sources];
        const targetIndex = direction === "up" ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= newSources.length) return;

        // Swap
        const temp = newSources[index];
        newSources[index] = newSources[targetIndex];
        newSources[targetIndex] = temp;

        // Map new priority indexes
        const payload = newSources.map((source, idx) => ({
            id: source._id,
            priority: idx + 1
        }));

        try {
            // Update UI optimistically
            setSources(newSources.map((s, idx) => ({ ...s, priority: idx + 1 })));
            
            await updateKnowledgePriorities(payload);
            setNotice("Knowledge search priorities updated successfully.");
        } catch (err) {
            setError(err.message || "Failed to update priorities.");
            void loadSources(); // Rollback
        }
    };

    const handleAddUrl = async (e) => {
        e.preventDefault();
        if (!urlAddress) return;

        setAdding(true);
        setError("");
        try {
            // Add a default priority based on placement of URLs
            const response = await addWebsiteSource({
                name: urlName || "Website URL",
                url: urlAddress
            });
            setNotice("Approved Website URL added successfully.");
            setUrlName("");
            setUrlAddress("");
            await loadSources();
        } catch (err) {
            setError(err.message || "Failed to add website URL.");
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to remove this website URL?")) return;

        setError("");
        try {
            await deleteKnowledgeSource(id);
            setNotice("Website URL deleted successfully.");
            await loadSources();
        } catch (err) {
            setError(err.message || "Failed to delete website URL.");
        }
    };

    // Split sources into global Priority config rows and individual URL mappings
    const priorityRows = sources.filter(s => s.type !== "url" || s.url === "https://heritageit.edu/"); 
    // Make sure we have exactly one website priority rows group for ordering, and individual website URLs listed below
    const websiteUrls = sources.filter(s => s.type === "url");

    const getIcon = (type) => {
        if (type === "pdf") return <FileText size={18} style={{ color: "var(--admin-blue)" }} />;
        if (type === "url") return <Globe size={18} style={{ color: "var(--admin-gold)" }} />;
        return <Link2 size={18} style={{ color: "var(--admin-purple)" }} />;
    };

    return (
        <section className="ks-shell">
            <header className="ks-header">
                <h2>Knowledge Source Manager</h2>
                <p>Configure priorities for different query handlers. Tiers evaluate sequentially: fallback searches execute only when higher tiers yield low confidence answers.</p>
            </header>

            {loading && sources.length === 0 ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
                    <Loader2 className="animate-spin" size={32} style={{ color: "var(--admin-gold)" }} />
                </div>
            ) : (
                <div className="ks-layout">
                    {/* Priority Sequence List */}
                    <div className="ks-priority-section">
                        <h3 className="crawler-section-title">Knowledge Priorities Order</h3>
                        <div className="ks-card-list">
                            {sources.map((source, index) => (
                                <div key={source._id} className="ks-source-card">
                                    <div className="ks-source-info">
                                        <div className="ks-rank-badge">{source.priority}</div>
                                        {getIcon(source.type)}
                                        <div className="ks-details">
                                            <h4>{source.name}</h4>
                                            <p>
                                                {source.type === "pdf" && "Indexes raw uploaded documents (.pdf)"}
                                                {source.type === "url" && `Indexes registered website urls (${websiteUrls.length} configured)`}
                                                {source.type === "internet" && "Scrapes trusted web references (Google, DuckDuckGo)"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="ks-source-actions">
                                        <div className="ks-order-buttons">
                                            <button
                                                type="button"
                                                className="ks-order-btn"
                                                onClick={() => handleMove(index, "up")}
                                                disabled={index === 0}
                                                title="Move Priority Up"
                                            >
                                                <ChevronUp size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                className="ks-order-btn"
                                                onClick={() => handleMove(index, "down")}
                                                disabled={index === sources.length - 1}
                                                title="Move Priority Down"
                                            >
                                                <ChevronDown size={14} />
                                            </button>
                                        </div>

                                        <label className="ks-switch">
                                            <input
                                                type="checkbox"
                                                checked={source.isEnabled}
                                                onChange={(e) => handleToggle(source._id, e.target.checked)}
                                            />
                                            <span className="ks-slider"></span>
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Web URLs Configuration */}
                    <div className="ks-add-url-section">
                        <h3 className="crawler-section-title" style={{ margin: 0 }}>Approved Website Sources</h3>
                        <p style={{ margin: "4px 0 16px 0", fontSize: "0.75rem", color: "var(--admin-muted)" }}>
                            Define which domain bases or pages the RAG engine retrieves university information from.
                        </p>

                        <form onSubmit={handleAddUrl} className="ks-url-form">
                            <div className="ks-input-group">
                                <label htmlFor="ks-url-name">Webpage Name / Title</label>
                                <input
                                    id="ks-url-name"
                                    type="text"
                                    className="ks-input"
                                    placeholder="e.g. Admissions Overview"
                                    value={urlName}
                                    onChange={(e) => setUrlName(e.target.value)}
                                    disabled={adding}
                                />
                            </div>

                            <div className="ks-input-group">
                                <label htmlFor="ks-url-address">Website URL</label>
                                <input
                                    id="ks-url-address"
                                    type="url"
                                    className="ks-input"
                                    placeholder="https://heritageit.edu/admissions.aspx"
                                    value={urlAddress}
                                    onChange={(e) => setUrlAddress(e.target.value)}
                                    required
                                    disabled={adding}
                                />
                            </div>

                            <button type="submit" className="ks-add-btn" disabled={adding || !urlAddress}>
                                {adding ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                            </button>
                        </form>
                    </div>

                    {/* Web URLs List Table */}
                    <div className="ks-table-section">
                        <div className="ks-table-wrapper">
                            {websiteUrls.length === 0 ? (
                                <div className="crawler-empty-jobs">
                                    <Globe size={32} style={{ marginBottom: "12px", opacity: 0.5 }} />
                                    No website URLs configured.
                                </div>
                            ) : (
                                <table className="ks-table">
                                    <thead>
                                        <tr>
                                            <th>Source Name</th>
                                            <th>Website URL</th>
                                            <th>Crawl Status</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {websiteUrls.map((site) => (
                                            <React.Fragment key={site._id}>
                                                <tr>
                                                    <td style={{ fontWeight: 600 }}>{site.name}</td>
                                                    <td style={{ maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        <a href={site.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--admin-blue)" }}>
                                                            {site.url}
                                                        </a>
                                                    </td>
                                                    <td>
                                                        <span className={`crawler-badge ${site.crawlStatus || "pending"}`}>
                                                            {site.crawlStatus || "pending"}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <label className="ks-switch" style={{ transform: "scale(0.85)" }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={site.isEnabled}
                                                                onChange={(e) => handleToggle(site._id, e.target.checked)}
                                                            />
                                                            <span className="ks-slider"></span>
                                                        </label>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                            <select
                                                                className="crawler-select"
                                                                style={{ padding: "4px 8px", fontSize: "0.75rem", width: "auto" }}
                                                                value={site.syncInterval || "manual"}
                                                                onChange={(e) => handleSyncIntervalChange(site._id, e.target.value)}
                                                                title="Sync Schedule"
                                                            >
                                                                <option value="manual">Manual</option>
                                                                <option value="daily">Daily</option>
                                                                <option value="weekly">Weekly</option>
                                                                <option value="monthly">Monthly</option>
                                                                <option value="disabled">Disabled</option>
                                                            </select>

                                                            <select
                                                                className="crawler-select"
                                                                style={{ padding: "4px 8px", fontSize: "0.75rem", width: "auto" }}
                                                                value={rowMaxPages[site._id] || 50}
                                                                onChange={(e) => setRowMaxPages(prev => ({ ...prev, [site._id]: e.target.value === "ALL" ? "ALL" : Number(e.target.value) }))}
                                                                disabled={crawlingId === site._id}
                                                            >
                                                                <option value={10}>10 pages</option>
                                                                <option value={25}>25 pages</option>
                                                                <option value={50}>50 pages</option>
                                                                <option value={100}>100 pages</option>
                                                                <option value={250}>250 pages</option>
                                                                <option value={500}>500 pages</option>
                                                                <option value={1000}>1000 pages</option>
                                                                <option value="ALL">ALL</option>
                                                            </select>
                                                            <button
                                                                type="button"
                                                                className="crawler-submit-btn"
                                                                style={{ padding: "6px 12px", fontSize: "0.75rem" }}
                                                                onClick={() => handleCrawlNow(site)}
                                                                disabled={crawlingId === site._id || site.crawlStatus === "crawling"}
                                                            >
                                                                {crawlingId === site._id ? "Queueing..." : "Crawl Now"}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="ks-delete-btn"
                                                                onClick={() => handleDelete(site._id)}
                                                            >
                                                                <Trash2 size={13} style={{ display: "inline", marginRight: "3px" }} />
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {site.stats && (
                                                    <tr>
                                                        <td colSpan="5" style={{ background: "rgba(0, 0, 0, 0.15)", padding: "10px 16px", borderBottom: "1px solid var(--admin-line)" }}>
                                                            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--admin-muted)" }}>
                                                                <span><strong>Last Sync:</strong> {site.lastSyncAt ? new Date(site.lastSyncAt).toLocaleString() : "Never"}</span>
                                                                <span><strong>Pages:</strong> {site.stats.pages || 0}</span>
                                                                <span><strong>Docs:</strong> {site.stats.documents || 0}</span>
                                                                <span><strong>Chunks:</strong> {site.stats.chunks || 0}</span>
                                                                <span><strong>Embeddings:</strong> {site.stats.embeddings || 0}</span>
                                                                <span><strong>Storage:</strong> {formatBytes(site.stats.storageUsed)}</span>
                                                                <span><strong>Skipped:</strong> {site.stats.skipped || 0}</span>
                                                                <span><strong>Downloaded:</strong> {site.stats.downloaded || 0}</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
