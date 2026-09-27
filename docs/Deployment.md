# EduMate Deployment Guide (v1.0 Production)

EduMate is designed to run seamlessly on a single developer machine or campus server.

---

## 1. Quick Windows Production Deployment (1-Command)

### Prerequisites:
- Windows 10/11 (64-bit)
- Node.js 18+ ([Download Node.js](https://nodejs.org/))
- MongoDB Community Server (Running on localhost:27017 or Atlas URI)
- (Optional) Docker Desktop for Qdrant container

### Deployment Steps:
1. Clone or extract the `edumate` repository:
   ```cmd
   git clone https://github.com/raju-yadav-dev/edumate.git
   cd edumate
   ```
2. Double-click `EduMate.bat` (or run `npm run edumate` in terminal).
3. The launcher will automatically verify dependencies, configure storage, start all microservices, and launch the browser at `http://localhost:5173`.

---

## 2. Docker Compose Deployment

To deploy EduMate with containerized Qdrant and MongoDB:

```bash
docker-compose up -d
```

This boots:
- **Qdrant Vector DB** on `localhost:6333`
- **MongoDB** on `localhost:27017`
- Persists vector collections in `./docker/qdrant_storage`

---

## 3. Production Environment Variables (`.env`)

```env
PORT=5000
CHUNKING_PORT=5001
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/edumate
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d
BCRYPT_SALT_ROUNDS=12
LLM_PROVIDER=llama.cpp
LLAMA_SERVER_URL=http://localhost:8080
LLAMA_MODEL_PATH=llama.cpp/qwen2.5-3b-instruct-q4_k_m.gguf
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=edumate
STORAGE_ROOT=storage
API_RATE_LIMIT_MAX=300
```
