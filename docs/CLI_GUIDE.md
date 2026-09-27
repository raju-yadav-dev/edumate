# 💻 EduMate AI — CLI Command Reference

EduMate provides a clean, production-grade CLI designed for ease of use, robust orchestration, and fast developer workflows.

---

## 🎯 Production Commands Matrix

| Command | Purpose | Target Port / Action |
|---|---|---|
| `npm run edumate` | Starts complete development environment (Frontend, Backend, Studio, Control Center) | Ports 5173, 5000, 5001 |
| `npm run web` | Starts React Vite Frontend client only | Port 5173 |
| `npm run api` | Starts Express REST API & AI WebSocket Backend only | Port 5000 |
| `npm run studio` | Starts Dedicated Knowledge Chunking Studio microservice | Port 5001 |
| `npm run ingest` | Runs standalone worker to scan `storage/`, chunk docs, and index vectors | CLI Runtime |
| `npm run sync-storage` | Scans `storage/` directory and synchronizes metadata with MongoDB | Database Sync |
| `npm run reindex` | Rebuilds and re-embeds all Qdrant vectors from stored chunks | Vector Database |
| `npm run health` | Executes complete system diagnostics (Doctor check) | Diagnostic Report |
| `npm run qa` | Runs automated regression test suite & validation runners | QA Testing |
| `npm run backup` | Creates a compressed snapshot of database, storage, and configurations | `backups/` archive |
| `npm run restore` | Restores an existing EduMate snapshot archive | System Restore |
| `npm run clean-cache` | Flushes all 10 cache layers, prompt caches, and temporary files | Cache Cleanup |

---

## 📖 Command Deep Dive

### 1. Complete Environment: `npm run edumate`
Launches the full ecosystem and renders the ANSI Development Control Center.
```bash
npm run edumate
# Run with live memory monitoring:
npm run edumate -- --debug
```

### 2. Frontend Only: `npm run web`
Spawns the React Vite development server for UI engineers:
```bash
npm run web
```

### 3. Backend Only: `npm run api`
Spawns the Express backend server:
```bash
npm run api
```

### 4. Knowledge Studio: `npm run studio`
Launches the browser-based Knowledge Studio on port 5001:
- Visual chunk inspector
- Storage folder browser
- Document queue monitor
- Real-time indexing telemetry
```bash
npm run studio
```

### 5. Document Ingestion Worker: `npm run ingest`
Runs the headless document ingestion worker on `storage/`:
```bash
# Ingest only pending / new documents
npm run ingest

# Force re-chunking and re-indexing of all documents
npm run ingest -- --force

# Enqueue all documents regardless of state
npm run ingest -- --all
```

### 6. Storage Synchronizer: `npm run sync-storage`
Scans the local filesystem at `storage/` and upserts file metadata (checksum, size, mime type, category) into MongoDB without re-running vector embeddings:
```bash
npm run sync-storage
```

### 7. Health Diagnostics: `npm run health`
Validates Node.js, npm, MongoDB, Local Storage, Qdrant, and LLM readiness:
```bash
npm run health
```

### 8. QA Test Suite: `npm run qa`
Executes end-to-end regression validation, API test suites, chunking studio validator, and security checks:
```bash
npm run qa
```

---

## 🔄 Backward Compatibility Aliases

The following legacy commands are preserved for backward compatibility:
- `npm run dev` → Alias for `npm run edumate`
- `npm run start` → Alias for `npm run api`
- `npm run server` → Alias for `npm run api`
- `npm run chunking` → Alias for `npm run studio`
- `npm run doctor` → Alias for `npm run health`
- `npm run client` → Alias for `npm run web`
- `npm run clean` → Alias for `npm run clean-cache`
