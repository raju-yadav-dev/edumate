# 🔧 EduMate AI — Troubleshooting Guide

This guide covers resolution steps for common setup and runtime issues.

---

## 🛑 Common Issues & Solutions

### 1. MongoDB Connection Failure
- **Error**: `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017`
- **Solution**:
  1. Ensure MongoDB service is running: `sudo systemctl status mongod` or Start MongoDB service on Windows Services.
  2. If using Docker: `docker run -d -p 27017:27017 mongo:latest`
  3. Verify `MONGODB_URI` in `.env` matches your connection string.

---

### 2. Qdrant Vector DB Unavailable
- **Error**: `FetchError: request to http://localhost:6333/collections/... failed`
- **Solution**:
  1. Launch Qdrant Docker container:
     ```bash
     docker run -d -p 6333:6333 -p 6334:6334 -v qdrant_storage:/qdrant/storage qdrant/qdrant:latest
     ```
  2. Verify dashboard at [http://localhost:6333/dashboard](http://localhost:6333/dashboard).
  3. Run `npm run health` to verify automated connectivity.

---

### 3. Local llama.cpp Model Not Found / Server Offline
- **Error**: `Local LLM model file not found` or `ECONNREFUSED 127.0.0.1:8080`
- **Solution**:
  1. Download the Qwen 2.5 3B GGUF model into `server/ai-models/`:
     ```bash
     # Place Qwen2.5-3B-Instruct-Q4_K_M.gguf inside server/ai-models/
     ```
  2. Or set `LLM_PROVIDER=groq` or `LLM_PROVIDER=gemini` with your respective API keys in `.env` if running without local llama.cpp.

---

### 4. Missing Module `../storage/localStorageManager`
- **Error**: `Cannot find module '../storage/localStorageManager'`
- **Solution**:
  1. Ensure the `server/storage/` directory and `localStorageManager.js` exist.
  2. Run `npm run sync-storage` to ensure local storage files are synchronized with MongoDB.

---

### 5. Port Conflicts (5000, 5001, 5173, 8080)
- **Error**: `EADDRINUSE: address already in use :::5000`
- **Solution**:
  - **Windows**:
    ```powershell
    netstat -ano | findstr :5000
    taskkill /PID <PID> /F
    ```
  - **Linux / macOS**:
    ```bash
    lsof -i :5000 | awk 'NR>1 {print $2}' | xargs kill -9
    ```

---

### 6. Cache Invalidation / Stale Responses
- **Symptom**: Chat answers do not reflect newly updated documents.
- **Solution**:
  ```bash
  npm run clean-cache
  npm run ingest -- --force
  ```
