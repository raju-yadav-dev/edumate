# EduMate Implementation Roadmap

EduMate is being implemented as a phased enterprise platform, not as a single chatbot feature. Each phase must keep controllers thin, isolate business logic in services, protect APIs with middleware, and preserve a stable response contract.

## Phase 1: Production Foundation

Status: in progress

- Versioned REST API under `/api/v1`
- Standard response envelope with `success`, `message`, `data`, `metadata`, `pagination`, and `errors`
- JWT authentication and RBAC middleware
- Password policy validation
- Security middleware: Helmet, compression, rate limiting, CORS
- Centralized 404 and error handling
- User account lifecycle fields and indexes
- Auth APIs: register, login, logout, profile, change password, password reset compatibility

## Phase 2: Core Platform Data

- Institution, department, course, faculty, announcement, event, fee, scholarship, hostel, transport, and academic calendar models
- Admin CRUD APIs with search, filter, pagination, soft delete, audit metadata
- Student and teacher read APIs
- Dashboard summary services

## Phase 3: AI Brain

Status: first routed pipeline implemented

- Intent detection
- Decision engine
- AI router
- Prompt builder
- Context builder
- Response validator and formatter
- Groq provider manager with retries, timeouts, provider health, and key rotation
- Conversation memory service

## Phase 4: Documents And RAG

Status: document metadata and secure upload surface implemented

- Secure document upload
- Document metadata and versioning
- Text extraction pipeline
- Chunking and embeddings metadata
- ChromaDB integration
- Citation generation
- Knowledge-base search and re-index APIs

## Phase 5: Frontend Experience

- Role-aware protected routes
- Shared app shell, sidebar, topbar, and dashboard layouts
- Admin dashboard
- Student dashboard
- Teacher dashboard
- AI assistant interface with markdown, citations, and streaming-ready UI
- Profile and settings pages

## Phase 6: Operations

- Structured logging
- Audit logs
- API monitoring endpoints
- Docker and docker-compose
- CI workflow
- Deployment and environment documentation
- Backup and recovery guide

## Architecture Rule

Every new feature follows:

`route -> middleware -> controller -> service -> model/external provider -> response formatter`

Controllers must never call AI providers, map providers, vector databases, or raw external APIs directly.
