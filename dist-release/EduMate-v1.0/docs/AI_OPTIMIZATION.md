# EduMate AI Optimisation Changes

This update targets four production issues:

1. High response latency from unnecessary LLM preprocessing/verification calls.
2. Multi-part questions such as "HOD + fee" not being answered completely.
3. Course/department synonym mismatch such as "B.Tech" vs "CSE" in institutional documents.
4. Voice mode treating accidental speech/noise as an immediate interruption.
5. Excessive prompt/token usage limiting the number of queries available on the configured AI plan.

## New request flow

```text
User text/voice
  -> deterministic query normalisation
  -> multi-intent detection
  -> alias expansion (B.Tech <-> CSE where appropriate)
  -> parallel/intent-specific retrieval
  -> reranking
  -> small evidence set
  -> compact prompt
  -> one final LLM call
  -> response + citations
```

## Token controls

The following settings are available in `.env`:

- `LLM_MAX_OUTPUT_TOKENS=500`
- `LLM_TIMEOUT_MS=20000`
- `RAG_MAX_CHUNKS=4`
- `RAG_MAX_CHUNKS_PER_INTENT=3`
- `RAG_MAX_CHUNK_CHARS=4500`
- `RAG_HISTORY_MAX_TOKENS=500`
- `RAG_MAX_HISTORY_CHARS=2000`
- `RAG_EXPAND_ADJACENT=false`
- `ENABLE_LLM_QUERY_ANALYSIS=false`

The default path no longer makes an LLM call just to rewrite/classify every query. LLM-based query analysis is available as an opt-in fallback via `ENABLE_LLM_QUERY_ANALYSIS=true`.

Evidence validation and grounding verification are deterministic in the main RAG path, removing additional LLM calls per intent/answer.

## Multi-intent support

Queries can now produce multiple intents and intent-specific retrieval queries. For example:

```text
Who is the HOD of CSE and what is the fee structure?
```

is retrieved as separate HOD and fee evidence, then combined into one final answer.

## B.Tech/CSE retrieval

The query optimiser adds canonical aliases such as:

- B.Tech / BTech / B Tech / Bachelor of Technology
- CSE / Computer Science / Computer Science and Engineering
- BCA / Bachelor of Computer Applications

The reranker also boosts relevant course/department matches.

## Voice behaviour

Voice mode no longer keeps browser speech recognition open while EduMate is speaking. Listening resumes after TTS finishes. This prevents a single accidental word from being interpreted as a user interruption. A transcript is submitted only after actual speech and end-of-speech handling.

## Important

The existing RAG, Qdrant, MongoDB, Supabase, crawler and map architecture is preserved. These changes focus on orchestration, retrieval efficiency, prompt size and voice turn-taking.
