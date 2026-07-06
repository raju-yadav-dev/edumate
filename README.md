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

# ⚙️ Installation

## Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/edumate.git
```

```bash
cd edumate
```

---

## Install Client

```bash
cd client
npm install
```

---

## Install Server

```bash
cd ../server
npm install
```

---

# 🔐 Environment Variables

Create a `.env` file inside the **server** directory.

```env
PORT=5000

MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret

GEMINI_API_KEY=your_gemini_api_key
```

---

# ▶ Running the Project

## Backend

```bash
cd server
npm run dev
```

Runs on:

```
http://localhost:5000
```

---

## Frontend

```bash
cd client
npm run dev
```

Runs on:

```
http://localhost:5173
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
