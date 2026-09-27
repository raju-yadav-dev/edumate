# EduMate API Specification (v1.0 Production)

All endpoints accept and return `application/json` (unless handling multipart uploads or Server-Sent Events).

---

## 1. Authentication & Session Management
- `POST /api/auth/register` — Register new user account.
- `POST /api/auth/login` — Authenticate user, set secure cookie and return JWT access token.
- `POST /api/auth/refresh` — Rotate refresh token and issue new access token.
- `POST /api/auth/logout` — Revoke active session and clear authentication cookies.
- `GET /api/auth/me` — Retrieve currently authenticated user profile.

---

## 2. Conversational AI & Chat
- `POST /api/chat/ask` — Submit user question to the Intelligent Hybrid Router.
  - Returns answer, intent, sources with exact file citations, confidence score, and token telemetry.
- `GET /api/chat/conversations` — List conversation history for authenticated user.
- `GET /api/chat/conversations/:id` — Retrieve messages for a specific conversation.
- `DELETE /api/chat/conversations/:id` — Delete conversation history.

---

## 3. Documents & Knowledge Management
- `GET /api/documents` — Search, filter, and list indexed documents.
- `POST /api/upload` — Upload PDF, DOCX, TXT, MD, CSV documents with magic byte inspection.
- `DELETE /api/documents/:id` — Soft-delete / permanently remove document.
- `POST /api/documents/:id/reindex` — Trigger re-chunking and vector re-indexing for a document.

---

## 4. Chunking Microservice (Port 5001)
- `GET /health` — Chunking server health and worker pool state.
- `GET /api/chunking/queue` — Real-time ingestion queue items and status.
- `POST /api/chunking/reindex-all` — Trigger complete parallel re-indexing.
- `POST /api/chunking/pause` — Pause active background ingestion worker pool.
- `POST /api/chunking/resume` — Resume background ingestion worker pool.
- `GET /api/chunking/events` — Server-Sent Events (SSE) live progress and runtime logs.

---

## 5. Smart Cache APIs
- `GET /api/cache/stats` — Metrics for all 10 cache layers (hit ratio, memory, items).
- `POST /api/cache/clear` — Selectively invalidate or flush all cache layers.

---

## 6. Security & Audit Telemetry
- `GET /api/admin/security/metrics` — Aggregate security counters (failed logins, injections, rate limit hits).
- `GET /api/admin/security/audit-logs` — Filterable historical security audit events.
- `GET /api/admin/security/sessions` — List active user sessions with IP and device info.
- `POST /api/admin/security/sessions/revoke` — Force-revoke a specific user session.

---

## 7. System Health & Monitoring
- `GET /api/system/health` — Complete health check (MongoDB, Qdrant, llama.cpp, Disk, Memory).
- `POST /api/admin/backup` — Create HMAC-signed full system backup.
- `POST /api/admin/restore` — Restore system state from backup archive.
