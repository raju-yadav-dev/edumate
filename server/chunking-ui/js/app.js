/**
 * EduMate Standalone Chunking Studio Frontend Application (Mission 15.3)
 * Pure Vanilla JavaScript - Offline-first, Zero React/Vite dependency.
 */

const state = {
    activeTab: 'dashboard',
    health: null,
    queue: null,
    storageTree: null,
    storageFilter: '',
    storageCategory: 'all',
    expandedFolders: new Set(['admissions', 'academics', 'rules']),
    logs: [],
    logFilter: 'ALL',
    logSearch: '',
    selectedDocumentId: null,
    selectedDocChunks: null,
    analytics: null,
    sseConnected: false
};

// ==========================================
// Initialization & Navigation
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initUploadZone();
    initSSEStreams();
    fetchInitialData();
    setInterval(fetchHealth, 8000);
});

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.dataset.tab;
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-pane').forEach(el => {
        el.classList.toggle('active', el.id === `tab-${tabId}`);
    });

    if (tabId === 'storage') renderStorageTree();
    if (tabId === 'queue') renderQueueView();
    if (tabId === 'analytics') fetchAnalytics();
    if (tabId === 'logs') scrollLogsToBottom();
}

// ==========================================
// Initial & Periodic Data Fetching
// ==========================================
async function fetchInitialData() {
    await Promise.all([
        fetchHealth(),
        fetchQueue(),
        fetchStorageTree(),
        fetchAnalytics()
    ]);
}

async function fetchHealth() {
    try {
        const res = await fetch('/health');
        const json = await res.json();
        if (json.success) {
            state.health = json.data;
            updateHealthUI();
        }
    } catch (err) {
        console.error('Health fetch error:', err);
    }
}

async function fetchQueue() {
    try {
        const res = await fetch('/queue');
        const json = await res.json();
        if (json.success) {
            state.queue = json.data;
            updateQueueBadges();
            if (state.activeTab === 'queue') renderQueueView();
        }
    } catch (err) {
        console.error('Queue fetch error:', err);
    }
}

async function fetchStorageTree() {
    try {
        const res = await fetch('/storage/tree');
        const json = await res.json();
        if (json.success) {
            state.storageTree = json.data.tree || [];
            renderStorageTree();
        }
    } catch (err) {
        console.error('Storage fetch error:', err);
    }
}

async function fetchAnalytics() {
    try {
        const res = await fetch('/chunking/analytics');
        const json = await res.json();
        if (json.success) {
            state.analytics = json.data;
            updateAnalyticsUI();
        }
    } catch (err) {
        console.error('Analytics fetch error:', err);
    }
}

// ==========================================
// Health & Header UI Update
// ==========================================
function updateHealthUI() {
    const h = state.health;
    if (!h) return;

    // Header Badges
    const workerBadge = document.getElementById('topWorkerStatus');
    if (workerBadge) {
        const status = (h.workerStatus || 'IDLE').toUpperCase();
        workerBadge.innerHTML = `<span class="dot ${status === 'RUNNING' ? 'pulse' : (status === 'OFFLINE' ? 'danger' : '')}"></span> Worker: ${status}`;
    }

    const qdrantBadge = document.getElementById('topQdrantStatus');
    if (qdrantBadge) {
        const qdStatus = h.services?.qdrant?.status === 'connected';
        qdrantBadge.innerHTML = `<span class="dot ${qdStatus ? '' : 'danger'}"></span> Qdrant: ${qdStatus ? 'Ready' : 'Offline'}`;
    }

    const mongoBadge = document.getElementById('topMongoStatus');
    if (mongoBadge) {
        const mgStatus = h.services?.mongodb?.status === 'connected';
        mongoBadge.innerHTML = `<span class="dot ${mgStatus ? '' : 'danger'}"></span> MongoDB: ${mgStatus ? 'Online' : 'Offline'}`;
    }

    // Dashboard Telemetry
    const dashWorker = document.getElementById('dashWorkerStatus');
    if (dashWorker) dashWorker.innerText = (h.workerStatus || 'IDLE').toUpperCase();

    const dashConcurrency = document.getElementById('dashConcurrency');
    if (dashConcurrency) dashConcurrency.innerText = `Concurrency: ${h.queueSummary?.concurrency || 2} Workers`;

    const dashActiveJobs = document.getElementById('dashActiveJobs');
    if (dashActiveJobs) dashActiveJobs.innerText = h.queueSummary?.activeJobs || 0;

    const dashWaitingJobs = document.getElementById('dashWaitingJobs');
    if (dashWaitingJobs) dashWaitingJobs.innerText = `${h.queueSummary?.waitingJobs || 0} queued`;

    const dashCompletedJobs = document.getElementById('dashCompletedJobs');
    if (dashCompletedJobs) dashCompletedJobs.innerText = h.queueSummary?.completedJobs || 0;

    const dashFailedJobs = document.getElementById('dashFailedJobs');
    if (dashFailedJobs) dashFailedJobs.innerText = `${h.queueSummary?.failedJobs || 0} failed`;

    // Latency Rows
    const setLatency = (id, latency, status) => {
        const el = document.getElementById(id);
        if (el) {
            el.innerText = latency >= 0 ? `${latency} ms` : (status || 'offline');
            el.style.color = status === 'connected' ? 'var(--accent)' : 'var(--danger)';
        }
    };
    setLatency('latMongo', h.services?.mongodb?.latencyMs, h.services?.mongodb?.status);
    setLatency('latQdrant', h.services?.qdrant?.latencyMs, h.services?.qdrant?.status);
    setLatency('latLlama', h.services?.llamaCpp?.latencyMs, h.services?.llamaCpp?.status);
    setLatency('latStorage', h.services?.localStorage?.latencyMs, h.services?.localStorage?.status);
}

function updateQueueBadges() {
    const q = state.queue;
    if (!q) return;
    const badge = document.getElementById('navQueueBadge');
    if (badge) {
        const totalPending = (q.totalQueued || 0) + (q.activeJobs?.length || 0);
        badge.innerText = totalPending > 0 ? totalPending : '0';
    }
}

// ==========================================
// Real-Time SSE Streams
// ==========================================
function initSSEStreams() {
    // 1. Queue Stream
    try {
        const queueSource = new EventSource('/queue/stream');
        queueSource.addEventListener('initial_state', (e) => {
            const data = JSON.parse(e.data);
            if (data.status) {
                state.queue = data.status;
                updateQueueBadges();
                if (state.activeTab === 'queue') renderQueueView();
            }
        });
        queueSource.addEventListener('progress', (e) => {
            const payload = JSON.parse(e.data);
            handleJobProgress(payload);
        });
        queueSource.addEventListener('queue_update', () => {
            fetchQueue();
            fetchHealth();
        });
        queueSource.addEventListener('worker_status', () => {
            fetchHealth();
        });
        queueSource.addEventListener('storage_updated', () => {
            fetchStorageTree();
            fetchAnalytics();
        });
    } catch (err) {
        console.warn('Queue SSE connection error:', err);
    }

    // 2. Logs Stream
    try {
        const logsSource = new EventSource('/logs/stream');
        logsSource.addEventListener('initial_logs', (e) => {
            const data = JSON.parse(e.data);
            if (data.logs) {
                state.logs = data.logs;
                renderLogs();
            }
        });
        logsSource.addEventListener('log', (e) => {
            const log = JSON.parse(e.data);
            state.logs.push(log);
            if (state.logs.length > 500) state.logs.shift();
            appendLogLine(log);
        });
    } catch (err) {
        console.warn('Logs SSE connection error:', err);
    }
}

function handleJobProgress(payload) {
    if (!state.queue) return;
    const docId = String(payload.documentId);
    const existing = (state.queue.activeJobs || []).find(j => String(j.documentId) === docId);
    if (existing) {
        existing.progress = payload.progress;
        existing.stage = payload.stage;
    }
    if (state.activeTab === 'queue') {
        renderQueueView();
    }
}

// ==========================================
// Storage Explorer Tree Component
// ==========================================
function renderStorageTree() {
    const container = document.getElementById('storageTreeContainer');
    if (!container) return;

    if (!state.storageTree || state.storageTree.length === 0) {
        container.innerHTML = `
            <div style="padding: 30px; text-align: center; color: var(--text-muted);">
                <p>📂 No documents discovered in <code>edumate/storage/</code>.</p>
                <button onclick="triggerStorageSync()" class="btn btn-primary" style="margin-top: 14px;">🔄 Sync Storage Now</button>
            </div>`;
        return;
    }

    let html = '';
    const renderNode = (node, depth = 0) => {
        const isFolder = node.type === 'folder';
        const indent = depth * 22;

        if (isFolder) {
            const isExpanded = state.expandedFolders.has(node.name);
            html += `
                <div class="tree-node folder" onclick="toggleFolder('${escapeQuotes(node.name)}')">
                    <span class="tree-indent" style="width: ${indent}px;"></span>
                    <span>${isExpanded ? '📂' : '📁'}</span>
                    <span>${escapeHtml(node.name)}</span>
                    <span class="node-meta">
                        <span>${node.fileCount || 0} files</span>
                        <span>${formatBytes(node.totalSize)}</span>
                    </span>
                </div>`;

            if (isExpanded && node.children) {
                node.children.forEach(child => renderNode(child, depth + 1));
            }
        } else {
            // File
            const query = (state.storageFilter || '').toLowerCase();
            if (query && !node.name.toLowerCase().includes(query)) return;

            const statusClass = `tag-${node.embeddingStatus || 'unindexed'}`;
            const docId = node.documentId ? `'${node.documentId}'` : 'null';

            html += `
                <div class="tree-node file">
                    <span class="tree-indent" style="width: ${indent}px;"></span>
                    <span>📄</span>
                    <span style="font-weight: 500;">${escapeHtml(node.name)}</span>
                    <span class="node-meta">
                        <span class="tag-status ${statusClass}">${node.embeddingStatus || 'unindexed'}</span>
                        <span>${formatBytes(node.size)}</span>
                        ${node.documentId ? `
                            <button class="btn btn-sm" onclick="openChunkDrawer(${docId}, '${escapeQuotes(node.name)}')">🔍 Chunks</button>
                            <button class="btn btn-sm btn-primary" onclick="enqueueSingleDoc(${docId})">⚡ Enqueue</button>
                        ` : `
                            <button class="btn btn-sm btn-accent" onclick="triggerStorageSync()">Register</button>
                        `}
                    </span>
                </div>`;
        }
    };

    state.storageTree.forEach(rootItem => renderNode(rootItem, 0));
    container.innerHTML = html;
}

function toggleFolder(folderName) {
    if (state.expandedFolders.has(folderName)) {
        state.expandedFolders.delete(folderName);
    } else {
        state.expandedFolders.add(folderName);
    }
    renderStorageTree();
}

function filterStorageTree(val) {
    state.storageFilter = val;
    renderStorageTree();
}

// ==========================================
// Upload Manager
// ==========================================
function initUploadZone() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleFileUpload(fileInput.files[0]);
        }
    });
}

async function handleFileUpload(file) {
    const statusBox = document.getElementById('uploadStatus');
    const categorySelect = document.getElementById('uploadCategory');
    const category = categorySelect ? categorySelect.value : 'general';

    if (statusBox) {
        statusBox.style.display = 'block';
        statusBox.innerHTML = `⏳ Uploading <strong>${escapeHtml(file.name)}</strong> (${formatBytes(file.size)}) to <code>[${category}]</code>...`;
    }

    const formData = new FormData();
    formData.append('document', file);
    formData.append('category', category);

    try {
        const res = await fetch('/upload', { method: 'POST', body: formData });
        const json = await res.json();
        if (json.success) {
            if (statusBox) {
                statusBox.innerHTML = `✅ Successfully uploaded and queued <strong>${escapeHtml(file.name)}</strong>!`;
                statusBox.style.color = 'var(--accent)';
            }
            fetchStorageTree();
            fetchQueue();
            fetchAnalytics();
        } else {
            if (statusBox) {
                statusBox.innerHTML = `❌ Upload failed: ${json.message}`;
                statusBox.style.color = 'var(--danger)';
            }
        }
    } catch (err) {
        if (statusBox) {
            statusBox.innerHTML = `❌ Network error: ${err.message}`;
            statusBox.style.color = 'var(--danger)';
        }
    }
}

// ==========================================
// Queue Monitor View
// ==========================================
function renderQueueView() {
    const activeContainer = document.getElementById('activeJobsContainer');
    const queueList = document.getElementById('queuedDocsList');
    const q = state.queue;

    if (!q) return;

    // Active Jobs
    if (activeContainer) {
        if (!q.activeJobs || q.activeJobs.length === 0) {
            activeContainer.innerHTML = `
                <div style="padding: 24px; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: 10px; border: 1px solid var(--border);">
                    <p>☕ Worker pool is currently idle. No jobs processing.</p>
                </div>`;
        } else {
            activeContainer.innerHTML = q.activeJobs.map(job => `
                <div class="queue-card">
                    <div class="queue-card-top">
                        <span style="font-weight: 700; color: var(--primary);">⚡ ${escapeHtml(job.originalName || 'Document')}</span>
                        <span class="tag-status tag-processing">Processing (${job.progress || 0}%)</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(job.stage || 'Working')}</div>
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${Math.max(5, job.progress || 0)}%;"></div>
                    </div>
                    <div style="display: flex; justify-content: flex-end; gap: 8px;">
                        <button class="btn btn-sm" onclick="pauseJob('${job.documentId}')">⏸ Pause</button>
                        <button class="btn btn-sm btn-danger" onclick="cancelJob('${job.documentId}')">⏹ Cancel</button>
                    </div>
                </div>
            `).join('');
        }
    }

    // Queued Documents
    if (queueList) {
        if (!q.queuedDocuments || q.queuedDocuments.length === 0) {
            queueList.innerHTML = `
                <div style="padding: 16px; text-align: center; color: var(--text-muted);">
                    <p>Queue is empty. All documents are up to date.</p>
                </div>`;
        } else {
            queueList.innerHTML = q.queuedDocuments.map((doc, idx) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border); margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-family: var(--font-mono); color: var(--text-dim); font-size: 0.8rem;">#${idx + 1}</span>
                        <span style="font-size: 0.85rem; font-weight: 600;">${escapeHtml(doc.originalName)}</span>
                        <span class="tag-status tag-queued">${doc.category || 'General'}</span>
                    </div>
                    <button class="btn btn-sm btn-danger" onclick="cancelJob('${doc._id}')">Remove</button>
                </div>
            `).join('');
        }
    }
}

// ==========================================
// Chunk Inspector Drawer
// ==========================================
async function openChunkDrawer(docId, fileName) {
    state.selectedDocumentId = docId;
    const overlay = document.getElementById('drawerOverlay');
    const drawer = document.getElementById('chunkDrawer');
    const titleEl = document.getElementById('drawerDocTitle');
    const bodyEl = document.getElementById('drawerBody');

    if (titleEl) titleEl.innerText = fileName || 'Document Chunks';
    if (overlay) overlay.style.display = 'block';
    if (drawer) drawer.style.display = 'flex';
    if (bodyEl) bodyEl.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 30px;">⏳ Loading document chunks & vector status...</p>';

    try {
        const res = await fetch(`/chunks/${docId}`);
        const json = await res.json();
        if (json.success && json.data) {
            state.selectedDocChunks = json.data;
            renderChunkDrawerContent(json.data);
        } else {
            if (bodyEl) bodyEl.innerHTML = `<p style="color: var(--danger); padding: 20px;">Could not load chunks: ${json.message}</p>`;
        }
    } catch (err) {
        if (bodyEl) bodyEl.innerHTML = `<p style="color: var(--danger); padding: 20px;">Network error: ${err.message}</p>`;
    }
}

function renderChunkDrawerContent(data) {
    const bodyEl = document.getElementById('drawerBody');
    if (!bodyEl) return;

    const chunks = data.chunks || [];
    if (chunks.length === 0) {
        bodyEl.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--text-muted);">
                <p>No chunk files generated yet for this document.</p>
                <button class="btn btn-primary" style="margin-top: 12px;" onclick="enqueueSingleDoc('${state.selectedDocumentId}'); closeChunkDrawer();">⚡ Enqueue for Chunking</button>
            </div>`;
        return;
    }

    bodyEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border);">
            <div>
                <span style="font-weight: 700; font-size: 0.9rem;">Total Chunks: ${chunks.length}</span>
                <span style="font-size: 0.78rem; color: var(--text-dim); margin-left: 10px;">Embedded: ${data.chunkStats?.embeddedChunks || chunks.length}</span>
            </div>
            <button class="btn btn-sm btn-primary" onclick="downloadChunkJson()">📥 Export JSON</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 12px;">
            ${chunks.map((c, i) => `
                <div class="chunk-item">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700; color: var(--primary); font-size: 0.82rem;">Chunk #${i + 1} &bull; Page ${c.metadata?.pageNumber || c.pageNumber || 1}</span>
                        <span style="font-size: 0.75rem; color: var(--text-dim);">${c.tokenCount || c.text?.split(/\\s+/).length || 0} tokens</span>
                    </div>
                    <div class="chunk-text">${escapeHtml(c.text || c.content || '')}</div>
                    <div style="display: flex; justify-content: flex-end;">
                        <button class="btn btn-sm" onclick="copyToClipboard('${escapeQuotes(c.text || c.content || '')}')">📋 Copy Chunk</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function closeChunkDrawer() {
    const overlay = document.getElementById('drawerOverlay');
    const drawer = document.getElementById('chunkDrawer');
    if (overlay) overlay.style.display = 'none';
    if (drawer) drawer.style.display = 'none';
}

function downloadChunkJson() {
    if (!state.selectedDocChunks) return;
    const blob = new Blob([JSON.stringify(state.selectedDocChunks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document_${state.selectedDocumentId}_chunks.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// ==========================================
// Runtime Logs Console
// ==========================================
function renderLogs() {
    const term = document.getElementById('logStreamTerminal');
    if (!term) return;

    term.innerHTML = '';
    const filtered = state.logs.filter(log => {
        if (state.logFilter !== 'ALL' && log.level !== state.logFilter) return false;
        if (state.logSearch && !log.message.toLowerCase().includes(state.logSearch.toLowerCase())) return false;
        return true;
    });

    filtered.forEach(appendLogLine);
    scrollLogsToBottom();
}

function appendLogLine(log) {
    const term = document.getElementById('logStreamTerminal');
    if (!term) return;

    if (state.logFilter !== 'ALL' && log.level !== state.logFilter) return;
    if (state.logSearch && !log.message.toLowerCase().includes(state.logSearch.toLowerCase())) return;

    const time = log.timestamp ? log.timestamp.split('T')[1].split('.')[0] : new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.className = 'log-line';
    div.innerHTML = `
        <span class="log-time">[${time}]</span>
        <span class="log-lvl lvl-${log.level || 'INFO'}">${log.level || 'INFO'}</span>
        <span style="color: var(--text-main);">${escapeHtml(log.message)}</span>
    `;
    term.appendChild(div);
    scrollLogsToBottom();
}

function setLogFilter(level) {
    state.logFilter = level;
    document.querySelectorAll('.filter-chip').forEach(el => {
        el.classList.toggle('active', el.innerText === level);
    });
    renderLogs();
}

function filterLogSearch(query) {
    state.logSearch = query;
    renderLogs();
}

function scrollLogsToBottom() {
    const term = document.getElementById('logStreamTerminal');
    if (term) term.scrollTop = term.scrollHeight;
}

async function clearLogs() {
    await fetch('/queue/logs/clear', { method: 'POST' });
    state.logs = [];
    renderLogs();
}

function copyAllLogs() {
    const text = state.logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
    copyToClipboard(text);
}

function exportLogsFile() {
    const text = state.logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chunking_runtime_logs_${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
}

// ==========================================
// Analytics UI Update
// ==========================================
function updateAnalyticsUI() {
    const a = state.analytics;
    if (!a) return;

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    setVal('anTotalDocs', a.totalDocuments || 0);
    setVal('anIndexedDocs', a.indexedDocuments || 0);
    setVal('anTotalChunks', a.totalChunks || 0);
    setVal('anTotalChunkFiles', a.totalChunkFiles || 0);
    setVal('anStorageSize', formatBytes(a.totalChunkSizeBytes || 0));
}

// ==========================================
// REST Operations & Global Actions
// ==========================================
async function startWorker() {
    await fetch('/worker/start', { method: 'POST' });
    fetchHealth();
}

async function pauseWorker() {
    await fetch('/queue/pause', { method: 'POST' });
    fetchHealth();
}

async function resumeWorker() {
    await fetch('/queue/resume', { method: 'POST' });
    fetchHealth();
}

async function restartWorker() {
    await fetch('/worker/restart', { method: 'POST' });
    fetchHealth();
    fetchQueue();
}

async function retryFailedJobs() {
    await fetch('/queue/retry-all', { method: 'POST' });
    fetchQueue();
    fetchHealth();
}

async function reindexAll() {
    if (confirm('Re-index and chunk all pending/active documents?')) {
        await fetch('/qdrant/reindex', { method: 'POST' });
        fetchQueue();
    }
}

async function clearQueue() {
    if (confirm('Clear all waiting documents from the processing queue?')) {
        await fetch('/queue/clear', { method: 'POST' });
        fetchQueue();
    }
}

async function triggerStorageSync() {
    const syncBtn = document.getElementById('btnStorageSync');
    if (syncBtn) syncBtn.innerText = '⏳ Syncing...';
    try {
        const res = await fetch('/storage/scan-sync', { method: 'POST' });
        const json = await res.json();
        if (json.success) {
            fetchStorageTree();
            fetchAnalytics();
        }
    } finally {
        if (syncBtn) syncBtn.innerText = '🔄 Sync Storage';
    }
}

async function enqueueSingleDoc(docId) {
    await fetch('/queue/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [docId], forceRechunk: true })
    });
    fetchQueue();
    fetchStorageTree();
}

async function pauseJob(docId) {
    await fetch(`/queue/pause/${docId}`, { method: 'POST' });
    fetchQueue();
}

async function cancelJob(docId) {
    await fetch(`/queue/cancel/${docId}`, { method: 'POST' });
    fetchQueue();
    fetchStorageTree();
}

// ==========================================
// Utilities
// ==========================================
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeQuotes(str) {
    return String(str || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied to clipboard!');
    }).catch(() => {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        alert('Copied to clipboard!');
    });
}
