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
    expandedFolders: new Set(),
    selectedStoragePaths: new Set(),
    categories: [],
    stagedFiles: [], // Array of { file, relPath, name, size, type }
    trackedUploads: [], // Array of { id, name, size, category, status, stage, progress, isImage, error }
    logs: [],
    logFilter: 'ALL',
    logSearch: '',
    selectedDocumentId: null,
    selectedDocChunks: null,
    analytics: null,
    sseConnected: false,
    inputModalCallback: null
};

function isImageExtension(name) {
    const ext = String(name || '').toLowerCase();
    return ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.webp');
}

function getFileIcon(name) {
    if (isImageExtension(name)) return '🖼️';
    const ext = String(name || '').toLowerCase();
    if (ext.endsWith('.pdf')) return '📑';
    if (ext.endsWith('.docx') || ext.endsWith('.doc')) return '📝';
    return '📄';
}

// ==========================================
// Initialization & Navigation
// ==========================================
function bootStudioApp() {
    initNavigation();
    initUploadZone();
    initGlobalEvents();
    initSSEStreams();
    startPeriodicRefresh(15000);
    fetchInitialData();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootStudioApp);
} else {
    bootStudioApp();
}

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

    if (tabId === 'dashboard') {
        fetchHealth();
        fetchQueue();
        fetchAnalytics();
    }
    if (tabId === 'storage') {
        fetchStorageTree();
    }
    if (tabId === 'upload') {
        fetchCategories();
    }
    if (tabId === 'queue') {
        fetchQueue();
        renderQueueView();
    }
    if (tabId === 'analytics') {
        fetchAnalytics();
    }
    if (tabId === 'logs') {
        scrollLogsToBottom();
    }
}

function initGlobalEvents() {
    // Dismiss context menu on click anywhere outside
    document.addEventListener('click', () => {
        hideContextMenu();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideContextMenu();
            closeChunkDrawer();
            closeInputModal();
            closePreviewModal();
        }
    });
}

// ==========================================
// Initial & Periodic Data Fetching
// ==========================================
let periodicRefreshTimer = null;

function startPeriodicRefresh(intervalMs = 15000) {
    stopPeriodicRefresh();
    periodicRefreshTimer = setInterval(() => {
        if (document.visibilityState === 'visible') {
            fetchHealth();
            fetchQueue();
            fetchAnalytics();
        }
    }, intervalMs);
}

function stopPeriodicRefresh() {
    if (periodicRefreshTimer) {
        clearInterval(periodicRefreshTimer);
        periodicRefreshTimer = null;
    }
}

// Window lifecycle listeners for clean timer teardown
window.addEventListener('beforeunload', stopPeriodicRefresh);
window.addEventListener('pagehide', stopPeriodicRefresh);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        fetchHealth();
        fetchQueue();
        fetchAnalytics();
    }
});

async function fetchInitialData() {
    await Promise.allSettled([
        fetchHealth(),
        fetchCategories(),
        fetchQueue(),
        fetchStorageTree(),
        fetchAnalytics()
    ]);
}

async function fetchCategories() {
    try {
        const res = await fetch('/storage/categories');
        const json = await res.json();
        if (json.success && Array.isArray(json.data.categories)) {
            state.categories = json.data.categories;
            populateCategoryDropdown();
        }
    } catch (err) {
        console.warn('Failed to fetch dynamic categories:', err);
    }
}

function populateCategoryDropdown(selectedCategory = '') {
    const select = document.getElementById('uploadCategory');
    if (!select) return;

    const previousVal = selectedCategory || select.value || (state.categories[0] || 'general');
    select.innerHTML = '';

    // Option for Root/General if available or dynamically listed
    const categories = state.categories.length > 0 ? state.categories : ['general'];

    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        if (cat === previousVal) opt.selected = true;
        select.appendChild(opt);
    });

    // Add option to create a custom category/folder
    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '➕ Create New Category Folder...';
    select.appendChild(newOpt);

    handleCategoryChange(select.value);
}

function handleCategoryChange(val) {
    const customContainer = document.getElementById('customCategoryContainer');
    if (customContainer) {
        customContainer.style.display = val === '__new__' ? 'block' : 'none';
        if (val === '__new__') {
            const input = document.getElementById('customCategoryInput');
            if (input) input.focus();
        }
    }
}

async function fetchHealth(force = false) {
    const probeBtn = document.querySelector('button[onclick*="fetchHealth"]');
    if (probeBtn && force) probeBtn.innerText = '⏳ Probing...';

    try {
        const url = force ? '/health?force=true' : '/health';
        const res = await fetch(url);
        const json = await res.json();
        if (json.success) {
            state.health = json.data;
            updateHealthUI();
        }
    } catch (err) {
        console.error('Health fetch error:', err);
    } finally {
        if (probeBtn && force) probeBtn.innerText = '🔄 Probe';
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

    const concurrency = h.queueSummary?.concurrency || 2;
    const activeJobs = h.queueSummary?.activeJobs || 0;
    const rawStatus = (h.workerStatus || 'idle').toUpperCase();
    const utilizationPct = h.queueSummary?.workerUtilizationPct !== undefined 
        ? h.queueSummary.workerUtilizationPct 
        : (concurrency > 0 ? Math.round((activeJobs / concurrency) * 100) : 0);

    // Header Badges
    const workerBadge = document.getElementById('topWorkerStatus');
    if (workerBadge) {
        const statusText = rawStatus === 'RUNNING' 
            ? `RUNNING (${utilizationPct}%)` 
            : (rawStatus === 'PAUSED' || rawStatus === 'OFFLINE' ? `PAUSED (0%)` : `IDLE (0%)`);
        const pulseClass = rawStatus === 'RUNNING' ? 'pulse' : (rawStatus === 'OFFLINE' ? 'danger' : '');
        workerBadge.innerHTML = `<span class="dot ${pulseClass}"></span> Worker: ${statusText}`;
    }

    const qdrantBadge = document.getElementById('topQdrantStatus');
    if (qdrantBadge) {
        const qdStatus = h.services?.qdrant?.status === 'connected' || h.services?.qdrant === 'connected';
        qdrantBadge.innerHTML = `<span class="dot ${qdStatus ? '' : 'danger'}"></span> Qdrant: ${qdStatus ? 'Ready' : 'Offline'}`;
    }

    const mongoBadge = document.getElementById('topMongoStatus');
    if (mongoBadge) {
        const mgStatus = h.services?.mongodb?.status === 'connected' || h.services?.mongodb === 'connected';
        mongoBadge.innerHTML = `<span class="dot ${mgStatus ? '' : 'danger'}"></span> MongoDB: ${mgStatus ? 'Online' : 'Offline'}`;
    }

    // Dashboard Telemetry
    const dashWorker = document.getElementById('dashWorkerStatus');
    if (dashWorker) {
        const tagClass = rawStatus === 'RUNNING' ? (utilizationPct > 0 ? 'tag-processing' : 'tag-completed') : (rawStatus === 'PAUSED' ? 'tag-queued' : 'tag-failed');
        dashWorker.innerText = `${rawStatus} · ${utilizationPct}%`;
        dashWorker.className = `tag-status ${tagClass}`;
    }

    const dashConcurrency = document.getElementById('dashConcurrency');
    if (dashConcurrency) {
        dashConcurrency.innerText = `${concurrency} Workers (${activeJobs} active)`;
    }

    const dashWorkerSubtext = document.getElementById('dashWorkerSubtext');
    if (dashWorkerSubtext) {
        dashWorkerSubtext.innerText = `Pool Utilization: ${utilizationPct}%`;
    }

    // Service Latency Rows
    const setLat = (id, s) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (!s) { el.innerText = 'Offline'; el.style.color = 'var(--danger)'; return; }
        const statusVal = typeof s === 'string' ? s : (s.status || 'offline');
        const latency = typeof s === 'object' && s.latencyMs !== undefined ? s.latencyMs : (s.latency !== undefined ? s.latency : 0);
        const isOk = statusVal === 'connected' || statusVal === 'ready' || statusVal === 'online';
        const isStandby = statusVal.includes('fallback') || statusVal === 'standby' || statusVal === 'idle';

        if (isOk) {
            el.innerText = `Online (${latency >= 0 ? latency : 0}ms)`;
            el.style.color = 'var(--accent)';
        } else if (isStandby) {
            el.innerText = `Standby (${latency >= 0 ? latency : 0}ms)`;
            el.style.color = 'var(--warning, #eab308)';
        } else {
            el.innerText = `Degraded (${latency >= 0 ? latency : 0}ms)`;
            el.style.color = 'var(--danger)';
        }
    };

    setLat('latMongo', h.services?.mongodb);
    setLat('latQdrant', h.services?.qdrant);
    setLat('latLlama', h.services?.llamaCpp);
    setLat('latStorage', h.services?.localStorage || h.services?.storage);

    // Dashboard Metrics
    const dashActive = document.getElementById('dashActiveJobs');
    if (dashActive) dashActive.innerText = activeJobs;

    const dashWaiting = document.getElementById('dashWaitingJobs');
    if (dashWaiting) dashWaiting.innerText = `${h.queueSummary?.waitingJobs || 0} queued in pipeline`;

    const dashStorageDocs = document.getElementById('dashStorageDocs');
    if (dashStorageDocs) dashStorageDocs.innerText = state.analytics?.storageDocuments !== undefined ? state.analytics.storageDocuments : (state.storageTree ? state.storageTree.length : 0);

    const dashHistoricalDocs = document.getElementById('dashHistoricalDocs');
    if (dashHistoricalDocs) dashHistoricalDocs.innerText = `${state.analytics?.mongoTotalDocuments ?? h.queueSummary?.totalDocuments ?? 0} historical in DB`;

    const dashStorageSize = document.getElementById('dashStorageSize');
    if (dashStorageSize) dashStorageSize.innerText = state.analytics?.storageSizeFormatted || formatBytes(state.analytics?.totalStorageSizeBytes || 0);

    const dashLocalChunks = document.getElementById('dashLocalChunks');
    if (dashLocalChunks) dashLocalChunks.innerText = `${state.analytics?.totalChunks || 0} Local Chunks`;
}

function updateQueueBadges() {
    const q = state.queue;
    if (!q) return;

    const navBadge = document.getElementById('navQueueBadge');
    if (navBadge) {
        const count = (q.stats?.queued || 0) + (q.stats?.processing || 0);
        navBadge.innerText = count;
        navBadge.style.display = count > 0 ? 'inline-block' : 'none';
    }

    // Update worker status in real-time
    const rawStatus = (q.workerStatus || (q.isPaused ? 'PAUSED' : 'RUNNING')).toUpperCase();
    const concurrency = q.concurrency || 2;
    const activeWorkers = q.activeWorkers?.length || q.activeJobs?.length || 0;
    const utilizationPct = q.workerUtilizationPct !== undefined 
        ? q.workerUtilizationPct 
        : (concurrency > 0 ? Math.round((activeWorkers / concurrency) * 100) : 0);

    const workerBadge = document.getElementById('topWorkerStatus');
    if (workerBadge) {
        const statusText = rawStatus === 'RUNNING' 
            ? `RUNNING (${utilizationPct}%)` 
            : (rawStatus === 'PAUSED' ? `PAUSED (0%)` : `STOPPED (0%)`);
        const pulseClass = rawStatus === 'RUNNING' && utilizationPct > 0 ? 'pulse' : (rawStatus === 'STOPPED' || rawStatus === 'OFFLINE' ? 'danger' : '');
        workerBadge.innerHTML = `<span class="dot ${pulseClass}"></span> Worker: ${statusText}`;
    }

    const dashWorker = document.getElementById('dashWorkerStatus');
    if (dashWorker) {
        const tagClass = rawStatus === 'RUNNING' ? (utilizationPct > 0 ? 'tag-processing' : 'tag-completed') : (rawStatus === 'PAUSED' ? 'tag-queued' : 'tag-failed');
        dashWorker.innerText = `${rawStatus} · ${utilizationPct}%`;
        dashWorker.className = `tag-status ${tagClass}`;
    }

    const dashConcurrency = document.getElementById('dashConcurrency');
    if (dashConcurrency) {
        dashConcurrency.innerText = `${concurrency} Workers (${activeWorkers} active)`;
    }

    const dashWorkerSubtext = document.getElementById('dashWorkerSubtext');
    if (dashWorkerSubtext) {
        dashWorkerSubtext.innerText = `Pool Utilization: ${utilizationPct}%`;
    }

    const dashActive = document.getElementById('dashActiveJobs');
    if (dashActive) dashActive.innerText = activeWorkers;

    const dashWaiting = document.getElementById('dashWaitingJobs');
    if (dashWaiting) dashWaiting.innerText = `${q.stats?.queued || q.totalQueued || 0} queued in pipeline`;

    if (state.analytics) {
        const dashStorageDocs = document.getElementById('dashStorageDocs');
        if (dashStorageDocs) dashStorageDocs.innerText = state.analytics.storageDocuments ?? 0;

        const dashHistoricalDocs = document.getElementById('dashHistoricalDocs');
        if (dashHistoricalDocs) dashHistoricalDocs.innerText = `${state.analytics.mongoTotalDocuments ?? 0} historical in DB`;

        const dashStorageSize = document.getElementById('dashStorageSize');
        if (dashStorageSize) dashStorageSize.innerText = state.analytics.storageSizeFormatted || formatBytes(state.analytics.totalStorageSizeBytes || 0);

        const dashLocalChunks = document.getElementById('dashLocalChunks');
        if (dashLocalChunks) dashLocalChunks.innerText = `${state.analytics.totalChunks || 0} Local Chunks`;
    }
}

// ==========================================
// SSE Live Streams
// ==========================================
function initSSEStreams() {
    try {
        const queueSource = new EventSource('/queue/stream');
        queueSource.addEventListener('open', () => {
            state.sseConnected = true;
        });
        queueSource.addEventListener('progress', (e) => {
            const payload = JSON.parse(e.data);
            handleJobProgress(payload);
        });
        queueSource.addEventListener('queue_update', () => {
            fetchQueue();
            fetchAnalytics();
            fetchHealth();
            if (state.activeTab === 'storage') fetchStorageTree();
        });
        queueSource.addEventListener('worker_status', () => {
            fetchHealth();
            fetchQueue();
            fetchAnalytics();
        });
    } catch (err) {
        console.warn('Queue SSE connection error:', err);
    }

    try {
        const logsSource = new EventSource('/logs/stream');
        const handleInitLogs = (e) => {
            try {
                const data = JSON.parse(e.data);
                state.logs = data.logs || [];
                renderLogs();
            } catch (_) {}
        };
        logsSource.addEventListener('init', handleInitLogs);
        logsSource.addEventListener('initial_logs', handleInitLogs);
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
    const docId = String(payload.documentId || '');
    if (state.queue) {
        const existing = (state.queue.activeJobs || []).find(j => String(j.documentId) === docId);
        if (existing) {
            existing.progress = payload.progress;
            existing.stage = payload.stage;
        }
    }

    // Update tracked uploads in Upload Studio
    if (state.trackedUploads && state.trackedUploads.length > 0) {
        const tracked = state.trackedUploads.find(u => String(u.id) === docId || u.name === payload.fileName);
        if (tracked) {
            tracked.progress = payload.progress !== undefined ? payload.progress : tracked.progress;
            tracked.stage = payload.stage || tracked.stage;
            const stageLower = String(payload.stage || '').toLowerCase();
            if (payload.status === 'completed' || payload.progress === 100) {
                tracked.status = 'completed';
                tracked.progress = 100;
            } else if (payload.status === 'failed') {
                tracked.status = 'failed';
                tracked.error = payload.error || payload.stage || 'Processing failed';
            } else if (stageLower.includes('ocr') || (tracked.isImage && stageLower.includes('extract'))) {
                tracked.status = 'ocr_processing';
            } else if (stageLower.includes('chunk') || stageLower.includes('clean')) {
                tracked.status = 'chunking';
            } else if (stageLower.includes('embed') || stageLower.includes('index') || stageLower.includes('saving')) {
                tracked.status = 'indexing';
            } else {
                tracked.status = 'processing';
            }
            renderUploadPipelineTracker();
        }
    }

    // Refresh queue & analytics immediately upon job completion or failure
    if (payload.status === 'completed' || payload.status === 'failed') {
        fetchQueue();
        fetchAnalytics();
        fetchHealth();
        if (state.activeTab === 'storage') fetchStorageTree();
    }
    if (state.activeTab === 'queue') {
        renderQueueView();
    }
}

// ==========================================
// Storage Explorer Tree Component & Context Menu
// ==========================================
function renderStorageTree() {
    const container = document.getElementById('storageTreeContainer');
    if (!container) return;

    updateStorageSelectionBar();

    if (!state.storageTree || state.storageTree.length === 0) {
        container.innerHTML = `
            <div style="padding: 40px; text-align: center; color: var(--text-muted);" oncontextmenu="handleEmptyContextMenu(event)">
                <p style="font-size: 1.1rem; margin-bottom: 8px;">📂 No documents discovered in <code>edumate/storage/file_explorer/</code>.</p>
                <p style="font-size: 0.82rem; margin-bottom: 16px;">Right-click anywhere or click below to start uploading knowledge documents.</p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button onclick="promptNewFolder('')" class="btn btn-sm">➕ Create Folder</button>
                    <button onclick="switchTab('upload')" class="btn btn-sm btn-primary">⬆️ Upload Documents</button>
                    <button onclick="triggerStorageSync()" class="btn btn-sm btn-accent">🔄 Sync Storage</button>
                </div>
            </div>`;
        return;
    }

    let html = '';
    const renderNode = (node, depth = 0) => {
        const isFolder = node.type === 'folder';
        const indent = depth * 20;
        const nodePath = node.path || node.name;
        const isSelected = state.selectedStoragePaths.has(nodePath);

        if (isFolder) {
            const isExpanded = state.expandedFolders.has(nodePath);
            html += `
                <div class="tree-node folder ${isSelected ? 'selected' : ''}" 
                     data-path="${escapeQuotes(nodePath)}" 
                     data-type="folder"
                     onclick="handleTreeNodeClick(event, '${escapeQuotes(nodePath)}', 'folder')"
                     oncontextmenu="handleFolderContextMenu(event, '${escapeQuotes(nodePath)}')">
                    <span class="tree-indent" style="width: ${indent}px;"></span>
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleNodeSelection('${escapeQuotes(nodePath)}')" style="margin-right: 6px; cursor: pointer;">
                    <span>${isExpanded ? '📂' : '📁'}</span>
                    <span style="font-weight: 600;">${escapeHtml(node.name)}</span>
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
                <div class="tree-node file ${isSelected ? 'selected' : ''}" 
                     data-path="${escapeQuotes(nodePath)}" 
                     data-type="file"
                     data-docid="${node.documentId || ''}"
                     onclick="handleTreeNodeClick(event, '${escapeQuotes(nodePath)}', 'file')"
                     oncontextmenu="handleFileContextMenu(event, '${escapeQuotes(nodePath)}', ${docId}, '${escapeQuotes(node.name)}')">
                    <span class="tree-indent" style="width: ${indent}px;"></span>
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleNodeSelection('${escapeQuotes(nodePath)}')" style="margin-right: 6px; cursor: pointer;">
                    <span>${getFileIcon(node.name)}</span>
                    <span style="font-weight: 500;">${escapeHtml(node.name)}</span>
                    <span class="node-meta">
                        <span class="tag-status ${statusClass}">${node.embeddingStatus || 'unindexed'}</span>
                        <span>${formatBytes(node.size)}</span>
                        ${node.documentId ? `
                            <button class="btn btn-sm" onclick="event.stopPropagation(); openChunkDrawer(${docId}, '${escapeQuotes(node.name)}')">🔍 Chunks</button>
                            <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); enqueueSingleDoc(${docId})">⚡ Enqueue</button>
                        ` : `
                            <button class="btn btn-sm btn-accent" onclick="event.stopPropagation(); triggerStorageSync()">Register</button>
                        `}
                    </span>
                </div>`;
        }
    };

    state.storageTree.forEach(rootItem => renderNode(rootItem, 0));
    container.innerHTML = html;
}

function handleTreeNodeClick(event, path, type) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
        toggleNodeSelection(path);
        return;
    }

    if (type === 'folder') {
        toggleFolder(path);
    }
}

function toggleFolder(folderPath) {
    if (state.expandedFolders.has(folderPath)) {
        state.expandedFolders.delete(folderPath);
    } else {
        state.expandedFolders.add(folderPath);
    }
    renderStorageTree();
}

function filterStorageTree(val) {
    state.storageFilter = val;
    renderStorageTree();
}

// Multi-selection Handlers
function toggleNodeSelection(path) {
    if (state.selectedStoragePaths.has(path)) {
        state.selectedStoragePaths.delete(path);
    } else {
        state.selectedStoragePaths.add(path);
    }
    renderStorageTree();
}

function clearStorageSelection() {
    state.selectedStoragePaths.clear();
    renderStorageTree();
}

function updateStorageSelectionBar() {
    const bar = document.getElementById('storageSelectionBar');
    const text = document.getElementById('selectedCountText');
    const count = state.selectedStoragePaths.size;

    if (bar && text) {
        if (count > 0) {
            bar.style.display = 'flex';
            text.innerText = `Selected: ${count} item${count > 1 ? 's' : ''}`;
        } else {
            bar.style.display = 'none';
        }
    }
}

async function enqueueSelectedDocuments() {
    if (state.selectedStoragePaths.size === 0) return;
    const paths = Array.from(state.selectedStoragePaths);
    
    // Find matching document IDs from tree
    const docIds = [];
    const findIds = (nodes) => {
        for (const n of nodes) {
            if (paths.includes(n.path) && n.documentId) {
                docIds.push(n.documentId);
            }
            if (n.children) findIds(n.children);
        }
    };
    findIds(state.storageTree || []);

    if (docIds.length === 0) {
        alert('None of the selected items are registered database documents yet. Syncing storage first...');
        await triggerStorageSync();
        return;
    }

    await fetch('/queue/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: docIds, forceRechunk: true })
    });

    clearStorageSelection();
    fetchQueue();
    fetchStorageTree();
}

async function deleteSelectedDocuments() {
    if (state.selectedStoragePaths.size === 0) return;
    const count = state.selectedStoragePaths.size;
    if (!confirm(`Are you sure you want to delete ${count} selected item(s)? This will delete them from disk, database, and vector index.`)) {
        return;
    }

    const paths = Array.from(state.selectedStoragePaths);
    for (const p of paths) {
        if (p.includes('.')) {
            await fetch(`/storage/file?filePath=${encodeURIComponent(p)}`, { method: 'DELETE' });
        } else {
            await fetch(`/storage/folder?folderPath=${encodeURIComponent(p)}`, { method: 'DELETE' });
        }
    }

    clearStorageSelection();
    fetchStorageTree();
    fetchAnalytics();
    fetchCategories();
}

// ==========================================
// Context Menu System
// ==========================================
function hideContextMenu() {
    const menu = document.getElementById('contextMenu');
    if (menu) menu.style.display = 'none';
}

function showContextMenu(e, items = []) {
    e.preventDefault();
    e.stopPropagation();

    const menu = document.getElementById('contextMenu');
    if (!menu) return;

    menu.innerHTML = items.map(item => {
        if (item.separator) {
            return `<div class="context-menu-separator"></div>`;
        }
        return `
            <div class="context-menu-item ${item.danger ? 'danger' : ''}" onclick="${item.action}">
                <span class="context-menu-icon">${item.icon || '•'}</span>
                <span>${escapeHtml(item.label)}</span>
            </div>
        `;
    }).join('');

    menu.style.display = 'block';

    // Position menu within viewport bounds
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - (items.length * 35 + 20));

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
}

function handleEmptyContextMenu(e) {
    showContextMenu(e, [
        { label: 'New Folder', icon: '📁', action: "promptNewFolder(''); hideContextMenu();" },
        { label: 'Upload Files Here', icon: '📄', action: "openUploadForFolder(''); hideContextMenu();" },
        { label: 'Upload Folder Here', icon: '📂', action: "openUploadForDirectory(''); hideContextMenu();" },
        { separator: true },
        { label: 'Refresh Tree', icon: '🔄', action: "fetchStorageTree(); hideContextMenu();" },
        { label: 'Sync Storage with DB', icon: '⚡', action: "triggerStorageSync(); hideContextMenu();" }
    ]);
}

function handleFolderContextMenu(e, folderPath) {
    showContextMenu(e, [
        { label: 'Open / Expand', icon: '📂', action: `toggleFolder('${escapeQuotes(folderPath)}'); hideContextMenu();` },
        { label: 'Upload Files Here', icon: '📄', action: `openUploadForFolder('${escapeQuotes(folderPath)}'); hideContextMenu();` },
        { label: 'Upload Folder Here', icon: '📂', action: `openUploadForDirectory('${escapeQuotes(folderPath)}'); hideContextMenu();` },
        { label: 'New Subfolder', icon: '➕', action: `promptNewFolder('${escapeQuotes(folderPath)}'); hideContextMenu();` },
        { separator: true },
        { label: 'Re-index All in Folder', icon: '⚡', action: `reindexFolder('${escapeQuotes(folderPath)}'); hideContextMenu();` },
        { label: 'Rename Folder', icon: '✏️', action: `promptRenamePath('${escapeQuotes(folderPath)}', true); hideContextMenu();` },
        { label: 'Delete Folder', icon: '🗑️', danger: true, action: `deleteStorageFolder('${escapeQuotes(folderPath)}'); hideContextMenu();` },
        { separator: true },
        { label: 'Refresh', icon: '🔄', action: "fetchStorageTree(); hideContextMenu();" }
    ]);
}

function handleFileContextMenu(e, filePath, docId, fileName) {
    showContextMenu(e, [
        ...(docId ? [{ label: 'View Chunks', icon: '🔍', action: `openChunkDrawer('${docId}', '${escapeQuotes(fileName)}'); hideContextMenu();` }] : []),
        { label: 'Preview Content', icon: '📄', action: `previewStorageFile('${escapeQuotes(filePath)}'); hideContextMenu();` },
        { label: 'Download File', icon: '📥', action: `downloadStorageFile('${escapeQuotes(filePath)}'); hideContextMenu();` },
        { separator: true },
        ...(docId ? [{ label: 'Re-index Document', icon: '⚡', action: `enqueueSingleDoc('${docId}'); hideContextMenu();` }] : []),
        { label: 'Rename File', icon: '✏️', action: `promptRenamePath('${escapeQuotes(filePath)}', false); hideContextMenu();` },
        { label: 'Delete File', icon: '🗑️', danger: true, action: `deleteStorageFile('${escapeQuotes(filePath)}'); hideContextMenu();` }
    ]);
}

function openUploadForFolder(folderPath) {
    switchTab('upload');
    if (folderPath) {
        populateCategoryDropdown(folderPath);
    }
    document.getElementById('fileInput').click();
}

function openUploadForDirectory(folderPath) {
    switchTab('upload');
    if (folderPath) {
        populateCategoryDropdown(folderPath);
    }
    document.getElementById('folderInput').click();
}

async function reindexFolder(folderPath) {
    if (confirm(`Re-index all documents in folder "${folderPath}"?`)) {
        await fetch('/storage/chunk/folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath, force: true })
        });
        fetchQueue();
        fetchStorageTree();
    }
}

async function deleteStorageFolder(folderPath) {
    if (confirm(`Delete folder "${folderPath}" and purge all its documents from database and vector index?`)) {
        await fetch(`/storage/folder?folderPath=${encodeURIComponent(folderPath)}`, { method: 'DELETE' });
        fetchStorageTree();
        fetchAnalytics();
        fetchCategories();
    }
}

async function deleteStorageFile(filePath) {
    if (confirm(`Delete file "${filePath}"?`)) {
        await fetch(`/storage/file?filePath=${encodeURIComponent(filePath)}`, { method: 'DELETE' });
        fetchStorageTree();
        fetchAnalytics();
    }
}

function downloadStorageFile(filePath) {
    window.location.href = `/storage/file/download?path=${encodeURIComponent(filePath)}`;
}

async function previewStorageFile(filePath) {
    try {
        const res = await fetch(`/storage/file/preview?path=${encodeURIComponent(filePath)}`);
        const json = await res.json();
        if (json.success && json.data) {
            openPreviewModal(json.data);
        } else {
            alert(`Could not load preview: ${json.message}`);
        }
    } catch (err) {
        alert(`Preview error: ${err.message}`);
    }
}

function openPreviewModal(fileData) {
    const modal = document.getElementById('previewModal');
    const title = document.getElementById('previewModalTitle');
    const meta = document.getElementById('previewMetaDetails');
    const content = document.getElementById('previewTextContent');

    if (title) title.innerText = `Preview: ${fileData.fileName}`;
    if (meta) {
        meta.innerHTML = `
            <span>Path: <code>${escapeHtml(fileData.filePath)}</code></span> &bull; 
            <span>Size: ${formatBytes(fileData.size)}</span> &bull; 
            <span>Status: <strong class="tag-status tag-${fileData.embeddingStatus}">${fileData.embeddingStatus}</strong></span>
        `;
    }
    if (content) {
        content.innerText = fileData.textPreview || '(No text preview available for binary format)';
    }
    if (modal) modal.style.display = 'flex';
}

function closePreviewModal() {
    const modal = document.getElementById('previewModal');
    if (modal) modal.style.display = 'none';
}

// Modal Dialog Helpers
function promptNewFolder(parentPath = '') {
    openInputModal('Create New Folder', 'Folder name:', '', async (name) => {
        const clean = name.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        if (!clean) return;
        const targetPath = parentPath ? `${parentPath}/${clean}` : clean;
        await fetch('/storage/folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: targetPath })
        });
        fetchStorageTree();
        fetchCategories();
    });
}

function promptRenamePath(oldPath, isFolder = false) {
    const currentName = oldPath.split('/').pop();
    openInputModal(`Rename ${isFolder ? 'Folder' : 'File'}`, 'New name:', currentName, async (newName) => {
        const clean = newName.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
        if (!clean || clean === currentName) return;
        const parts = oldPath.split('/');
        parts.pop();
        const newPath = parts.length > 0 ? `${parts.join('/')}/${clean}` : clean;

        await fetch('/storage/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldPath, newPath })
        });
        fetchStorageTree();
        fetchCategories();
    });
}

function openInputModal(title, label, defaultValue, callback) {
    const modal = document.getElementById('inputModal');
    const titleEl = document.getElementById('inputModalTitle');
    const labelEl = document.getElementById('inputModalLabel');
    const fieldEl = document.getElementById('inputModalField');

    if (titleEl) titleEl.innerText = title;
    if (labelEl) labelEl.innerText = label;
    if (fieldEl) {
        fieldEl.value = defaultValue;
        setTimeout(() => fieldEl.focus(), 50);
    }
    state.inputModalCallback = callback;
    if (modal) modal.style.display = 'flex';
}

function closeInputModal() {
    const modal = document.getElementById('inputModal');
    if (modal) modal.style.display = 'none';
    state.inputModalCallback = null;
}

function submitInputModal() {
    const fieldEl = document.getElementById('inputModalField');
    const val = fieldEl ? fieldEl.value : '';
    if (state.inputModalCallback && val) {
        state.inputModalCallback(val);
    }
    closeInputModal();
}

// ==========================================
// Upload Studio & Staging Manager
// ==========================================
function initUploadZone() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const folderInput = document.getElementById('folderInput');

    if (!dropZone) return;

    dropZone.addEventListener('click', () => {
        if (fileInput) fileInput.click();
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');

        const items = e.dataTransfer.items;
        if (items && items.length > 0) {
            await handleDataTransferItems(items);
        } else if (e.dataTransfer.files.length > 0) {
            stageFiles(Array.from(e.dataTransfer.files));
        }
    });

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                stageFiles(Array.from(fileInput.files));
                fileInput.value = '';
            }
        });
    }

    if (folderInput) {
        folderInput.addEventListener('change', () => {
            if (folderInput.files.length > 0) {
                stageFiles(Array.from(folderInput.files));
                folderInput.value = '';
            }
        });
    }
}

async function handleDataTransferItems(items) {
    const entries = [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.webkitGetAsEntry) {
            const entry = item.webkitGetAsEntry();
            if (entry) entries.push(entry);
        }
    }

    const filesToStage = [];

    const traverseEntry = async (entry, currentPath = '') => {
        if (entry.isFile) {
            const file = await new Promise(resolve => entry.file(resolve));
            const relPath = currentPath ? `${currentPath}/${file.name}` : file.name;
            filesToStage.push({ file, relPath });
        } else if (entry.isDirectory) {
            const dirReader = entry.createReader();
            const readEntries = async () => {
                const subEntries = await new Promise(resolve => dirReader.readEntries(resolve));
                if (subEntries.length > 0) {
                    for (const sub of subEntries) {
                        await traverseEntry(sub, currentPath ? `${currentPath}/${entry.name}` : entry.name);
                    }
                    await readEntries(); // Continue reading until empty batch
                }
            };
            await readEntries();
        }
    };

    for (const entry of entries) {
        await traverseEntry(entry, '');
    }

    if (filesToStage.length > 0) {
        stageFilesWithPaths(filesToStage);
    }
}

const SUPPORTED_EXTS = ['.pdf', '.docx', '.doc', '.txt', '.md', '.markdown', '.png', '.jpg', '.jpeg', '.webp'];

function isFileSupported(name) {
    const lower = (name || '').toLowerCase();
    return SUPPORTED_EXTS.some(ext => lower.endsWith(ext));
}

function stageFiles(files) {
    const formatted = files.map(file => ({
        file,
        relPath: file.webkitRelativePath || file.name,
        name: file.name,
        size: file.size,
        type: file.type
    }));
    stageFilesWithPaths(formatted);
}

function stageFilesWithPaths(fileObjects) {
    const valid = fileObjects.filter(item => isFileSupported(item.name || item.file.name));
    
    if (valid.length === 0) {
        alert('None of the selected files match supported formats (PDF, DOCX, TXT, MD, PNG, JPG, JPEG, WEBP).');
        return;
    }

    state.stagedFiles.push(...valid);
    renderStagedFiles();
}

function removeStagedItem(index) {
    state.stagedFiles.splice(index, 1);
    renderStagedFiles();
}

function clearStagedFiles() {
    state.stagedFiles = [];
    renderStagedFiles();
}

function renderStagedFiles() {
    const container = document.getElementById('uploadStagedContainer');
    const list = document.getElementById('stagedFilesList');
    const summaryTitle = document.getElementById('stagedSummaryTitle');
    const btnUpload = document.getElementById('btnStartUpload');

    if (!container || !list) return;

    if (state.stagedFiles.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    const totalBytes = state.stagedFiles.reduce((sum, item) => sum + (item.file?.size || item.size || 0), 0);
    const count = state.stagedFiles.length;

    if (summaryTitle) {
        summaryTitle.innerText = `Selected: ${count} item${count > 1 ? 's' : ''} (Total: ${formatBytes(totalBytes)})`;
    }

    if (btnUpload) {
        btnUpload.innerText = `🚀 Upload ${count} File${count > 1 ? 's' : ''}`;
    }

    list.innerHTML = state.stagedFiles.map((item, idx) => `
        <div class="staged-item">
            <div class="staged-item-info">
                <span>${getFileIcon(item.name || item.file.name)}</span>
                <div>
                    <div style="font-weight: 600;">${escapeHtml(item.name || item.file.name)}</div>
                    ${item.relPath && item.relPath !== item.name ? `<div class="staged-item-path">${escapeHtml(item.relPath)}</div>` : ''}
                </div>
            </div>
            <div class="staged-item-meta">
                <span>${formatBytes(item.size || item.file.size)}</span>
                <button class="btn btn-sm btn-danger" onclick="removeStagedItem(${idx})">✖</button>
            </div>
        </div>
    `).join('');
}

function renderUploadPipelineTracker() {
    const tracker = document.getElementById('uploadPipelineTracker');
    const list = document.getElementById('uploadPipelineList');
    if (!tracker || !list) return;

    if (!state.trackedUploads || state.trackedUploads.length === 0) {
        tracker.style.display = 'none';
        return;
    }

    tracker.style.display = 'block';

    const getStatusBadge = (status, stage) => {
        switch (status) {
            case 'uploaded':
                return '<span class="tag-status tag-queued">Uploaded</span>';
            case 'queued':
                return '<span class="tag-status tag-queued">Queued</span>';
            case 'ocr_processing':
                return '<span class="tag-status tag-processing">⚡ OCR-processing</span>';
            case 'chunking':
                return '<span class="tag-status tag-processing">⚡ Chunking</span>';
            case 'indexing':
                return '<span class="tag-status tag-processing">⚡ Indexing</span>';
            case 'completed':
                return '<span class="tag-status tag-completed">✓ Completed</span>';
            case 'failed':
                return '<span class="tag-status tag-failed">✖ Failed</span>';
            default:
                return `<span class="tag-status tag-processing">${escapeHtml(stage || 'Processing')}</span>`;
        }
    };

    list.innerHTML = state.trackedUploads.map(doc => {
        const isCompleted = doc.status === 'completed';
        const isFailed = doc.status === 'failed';
        const progressPct = doc.progress || (isCompleted ? 100 : (doc.status === 'uploaded' ? 5 : 20));

        return `
            <div style="display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; background: var(--bg-main); border: 1px solid var(--border); border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span>${getFileIcon(doc.name)}</span>
                        <strong style="font-size: 0.88rem;">${escapeHtml(doc.name)}</strong>
                        <span style="font-size: 0.75rem; color: var(--text-dim);">(${formatBytes(doc.size)})</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted); background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">📂 ${escapeHtml(doc.category || 'general')}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${getStatusBadge(doc.status, doc.stage)}
                        ${isCompleted && doc.id ? `
                            <button class="btn btn-sm btn-primary" onclick="openChunkDrawer('${doc.id}', '${escapeQuotes(doc.name)}')">🔍 View Chunks</button>
                        ` : ''}
                        ${isFailed && doc.id ? `
                            <button class="btn btn-sm btn-accent" onclick="retrySingleDoc('${doc.id}')">🔁 Retry</button>
                        ` : ''}
                    </div>
                </div>
                <div style="font-size: 0.78rem; color: ${isFailed ? 'var(--danger)' : 'var(--text-muted)'}; display: flex; justify-content: space-between;">
                    <span>${escapeHtml(doc.error || doc.stage || 'Processing in pipeline...')}</span>
                    <span>${progressPct}%</span>
                </div>
                <div class="progress-bar-container" style="height: 4px; margin-top: 2px;">
                    <div class="progress-bar ${isFailed ? 'bg-danger' : ''}" style="width: ${progressPct}%;"></div>
                </div>
            </div>
        `;
    }).join('');
}

function clearUploadPipelineTracker() {
    state.trackedUploads = [];
    renderUploadPipelineTracker();
}

async function startStagedUpload() {
    if (state.stagedFiles.length === 0) return;

    const categorySelect = document.getElementById('uploadCategory');
    const customCategoryInput = document.getElementById('customCategoryInput');
    let category = categorySelect ? categorySelect.value : 'general';
    if (category === '__new__') {
        category = (customCategoryInput?.value || 'general').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    const progressContainer = document.getElementById('uploadProgressContainer');
    const progressText = document.getElementById('uploadProgressText');
    const progressPercent = document.getElementById('uploadProgressPercent');
    const progressBar = document.getElementById('uploadProgressBar');
    const statusBox = document.getElementById('uploadStatus');

    if (progressContainer) progressContainer.style.display = 'block';
    if (statusBox) statusBox.style.display = 'none';

    const formData = new FormData();
    formData.append('category', category);

    // Build relative path map
    const relPathsMap = {};
    const stagedSnapshot = state.stagedFiles.slice();
    stagedSnapshot.forEach(item => {
        const f = item.file;
        formData.append('files', f);
        relPathsMap[f.name] = item.relPath || f.name;
    });

    formData.append('relPaths', JSON.stringify(relPathsMap));

    try {
        if (progressText) progressText.innerText = `Uploading ${stagedSnapshot.length} file(s)...`;
        if (progressBar) progressBar.style.width = '40%';
        if (progressPercent) progressPercent.innerText = '40%';

        const res = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const json = await res.json();

        if (progressBar) progressBar.style.width = '100%';
        if (progressPercent) progressPercent.innerText = '100%';

        if (json.success) {
            if (statusBox) {
                statusBox.style.display = 'block';
                statusBox.innerHTML = `✅ Successfully uploaded and queued <strong>${json.data.filesCount || stagedSnapshot.length}</strong> document(s) to <code>[${category}]</code>!`;
                statusBox.style.color = 'var(--accent)';
            }

            // Track newly uploaded documents in pipeline tracker
            if (json.data && Array.isArray(json.data.documents)) {
                json.data.documents.forEach(doc => {
                    const isImg = isImageExtension(doc.originalName);
                    state.trackedUploads.unshift({
                        id: doc._id,
                        name: doc.originalName,
                        size: doc.fileSize,
                        category: doc.category || category,
                        status: 'queued',
                        stage: 'Queued in processing pipeline',
                        progress: 5,
                        isImage: isImg,
                        error: null
                    });
                });
            } else {
                stagedSnapshot.forEach(item => {
                    const isImg = isImageExtension(item.name || item.file?.name);
                    state.trackedUploads.unshift({
                        id: null,
                        name: item.name || item.file?.name,
                        size: item.size || item.file?.size || 0,
                        category: category,
                        status: 'queued',
                        stage: 'Queued in processing pipeline',
                        progress: 5,
                        isImage: isImg,
                        error: null
                    });
                });
            }

            renderUploadPipelineTracker();
            clearStagedFiles();
            fetchStorageTree();
            fetchQueue();
            fetchAnalytics();
            fetchCategories();
        } else {
            if (statusBox) {
                statusBox.style.display = 'block';
                statusBox.innerHTML = `❌ Upload failed: ${json.message}`;
                statusBox.style.color = 'var(--danger)';
            }
        }
    } catch (err) {
        if (statusBox) {
            statusBox.style.display = 'block';
            statusBox.innerHTML = `❌ Network error during upload: ${err.message}`;
            statusBox.style.color = 'var(--danger)';
        }
    } finally {
        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = 'none';
        }, 1500);
    }
}

// ==========================================
// Queue Monitor View
// ==========================================
function renderQueueView() {
    const activeContainer = document.getElementById('activeJobsContainer');
    const queueList = document.getElementById('queuedDocsList');
    const failedContainer = document.getElementById('failedDocsContainer');
    const failedBadge = document.getElementById('failedDocsCountBadge');
    const q = state.queue;

    if (!q) return;

    // Active Jobs
    if (activeContainer) {
        if (!q.activeJobs || q.activeJobs.length === 0) {
            activeContainer.innerHTML = `
                <div style="padding: 24px; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: 10px; border: 1px solid var(--border);">
                    <p>☕ Worker pool is currently idle. No active chunking jobs.</p>
                </div>`;
        } else {
            activeContainer.innerHTML = q.activeJobs.map(job => `
                <div class="queue-card">
                    <div class="queue-card-top">
                        <span style="font-weight: 700; color: var(--primary);">⚡ ${escapeHtml(job.originalName || 'Document')}</span>
                        <span class="tag-status tag-processing">${escapeHtml(job.workerId || 'Worker')} &bull; ${job.progress || 0}%</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(job.stage || 'Processing')}</div>
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
        const queuedDocs = q.waitingQueue || q.queue || [];
        if (queuedDocs.length === 0) {
            queueList.innerHTML = `
                <div style="padding: 16px; text-align: center; color: var(--text-muted);">
                    <p>Queue is empty. All documents are up to date.</p>
                </div>`;
        } else {
            queueList.innerHTML = queuedDocs.map((doc, idx) => `
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

    // Failed Documents
    const failedDocs = q.failedDocs || state.analytics?.failedDocs || [];
    if (failedBadge) {
        failedBadge.innerText = `${failedDocs.length} failed / retryable`;
    }

    if (failedContainer) {
        if (failedDocs.length === 0) {
            failedContainer.innerHTML = `
                <div style="padding: 16px; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border);">
                    <p>🎉 No failed documents. All jobs executed cleanly.</p>
                </div>`;
        } else {
            failedContainer.innerHTML = failedDocs.map(doc => {
                const reason = doc.lastError || doc.failureInfo?.reason || doc.failureInfo?.error || doc.currentStage || 'Processing failure';
                const attempts = doc.retryCount !== undefined ? doc.retryCount : 0;
                const stage = doc.currentStage || 'Failed';
                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: rgba(239, 68, 68, 0.05); border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.25); margin-bottom: 8px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 1rem;">⚠️</span>
                                <span style="font-size: 0.88rem; font-weight: 700; color: var(--text-main);">${escapeHtml(doc.originalName || 'Document')}</span>
                                <span class="tag-status tag-failed">${escapeHtml(doc.category || 'General')}</span>
                                <span style="font-size: 0.75rem; color: var(--text-dim);">Attempts: ${attempts}</span>
                            </div>
                            <div style="font-size: 0.78rem; color: var(--danger); font-family: var(--font-mono);">
                                <strong>${escapeHtml(stage)}:</strong> ${escapeHtml(reason)}
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button class="btn btn-sm btn-accent" onclick="retrySingleDoc('${doc._id}')">🔁 Retry</button>
                            <button class="btn btn-sm btn-danger" onclick="dismissJob('${doc._id}')">🗑️ Dismiss</button>
                        </div>
                    </div>
                `;
            }).join('');
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
                <span style="font-size: 0.78rem; color: var(--text-dim); margin-left: 10px;">Category: ${data.category || 'General'}</span>
            </div>
            <button class="btn btn-sm btn-primary" onclick="downloadChunkJson()">📥 Export JSON</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 12px;">
            ${chunks.map((c, i) => `
                <div class="chunk-item">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700; color: var(--primary); font-size: 0.82rem;">Chunk #${i + 1} &bull; Page ${c.metadata?.pageNumber || c.pageNumber || 1}</span>
                        <span style="font-size: 0.75rem; color: var(--text-dim);">${(c.content || c.cleanedText || '').split(/\s+/).length} tokens</span>
                    </div>
                    <div class="chunk-text">${escapeHtml(c.content || c.cleanedText || '')}</div>
                    <div style="display: flex; justify-content: flex-end;">
                        <button class="btn btn-sm" onclick="copyToClipboard('${escapeQuotes(c.content || c.cleanedText || '')}')">📋 Copy Chunk</button>
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
        const text = (el.textContent || el.innerText || "").trim();
        const matches = text === level || (level === 'WARNING' && text === 'WARN') || (level === 'WARN' && text === 'WARNING');
        el.classList.toggle('active', matches);
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
    try {
        const text = state.logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        if (typeof URL !== 'undefined' && URL.createObjectURL) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `edumate-chunking-logs-${Date.now()}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Logs exported successfully', 'success');
        }
    } catch (_) {}
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

    const storageDocs = a.storageDocuments !== undefined ? a.storageDocuments : (a.totalDocuments || 0);
    const mongoDocs = a.mongoTotalDocuments !== undefined ? a.mongoTotalDocuments : 0;
    const indexedDocs = a.indexedDocuments !== undefined ? a.indexedDocuments : 0;
    const mongoIndexed = a.mongoIndexedDocuments || 0;
    const totalChunks = a.totalChunks || 0;
    const chunkFiles = a.totalChunkFiles || 0;
    const formattedSize = a.storageSizeFormatted || formatBytes(a.totalStorageSizeBytes || 0);

    setVal('anTotalDocs', storageDocs);
    setVal('anMongoSubtext', `${mongoDocs} historical in database`);
    setVal('anIndexedDocs', indexedDocs);
    setVal('anIndexedSubtext', `${mongoIndexed} historical completed in DB`);
    setVal('anTotalChunks', totalChunks);
    setVal('anChunksSubtext', `${chunkFiles} chunk files on disk`);
    setVal('anStorageSize', formattedSize);

    // Dashboard cards update
    setVal('dashStorageDocs', storageDocs);
    setVal('dashHistoricalDocs', `${mongoDocs} historical in DB`);
    setVal('dashStorageSize', formattedSize);
    setVal('dashLocalChunks', `${totalChunks} Local Chunks`);

    // Secondary details
    setVal('anStorageFolders', a.storageDetails?.folders || a.storageFolders || 0);
    setVal('anStorageFiles', a.storageDetails?.supportedDocuments || a.storageDetails?.files || storageDocs);
    setVal('anTotalChunkFiles', chunkFiles);
    setVal('anIgnoredFiles', a.storageDetails?.ignoredFiles || 0);

    // Category Breakdown
    const catContainer = document.getElementById('anCategoryBreakdown');
    if (catContainer && Array.isArray(a.categoryDistribution)) {
        if (a.categoryDistribution.length === 0) {
            catContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 10px;">No categories active</div>';
        } else {
            catContainer.innerHTML = a.categoryDistribution.map(cat => `
                <div class="latency-row">
                    <span class="latency-name"><span>📁</span> ${escapeHtml(cat._id || 'General')}</span>
                    <span class="latency-val">${cat.count} docs (${cat.totalChunks || 0} chunks)</span>
                </div>
            `).join('');
        }
    }
}

// ==========================================
// REST Operations & Global Controls
// ==========================================
async function startWorker() {
    try {
        const res = await fetch('/worker/start', { method: 'POST' });
        const json = await res.json();
        showToast('Worker pool started', 'success');
    } catch (err) {
        console.error('[WorkerPool] Start error:', err);
    } finally {
        fetchQueue();
        fetchAnalytics();
        fetchStorageTree();
    }
}

async function pauseWorker() {
    try {
        await fetch('/queue/pause', { method: 'POST' });
        showToast('Queue paused', 'warning');
    } finally {
        fetchQueue();
        fetchHealth();
    }
}

async function resumeWorker() {
    try {
        await fetch('/queue/resume', { method: 'POST' });
        showToast('Queue resumed', 'success');
    } finally {
        fetchQueue();
        fetchHealth();
    }
}

async function restartWorker() {
    try {
        await fetch('/worker/restart', { method: 'POST' });
        showToast('Worker pool restarted', 'success');
    } finally {
        fetchQueue();
        fetchAnalytics();
        fetchStorageTree();
    }
}

async function retryFailedJobs() {
    try {
        await fetch('/queue/retry-all', { method: 'POST' });
        showToast('Retrying all failed jobs', 'info');
    } finally {
        fetchQueue();
        fetchAnalytics();
    }
}

async function retrySingleDoc(docId) {
    if (!docId) return;
    try {
        await fetch(`/queue/retry/${docId}`, { method: 'POST' });
    } catch (err) {
        console.error('Failed to retry document:', err);
    } finally {
        fetchQueue();
        fetchAnalytics();
    }
}

async function reindexAll() {
    if (confirm('Re-index and chunk all pending/active documents?')) {
        try {
            await fetch('/qdrant/reindex', { method: 'POST' });
        } finally {
            fetchQueue();
            fetchAnalytics();
            fetchStorageTree();
        }
    }
}

async function clearQueue() {
    if (confirm('Clear all waiting documents from the processing queue?')) {
        try {
            await fetch('/queue/clear', { method: 'POST' });
            showToast('Queue cleared', 'warning');
        } finally {
            fetchQueue();
            fetchAnalytics();
        }
    }
}

async function triggerStorageSync() {
    const syncBtn = document.getElementById('btnStorageSync');
    if (syncBtn) syncBtn.innerText = '⏳ Syncing...';
    try {
        const res = await fetch('/storage/scan-sync', { method: 'POST' });
        const json = await res.json();
        showToast('Storage synchronized', 'success');
        if (json.success) {
            fetchStorageTree();
            fetchAnalytics();
            fetchCategories();
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

async function dismissJob(docId) {
    await fetch(`/queue/dismiss/${docId}`, { method: 'POST' });
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
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard!', 'success');
        }).catch(() => fallbackCopy(text));
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    try {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast('Copied to clipboard!', 'success');
    } catch (_) {}
}


// ==========================================
// Toast Notifications & Window Scope Exports
// ==========================================
function showToast(message, type = 'info') {
    try {
        let container = document.getElementById('studioToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'studioToastContainer';
            container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        const bg = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6';
        toast.style.cssText = `background:${bg};color:#ffffff;padding:10px 16px;border-radius:8px;font-size:0.85rem;font-weight:600;box-shadow:0 4px 14px rgba(0,0,0,0.35);transition:all 0.25s ease;pointer-events:auto;max-width:340px;word-break:break-word;opacity:0;transform:translateY(12px);`;
        toast.textContent = message;
        container.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(12px)';
            setTimeout(() => toast.remove(), 250);
        }, 3000);
    } catch (_) {}
}

// Bind all button and context actions explicitly to window
if (typeof window !== 'undefined') {
    window.switchTab = switchTab;
    window.startWorker = startWorker;
    window.pauseWorker = pauseWorker;
    window.resumeWorker = resumeWorker;
    window.restartWorker = restartWorker;
    window.retryFailedJobs = retryFailedJobs;
    window.retrySingleDoc = retrySingleDoc;
    window.reindexAll = reindexAll;
    window.clearQueue = clearQueue;
    window.triggerStorageSync = triggerStorageSync;
    window.enqueueSingleDoc = enqueueSingleDoc;
    window.enqueueSelectedDocuments = enqueueSelectedDocuments;
    window.deleteSelectedDocuments = deleteSelectedDocuments;
    window.clearStorageSelection = clearStorageSelection;
    window.promptNewFolder = promptNewFolder;
    window.openUploadForFolder = openUploadForFolder;
    window.startStagedUpload = startStagedUpload;
    window.clearStagedFiles = clearStagedFiles;
    window.clearUploadPipelineTracker = clearUploadPipelineTracker;
    window.setLogFilter = setLogFilter;
    window.filterLogSearch = filterLogSearch;
    window.copyAllLogs = copyAllLogs;
    window.exportLogsFile = exportLogsFile;
    window.clearLogs = clearLogs;
    window.fetchHealth = fetchHealth;
    window.fetchQueue = fetchQueue;
    window.fetchAnalytics = fetchAnalytics;
    window.fetchStorageTree = fetchStorageTree;
    window.fetchCategories = fetchCategories;
    window.closeChunkDrawer = closeChunkDrawer;
    window.closeInputModal = closeInputModal;
    window.submitInputModal = submitInputModal;
    window.closePreviewModal = closePreviewModal;
    window.handleEmptyContextMenu = typeof handleEmptyContextMenu !== 'undefined' ? handleEmptyContextMenu : () => {};
    window.filterStorageTree = typeof filterStorageTree !== 'undefined' ? filterStorageTree : () => {};
    window.handleCategoryChange = typeof handleCategoryChange !== 'undefined' ? handleCategoryChange : () => {};
    window.showToast = showToast;
}
