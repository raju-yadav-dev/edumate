# 🏛️ EduMate AI — System Architecture

EduMate is designed as an **offline-first, multi-tier AI university intelligence platform**. It combines local document storage, hierarchical chunking, high-dimensional vector search, a 10-layer smart caching hub, and specialized multi-agent orchestration.

---

## 📐 High-Level Architecture Diagram

```text
                               +-----------------------------+
                               |     Student / Admin User    |
                               +--------------+--------------+
                                              |
                                              v
                               +-----------------------------+
                               |   React 18 Frontend (Vite)  |
                               |   Port 5173 / Tailwind CSS  |
                               +--------------+--------------+
                                              |
                                              v
                               +-----------------------------+
                               |    Express 4 Backend API    |
                               |          Port 5000          |
                               +-------+--------------+------+
                                       |              |
                    +------------------+              +------------------+
                    v                                                    v
      +-----------------------------+                      +-----------------------------+
      |      AI Query Router        |                      |  Knowledge Studio (Port 5001|
      +--------------+--------------+                      +--------------+--------------+
                     |                                                    |
         +-----------+-----------+                                        |
         |                       |                                        v
         v                       v                         +-----------------------------+
+-----------------+     +-----------------+                |   Local Storage Manager     |
| Specialized     |     | Knowledge Agent |                |   storage/ (PDF, DOCX, MD)  |
| Agents (Math,   |     +--------+--------+                +--------------+--------------+
| Code, Academic) |              |                                        |
+--------+--------+              v                                        v
         |              +-----------------+                +-----------------------------+
         |              | 10-Layer Smart  |                |   Chunking & Ingest Queue   |
         |              |   Cache Hub     |                |  Regex / LLM Metadata Extr. |
         |              +--------+--------+                +--------------+--------------+
         |                       |                                        |
         +-----------+-----------+                                        |
                     |                                                    v
                     v                                     +-----------------------------+
+-----------------------------+                            |    Vector Embedding Engine  |
|     llama.cpp / LLM Engine  |                            |   Jina Embeddings / Qdrant  |
|   Qwen 2.5 3B (Port 8080)   |                            +--------------+--------------+
+--------------+--------------+                                           |
               |                                                          v
               v                                           +-----------------------------+
+-----------------------------+                            |  MongoDB Metadata Store     |
|  SSE Stream & Response Form.|                            |  Users, Docs, Logs, Stats   |
+-----------------------------+                            +-----------------------------+
```

---

## 🧩 Architectural Components

### 1. Presentation Tier (React Client)
- **Student Portal**: Low-latency chat interface supporting streaming markdown, citation popups, voice transcription, and mathematical formula rendering.
- **Admin Hub**: Real-time server telemetry, document upload workbench, user management, and security audit explorer.
- **Knowledge Studio UI**: Visual chunk inspector, directory browser, and vector similarity playground.

### 2. Application Tier (Express API Server)
- **Security Sanitizer & Prompt Guard**: Protects against SQL/NoSQL injection, XSS, and prompt injection attacks.
- **Rate Limiters & JWT Auth**: Role-based access control (Student, Faculty, Admin, Super Admin).
- **Audit Logger**: Detailed compliance logging of user queries and document access.

### 3. Agent & Routing Layer
- **Query Router**: Analyzes user intent, language (English, Hindi, Bengali), and domain category.
- **Specialized Agents**:
  - `KnowledgeAgent`: Performs hybrid vector retrieval from university regulations, syllabi, and circulars.
  - `AcademicAgent`: Answers course scheduling, exam dates, and CGPA questions.
  - `ProgrammingAgent`: Assists with coding and technical assignments.
  - `DocumentAgent`: Summarizes and interrogates uploaded user documents.

### 4. Vector & Embedding Tier
- **Qdrant Vector Engine**: Stores dense 1024-dimensional vectors with payload filtering by category and document ID.
- **Hierarchical Chunking**: Splits documents into contextual chunks with sliding overlap and document header awareness.

### 5. Storage Philosophy (Local-First)
- **No Cloud Dependencies**: Zero reliance on Supabase or external storage buckets.
- **Storage Root**: `storage/` on the local filesystem organizes documents into structured academic categories (`admissions/`, `academics/`, `fees/`, `hostel/`, etc.).
- **Atomic File Operations**: Safe path traversal protection and filesystem sync.
