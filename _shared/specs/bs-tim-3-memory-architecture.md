# Architecture Spec: Memory Architecture 2.0 (bs-tim-3)

## 1. Executive Summary
Memory Architecture 2.0 transitions the OpenClaw agent ecosystem from flat-file daily logs (`memory/YYYY-MM-DD.md`) and static long-term memory (`MEMORY.md`) to a structured, vector-backed dual-system memory model. This enables semantic retrieval, strict privacy governance, automated retention lifecycles, and scalable context management across multiple agents and sessions.

## 2. Scope Boundaries

### 2.1 Short-Term Memory (Working Context)
*   **Definition:** Session-scoped context, active task state, and immediate conversational history.
*   **Storage:** Fast, in-memory or Redis-backed key-value store.
*   **Capacity:** Bound by the active model's context window (dynamically compacted).
*   **Lifecycle:** Ephemeral. Automatically summarized and flushed to Long-Term Memory upon session termination or inactivity timeout.

### 2.2 Long-Term Memory (Semantic Store)
*   **Definition:** Persistent institutional knowledge, user preferences, agent evaluations, and cross-session learnings.
*   **Storage:** Vector database (e.g., Pinecone, Qdrant, or pgvector) alongside structured metadata.
*   **Capacity:** Theoretically unbounded.
*   **Lifecycle:** Persistent, governed by explicit retention and deletion semantics.

## 3. Retrieval Model

### 3.1 Core Mechanisms
*   **Vector Search (Semantic):** Uses `text-embedding-3-small` (per OpenClaw standard) for dense vector similarity search. Ideal for "find similar previous issues" or "recall user preferences."
*   **Keyword/BM25 (Lexical):** Fallback or hybrid search for exact entity matching (e.g., specific ticket IDs, exact variable names).
*   **Metadata Filtering:** Hard filters applied before vector search (e.g., `agentId`, `userId`, `timestamp`, `domain`).

### 3.2 Context Injection Pipeline
1.  **Trigger:** Agent intent or explicit memory query (e.g., `/search` or implicit context gap).
2.  **Retrieve:** Fetch top *K* relevant memory nodes using hybrid search.
3.  **Rank & Prune:** Filter out redundant nodes and trim based on a token budget allocated for memory (e.g., max 4000 tokens).
4.  **Inject:** Format as system prompt context `<memory_context>` block.

## 4. Governance Controls

### 4.1 Access Control & Isolation
*   **Tenant Isolation:** Strict namespace isolation per user/tenant.
*   **Agent Silos vs. Shared Knowledge:** 
    *   *Private Nodes:* Bound to a specific `agentId` (e.g., Amadeus's internal scratchpad).
    *   *Shared Nodes:* Accessible across the agent ecosystem (e.g., global `EVOLUTION.md` facts).

### 4.2 Security & Privacy
*   **PII Scrubbing:** All nodes pass through an automated PII redaction layer (Regex + lightweight NER) before embedding.
*   **Compliance Hooks:** Audit logging on read/write for sensitive memory nodes. Support for immediate legal holds.

## 5. Retention & Deletion Semantics

### 5.1 TTL & Auto-Compaction
*   **Ephemeral Data:** Short-term session logs have a hard 7-day TTL before forced summarization.
*   **Compaction:** Similar/overlapping memory nodes are periodically merged by an offline background job (e.g., nightly cron using a fast-tier agent to summarize redundant facts).

### 5.2 Explicit Forgetting
*   **User Right to be Forgotten:** API endpoint `DELETE /memory/user/:id` triggers cascading hard deletion of all associated vector IDs and metadata.
*   **Agent Correction:** Explicit API for agents to tombstone outdated facts (`mark_invalid(nodeId)`).

## 6. Evaluation Criteria

Before fully replacing the file-based system, Architecture 2.0 must meet the following metrics:

### 6.1 Performance
| Metric | Target | Measurement |
|--------|--------|-------------|
| Vector retrieval p50 | < 150ms | End-to-end from query to context injection |
| Vector retrieval p95 | < 300ms | Excludes cold-start on first query of session |
| Embedding generation | < 50ms per node | For batch sizes up to 10 nodes |

### 6.2 Accuracy (Relevance)
| Metric | Target | Method |
|--------|--------|--------|
| NDCG@5 | > 0.85 | Benchmark suite of 50+ human-curated queries |
| Recall@10 | > 0.90 | "Did we retrieve the relevant context?" |
| False Positive Rate | < 5% | Irrelevant memories injected into context |

### 6.3 Cost Efficiency
| Metric | Target | Constraint |
|--------|--------|------------|
| Embedding + DB cost | < $0.02 per session | Robert's constraint |
| Storage cost | < $0.50 per 10K nodes/month | Managed service estimate |
| Token efficiency gain | ≥ 30% reduction | vs. brute-force full-file loading |

### 6.4 Reliability
| Metric | Target |
|--------|--------|
| Availability | 99.9% (vector DB) |
| Data durability | 99.999999999% (11 9's) |
| Sync divergence | < 0.1% of writes in shadow mode |

### 6.5 Evaluation Protocol
1.  **Benchmark Suite:** Create `memory/eval/benchmark-queries.json` with 50+ query/expected-result pairs
2.  **A/B Testing:** Run parallel shadow writes for 2 weeks, compare retrieval quality
3.  **Cost Analysis:** Instrument all embedding/DB calls, calculate per-session cost
4.  **Human Review:** Random sample of 100 retrieval results reviewed by human for relevance

## 7. Phased Rollout & Migration Risks

### Phase 1: Shadow Write (Weeks 1-2)
- **Action:** Continue using `MEMORY.md` and daily files for agent context. Asynchronously embed and write all new facts to the vector store.
- **Success Criteria:** ≥95% of new facts successfully synced to vector DB
- **Risk:** Data divergence if the shadow sync fails silently.
  - **Mitigation:** Write-ahead log in PostgreSQL to track sync status. Alert if divergence > 1%
- **Rollback:** Trivial — just stop reading from vector DB

### Phase 2: Hybrid Read (Weeks 3-4)
- **Action:** Agents query the vector store for specific tasks but fall back to file-based context if confidence is low.
- **Success Criteria:** Vector retrieval relevance ≥ 0.80 NDCG@5 on production queries
- **Risk:** Increased latency and context window bloat if both systems return overlapping data.
  - **Mitigation:** Deduplicate results before context injection. Set max vector retrieval time budget (100ms)
- **Rollback:** Disable vector read path, revert to file-only

### Phase 3: Cutover & Deprecation (Week 5)
- **Action:** Make vector store the primary source of truth. Freeze and archive legacy `.md` memory files.
- **Success Criteria:** 
  - Zero regressions in agent task completion rate
  - Cost per session ≤ $0.02
- **Risk:** Legacy context loss.
  - **Mitigation:** Run a one-time batch embedding job on historical `memory/YYYY-MM-DD.md` files prior to cutover.
- **Rollback:** Requires restoring from backup + re-enabling file reads (requires ~4 hours)

### Cross-Cutting Migration Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Embedding API rate limits | Medium | High | Implement exponential backoff + request queuing |
| Vector DB cold-start latency | Medium | Medium | Pre-warm connection pool on agent startup |
| PII redaction false positives | Low | High | Human review loop for first 1000 nodes |
| Schema migration failures | Low | High | Version field in schema, migrations idempotent |
| Cost overrun at scale | Medium | Medium | Hard cap on vector DB nodes, auto-TTL enforcement |

## 8. Schema & Interface Scaffolding (TypeScript)

> **Non-Breaking Guarantee:** This schema is additive only. No existing file-based memory APIs are modified. The vector store is a parallel system until Phase 3 cutover. Clients can ignore this interface entirely during Phases 1-2.

```typescript
// Core Memory Node Schema
export interface MemoryNode {
  id: string;                  // UUID v4
  content: string;             // Raw text fact or summary
  embedding: number[];         // Float32Array from text-embedding-3-small (512 dims by default)
  metadata: MemoryMetadata;
  createdAt: number;           // Epoch timestamp (ms)
  updatedAt: number;           // Epoch timestamp (ms)
  version: number;             // Schema version for migrations (default: 1)
}

export interface MemoryMetadata {
  domain: 'user_pref' | 'system_fact' | 'session_summary' | 'agent_eval' | 'code_context';
  sourceId: string;            // Session ID, document ID, or PR/issue ID
  agentId?: string;            // If undefined, shared globally across agents
  userId?: string;             // For tenant isolation (required if multi-tenant)
  ttlSec?: number;             // Time-to-live; undefined = permanent
  confidenceScore: number;     // 0.0 - 1.0, agent's confidence in the fact accuracy
  tags?: string[];             // Optional taxonomy for filtering (e.g., ['bug', 'frontend'])
}

// Memory Service Interface (Backwards-Compatible)
export interface IMemoryService {
  /** 
   * Ingests a new fact, computes embedding, and stores it.
   * @returns The node ID of the stored memory
   */
  store(content: string, metadata: Omit<MemoryMetadata, 'confidenceScore'>): Promise<string>;
  
  /**
   * Stores multiple facts in a single batch (optimized for session summarization)
   */
  storeBatch(items: Array<{ content: string; metadata: Omit<MemoryMetadata, 'confidenceScore'> }>): Promise<string[]>;
  
  /** 
   * Hybrid search returning top K context strings
   * @param query - Natural language query
   * @param filters - Metadata filters to apply before search
   * @param limit - Max results (default: 5)
   */
  retrieve(query: string, filters?: Partial<MemoryMetadata>, limit?: number): Promise<MemoryNode[]>;
  
  /** 
   * Explicitly tombstone or delete a fact
   * @returns true if deleted, false if not found
   */
  forget(nodeId: string): Promise<boolean>;
  
  /** 
   * Tombstone all memories for a specific user (GDPR compliance)
   */
  forgetUser(userId: string): Promise<number>; // Returns count of deleted nodes
  
  /** 
   * Trigger background compaction of similar nodes
   * @returns Number of nodes merged
   */
  compact(userId?: string): Promise<number>;
  
  /** 
   * Search by exact keyword (lexical fallback)
   * Used when semantic search misses exact entity matches
   */
  searchKeywords(keywords: string[], filters?: Partial<MemoryMetadata>, limit?: number): Promise<MemoryNode[]>;
}

// Configuration interface (defaults shown)
export interface MemoryConfig {
  vectorDb: {
    provider: 'qdrant' | 'pinecone' | 'pgvector';
    endpoint: string;
    apiKey?: string;           // Use env var in production
    collection: string;        // Default: 'openclaw-memory'
  };
  embedding: {
    model: 'text-embedding-3-small';
    dimensions: 512;          // Recommended default
    batchSize: 10;
  };
  retrieval: {
    defaultLimit: number;     // Default: 5
    maxTokensBudget: number;   // Default: 4000
    vectorWeight: number;      // Default: 0.7 (for hybrid)
    keywordWeight: number;     // Default: 0.3
  };
  retention: {
    defaultTtlDays: number;   // Default: 90 for session summaries
    compactionCron: string;   // Default: '0 2 * * *' (2 AM daily)
  };
}

// Factory function with safe defaults
export function createMemoryService(config?: Partial<MemoryConfig>): IMemoryService {
  const defaults: MemoryConfig = {
    vectorDb: {
      provider: 'qdrant',
      endpoint: process.env.QDRANT_ENDPOINT || 'http://localhost:6333',
      collection: 'openclaw-memory',
    },
    embedding: {
      model: 'text-embedding-3-small',
      dimensions: 512,
      batchSize: 10,
    },
    retrieval: {
      defaultLimit: 5,
      maxTokensBudget: 4000,
      vectorWeight: 0.7,
      keywordWeight: 0.3,
    },
    retention: {
      defaultTtlDays: 90,
      compactionCron: '0 2 * * *',
    },
  };
  
  const finalConfig = { ...defaults, ...config };
  // Implementation injected here (Qdrant, Pinecone, or mock for testing)
  return new MemoryServiceImpl(finalConfig);
}
```

## 9. Open Decisions & Recommended Defaults

| Decision | Options | Recommended Default | Rationale |
|----------|---------|---------------------|-----------|
| **Database Selection** | Self-hosted `pgvector` vs. managed (Pinecone/Qdrant) | **Qdrant (self-hosted or cloud)** | Best cost-to-performance ratio for our scale. Pinecone is simpler but 3-5x more expensive at volume. pgvector requires more operational overhead. |
| **Compaction Model** | Async cron vs. inline during summarization | **Hybrid: Inline lightweight merge + nightly async compaction** | Session summaries should do lightweight de-dupe inline. Heavy compaction (merging similar facts) runs async to avoid blocking agent response time. |
| **Vector Dimensions** | 1536 (full) vs 512 (truncated) | **512 dimensions** | text-embedding-3-small retains meaningful similarity in 512 dims. Cuts embedding costs by ~66% and retrieval latency by ~40%. Acceptable NDCG trade-off for our use case. |
| **Embedding Model** | `text-embedding-3-small` vs `text-embedding-3-large` | **`text-embedding-3-small`** (stay consistent with OpenClaw standard) | Already the standard. 3-large is 4x cost for marginal gains on our retrieval patterns. |
| **Similarity Metric** | Cosine vs. Dot Product vs. Euclidean | **Cosine** | Most robust for variable-length text. Handles the "most similar" use case better than dot product when document lengths vary significantly. |
| **Hybrid Search Weight** | Vector:Keyword ratio | **70% vector / 30% keyword** | Starting point — tune based on NDCG benchmarks. Keyword fallback critical for exact entity matches (ticket IDs, code symbols). |

### 9.1 Decision Log
All architecture decisions should be logged in `_shared/ops/architecture-decisions.md` with:
- Decision ID (e.g., `MEM-2026-001`)
- Date
- Stakeholders consulted
- Alternatives considered
- Final decision + rationale
- Review date (12 months default)
