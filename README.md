# 🎓 EduMate – AI-Powered Educational Assistant

EduMate is an AI-powered chatbot designed for educational institutions. It helps students, parents, faculty, and administrators get instant answers about admissions, academics, fees, placements, hostel facilities, examinations, and campus-related information.

The project uses **Retrieval-Augmented Generation (RAG)** to provide accurate responses from institutional documents instead of relying only on a language model.

---

## 🚀 Features

### 👤 Authentication
- User Registration & Login
- Password Hashing with BCrypt
- JWT Authentication & Role-Based Access
- Admin Panel Authentication

### 📄 Document & Web Management
- PDF, DOCX, TXT, and XLSX Document Upload
- Automated Web Crawling and Scraping of Educational Site Maps
- Content Cleaning & Chunking Pipelines

### 🤖 AI & Search Stack
- Groq LLM Integration & Jina AI Embeddings Integration
- Qdrant Vector Database for Vector Search
- Custom Semantic Query Router & Intent Engine
- Speech Recognition & Voice Commands

---

## 📁 Exact Project Structure (Excluding `node_modules`)

```text
edumate/
├── client/
│   ├── public/
│   ├── src/
│   │   ├── Admin/
│   │   │   ├── Console/
│   │   │   │   ├── AdminConsole.css
│   │   │   │   └── AdminConsole.jsx
│   │   │   ├── Login/
│   │   │   │   ├── AdminLogin.css
│   │   │   │   └── AdminLogin.jsx
│   │   │   ├── Admin.css
│   │   │   ├── Admin.jsx
│   │   │   └── AdminTheme.css
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── About/
│   │   │   ├── Button/
│   │   │   ├── Chat/
│   │   │   ├── Contact/
│   │   │   ├── FAQ/
│   │   │   ├── Features/
│   │   │   ├── Footer/
│   │   │   ├── Hero/
│   │   │   ├── Map/
│   │   │   ├── Navbar/
│   │   │   ├── Statistics/
│   │   │   ├── ThemeToggle/
│   │   │   ├── Voice/
│   │   │   └── fileManager/
│   │   ├── context/
│   │   │   ├── AdminAuthContext.jsx
│   │   │   ├── AuthContext.jsx
│   │   │   ├── ChatContext.jsx
│   │   │   ├── ThemeContext.jsx
│   │   │   └── contexts.js
│   │   ├── crawler/
│   │   │   ├── Crawler.css
│   │   │   ├── CrawlerManager.jsx
│   │   │   └── crawlerService.js
│   │   ├── hooks/
│   │   │   ├── useAdminAuth.js
│   │   │   ├── useAuth.js
│   │   │   ├── useChat.js
│   │   │   ├── useKeyboardShortcuts.js
│   │   │   ├── useTheme.js
│   │   │   └── useVoice.js
│   │   ├── pages/
│   │   │   ├── Chat/
│   │   │   ├── ForgotPassword/
│   │   │   ├── Home/
│   │   │   ├── Login/
│   │   │   ├── Profile/
│   │   │   └── Register/
│   │   ├── routes/
│   │   │   ├── AdminRoute.jsx
│   │   │   └── AppRouter.jsx
│   │   ├── services/
│   │   │   ├── voice/
│   │   │   │   ├── AudioAnalyserService.js
│   │   │   │   ├── LanguageDetectionService.js
│   │   │   │   ├── SpeechRecognitionService.js
│   │   │   │   ├── SpeechSynthesisService.js
│   │   │   │   ├── VadService.js
│   │   │   │   └── VoiceCommandService.js
│   │   │   ├── activityLogService.js
│   │   │   ├── adminApi.js
│   │   │   ├── adminService.js
│   │   │   ├── adminSession.js
│   │   │   ├── analyticsService.js
│   │   │   ├── apiConfig.js
│   │   │   ├── authService.js
│   │   │   ├── chatService.js
│   │   │   ├── documentService.js
│   │   │   └── knowledgeService.js
│   │   ├── styles/
│   │   │   ├── global.css
│   │   │   └── variables.css
│   │   ├── App.css
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.example
│   ├── .gitignore
│   ├── dev_index.html
│   ├── dev_main.jsx
│   ├── dev_vite_client.js
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── react_icons_fi.js
│   └── vite.config.js
├── docker/
│   └── docker-compose.yml
├── docs/
│   ├── API_CONTRACT.md
│   └── IMPLEMENTATION_ROADMAP.md
├── scripts/
│   ├── banner.js
│   ├── bootstrap.js
│   ├── clean.js
│   ├── deleteOldFiles.js
│   ├── dependencyChecker.js
│   ├── dockerManager.js
│   ├── doctor.js
│   ├── format.js
│   ├── healthCheck.js
│   ├── logger.js
│   ├── reset.js
│   ├── setup.js
│   ├── startup.js
│   ├── verifyEnvironment.js
│   ├── verifyGroq.js
│   ├── verifyMongo.js
│   ├── verifyQdrant.js
│   └── verifySupabase.js
├── server/
│   ├── ai/
│   │   ├── config/
│   │   ├── constants/
│   │   ├── services/
│   │   └── utils/
│   ├── config/
│   │   ├── db.js
│   │   ├── multer.js
│   │   └── supabase.js
│   ├── constants/
│   │   ├── accountStatus.js
│   │   ├── intents.js
│   │   └── roles.js
│   ├── controllers/
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   ├── chatController.js
│   │   ├── documentController.js
│   │   ├── mapController.js
│   │   ├── storageController.js
│   │   ├── uploadController.js
│   │   └── userController.js
│   ├── crawler/
│   │   ├── controllers/
│   │   ├── extractors/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── ContentCleaner.js
│   │   ├── QueueManager.js
│   │   ├── RobotsManager.js
│   │   ├── SitemapCrawler.js
│   │   ├── SyncScheduler.js
│   │   └── WebsiteCrawler.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── documentUploadMiddleware.js
│   │   ├── errorMiddleware.js
│   │   ├── multer.js
│   │   ├── roleMiddleware.js
│   │   ├── uploadMiddleware.js
│   │   └── validationMiddleware.js
│   ├── models/
│   │   ├── ActivityLog.js
│   │   ├── Chat.js
│   │   ├── Chunk.js
│   │   ├── Document.js
│   │   ├── History.js
│   │   ├── KnowledgeSource.js
│   │   ├── Location.js
│   │   ├── RouteCache.js
│   │   ├── Setting.js
│   │   └── User.js
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── apiRoutes.js
│   │   ├── authRoutes.js
│   │   ├── chatRoutes.js
│   │   ├── documentRoutes.js
│   │   ├── mapRoutes.js
│   │   ├── storageRoutes.js
│   │   ├── uploadRoutes.js
│   │   └── userRoutes.js
│   ├── services/
│   │   ├── authService.js
│   │   ├── chatService.js
│   │   ├── decisionEngine.js
│   │   ├── documentService.js
│   │   ├── embeddingService.js
│   │   ├── groqProviderManager.js
│   │   ├── intentService.js
│   │   ├── mapService.js
│   │   ├── memoryService.js
│   │   ├── pdfService.js
│   │   ├── promptService.js
│   │   ├── ragService.js
│   │   ├── responseFormatter.js
│   │   ├── responseValidator.js
│   │   ├── settingsService.js
│   │   ├── storageService.js
│   │   ├── userService.js
│   │   └── vectorService.js
│   ├── utils/
│   │   ├── AppError.js
│   │   ├── asyncHandler.js
│   │   ├── locationHelper.js
│   │   ├── response.js
│   │   ├── textSplitter.js
│   │   └── tokenizer.js
│   ├── .env
│   ├── .env.example
│   ├── .gitignore
│   ├── app.js
│   ├── docker-compose.yml
│   ├── index_pending_docs.js
│   ├── package.json
│   ├── server.js
│   └── testSupabase.js
├── .env
├── .env.example
├── .gitignore
├── package.json
├── README.md
├── check_errors.js
├── scratch_check_db.js
└── LICENSE
```

---

## 🛠 Tech Stack & Package Requirements

The application runs as an npm workspaces monorepo. Dependencies can be installed globally from the root directory, or individually within their respective workspaces.

### 1. Root Workspace (`/package.json`)
Manage scripts and monorepo tasks.
*   **Dependencies**:
    *   `@qdrant/js-client-rest` (V1.18.0) - Node SDK for Qdrant vector database.
    *   `undici` (V8.9.0) - Fast HTTP client.
*   **DevDependencies**:
    *   `concurrently` (V8.2.2) - Run client and server simultaneously.

**Root Installation Command:**
```bash
# Installs all packages for the entire monorepo (root, client, and server) at once
npm install
```

---

### 2. Frontend Workspace (`/client/package.json`)
Built with React 19, Vite, and CSS3.
*   **Core Dependencies**:
    *   `react` & `react-dom` (^19.2.7) - UI Framework.
    *   `react-router-dom` (^7.11.0) - Declarative routing.
*   **AI & Markdown Rendering**:
    *   `react-markdown` (^10.1.0) - Markdown compiler.
    *   `remark-gfm` (^4.0.1) & `remark-math` (^6.0.0) - GFM and Math markdown parser extensions.
    *   `rehype-highlight` (^7.0.2) & `rehype-katex` (^7.0.1) - Highlight and LaTeX renderer extensions.
    *   `highlight.js` (^11.11.1) - Code highlighting.
    *   `katex` (^0.17.0) - LaTeX math equations.
*   **Voice Integration**:
    *   `@ricky0123/vad-web` (^0.0.30) - Voice Activity Detection.
*   **Interactive Maps**:
    *   `leaflet` (^1.9.4) - Leaflet maps interface.
*   **UI Assets**:
    *   `lucide-react` (^1.23.0) & `react-icons` (^5.7.0) - Icons.

**Frontend Only Installation Command (from `/client` folder):**
```bash
cd client
npm install
# Or to install individual packages:
npm install @ricky0123/vad-web highlight.js katex leaflet lucide-react react react-dom react-icons react-markdown react-router-dom rehype-highlight rehype-katex remark-gfm remark-math
```

---

### 3. Backend Workspace (`/server/package.json`)
NodeJS with Express, MongoDB, Supabase, and Vector clients.
*   **Core Framework**:
    *   `express` (^5.2.1) - Web app framework.
    *   `cors` (^2.8.6), `helmet` (^8.2.0), `compression` (^1.8.1), `cookie-parser` (^1.4.7) - Middleware.
    *   `dotenv` (^17.4.2) - Environment configurations loader.
    *   `express-rate-limit` (^8.5.2) - API rate limiting.
*   **Database & Storage**:
    *   `mongoose` (^9.7.3) - MongoDB ODM.
    *   `@qdrant/js-client-rest` (^1.18.0) - Qdrant client.
    *   `@supabase/supabase-js` (^2.110.8) - Supabase Storage and Client.
*   **Auth & Hashing**:
    *   `bcrypt` (^6.0.0) - Hashing library.
    *   `jsonwebtoken` (^9.0.3) - Auth token signing.
*   **Scraping & Crawler**:
    *   `crawlee` (^3.18.0) - Web scraping framework.
    *   `cheerio` (^1.2.0) - HTML parsing.
    *   `jsdom` (^30.0.1) & `@mozilla/readability` (^0.6.0) - Article readability extractor.
    *   `axios` (^1.19.0) - HTTP requester.
*   **Document Uploads & Parsers**:
    *   `multer` (^2.2.0) - Multipart form data handler.
    *   `pdf-parse` (^1.1.1) - PDF text parser.
    *   `officeparser` (^7.5.1) - MS Office document parser.
    *   `mammoth` (^1.12.0) - DOCX text parser.
    *   `xlsx` (^0.18.5) - Spreadsheet parser.
    *   `adm-zip` (^0.6.0) - ZIP archives utility.
    *   `file-type` (^21.3.4) - File type detection.
*   **DevDependencies**:
    *   `nodemon` (^3.1.14) - Development watcher.

**Backend Only Installation Command (from `/server` folder):**
```bash
cd server
npm install
# Or to install individual packages:
npm install @mozilla/readability @qdrant/js-client-rest @supabase/supabase-js adm-zip axios bcrypt cheerio compression cookie-parser cors crawlee dotenv express express-rate-limit file-type helmet jsdom jsonwebtoken mammoth mongoose multer officeparser pdf-parse xlsx
```

---

## ⚙️ Setup & Developer Workflow

EduMate provides helper scripts to orchestrate setups and servers from the root workspace.

### Quick Start Workflow

1.  **Clone the Repository:**
    ```bash
    git clone <repo_url>
    cd edumate
    ```

2.  **Install Monorepo Workspace Dependencies:**
    ```bash
    npm install
    ```

3.  **Run One-Time Initial Setup:**
    Copies template `.env` configurations, checks configurations, pulls/runs Qdrant Docker containers, and runs connection health checks:
    ```bash
    npm run setup
    ```

4.  **Run Development Servers Concurrently:**
    ```bash
    npm run dev
    ```

### Master CLI Commands

*   `npm install` - Installs packages across all workspaces.
*   `npm run setup` - Validates Node/NPM, provisions Docker environments, setups collections.
*   `npm run dev` - Runs Hot reload Vite Client & Express server simultaneously.
*   `npm run doctor` - Audits external API integrations (MongoDB, Supabase, Gemini, Qdrant).
*   `npm run clean` - Cleans build outputs, local cache, and resets node modules.
*   `npm run reset` - Stops services, purges caches, recreates vector databases, and performs clean installs.

---

## 🔐 Environment Variables

A single `.env` file at the root level controls configs for both applications:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret

SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

GROQ_API_KEY=your_groq_api_key
EMBEDDING_PROVIDER=jina
EMBEDDING_MODEL=jina-embeddings-v3
JINA_API_KEY=your_jina_api_key

QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=edumate
```

---

## 🎯 Contributing & Developer Team

*   **Raju Yadav** (BCA Student, Full Stack Developer) - [GitHub](https://github.com/raju-yadav-dev)
*   **Baishnabi Shaw** (BCA Student, Full Stack Developer) - [GitHub](https://github.com/baishnabi-shaw-dev)
*   **Perona Chaudhari** (Content Researcher) - [GitHub](https://github.com/preranachowdhury83-byte)
