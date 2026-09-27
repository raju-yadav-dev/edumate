# EduMate Admin & User Guides (v1.0 Production)

---

# Part 1: Admin Console User Guide

Access the Admin Console at: `http://localhost:5173/admin`

### 1. File Manager
- Organize documents into institutional categories (Admissions, Academics, Hostel, Fees, Faculty, Notices, Campus Navigation).
- Drag and drop uploads with automatic magic-byte verification and deduplication.
- Bulk reindex, move, copy, and delete operations.

### 2. Chunking Studio
- Dedicated browser control center for ingestion workers.
- Live progress bar, throughput monitoring, active workers count, and queue ETA.
- Chunk inspector with token counts and dense embedding status.
- Pause, resume, retry failed ingestion jobs, or trigger whole-folder reindexing.

### 3. Smart Cache Dashboard
- Inspect hit ratios across all 10 cache layers.
- Real-time latency savings and memory footprint meters.
- Selective invalidation controls (e.g. invalidate prompt cache, vector cache, or full system flush).

### 4. Security & Audit Hub
- Real-time threat detection cards: Failed Logins, Blocked Requests, Rate Limit Hits, and Prompt Injections.
- Live active session management with one-click revocation.
- Searchable and filterable security audit event log.

---

# Part 2: Student & Faculty User Guide

Access the Student Chat Interface at: `http://localhost:5173`

### 1. Conversational Queries & Grounded Answers
- Ask anything regarding university procedures, faculty contacts, admissions, hostel fees, and campus navigation.
- Every university fact is grounded with precise source document citations (clickable PDF/DOCX previews).

### 2. General AI & Programming Assistant
- Ask general programming questions (Python, JavaScript, Data Structures, Algorithms, Mathematics).
- Handled directly by the local Qwen LLM without requiring citation lookup.

### 3. Voice Interaction
- Click the microphone icon to speak your query.
- Listen to synthesized audio responses in English, Hindi, and regional languages.

### 4. Conversation History & Export
- Automatically saved multi-turn conversations.
- Export chat history as PDF, Markdown, JSON, or TXT.
