import React, { useState, useEffect, useRef } from "react";
import { Play, Loader2, Globe, Calendar, CheckCircle2, AlertTriangle, ListFilter } from "lucide-react";
import { getCrawlJobs, startCrawl, getCrawlJobDetails } from "./crawlerService";
import "./Crawler.css";

const CATEGORIES = [
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
    { label: "Others", value: "others" }
];

export default function CrawlerManager({ user, setNotice, setError }) {
    const [url, setUrl] = useState("");
    const [maxPages, setMaxPages] = useState(10);
    const [category, setCategory] = useState("admissions");
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [startingJob, setStartingJob] = useState(false);
    const [selectedJob, setSelectedJob] = useState(null);
    const logConsoleRef = useRef(null);

    // Load jobs on mount
    const loadJobs = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const response = await getCrawlJobs();
            const fetchedJobs = Array.isArray(response.data) ? response.data : [];
            setJobs(fetchedJobs);

            // Keep selected job updated
            if (selectedJob) {
                const updatedSelected = fetchedJobs.find(j => j._id === selectedJob._id);
                if (updatedSelected) {
                    setSelectedJob(updatedSelected);
                }
            }
        } catch (err) {
            console.error("Failed to load crawl jobs:", err);
            if (!silent) setError(err.message || "Failed to load crawl jobs.");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        void loadJobs();
    }, []);

    // Polling effect for active jobs (queued or crawling)
    useEffect(() => {
        const hasActiveJobs = jobs.some(job => job.status === "queued" || job.status === "crawling");
        if (!hasActiveJobs) return;

        const interval = setInterval(() => {
            void loadJobs(true);
        }, 3000);

        return () => clearInterval(interval);
    }, [jobs, selectedJob]);

    // Auto-scroll logs console to bottom when new logs or errors are added
    useEffect(() => {
        if (logConsoleRef.current) {
            logConsoleRef.current.scrollTop = logConsoleRef.current.scrollHeight;
        }
    }, [selectedJob?.crawledUrls, selectedJob?.errors]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!url) return;

        setStartingJob(true);
        setError("");
        try {
            const response = await startCrawl({
                url,
                maxPages,
                category,
                institution: user?.institution || ""
            });
            setNotice("Web crawl job started in the background.");
            setUrl("");
            await loadJobs();
            if (response.data) {
                setSelectedJob(response.data);
            }
        } catch (err) {
            setError(err.message || "Failed to start web crawl.");
        } finally {
            setStartingJob(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    };

    return (
        <section className="crawler-shell">
            <header className="crawler-header">
                <h2>University Web Crawler</h2>
                <p>Recursively crawl, clean, extract, and index official institutional web pages into your vector memory</p>
            </header>

            <div className="crawler-layout">
                {/* Left Form: Crawler Setup */}
                <div className="crawler-left-column">
                    <form onSubmit={handleSubmit} className="crawler-panel-card">
                        <h3 className="crawler-section-title">Configure New Crawl</h3>

                        <div className="crawler-form-group">
                            <label htmlFor="start-url">Start Website URL</label>
                            <input
                                id="start-url"
                                type="url"
                                className="crawler-input"
                                placeholder="https://heritageit.edu/admissions.aspx"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                required
                                disabled={startingJob}
                            />
                        </div>

                        <div className="crawler-form-group">
                            <label htmlFor="max-pages">Max Pages Limit</label>
                            <select
                                id="max-pages"
                                className="crawler-select"
                                value={maxPages}
                                onChange={(e) => setMaxPages(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
                                disabled={startingJob}
                            >
                                <option value={10}>10 pages</option>
                                <option value={25}>25 pages</option>
                                <option value={50}>50 pages</option>
                                <option value={100}>100 pages</option>
                                <option value={250}>250 pages</option>
                                <option value={500}>500 pages</option>
                                <option value={1000}>1000 pages</option>
                                <option value="ALL">ALL (Scan Entire Site)</option>
                            </select>
                        </div>

                        <div className="crawler-form-group">
                            <label htmlFor="target-category">Knowledge Category</label>
                            <select
                                id="target-category"
                                className="crawler-select"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                disabled={startingJob}
                            >
                                {CATEGORIES.map(cat => (
                                    <option key={cat.value} value={cat.value}>
                                        {cat.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="submit"
                            className="crawler-submit-btn"
                            disabled={startingJob || !url}
                        >
                            {startingJob ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    Scheduling...
                                </>
                            ) : (
                                <>
                                    <Play size={16} style={{ fill: "currentColor" }} />
                                    Start Crawling
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Right: Crawl Logs / Active Progress */}
                <div className="crawler-right-column">
                    {/* Active job panel */}
                    {selectedJob && (
                        <div className="crawler-job-details-card" style={{ marginBottom: "20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                    <h3 className="crawler-section-title" style={{ marginBottom: "4px" }}>
                                        Active Crawl: {selectedJob.url}
                                    </h3>
                                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--admin-muted)" }}>
                                        Category: <strong style={{ color: "var(--admin-gold)" }}>{selectedJob.category}</strong> | Limit: {selectedJob.maxPages} pages
                                    </p>
                                </div>
                                <span className={`crawler-badge ${selectedJob.status}`}>
                                    {selectedJob.status}
                                </span>
                            </div>

                            {/* Progress bar */}
                            <div className="crawler-progress-section">
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
                                    <span>Progress</span>
                                    <span>
                                        {selectedJob.pagesCrawled} / {selectedJob.maxPages === "ALL" ? "∞" : selectedJob.maxPages} pages indexed
                                    </span>
                                </div>
                                <div className="crawler-progress-bar" style={{ marginBottom: "16px" }}>
                                    <div
                                        className="crawler-progress-inner"
                                        style={{
                                            width: `${
                                                selectedJob.maxPages === "ALL"
                                                    ? Math.min(100, (selectedJob.pagesCrawled / 100) * 100) // fake progression if infinite
                                                    : Math.min(100, (selectedJob.pagesCrawled / (Number(selectedJob.maxPages) || 1)) * 100)
                                            }%`
                                        }}
                                    ></div>
                                </div>

                                {selectedJob.metadata && (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px", margin: "16px 0" }}>
                                        <div style={{ background: "var(--admin-panel-2)", border: "1px solid var(--admin-line)", borderRadius: "6px", padding: "10px", textAlign: "center" }}>
                                            <div style={{ fontSize: "0.75rem", color: "var(--admin-muted)" }}>Pages Crawled</div>
                                            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--admin-text)" }}>{selectedJob.pagesCrawled || 0}</div>
                                        </div>
                                        <div style={{ background: "var(--admin-panel-2)", border: "1px solid var(--admin-line)", borderRadius: "6px", padding: "10px", textAlign: "center" }}>
                                            <div style={{ fontSize: "0.75rem", color: "var(--admin-muted)" }}>Documents Discovered</div>
                                            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--admin-gold)" }}>{selectedJob.metadata.discoveredDocumentsCount || 0}</div>
                                        </div>
                                        {selectedJob.metadata.discoveredDocuments && selectedJob.metadata.discoveredDocuments.length > 0 && (
                                            <div style={{ gridColumn: "1 / -1", maxHeight: "120px", overflowY: "auto", background: "rgba(0, 0, 0, 0.2)", borderRadius: "6px", padding: "10px", fontSize: "0.75rem", textAlign: "left" }}>
                                                <strong style={{ color: "var(--admin-muted)", display: "block", marginBottom: "4px" }}>Discovered Office/PDF URLs:</strong>
                                                {selectedJob.metadata.discoveredDocuments.map((docUrl, idx) => (
                                                    <div key={`doc-${idx}`} style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", marginTop: "2px" }}>
                                                        <a href={docUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--admin-blue)" }}>{docUrl}</a>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                            </div>

                            {/* Logs console */}
                            <div className="crawler-log-panel">
                                <div className="crawler-log-title">Live Crawled URLs & Logs</div>
                                <div ref={logConsoleRef} className="crawler-log-console">
                                    {selectedJob.crawledUrls?.map((curl, idx) => (
                                        <div key={`url-${idx}`} className="crawler-log-item">
                                            [SUCCESS] Indexed page: {curl}
                                        </div>
                                    ))}
                                    {selectedJob.errors?.map((err, idx) => (
                                        <div key={`err-${idx}`} className="crawler-error-item">
                                            [ERROR] {err}
                                        </div>
                                    ))}
                                    {selectedJob.status === "crawling" && (
                                        <div className="crawler-log-item" style={{ color: "var(--admin-blue)" }}>
                                            [INFO] Crawling next URL in queue...
                                        </div>
                                    )}
                                    {selectedJob.status === "completed" && (
                                        <div className="crawler-log-item" style={{ color: "var(--admin-green)" }}>
                                            [SUCCESS] Crawl task finished successfully. All chunks indexed in Qdrant.
                                        </div>
                                    )}
                                    {selectedJob.status === "queued" && (
                                        <div className="crawler-log-item">
                                            [INFO] Crawl job queued. Waiting for worker process...
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* All past jobs list */}
                    <div className="crawler-jobs-container">
                        <h3 className="crawler-section-title">Crawl Jobs History</h3>
                        <div className="crawler-table-wrapper">
                            {jobs.length === 0 ? (
                                <div className="crawler-empty-jobs">
                                    <Globe size={32} style={{ marginBottom: "12px", opacity: 0.5 }} />
                                    No web crawl jobs scheduled yet.
                                </div>
                            ) : (
                                <table className="crawler-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Website URL</th>
                                            <th>Category</th>
                                            <th>Status</th>
                                            <th>Pages</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {jobs.map((job) => (
                                            <tr
                                                key={job._id}
                                                onClick={() => setSelectedJob(job)}
                                                style={{
                                                    cursor: "pointer",
                                                    background: selectedJob?._id === job._id ? "rgba(242, 163, 11, 0.06)" : "transparent"
                                                }}
                                            >
                                                <td>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                        <Calendar size={14} style={{ color: "var(--admin-muted)" }} />
                                                        {formatDate(job.createdAt)}
                                                    </div>
                                                </td>
                                                <td style={{ maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {job.url}
                                                </td>
                                                <td>
                                                    <span style={{ textTransform: "capitalize" }}>
                                                        {job.category}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`crawler-badge ${job.status}`}>
                                                        {job.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    {job.pagesCrawled} / {job.maxPages}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
