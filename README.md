# 🎓 EduMate – AI-Powered Educational Assistant

EduMate is an AI-powered chatbot designed for educational institutions. It helps students, parents, faculty, and administrators get instant answers about admissions, academics, fees, placements, hostel facilities, examinations, and campus-related information.

The project uses **Retrieval-Augmented Generation (RAG)** to provide accurate responses from institutional documents instead of relying only on a language model.

---

## 🚀 Features

### 👤 Authentication
- User Registration
- User Login
- Password Hashing with BCrypt
- JWT Authentication *(Upcoming)*
- Role-Based Access *(Upcoming)*

### 📄 Document Management *(Upcoming)*
- PDF Upload
- DOCX Upload
- TXT Upload
- Document Processing

### 🤖 AI Features *(Upcoming)*
- Google Gemini Integration
- LangChain
- ChromaDB Vector Database
- Embedding Generation
- Retrieval-Augmented Generation (RAG)

### 💬 Chat System *(Upcoming)*
- AI Chat Interface
- Conversation History
- Context-Aware Responses

### 📊 Dashboard *(Upcoming)*
- User Dashboard
- Uploaded Documents
- Chat History
- Analytics

---

# 🛠 Tech Stack

## Frontend

- React
- Vite
- CSS3

## Backend

- Node.js
- Express.js
- MongoDB Atlas
- Mongoose
- JWT
- BCrypt
- Multer

## AI Stack

- Google Gemini API
- LangChain
- ChromaDB
- RAG

---

# 📁 Project Structure

```text
edumate/
│
├── client/
│   │
│   ├── public/
│   │
│   ├── src/
│   │   │
│   │   ├── assets/
│   │   │   ├── fonts/
│   │   │   ├── icons/
│   │   │   ├── images/
│   │   │   └── svg/
│   │   │
│   │   ├── components/
│   │   │   ├── About/
│   │   │   ├── Button/
│   │   │   ├── Contact/
│   │   │   ├── FAQ/
│   │   │   ├── Features/
│   │   │   ├── Footer/
│   │   │   ├── Hero/
│   │   │   ├── Navbar/
│   │   │   ├── Statistics/
│   │   │   ├── ThemeToggle/
│   │   │   ├── Loader/
│   │   │   ├── Modal/
│   │   │   └── ProtectedRoute/
│   │   │
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   ├── ThemeContext.jsx
│   │   │   └── ChatContext.jsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── useTheme.js
│   │   │   └── useChat.js
│   │   │
│   │   ├── layouts/
│   │   │   ├── AuthLayout.jsx
│   │   │   ├── DashboardLayout.jsx
│   │   │   └── MainLayout.jsx
│   │   │
│   │   ├── pages/
│   │   │   ├── Home/
│   │   │   ├── Login/
│   │   │   ├── Register/
│   │   │   ├── ForgotPassword/
│   │   │   ├── ResetPassword/
│   │   │   ├── Dashboard/
│   │   │   ├── Chat/
│   │   │   ├── Upload/
│   │   │   ├── Profile/
│   │   │   ├── Settings/
│   │   │   └── NotFound/
│   │   │
│   │   ├── routes/
│   │   │   ├── AppRoutes.jsx
│   │   │   └── ProtectedRoutes.jsx
│   │   │
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── authService.js
│   │   │   ├── chatService.js
│   │   │   ├── documentService.js
│   │   │   └── userService.js
│   │   │
│   │   ├── styles/
│   │   │   ├── animations.css
│   │   │   ├── global.css
│   │   │   ├── reset.css
│   │   │   └── variables.css
│   │   │
│   │   ├── utils/
│   │   │   ├── constants.js
│   │   │   ├── helpers.js
│   │   │   ├── storage.js
│   │   │   └── validators.js
│   │   │
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   │
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
│
├── server/
│   │
│   ├── config/
│   │   ├── db.js
│   │   ├── gemini.js
│   │   └── multer.js
│   │
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── chatController.js
│   │   ├── documentController.js
│   │   └── userController.js
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── roleMiddleware.js
│   │   ├── errorMiddleware.js
│   │   └── uploadMiddleware.js
│   │
│   ├── models/
│   │   ├── User.js
│   │   ├── Chat.js
│   │   ├── Document.js
│   │   └── Message.js
│   │
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── chatRoutes.js
│   │   ├── documentRoutes.js
│   │   └── userRoutes.js
│   │
│   ├── services/
│   │   ├── authService.js
│   │   ├── chatService.js
│   │   ├── embeddingService.js
│   │   └── ragService.js
│   │
│   ├── uploads/
│   │
│   ├── chroma/
│   │
│   ├── utils/
│   │   ├── generateToken.js
│   │   ├── sendEmail.js
│   │   └── validators.js
│   │
│   ├── .env.example
│   ├── .gitignore
│   ├── app.js
│   ├── server.js
│   ├── package.json
│   └── README.md
│
├── .gitignore
├── README.md
└── LICENSE
```

---

# ⚙️ Installation & Developer Workflow

EduMate is structured as an npm workspaces monorepo. All packages, configurations, docker compose networks, databases, and servers are controlled from the repository root.

## Quick Start

1. **Clone the Repository:**
   ```bash
   git clone <repo>
   cd edumate
   ```

2. **Install Root and Workspace Dependencies:**
   ```bash
   npm install
   ```

3. **Run One-Time Initial Setup:**
   This command automatically configures environment files, pulls Docker images, sets up databases, connects to Supabase, and initializes Qdrant collections.
   ```bash
   npm run setup
   ```

4. **Launch the Development Environment:**
   Run both frontend and backend concurrently with live hot-reloading:
   ```bash
   npm run dev
   ```

## Master CLI Commands

All commands must be executed from the repository root:

- `npm install` - Installs all dependencies for root, client, and server workspaces into a shared root folder.
- `npm run setup` - Validates Node.js/npm, copies environment templates, provisions containers, and checks database connections.
- `npm run dev` - Pre-flights system checks and spins up Vite and Express servers concurrently with colored log prefixing.
- `npm run doctor` - Audits external integrations (MongoDB, Supabase, Gemini, Qdrant) and fixes missing configs.
- `npm run clean` - Cleans caches, logs, build assets, and redundant node_modules folders.
- `npm run reset` - Stops compose services, purges cache, recreates vector database indexes, and rebuilds the project.
- `npm run build` - Builds production bundles for frontend and backend.
- `npm run format` - Standardizes syntax across frontend, backend, and scripts.

---

# 🔐 Environment Variables

A single `.env` file located at the repository root governs configurations for both the client (via Vite) and server:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret

SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

GEMINI_API_KEY=your_gemini_api_key

QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=edumate
```

---

# 📡 API Endpoints

## Authentication

### Register User

```
POST /api/auth/register
```

### Login User *(Upcoming)*

```
POST /api/auth/login
```

---

# ✅ Current Progress

- [x] React Project Setup
- [x] Express Server Setup
- [x] MongoDB Atlas Integration
- [x] Environment Configuration
- [x] User Model
- [x] Password Hashing (BCrypt)
- [x] User Registration API
- [ ] Login API
- [ ] JWT Authentication
- [ ] Protected Routes
- [ ] Forgot Password
- [ ] File Upload
- [ ] Gemini Integration
- [ ] LangChain
- [ ] ChromaDB
- [ ] RAG Pipeline
- [ ] Chat System
- [ ] Dashboard
- [ ] Deployment

---

# 🎯 Project Goals

EduMate aims to simplify communication between educational institutions and users by providing an AI-powered assistant capable of answering institutional queries using official documents and intelligent retrieval techniques.

---

# 🤝 Contributing

Contributions, suggestions, and improvements are welcome.

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to your branch
5. Open a Pull Request

---

# 📄 License

This project is licensed under the MIT License.

---

# 👨‍💻 Developer

**Raju Yadav**

BCA Student • Aspiring Full Stack Developer

GitHub: https://github.com/raju-yadav-dev

**Baishnabi Shaw**

BCA Student • Aspiring Full Stack Developer

GitHub: https://github.com/baishnabi-shaw-dev

# 🔍 Content Researcher

**Perona Chaudhari**

GitHub: https://github.com----
