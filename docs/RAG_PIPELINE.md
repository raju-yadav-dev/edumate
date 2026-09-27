# 🧠 EduMate AI — End-to-End RAG Pipeline

This document explains the technical lifecycle of knowledge from raw file ingestion to real-time student query synthesis.

---

## 🔄 End-to-End RAG Flow Diagram

```text
+-------------------------------------------------------------+
| 1. DOCUMENT INGESTION                                       |
|    Upload Document (PDF, DOCX, MD, TXT) to storage/category |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| 2. TEXT EXTRACTION & CHUNKING                               |
|    Extract text, apply sliding-window chunking & overlap,   |
|    extract structural metadata (headers, tables, keywords)  |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| 3. VECTOR EMBEDDING GENERATION                              |
|    Generate 1024-dim dense vectors (Jina / local model)     |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| 4. VECTOR INDEXING (QDRANT)                                 |
|    Upsert vectors + payloads into collection                |
|    (collection: edumate_knowledge_v3)                       |
+-------------------------------------------------------------+
```

---

## ⚡ Query-Time Retrieval & Generation Flow

```text
                    +------------------------+
                    | Student Query Received |
                    +-----------+------------+
                                |
                                v
                    +------------------------+
                    | Security Guard & Cache |
                    | (Prompt Guard, CacheL2)|
                    +-----------+------------+
                                | (Cache Miss)
                                v
                    +------------------------+
                    | Query Router           |
                    | (Domain, Language, Intent)
                    +-----------+------------+
                                |
                                v
                    +------------------------+
                    | Hybrid Vector Search   |
                    | (Qdrant Cosine Sim)    |
                    +-----------+------------+
                                |
                                v
                    +------------------------+
                    | Context Ranking & Dedupe
                    | (Re-ranking & Truncation)
                    +-----------+------------+
                                |
                                v
                    +------------------------+
                    | Prompt Assembly        |
                    | (System Prompt + Chunks)
                    +-----------+------------+
                                |
                                v
                    +------------------------+
                    | LLM Generation         |
                    | (llama.cpp / Qwen 2.5) |
                    +-----------+------------+
                                |
                                v
                    +------------------------+
                    | Streaming Formatter    |
                    | (Citations + Formulas) |
                    +-----------+------------+
                                |
                                v
                    +------------------------+
                    | Student Receives Answer|
                    +------------------------+
```

---

## 📊 Chunking Specifications

- **Chunk Target Size**: 500 – 800 tokens (~2,000 characters)
- **Overlap Window**: 100 – 150 tokens (preserves context continuity across boundaries)
- **Metadata Enriched**: File origin, category, page number, section heading, SHA-256 chunk hash.
- **Verification Invariant**: A document is only marked `completed` when its Qdrant indexed vector count matches its extracted chunk count exactly.
