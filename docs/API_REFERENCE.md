# 🔌 EduMate AI — REST & Streaming API Reference

The EduMate Express API Server runs on **Port 5000** by default and provides RESTful endpoints, Server-Sent Events (SSE) streaming, and administrative interfaces.

---

## 🔐 Authentication
Most endpoints require a Bearer token generated upon login. Include it in the `Authorization` header:
```http
Authorization: Bearer <YOUR_JWT_TOKEN>
```

---

## 💬 Chat & AI Endpoints

### 1. Send Chat Message (SSE Stream)
- **`POST /api/chat/stream`**
- **Payload**:
  ```json
  {
    "message": "What is the attendance policy for B.Tech students?",
    "conversationId": "65e7... optional",
    "language": "en"
  }
  ```
- **Response**: `text/event-stream` delivering incremental tokens, citation payloads, and complete response metadata.

### 2. Conversation History
- **`GET /api/chat/conversations`**: Retrieve all past conversations for the authenticated student.
- **`GET /api/chat/conversations/:id`**: Retrieve messages for a specific session.
- **`DELETE /api/chat/conversations/:id`**: Delete a conversation.

---

## 📄 Knowledge & Document Endpoints

### 1. List Documents
- **`GET /api/documents`**
- **Query Params**: `page`, `limit`, `category`, `search`, `status`
- **Response**: List of indexed documents with chunk statistics and embedding status.

### 2. Upload Document
- **`POST /api/documents/upload`**
- **Multipart Form**: `file` (PDF/DOCX/TXT/MD), `category`
- **Response**: Document metadata object with initial status `pending`.

### 3. Document Details & Chunks
- **`GET /api/documents/:id`**: Document summary.
- **`GET /api/documents/:id/chunks`**: Array of extracted chunks and vectors.

---

## 🛠️ System Health & Diagnostics

### 1. Health Status
- **`GET /api/health`**
- **Response**:
  ```json
  {
    "status": "ok",
    "uptime": 1420.5,
    "services": {
      "mongodb": "connected",
      "qdrant": "connected",
      "storage": "operational",
      "llm": "ready"
    }
  }
  ```

### 2. Storage Metrics
- **`GET /api/storage/stats`**
- Returns total files, quota, used bytes, and category counts.

---

## 🛡️ Developer & Cache Endpoints

- **`GET /api/developer/cache/metrics`**: View hit/miss rates across all 10 cache layers.
- **`POST /api/developer/cache/clear`**: Invalidate all cache layers.
- **`POST /api/developer/simulate-query`**: Dry-run a query through the Router and Agents with detailed telemetry.
