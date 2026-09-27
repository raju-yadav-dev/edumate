# ⚡ EduMate AI — 10-Layer Smart Cache Architecture

EduMate employs a multi-tiered **Smart Cache Hub** designed to minimize LLM inference overhead, eliminate redundant vector searches, and deliver sub-50ms response times for common university questions.

---

## 🏛️ Cache Layers Hierarchy

```text
Query Request
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Client / HTTP Cache (Browser / ETag / Cache-Control)│
└─────────────────────────────┬───────────────────────────────┘
                              ▼ (Miss)
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Prompt Query Cache (Exact & Normalized Questions)  │
└─────────────────────────────┬───────────────────────────────┘
                              ▼ (Miss)
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Embedding Cache (Pre-computed Query Vectors)       │
└─────────────────────────────┬───────────────────────────────┘
                              ▼ (Miss)
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Vector Search Cache (Top-K Similarity Results)     │
└─────────────────────────────┬───────────────────────────────┘
                              ▼ (Miss)
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: Document Chunk Cache (In-Memory / Disk Fast Read)  │
└─────────────────────────────┬───────────────────────────────┘
                              ▼ (Miss)
┌─────────────────────────────────────────────────────────────┐
│ Layer 6: Retriever Context Cache (De-duplicated Text Chunks)│
└─────────────────────────────┬───────────────────────────────┘
                              ▼ (Miss)
┌─────────────────────────────────────────────────────────────┐
│ Layer 7: LLM Response Cache (Full Synthesized Answers)      │
└─────────────────────────────┬───────────────────────────────┘
                              ▼ (Miss)
┌─────────────────────────────────────────────────────────────┐
│ Layer 8: Conversation Context Cache (Multi-turn History)    │
└─────────────────────────────┬───────────────────────────────┘
                              ▼ (Miss)
┌─────────────────────────────────────────────────────────────┐
│ Layer 9: Model KV Cache (llama.cpp Key-Value Token Cache)   │
└─────────────────────────────┬───────────────────────────────┘
                              ▼ (Miss)
┌─────────────────────────────────────────────────────────────┐
│ Layer 10: Persistent Disk Cache (Survives Restarts)         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📖 Detailed Layer Breakdown

| Layer | Component | Eviction Strategy | Purpose |
|---|---|---|---|
| **Layer 1** | `Layer1_ClientCache` | TTL (60s) | Prevents identical duplicate requests from the web client. |
| **Layer 2** | `Layer2_PromptQueryCache` | LRU (500 items) | Matches normalized user queries directly to cached intent and responses. |
| **Layer 3** | `Layer3_EmbeddingCache` | LRU (2,000 items) | Stores generated query embeddings to avoid re-calling embedding APIs. |
| **Layer 4** | `Layer4_VectorSearchCache` | LRU (1,000 items) | Caches Qdrant search results for given vector fingerprints. |
| **Layer 5** | `Layer5_DocumentChunkCache` | LRU + Disk backup | In-memory cache for parsed document chunks to eliminate disk IO. |
| **Layer 6** | `Layer6_RetrieverCache` | TTL (15 min) | Stores assembled and ranked multi-document context blocks. |
| **Layer 7** | `Layer7_LLMResponseCache` | Semantic Match | Caches verified LLM answer responses for high-frequency queries. |
| **Layer 8** | `Layer8_ConversationContextCache` | Sliding Window | Maintains active student session context across chat turns. |
| **Layer 9** | `Layer9_ModelKVCache` | Engine-managed | Leverages llama.cpp KV state reuse for fast continuous token generation. |
| **Layer 10** | `Layer10_PersistentDiskCache` | Storage Sync | Persists cache snapshots to disk across server reboots. |

---

## 🧹 Cache Management

To flush all in-memory and persistent cache layers:
```bash
npm run clean-cache
```
Or via HTTP API:
```http
POST /api/developer/cache/clear
Authorization: Bearer <ADMIN_TOKEN>
```
