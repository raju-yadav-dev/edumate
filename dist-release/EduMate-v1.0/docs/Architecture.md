# EduMate Architecture Specification (v1.0 Production)

EduMate is an offline-first, enterprise-grade AI University Assistant and Knowledge Operating System designed to operate entirely locally on Windows / Linux without external cloud dependencies.

---

## High-Level System Architecture

```
                                  +---------------------------------------+
                                  |         React Frontend Client         |
                                  |      (Port 5173 / Production SPA)     |
                                  +-------------------+-------------------+
                                                      |
                                                      | HTTP / SSE
                                                      v
                                  +---------------------------------------+
                                  |         Security Middleware           |
                                  |   (Helmet, Rate Limiters, Sanitizer)  |
                                  +-------------------+-------------------+
                                                      |
                         +----------------------------+----------------------------+
                         |                                                         |
                         v                                                         v
          +-----------------------------+                           +-----------------------------+
          |     Express Backend API     |                           |   Chunking Microservice     |
          |         (Port 5000)         |                           |         (Port 5001)         |
          +--------------+--------------+                           +--------------+--------------+
                         |                                                         |
           +-------------+-------------+                             +-------------+-------------+
           |             |             |                             |             |             |
           v             v             v                             v             v             v
    +-------------+ +---------+ +-------------+               +-------------+ +---------+ +-------------+
    | 10-Layer    | | LLM     | | Prompt      |               | Document    | | OCR &   | | Embedding   |
    | Smart Cache | | Router  | | Injection   |               | Ingestion   | | Parsing | | Generator   |
    +-------------+ +----+----+ | Guard       |               +------+------+ +---------+ +------+------+
                         |      +-------------+                      |                           |
                         |                                           +-------------+-------------+
                         v                                                         |
          +-----------------------------+                                          v
          |      Hybrid Query Router    |                           +-----------------------------+
          |  (LLM-Only | RAG | Direct)  |                           |     Local Chunk Manager     |
          +--------------+--------------+                           |   (storage/chunks/ & emb/)  |
                         |                                          +--------------+--------------+
                         v                                                         |
          +-----------------------------+                                          v
          |      Inference & Vector     |                           +-----------------------------+
          |  llama.cpp (Qwen) + Qdrant  |                           |  Qdrant Vector Database     |
          +-----------------------------+                           |         (Port 6333)         |
                                                                    +-----------------------------+
```

---

## 1. Ten-Layer Smart Cache System
1. **Layer 1 — Client Memory & Session Storage**: Instant UI response for repeated queries.
2. **Layer 2 — Prompt Normalization Cache**: Normalized intent and token bucket caching.
3. **Layer 3 — Embedding Cache**: SHA-256 keyed cache preventing redundant dense vector computations.
4. **Layer 4 — Vector Search Cache**: Top-k similarity results cached for identical embedding queries.
5. **Layer 5 — Document Chunk Cache**: Memory-mapped local chunk cache for rapid retrieval.
6. **Layer 6 — Retriever & Re-ranking Cache**: Cross-encoder scoring and hybrid search deduplication cache.
7. **Layer 7 — LLM Generation Cache**: Exact and fuzzy query-to-answer cache for instant inference.
8. **Layer 8 — Conversation Memory Cache**: Multi-turn dialog context and sliding window memory.
9. **Layer 9 — Analytics & Telemetry Cache**: Sub-millisecond ring buffers for live dashboard stats.
10. **Layer 10 — Filesystem Metadata Cache**: Inode and checksum index for fast storage tree traversal.

---

## 2. Multi-Layer Security Architecture
- **JWT Authentication & Token Rotation**: Refresh token rotation with device finger-printing and remote revocation.
- **Role-Based Access Control (RBAC)**: `student`, `faculty`, `admin`, and `super_admin` hierarchy.
- **Route-Specific Token Bucket Rate Limiting**:
  - Chat: 20 req/min
  - Uploads: 10 uploads/hr
  - Login: 5 attempts/15 min
  - Health: 60 req/min
- **Input Sanitization**: Strip NoSQL operator injections (`$gt`, `$where`, `$regex`), prevent prototype pollution, and sanitize dangerous HTML.
- **Binary Magic Byte File Validation**: Enforce header magic byte signatures for PDF, DOCX, TXT, MD, CSV, PNG, JPG.
- **Prompt Injection Defense Guard**: Real-time heuristic interception of system prompt extraction, DAN mode overrides, and credential dumping.
- **Cryptographic Backup Integrity**: HMAC-SHA256 digital signatures for full database exports.

---

## 3. Intelligent Hybrid LLM Router
- **Mode A (LLM Only)**: General programming, math, logic, science, and reasoning queries routed directly to local Qwen LLM.
- **Mode B (RAG + LLM)**: University regulations, faculty information, fee structure, hostel rules, campus navigation queries enriched with relevant context chunks and exact citations.
- **Mode C (RAG Only / Fast Lookup)**: Direct document lookup for tabular schedules, notices, and exact contact numbers.
- **Mode D (Educational Fallback)**: Transparent warning and citation fallback when queried facts are outside the institutional knowledge base.
