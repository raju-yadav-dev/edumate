# 🔬 EduMate Knowledge Studio

The **Knowledge Studio** (running on **Port 5001**) is EduMate's dedicated document ingestion, chunking inspection, and knowledge management microservice.

---

## 🌟 Key Features

1. **Document Ingestion & File Upload**:
   - Supports PDF, DOCX, DOC, Markdown, and TXT files.
   - Automatic category assignment based on directory structure (`admissions`, `academics`, `fees`, `hostel`, `departments`, etc.).

2. **Chunk Inspector**:
   - Live visual preview of extracted chunks.
   - Inspect token count, character density, metadata tags, and chunk checksums.

3. **Storage Explorer**:
   - Browse the local `storage/` directory tree in real time.
   - Filter out ignored artifacts (cache, `.tmp`, `.log`, `.gguf`) automatically.

4. **Runtime Pipeline Console**:
   - Real-time Server-Sent Events (SSE) tracking chunking progress, extraction stages, and vector indexing states.

5. **Vector & Reindex Management**:
   - Re-embed existing chunks into Qdrant with one click.
   - Validate vector count parity with chunk count.

---

## 🔌 Knowledge Studio REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Microservice health and uptime check |
| `GET` | `/api/studio/status` | Global studio status, MongoDB & Qdrant connectivity |
| `GET` | `/api/studio/storage` | Local storage disk metrics and category breakdown |
| `GET` | `/api/studio/documents` | List all registered knowledge documents and indexing states |
| `POST` | `/api/studio/upload` | Upload new documents directly to local category folders |
| `POST` | `/api/studio/ingest` | Trigger background ingestion worker for pending documents |
| `GET` | `/api/studio/chunks/:docId` | Retrieve all parsed chunks for a specific document |
| `POST` | `/api/studio/reindex/:docId` | Force re-embedding and vector indexing for a document |
| `DELETE` | `/api/studio/documents/:docId` | Safely delete a document, its chunks, and its vectors |
| `GET` | `/api/studio/events` | SSE stream for live real-time ingestion progress |

---

## 🖥️ Running Knowledge Studio

Start the standalone Knowledge Studio server:
```bash
npm run studio
```
Navigate to [http://localhost:5001](http://localhost:5001) in any web browser.
