# 🎓 EduMate AI — Offline-First AI University Assistant

[![Node.js](https://img.shields.io/badge/Node.js-v26.5%2B-green?logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-blue?logo=react)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0%2B-green?logo=mongodb)](https://www.mongodb.com/)
[![Qdrant](https://img.shields.io/badge/Qdrant-1.18%2B-red?logo=qdrant)](https://qdrant.tech/)
[![llama.cpp](https://img.shields.io/badge/llama.cpp-Qwen3_1.7B-orange?logo=c%2B%2B)](https://github.com/ggerganov/llama.cpp)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

> **EduMate** is an enterprise-grade, offline-first AI university companion and knowledge intelligence system. Built with React, Node.js, MongoDB, Qdrant Vector Engine, and llama.cpp, EduMate allows educational institutions to deploy an autonomous, privacy-preserving AI platform on local infrastructure.

---

## 📖 2. Project Overview

EduMate bridges the gap between massive, fragmented university documentation and instant student support. Universities generate thousands of pages of academic regulations, course syllabi, fee structures, examination schedules, hostel guidelines, and circulars. EduMate ingests, indexes, and synthesizes this institutional knowledge into an accurate, conversational AI assistant that operates completely offline.

At the core of EduMate is a local Retrieval-Augmented Generation (RAG) architecture powered by Qdrant vector database and localized GGUF LLMs (such as Qwen 2.5 3B Instruct) running on `llama.cpp`. By processing and querying data on-premise, EduMate ensures 100% student data privacy and zero dependence on recurring cloud subscription APIs.

EduMate eliminates cloud storage bloat by employing a strictly governed local storage architecture rooted in `storage/`. University administrators can drop documents into categorized directories (`admissions/`, `academics/`, `fees/`, `hostel/`, etc.), and EduMate's ingestion engine will automatically extract text, generate hierarchical chunks, index semantic vectors, and maintain real-time database synchronization.

The platform is designed around a multi-agent orchestration tier featuring specialized agents for general knowledge, academic rules, coding support, and personal document analysis. An integrated 10-tier Smart Cache Hub accelerates response delivery to sub-50ms for frequent student queries.

Complementing the student experience is the dedicated **Knowledge Studio** (Port 5001) — a visual administration workbench for monitoring ingestion queues, inspecting chunk quality, exploring storage trees, tracking real-time telemetry, and validating vector parity.

---

## ✨ 3. Features

### 🎓 Student Portal
- **Conversational AI Assistant**: Real-time token streaming with Markdown, LaTeX math formulas, code syntax highlighting, and citation popups.
- **Multilingual Query Support**: Seamless understanding and response synthesis in English, Hindi, and Bengali.
- **Voice Interaction**: Speech-to-text input and natural voice responses.
- **Document Interrogation**: Upload personal assignment files or notes for instant summarization and Q&A.

### 🛡️ Admin & Security Hub
- **Enterprise RBAC**: Role-based access control for Students, Faculty, Admins, and Super Admins.
- **Prompt Injection Guard**: Advanced heuristics and regex filters blocking jailbreaks and unauthorized system prompt overrides.
- **Audit Logging**: Comprehensive traceability of all student queries, administrative actions, and document modifications.

### 🔬 Knowledge Studio (Port 5001)
- **Hierarchical Chunk Inspector**: Visual token count, overlap verification, and chunk hash inspection.
- **Storage Directory Explorer**: Interactive navigation of local files, automatic exclusion of system cache artifacts.
- **Ingestion & Reindex Console**: Real-time Server-Sent Events (SSE) telemetry for chunking, embedding, and vector upsert pipelines.

### 🧠 AI & Optimization
- **Offline LLM Runtime**: Native `llama.cpp` integration with hardware acceleration (CUDA/Metal/CPU).
- **10-Layer Smart Cache**: In-memory and persistent caching across client, prompts, embeddings, vectors, chunks, and LLM responses.
- **Autonomous Query Router**: Intent and domain classifier routing queries to domain-specific agents.

---

## 🏛️ 4. Architecture Diagram

```text
Student / Admin User
         │
         ▼
 React 18 Web Client (Port 5173)
         │
         ▼
 Express 4 Backend API (Port 5000)
         │
 ┌───────┴───────────────────────────────┐
 │                                       │
 ▼                                       ▼
AI Query Router                 Knowledge Studio (Port 5001)
 │                                       │
 ├───────────────────────┐               │
 ▼                       ▼               ▼
Specialized Agents   Knowledge Agent   Local Storage (storage/)
(Code, Academic)         │               │
                         ▼               ▼
                  10-Layer Smart Hub   Chunking & Vector Ingest
                         │               │
                         ▼               ▼
                  Qdrant Vector DB   Embedding Engine (Jina)
                         │               │
                         ▼               ▼
                  llama.cpp LLM Server   MongoDB Metadata Store
```

---

## 🛠️ 5. Tech Stack Table

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | React 26.5.0, Vite, Tailwind CSS, Lucide Icons | Responsive single-page application with real-time SSE streaming |
| **Backend** | Node.js, Express 4 / 5, JavaScript (CommonJS) | Microservices API, Rate Limiters, Security Sanitizers |
| **Database** | MongoDB 6.0+ / Mongoose 9 | User identities, document catalog, audit logs, analytics |
| **Vector Engine** | Qdrant 1.18+ | 1024-dimensional dense vector store with cosine similarity |
| **Embeddings** | Jina Embeddings v3 / Local Embeddings | Dense text embedding pipeline with category payload filters |
| **LLM Runtime** | llama.cpp / Qwen3 1.7B Instruct (GGUF) | High-speed local LLM inference server on Port 8080 |
| **Authentication**| JWT (JSON Web Tokens), bcrypt | Secure cookie-based and header-based session authentication |
| **File Storage** | Localhost Filesystem (`storage/`) | 100% offline-first categorized knowledge repository |

---

## 📁 6. Project Structure

```text
edumate/
├── client/                     # React 18 Frontend Application
│   ├── src/                    # Components, Pages, State, Hooks
│   ├── index.html              # HTML Entrypoint
│   └── package.json            # Client Dependencies
├── server/                     # Express Backend & AI Microservices
│   ├── ai/                     # Agents, Routers, Embeddings, Security
│   ├── chunking-ui/            # Knowledge Studio Frontend Assets
│   ├── chunkingServer.js       # Dedicated Knowledge Studio Server (Port 5001)
│   ├── controllers/            # Express Route Handlers
│   ├── middleware/             # Auth, Rate Limiting, Sanitization
│   ├── models/                 # Mongoose Schemas (Document, User, Log)
│   ├── routes/                 # REST API Routes
│   ├── scripts/                # Ingestion Worker, Sync, Test Suites
│   ├── services/               # RAG, Cache, LLM, Storage Services
│   ├── storage/                # Storage Manager & Local File Abstraction
│   └── server.js               # Main Express Server (Port 5000)
├── storage/                    # Local Knowledge Root (PDF, DOCX, TXT, MD)
│   ├── academics/              # Syllabi, Course Catalogues
│   ├── admissions/             # Eligibility, Intake Guidelines
│   ├── fees/                   # Fee Schedules, Payment Policies
│   └── hostel/                 # Accommodation Rules, Dining Info
├── scripts/                    # Platform Startup, Health, Backup CLI
│   ├── startup.js              # Production Development Control Center
│   ├── doctor.js               # Health & Diagnostic Checklist
│   └── backupRestoreCenter.js  # Disaster Recovery Utility
├── docs/                       # Comprehensive Architecture & API Documentation
└── package.json                # Monorepo Orchestration & Production CLI
```

---

## 🚀 7. Installation Guide

### Step 1: Clone Repository
```bash
git clone https://github.com/raju-yadav-dev/edumate.git
cd edumate
```

### Step 2: Install Monorepo Dependencies
```bash
npm run setup
```

### Step 3: Configure Environment Variables
```bash
cp .env.example .env
```
Ensure your `.env` contains your MongoDB URI, Qdrant URL, and LLM preferences:
```env
PORT=5000
CHUNKING_PORT=5001
MONGODB_URI=mongodb://localhost:27017/edumate
QDRANT_URL=http://localhost:6333
LLM_PROVIDER=llama.cpp
LLAMA_SERVER_URL=http://localhost:8080/v1
```

### Step 4: Run Infrastructure
- **MongoDB**: Start local `mongod` service or MongoDB container.
- **Qdrant**:
  ```bash
  docker run -d -p 6333:6333 -p 6334:6334 -v qdrant_storage:/qdrant/storage qdrant/qdrant:latest
  ```

### Step 5: Start Local LLM (Optional for Offline Mode)
Place `Qwen2.5-3B-Instruct-Q4_K_M.gguf` inside `server/ai-models/` or run:
```bash
llama-server -m server/ai-models/Qwen2.5-3B-Instruct-Q4_K_M.gguf --port 8080 -c 4096
```

---

## 💻 8. Running EduMate

| Goal | Command | Description |
|---|---|---|
| **Start Everything** | `npm run edumate` | Boots Frontend, Backend, Studio, and prints Control Center |
| **Knowledge Studio** | `npm run studio` | Starts Dedicated Knowledge Studio on Port 5001 |
| **Backend API Only**| `npm run api` | Starts Express REST API Server on Port 5000 |
| **Frontend Only** | `npm run web` | Starts React Vite dev server on Port 5173 |
| **Ingest Documents** | `npm run ingest` | Headless worker scans `storage/`, chunks, and indexes |
| **Sync Storage** | `npm run sync-storage` | Synchronizes disk file metadata with MongoDB |
| **Rebuild Vectors** | `npm run reindex` | Re-embeds all stored document chunks into Qdrant |
| **Health Check** | `npm run health` | Runs automated system diagnostics (EduMate Doctor) |
| **Run QA Suite** | `npm run qa` | Executes regression, validator, and browser suites |
| **System Backup** | `npm run backup` | Generates a compressed snapshot archive of data |
| **System Restore** | `npm run restore` | Restores database and storage from a backup snapshot |
| **Clean Cache** | `npm run clean-cache` | Clears all 10 cache tiers and temp artifacts |

---

## 📂 9. Local Storage Guide

EduMate follows a strict **Local-First Storage Philosophy**:
- **Zero Cloud Storage**: No Supabase or external S3 buckets required.
- **Knowledge Root**: `storage/` at the project root is the single source of truth.
- **Supported Formats**: `.pdf`, `.docx`, `.doc`, `.txt`, `.md`.
- **Automatic Folder Categorization**: Documents placed in `storage/admissions/` are automatically categorized under `admissions`.
- **Integrity Enforcement**: Chunks and vectors are cryptographically tied to document SHA-256 hashes.

To synchronize newly dropped files in `storage/` without running the full vector pipeline:
```bash
npm run sync-storage
```

---

## 🔬 10. Knowledge Studio Guide

Access the visual **Knowledge Studio** at [http://localhost:5001](http://localhost:5001):

1. **Document Upload**: Drag-and-drop university circulars or handbooks directly into specific categories.
2. **Chunk Inspector**: Examine sliding window chunk text, character counts, and metadata tags before vectorization.
3. **Queue Telemetry**: Live progress bars tracking OCR, text splitting, embedding generation, and Qdrant upserts.
4. **Storage Explorer**: Browse filesystem folders and delete obsolete files cleanly with full cascade removal.

---

## 🔄 11. AI Pipeline

```text
Document Upload (storage/)
          │
          ▼
Text Extraction (pdf-parse, mammoth, officeparser)
          │
          ▼
Hierarchical Chunking (500-800 tokens, 150 token overlap)
          │
          ▼
Metadata Enrichment (Category, Section, SHA-256 Hash)
          │
          ▼
Vector Embeddings (1024-dim dense representation)
          │
          ▼
Qdrant Vector Indexing (Payload indexed by category)
          │
          ▼
Query Retrieval & Reranking (Cosine similarity + deduplication)
          │
          ▼
Context Assembly & Prompt Guard
          │
          ▼
llama.cpp Generation (Qwen 2.5 3B Instruct)
          │
          ▼
SSE Stream & Student Citation Delivery
```

---

## ⚡ 12. Smart Cache Layer

EduMate features a 10-tier caching architecture to ensure high throughput:
1. **Client Cache (L1)**: Browser-side response caching with ETag validation.
2. **Prompt Query Cache (L2)**: In-memory normalization of frequent student questions.
3. **Embedding Cache (L3)**: Caches pre-computed vector embeddings.
4. **Vector Search Cache (L4)**: Top-K Qdrant retrieval result caching.
5. **Document Chunk Cache (L5)**: High-speed RAM buffer for parsed document chunks.
6. **Retriever Context Cache (L6)**: Ranked multi-document context blocks.
7. **LLM Response Cache (L7)**: Exact match verified LLM answers.
8. **Conversation Context Cache (L8)**: Multi-turn chat session memory.
9. **Model KV Cache (L9)**: llama.cpp token state reuse.
10. **Persistent Disk Cache (L10)**: Survives server restarts for instant warm boots.

---

## 🔌 13. Knowledge Studio Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Studio health and uptime status |
| `GET` | `/api/studio/status` | MongoDB and Qdrant connectivity states |
| `GET` | `/api/studio/storage` | Local storage volume metrics and folder counts |
| `GET` | `/api/studio/documents` | List all documents and indexing status |
| `POST` | `/api/studio/upload` | Upload new document to local category |
| `POST` | `/api/studio/ingest` | Trigger background chunking worker |
| `GET` | `/api/studio/chunks/:docId` | Retrieve extracted chunks for a document |
| `POST` | `/api/studio/reindex/:docId` | Re-embed document into Qdrant |
| `DELETE`| `/api/studio/documents/:docId` | Cascade delete document, chunks, and vectors |
| `GET` | `/api/studio/events` | Server-Sent Events stream for live progress |

---

## 🔄 14. Development Workflow

1. **Add University Documents**: Place new files into the appropriate `storage/<category>/` directory.
2. **Synchronize & Ingest**: Run `npm run ingest` to chunk and index the documents.
3. **Verify Health**: Run `npm run health` to ensure all services are connected.
4. **Run End-to-End QA**: Run `npm run qa` to validate all API endpoints and browser flows.
5. **Commit Changes**: Push code updates to git.

---

## 🔐 15. Environment Variables

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `5000` | Express REST API Backend Port |
| `CHUNKING_PORT` | `5001` | Knowledge Studio Microservice Port |
| `NODE_ENV` | `development` | Application environment (`development` / `production`) |
| `MONGODB_URI` | `mongodb://localhost:27017/edumate` | MongoDB Connection String |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant Vector Engine URL |
| `QDRANT_COLLECTION` | `edumate_knowledge_v3` | Active vector collection name |
| `LLM_PROVIDER` | `llama.cpp` | Active LLM runtime (`llama.cpp`, `groq`, `gemini`) |
| `LLAMA_SERVER_URL` | `http://localhost:8080/v1` | llama.cpp HTTP server endpoint |
| `EMBEDDING_PROVIDER`| `jina` | Vector embedding provider (`jina` or `local`) |
| `JWT_SECRET` | *(auto-generated)* | Token signing key for student/admin authentication |

---

## 🔧 16. Troubleshooting

- **MongoDB Disconnected**: Confirm MongoDB service is running and `MONGODB_URI` is reachable.
- **Qdrant Unavailable**: Start Qdrant Docker container on port `6333`.
- **Local LLM Offline**: Ensure `llama-server` is started on port `8080` with a valid GGUF model in `server/ai-models/`.
- **Chunking Worker Error**: Run `npm run sync-storage` to ensure local storage files are registered.
- **Port In Use (EADDRINUSE)**: Terminate any orphaned node processes using port 5000 or 5001.

---

## ✅ 17. Production Readiness Checklist

- [x] MongoDB database connection active and indexed
- [x] Qdrant collection initialized with 1024-dim cosine distance
- [x] Local Storage root (`storage/`) verified with read/write permissions
- [x] Knowledge documents chunked and vector parity verified
- [x] Local LLM server (llama.cpp) responding on port 8080
- [x] 10-Layer Smart Cache warmed and operational
- [x] Automated regression suite (`npm run qa`) passing with 0 errors

---

## 🗺️ 18. Future Roadmap

- 👁️ **Vision Intelligence**: Optical chart and diagram parsing for engineering blueprints.
- 🗺️ **Interactive Campus Navigation**: Vectorized spatial pathfinding for campus facilities.
- 📅 **Dynamic Timetable Agent**: Personalized schedule management and exam reminder push feeds.
- 💼 **Placement Agent**: Resume review and mock technical interview simulations.
- 📱 **Mobile App**: Native Android & iOS offline-sync client.

---

## 📄 License

MIT © EduMate AI Platform Team
