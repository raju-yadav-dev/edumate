# EduMate Diagnostic & Troubleshooting Runbook (v1.0 Production)

---

## 1. Quick Health Check Command
Run the diagnostic doctor:
```cmd
npm run doctor
```
Or execute the master release test suite:
```cmd
npm run qa
```

---

## 2. Common Issues & Solutions

### Issue A: Port Already In Use (Port 5000, 5001, or 5173)
- **Symptom**: `EADDRINUSE: address already in use :::5000`
- **Solution (Windows PowerShell / CMD)**:
  ```cmd
  netstat -ano | findstr :5000
  taskkill /PID <PID> /F
  ```
- Or adjust `PORT` or `CHUNKING_PORT` in `.env`.

### Issue B: MongoDB Connection Failure
- **Symptom**: `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017`
- **Solution**:
  1. Ensure MongoDB Windows service is running:
     ```cmd
     net start MongoDB
     ```
  2. Or provide a remote MongoDB Atlas URI in `.env` (`MONGODB_URI=mongodb+srv://...`).

### Issue C: Qdrant Vector DB Offline
- **Symptom**: Vector similarity queries return fallback or warnings.
- **Solution**:
  1. Start the Qdrant container:
     ```cmd
     docker run -d -p 6333:6333 -p 6334:6334 -v %cd%/docker/qdrant_storage:/qdrant/storage:z qdrant/qdrant:latest
     ```
  2. EduMate automatically falls back to memory-mapped local chunk search (`storage/chunks/`) if Qdrant is temporarily offline.

### Issue D: Local llama.cpp Process Exits
- **Symptom**: Chat queries take long or return fallback.
- **Solution**:
  1. Verify your `.gguf` file exists in `llama.cpp/` (e.g. `llama.cpp/qwen2.5-3b-instruct-q4_k_m.gguf`).
  2. Check `logs/llama.log` for out-of-memory or model architecture errors.

### Issue E: Corrupted or Stale Cache
- **Symptom**: Old answers returned after documents were updated.
- **Solution**:
  - Open Admin Panel -> Smart Cache -> Click **"Flush All Cache Layers"**.
  - Or run:
    ```cmd
    node scripts/clean.js
    ```
