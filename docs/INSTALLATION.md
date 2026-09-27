# 🚀 EduMate AI — Installation & Setup Guide

This guide walks you through setting up the complete EduMate ecosystem from scratch on a clean system (Windows, macOS, or Linux).

---

## 📋 System Prerequisites

| Component | Minimum Requirement | Recommended |
|---|---|---|
| **Operating System** | Windows 10/11, macOS 12+, Ubuntu 20.04+ | Windows 11 / Ubuntu 22.04 LTS |
| **Node.js** | v18.16.0+ | v20.x or v22.x LTS |
| **npm** | v9.0.0+ | v10.x+ |
| **RAM** | 8 GB | 16 GB+ (for local Qwen 2.5 3B LLM) |
| **Storage** | 10 GB free disk space | 25 GB+ (for vectors & models) |
| **MongoDB** | MongoDB Community Server 6.0+ | MongoDB 7.0+ or MongoDB Atlas |
| **Qdrant** | Qdrant v1.7+ (Docker or Binary) | Qdrant v1.18+ |

---

## 🛠️ Step-by-Step Installation

### 1. Clone Repository
```bash
git clone https://github.com/raju-yadav-dev/edumate.git
cd edumate
```

### 2. Install Dependencies
EduMate is a unified monorepo containing client and server workspaces:
```bash
npm run setup
```
*(Alternatively, run `npm install` at root which installs monorepo dependencies and workspace packages).*

### 3. Configure Environment Variables
Copy the example environment template:
```bash
cp .env.example .env
```
Key configuration settings in `.env`:
```env
# Application
NODE_ENV=development
PORT=5000
CHUNKING_PORT=5001

# MongoDB
MONGODB_URI=mongodb://localhost:27017/edumate

# Vector Database (Qdrant)
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=edumate_knowledge_v3

# LLM Runtime (Local llama.cpp or Cloud API)
LLM_PROVIDER=llama.cpp
LLAMA_SERVER_URL=http://localhost:8080/v1
LLAMA_PORT=8080

# Embedding Provider
EMBEDDING_PROVIDER=jina
JINA_API_KEY=your_jina_key_here
```

### 4. Start Infrastructure Services

#### A. MongoDB
- **Local Service**: Ensure `mongod` is running on `mongodb://localhost:27017`.
- **Docker**:
  ```bash
  docker run -d --name edumate-mongo -p 27017:27017 mongo:latest
  ```

#### B. Qdrant Vector Database
- **Docker**:
  ```bash
  docker run -d --name edumate-qdrant -p 6333:6333 -p 6334:6334 -v qdrant_storage:/qdrant/storage qdrant/qdrant:latest
  ```

#### C. Local LLM Runtime (Optional for Offline AI)
Download the recommended GGUF model into `server/ai-models/`:
- Model: `Qwen2.5-3B-Instruct-Q4_K_M.gguf`
- Start llama-server:
  ```bash
  llama-server -m server/ai-models/Qwen2.5-3B-Instruct-Q4_K_M.gguf --port 8080 -c 4096 --n-gpu-layers 33
  ```

---

## 🩺 System Health Diagnostics

Verify that all components are operational before starting the full platform:
```bash
npm run health
```

EduMate Doctor will run automated checks on:
- Node.js & npm runtime versions
- Monorepo package dependencies
- `.env` configuration keys
- MongoDB database connection
- Local storage root permissions (`storage/`)
- Qdrant Vector Engine collection status
- LLM Provider connectivity

---

## 🚀 Launching EduMate

Launch all microservices (Frontend, Backend API, Knowledge Studio) with a single command:
```bash
npm run edumate
```

Access Points:
- **Student Web Application**: [http://localhost:5173](http://localhost:5173)
- **Knowledge Studio**: [http://localhost:5001](http://localhost:5001)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **Qdrant Web Dashboard**: [http://localhost:6333/dashboard](http://localhost:6333/dashboard)
