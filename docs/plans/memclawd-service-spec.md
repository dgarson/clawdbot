# MemClawd — Memory Composition Service

## Project Overview

**Name:** `memclawd` (Memory Composition Layer for OpenClaw/ClawdBrain)
**Location:** `clawd/memclawd/` (separate project subdirectory in the monorepo)
**Status:** Greenfield — laying foundational groundwork
**Relationship:** Architecturally separate from `clawdbot/`, tightly integrated via defined contracts

### Why a Separate Service?

David confirmed (2026-02-08) the three-layer architecture boundary:

1. **Synchronous Capture** (stays in `clawdbot/`) — Lightweight real-time significance detection hooks in the agent loop
2. **Asynchronous Pipeline** (this service, `memclawd/`) — Multi-modal classification, local model inference, GPU-heavy analysis, sophisticated ingestion
3. **Storage & Retrieval** (shared) — Graphiti knowledge graph, vector stores, SQLite, postgres

The boundary principle: anything that could block the agent's response loop gets extracted into MemClawd. The agent fires lightweight events; MemClawd does the heavy lifting asynchronously.

### Naming Rationale

`memclawd` — portmanteau of "memory" + "clawd". Follows the `clawd*` naming convention (`clawdbot`, `clawdbrain`, `clawdrank`). Short, memorable, greppable. The `mem` prefix makes the purpose instantly clear.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLAWDBOT (Agent)                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ PostToolUse Hook  │  │ PreCompact Hook  │  │ SessionEnd   │  │
│  │ (significance     │  │ (always-capture) │  │ (summary)    │  │
│  │  heuristic)       │  │                  │  │              │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘  │
│           │                      │                    │          │
│           └──────────┬───────────┘────────────────────┘          │
│                      │ Fire & Forget (async event)               │
│                      ▼                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Event Emitter → HTTP/gRPC/Queue → MemClawd Ingest API  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MEMCLAWD SERVICE                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    INGEST API (HTTP)                       │   │
│  │  POST /v1/ingest          — Fire-and-forget batch ingest  │   │
│  │  POST /v1/ingest/sync     — Synchronous single-item       │   │
│  │  GET  /v1/ingest/:runId   — Pipeline run status            │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│  ┌──────────────────────────▼───────────────────────────────┐   │
│  │              INGESTION PIPELINE (Async Workers)            │   │
│  │                                                            │   │
│  │  ┌──────────┐  ┌─────────┐  ┌────────┐  ┌────────────┐  │   │
│  │  │Normalize │→│ Extract  │→│ Enrich  │→│  Classify   │  │   │
│  │  └──────────┘  └─────────┘  └────────┘  └────────────┘  │   │
│  │       │              │            │            │          │   │
│  │  ┌────▼─────┐  ┌────▼────┐  ┌───▼────┐  ┌───▼───────┐  │   │
│  │  │ Entity   │  │Embed    │  │ Graph  │  │  Index    │  │   │
│  │  │ Extract  │  │(GPU)    │  │ Write  │  │  Write    │  │   │
│  │  └──────────┘  └─────────┘  └────────┘  └───────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    QUERY API (HTTP)                        │   │
│  │  POST /v1/query           — Semantic search (hybrid)      │   │
│  │  POST /v1/context-pack    — Pre-built context for prompts │   │
│  │  GET  /v1/entities/:id    — Entity detail                  │   │
│  │  POST /v1/graph/traverse  — Graph traversal query          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                GPU WORKER POOL                             │   │
│  │  ┌──────────────────────┐  ┌───────────────────────────┐ │   │
│  │  │ GPU 0 — Hot Path     │  │ GPU 1 — Throughput Path   │ │   │
│  │  │ • Real-time embeds   │  │ • Heavy embeddings        │ │   │
│  │  │ • Safety evaluator   │  │ • Vision/Classification   │ │   │
│  │  │ • BGE-M3 (~2GB)      │  │ • Qwen3-Embedding-8B     │ │   │
│  │  │ • Qwen3-30B-A3B      │  │ • Qwen3-VL-30B-A3B       │ │   │
│  │  │ (<60% utilization)   │  │ • Entity Extraction       │ │   │
│  │  └──────────────────────┘  │ • Reranker                │ │   │
│  │                             │ (can saturate 90-100%)    │ │   │
│  │                             └───────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  STORAGE ADAPTERS                          │   │
│  │  • Neo4j (Graphiti knowledge graph)                       │   │
│  │  • PostgreSQL + pgvector (vector store — long-term)       │   │
│  │  • SQLite + FTS5 (local/lightweight fallback)             │   │
│  │  • LanceDB (multi-modal vectors — future)                 │   │
│  │  • Redis (job queue, caching, rate limiting)              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Phase Breakdown

### Phase 0: Project Scaffolding & Foundation (Week 1)

#### 0.1 — Directory Structure

```
memclawd/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint + test + build
│       ├── docker-build.yml          # Container image build
│       └── release.yml               # Semantic versioning
├── docker/
│   ├── Dockerfile                    # Multi-stage production build
│   ├── Dockerfile.dev                # Dev with hot-reload
│   ├── Dockerfile.gpu                # GPU worker with CUDA/vLLM
│   └── docker-compose.yml           # Full local stack
├── docs/
│   ├── ARCHITECTURE.md              # This document (expanded)
│   ├── API.md                       # OpenAPI spec reference
│   ├── CONTRACTS.md                 # Event/message contracts
│   ├── DEPLOYMENT.md                # K8s, Docker, local
│   ├── GPU-SETUP.md                 # vLLM, model loading, CUDA
│   ├── MIGRATION.md                 # Migrating from clawdbot embedded
│   └── TROUBLESHOOTING.md
├── scripts/
│   ├── dev.sh                       # Start dev environment
│   ├── migrate.sh                   # Database migrations
│   ├── seed.sh                      # Seed test data
│   └── bench.sh                     # Run benchmarks
├── src/
│   ├── api/                         # HTTP API layer
│   │   ├── server.ts                # Hono/Fastify HTTP server
│   │   ├── routes/
│   │   │   ├── ingest.ts            # POST /v1/ingest
│   │   │   ├── query.ts             # POST /v1/query
│   │   │   ├── entities.ts          # Entity CRUD
│   │   │   ├── graph.ts             # Graph traversal
│   │   │   ├── health.ts            # Health + readiness
│   │   │   └── admin.ts             # Admin/debug endpoints
│   │   ├── middleware/
│   │   │   ├── auth.ts              # API key / JWT validation
│   │   │   ├── rate-limit.ts        # Per-agent rate limiting
│   │   │   ├── trace.ts             # OpenTelemetry tracing
│   │   │   └── validate.ts          # Request validation (TypeBox)
│   │   └── openapi.ts               # Auto-generated OpenAPI spec
│   ├── contracts/                   # Shared type contracts
│   │   ├── events.ts                # Inbound event schemas
│   │   ├── ingest.ts                # Ingestion pipeline types
│   │   ├── query.ts                 # Query/response types
│   │   ├── entities.ts              # Entity/relation types
│   │   ├── crn.ts                   # CRN (ClawdBrain Resource Name) utils
│   │   └── index.ts                 # Re-exports
│   ├── pipeline/                    # Ingestion pipeline stages
│   │   ├── orchestrator.ts          # Pipeline stage runner
│   │   ├── stages/
│   │   │   ├── normalize.ts         # Input normalization
│   │   │   ├── extract.ts           # Content extraction (text, metadata)
│   │   │   ├── classify.ts          # Multi-modal classification
│   │   │   ├── enrich.ts            # Temporal, provenance enrichment
│   │   │   ├── entity-extract.ts    # NER + relation extraction
│   │   │   ├── embed.ts             # Embedding generation
│   │   │   ├── graph-write.ts       # Write to knowledge graph
│   │   │   ├── vector-index.ts      # Write to vector store
│   │   │   └── audit.ts             # Pipeline audit logging
│   │   ├── extractors/              # Multi-modal extractors
│   │   │   ├── text.ts              # Plain text extraction
│   │   │   ├── markdown.ts          # Markdown parsing
│   │   │   ├── json.ts              # Structured JSON extraction
│   │   │   ├── image.ts             # Image captioning (vision model)
│   │   │   ├── audio.ts             # ASR transcription
│   │   │   ├── video.ts             # Video frame extraction + ASR
│   │   │   └── ocr.ts               # OCR for images/PDFs
│   │   └── significance/            # Significance evaluation
│   │       ├── heuristic.ts         # Rule-based significance scoring
│   │       ├── llm-evaluator.ts     # LLM-based significance (local model)
│   │       └── composite.ts         # Combined scorer
│   ├── query/                       # Query orchestration
│   │   ├── orchestrator.ts          # Multi-source query orchestration
│   │   ├── reranker.ts              # Cross-encoder reranking
│   │   ├── context-pack.ts          # Context pack builder
│   │   ├── graph-query.ts           # Graphiti/Neo4j query builder
│   │   └── hybrid-search.ts         # Vector + FTS + graph fusion
│   ├── models/                      # Local model management
│   │   ├── manager.ts               # Model lifecycle (load/unload/health)
│   │   ├── vllm-client.ts           # vLLM OpenAI-compat client
│   │   ├── embedding-client.ts      # Embedding model client
│   │   ├── vision-client.ts         # Vision model client
│   │   └── pool.ts                  # GPU worker pool management
│   ├── storage/                     # Storage adapters
│   │   ├── adapters/
│   │   │   ├── graphiti.ts          # Graphiti/Neo4j adapter
│   │   │   ├── pgvector.ts          # PostgreSQL + pgvector
│   │   │   ├── sqlite-vec.ts        # SQLite + sqlite-vec
│   │   │   ├── lancedb.ts           # LanceDB (multi-modal vectors)
│   │   │   └── redis.ts             # Redis (queue, cache)
│   │   ├── migrations/              # Database migrations
│   │   │   ├── 001_initial.ts
│   │   │   └── runner.ts
│   │   └── interfaces.ts            # Storage adapter interfaces
│   ├── workers/                     # Background job workers
│   │   ├── ingest-worker.ts         # Process ingest jobs from queue
│   │   ├── embed-worker.ts          # Batch embedding worker
│   │   ├── entity-worker.ts         # Entity extraction worker
│   │   ├── reindex-worker.ts        # Bulk re-indexing worker
│   │   └── scheduler.ts             # Periodic job scheduler
│   ├── experiential/                # Meridia experiential continuity
│   │   ├── recorder.ts              # Experience capture + evaluation
│   │   ├── classifier.ts            # Experience type classification
│   │   ├── significance.ts          # Significance scoring
│   │   ├── reconstitution.ts        # Reconstitution prompt builder
│   │   ├── schemas/
│   │   │   ├── experiential-record.ts
│   │   │   ├── identity-fragment.ts
│   │   │   └── relationship-texture.ts
│   │   └── prompts/
│   │       ├── quick.md
│   │       ├── standard.md
│   │       ├── morning.md
│   │       └── deep.md
│   ├── observability/               # Monitoring & telemetry
│   │   ├── metrics.ts               # Prometheus metrics
│   │   ├── tracing.ts               # OpenTelemetry spans
│   │   ├── audit-log.ts             # Structured audit logging
│   │   └── health.ts                # Health check aggregator
│   ├── config/                      # Configuration
│   │   ├── schema.ts                # TypeBox config schema
│   │   ├── loader.ts                # ENV + file config loader
│   │   ├── defaults.ts              # Default configuration
│   │   └── validate.ts              # Config validation
│   └── index.ts                     # Service entrypoint
├── test/
│   ├── unit/                        # Unit tests
│   │   ├── pipeline/
│   │   ├── query/
│   │   ├── storage/
│   │   └── models/
│   ├── integration/                 # Integration tests
│   │   ├── api/
│   │   ├── pipeline-e2e/
│   │   └── storage/
│   ├── fixtures/                    # Test fixtures
│   │   ├── episodes/
│   │   ├── entities/
│   │   └── embeddings/
│   └── helpers/
│       ├── test-db.ts               # Test database helpers
│       └── mock-models.ts           # Mock model responses
├── bench/                           # Benchmarks
│   ├── pipeline-throughput.ts
│   ├── embed-latency.ts
│   └── query-latency.ts
├── .env.example
├── .gitignore
├── AGENTS.md                        # OpenClaw agent context
├── CHANGELOG.md
├── LICENSE
├── Makefile                         # Build/test/deploy targets
├── package.json
├── README.md
├── tsconfig.json
└── vitest.config.ts
```

#### 0.2 — Package Configuration

```jsonc
// package.json
{
  "name": "@openclaw/memclawd",
  "version": "0.1.0",
  "description": "Memory Composition Service for OpenClaw — async memory ingestion, multi-modal processing, and intelligent retrieval",
  "type": "module",
  "engines": { "node": ">=22.0.0" },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsdown src/index.ts --format esm --dts",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "lint": "oxlint .",
    "typecheck": "tsc --noEmit",
    "bench": "vitest bench",
    "migrate": "tsx scripts/migrate.ts",
    "docker:build": "docker build -f docker/Dockerfile -t memclawd .",
    "docker:dev": "docker compose -f docker/docker-compose.yml up",
  },
  "dependencies": {
    "hono": "^4.x", // HTTP framework (lightweight, fast)
    "@hono/node-server": "^1.x",
    "@sinclair/typebox": "^0.x", // Runtime type validation
    "bullmq": "^5.x", // Redis-based job queue
    "ioredis": "^5.x", // Redis client
    "drizzle-orm": "^0.x", // SQL ORM (postgres + sqlite)
    "better-sqlite3": "^11.x", // SQLite with FTS5
    "pg": "^8.x", // PostgreSQL client
    "pgvector": "^0.x", // pgvector support
    "@opentelemetry/api": "^1.x",
    "@opentelemetry/sdk-node": "^0.x",
    "pino": "^9.x", // Structured logging
    "nanoid": "^5.x", // ID generation
  },
  "devDependencies": {
    "vitest": "^3.x",
    "tsx": "^4.x",
    "tsdown": "^0.x",
    "oxlint": "^0.x",
    "typescript": "^5.x",
    "@types/better-sqlite3": "^7.x",
    "@types/pg": "^8.x",
  },
}
```

#### 0.3 — Configuration Schema

```typescript
// src/config/schema.ts
import { Type, Static } from "@sinclair/typebox";

export const MemClawdConfig = Type.Object({
  server: Type.Object({
    port: Type.Number({ default: 3100 }),
    host: Type.String({ default: "0.0.0.0" }),
    cors: Type.Boolean({ default: false }),
  }),
  auth: Type.Object({
    apiKeys: Type.Array(Type.String(), { default: [] }),
    jwtSecret: Type.Optional(Type.String()),
    requireAuth: Type.Boolean({ default: true }),
  }),
  pipeline: Type.Object({
    maxConcurrency: Type.Number({ default: 4 }),
    batchSize: Type.Number({ default: 50 }),
    timeoutMs: Type.Number({ default: 30_000 }),
    retries: Type.Number({ default: 3 }),
    stages: Type.Object({
      normalize: Type.Object({ enabled: Type.Boolean({ default: true }) }),
      extract: Type.Object({ enabled: Type.Boolean({ default: true }) }),
      classify: Type.Object({
        enabled: Type.Boolean({ default: true }),
        model: Type.String({ default: "local:qwen3-vl-30b-a3b" }),
      }),
      enrich: Type.Object({ enabled: Type.Boolean({ default: true }) }),
      entityExtract: Type.Object({
        enabled: Type.Boolean({ default: true }),
        model: Type.String({ default: "local:qwen2.5-7b-instruct" }),
        minConfidence: Type.Number({ default: 0.7 }),
      }),
      embed: Type.Object({
        enabled: Type.Boolean({ default: true }),
        models: Type.Array(
          Type.Object({
            name: Type.String(),
            endpoint: Type.String(),
            dimensions: Type.Number(),
            modality: Type.Union([Type.Literal("text"), Type.Literal("multimodal")]),
            indexName: Type.String(),
          }),
        ),
      }),
      graphWrite: Type.Object({ enabled: Type.Boolean({ default: true }) }),
      vectorIndex: Type.Object({ enabled: Type.Boolean({ default: true }) }),
    }),
  }),
  storage: Type.Object({
    graphiti: Type.Object({
      url: Type.String({ default: "bolt://localhost:7687" }),
      database: Type.String({ default: "neo4j" }),
    }),
    postgres: Type.Optional(
      Type.Object({
        connectionString: Type.String(),
        poolSize: Type.Number({ default: 10 }),
      }),
    ),
    sqlite: Type.Object({
      path: Type.String({ default: "./data/memclawd.db" }),
    }),
    redis: Type.Object({
      url: Type.String({ default: "redis://localhost:6379" }),
    }),
  }),
  models: Type.Object({
    hotPath: Type.Object({
      endpoint: Type.String({ default: "http://localhost:8000/v1" }),
      models: Type.Array(
        Type.Object({
          name: Type.String(),
          purpose: Type.String(),
          vramGb: Type.Number(),
        }),
      ),
    }),
    throughputPath: Type.Object({
      endpoint: Type.String({ default: "http://localhost:8001/v1" }),
      models: Type.Array(
        Type.Object({
          name: Type.String(),
          purpose: Type.String(),
          vramGb: Type.Number(),
        }),
      ),
    }),
  }),
  experiential: Type.Object({
    enabled: Type.Boolean({ default: true }),
    captureInterval: Type.Number({ default: 240_000 }), // 4 min
    dailySynthesisHour: Type.Number({ default: 4 }), // 4am
    significanceThreshold: Type.Number({ default: 0.6 }),
  }),
  observability: Type.Object({
    metricsPort: Type.Number({ default: 9090 }),
    tracingEndpoint: Type.Optional(Type.String()),
    logLevel: Type.Union(
      [
        Type.Literal("trace"),
        Type.Literal("debug"),
        Type.Literal("info"),
        Type.Literal("warn"),
        Type.Literal("error"),
      ],
      { default: "info" },
    ),
  }),
});

export type MemClawdConfigType = Static<typeof MemClawdConfig>;
```

---

### Phase 1: Contract Bridge — ClawdBot ↔ MemClawd (Week 1-2)

The most critical piece: defining the exact event/message contracts between the existing clawdbot agent and the new MemClawd service.

#### 1.1 — Ingest Event Contract

```typescript
// src/contracts/events.ts
// These EXACTLY match what clawdbot's hooks already emit
// (see clawdbot/src/memory/pipeline/contracts.ts)

export type MemClawdIngestEvent = {
  /** Unique event ID */
  id: string;
  /** Event type — maps to clawdbot hook points */
  type:
    | "agent.tool_use" // PostToolUse hook
    | "agent.compaction" // PreCompact hook
    | "agent.session_end" // SessionEnd hook
    | "agent.session_start" // SessionStart (future)
    | "agent.message" // MessageReceived
    | "manual.ingest" // Manual ingestion via API
    | "webhook.inbound" // External webhook data
    | "scheduled.reflection" // Cron-driven reflection
    | "scheduled.synthesis"; // Cron-driven daily synthesis

  /** ISO timestamp */
  ts: string;

  /** Source context */
  source: {
    agentId: string;
    sessionKey: string;
    sessionKeyCrn?: string; // crn:1:session:{agentId}:main:{sessionId}
    channel?: string; // slack, telegram, web, etc.
  };

  /** The actual content to ingest */
  content: {
    text: string;
    kind: "text" | "json" | "markdown" | "image" | "audio" | "video";
    mimeType?: string;
    /** Binary data as base64 (for images/audio/video) */
    data?: string;
    /** URL to fetch content from */
    url?: string;
    /** Structured metadata from the agent */
    metadata?: Record<string, unknown>;
  };

  /** Pre-computed significance (from clawdbot's lightweight heuristic) */
  significance?: {
    score: number; // 0-1 from heuristic
    reason?: string;
    triggers?: string[]; // Which heuristic rules fired
  };

  /** Tracing */
  traceId?: string;
  parentSpanId?: string;
};
```

#### 1.2 — Query Contract

```typescript
// src/contracts/query.ts
export type MemClawdQueryRequest = {
  /** Natural language query */
  query: string;

  /** Filters */
  filters?: {
    agentId?: string;
    sessionKeys?: string[];
    dateRange?: { from?: string; to?: string };
    entityTypes?: string[];
    tags?: string[];
    minSignificance?: number;
    modality?: ("text" | "image" | "audio")[];
  };

  /** Result configuration */
  maxResults?: number;
  includeGraph?: boolean; // Include graph context
  includeVectors?: boolean; // Include raw vector scores
  rerank?: boolean; // Apply cross-encoder reranking

  /** Context pack mode */
  contextPack?: {
    maxTokens: number;
    format: "brief" | "detailed";
    includeSources?: boolean;
  };

  /** Tracing */
  traceId?: string;
};

export type MemClawdQueryResult = {
  results: Array<{
    id: string;
    text: string;
    score: number;
    source: "vector" | "graph" | "fts" | "hybrid";
    metadata: {
      agentId?: string;
      sessionKey?: string;
      timestamp?: string;
      entityType?: string;
      significance?: number;
      tags?: string[];
    };
    /** Related entities from the knowledge graph */
    entities?: Array<{
      id: string;
      name: string;
      type: string;
      relationship?: string;
    }>;
  }>;

  /** Pre-built context string for prompt injection */
  contextPack?: string;

  /** Performance metadata */
  latencyMs: number;
  sourcesQueried: string[];
};
```

#### 1.3 — Migration Adapter

The existing `clawdbot/src/memory/pipeline/` code needs a thin adapter that forwards events to MemClawd instead of processing them inline. This is the **migration bridge**.

```typescript
// In clawdbot (NOT in memclawd):
// clawdbot/src/memory/memclawd-bridge.ts
//
// Replaces direct pipeline execution with HTTP forwarding to MemClawd

export class MemClawdBridge {
  constructor(
    private config: {
      endpoint: string; // e.g. http://localhost:3100
      apiKey: string;
      fallbackToLocal: boolean; // If MemClawd is down, run local pipeline
    },
  ) {}

  async ingest(event: MemClawdIngestEvent): Promise<{ runId: string }> {
    // Fire-and-forget POST to MemClawd
    // Falls back to local pipeline if enabled + MemClawd unreachable
  }

  async query(request: MemClawdQueryRequest): Promise<MemClawdQueryResult> {
    // Synchronous query to MemClawd
    // Falls back to local search if MemClawd unreachable
  }
}
```

---

### Phase 2: Core Ingestion Pipeline (Week 2-3)

Port and extend the existing `clawdbot/src/memory/pipeline/` into the MemClawd service with proper async worker architecture.

#### 2.1 — Pipeline Orchestrator

```typescript
// src/pipeline/orchestrator.ts
// Manages the stage-by-stage processing of ingestion events
// Uses BullMQ for reliable job processing with retries

export class PipelineOrchestrator {
  private stages: Map<string, PipelineStage>;
  private queue: Queue;

  async process(event: MemClawdIngestEvent): Promise<PipelineRun> {
    // 1. Create PipelineRun record
    // 2. Enqueue first stage job
    // 3. Each stage completion triggers next stage
    // 4. Final stage records completion
    // 5. Emit pipeline.complete event
  }
}
```

#### 2.2 — Stage Implementations

Each stage from the existing pipeline gets extracted and enhanced:

| Stage            | Source (clawdbot)            | Enhancement in MemClawd                               |
| ---------------- | ---------------------------- | ----------------------------------------------------- |
| `normalize`      | `pipeline/normalize.ts`      | Add multi-modal normalization, MIME detection, dedup  |
| `extract`        | `pipeline/extract.ts`        | Add image/audio/video extraction via local models     |
| `classify`       | NEW                          | Multi-modal classification using Qwen3-VL             |
| `enrich`         | `pipeline/enrich.ts`         | Add temporal policy, provenance chains, CRN linking   |
| `entity_extract` | `pipeline/entity-extract.ts` | Upgrade to local LLM (Qwen2.5-7B) instead of regex    |
| `embed`          | `pipeline/embed.ts`          | Multi-model embedding (BGE-M3, Qwen3-Embedding-8B)    |
| `graph_write`    | `pipeline/graph.ts`          | Enhanced Graphiti integration with entity type schema |
| `vector_index`   | `pipeline/index.ts`          | Multi-index writes (one per embedding model)          |
| `audit`          | inline                       | Full audit trail with OpenTelemetry spans             |

#### 2.3 — Multi-Modal Extractors

```typescript
// src/pipeline/extractors/image.ts
export class ImageExtractor {
  constructor(private visionClient: VisionModelClient) {}

  async extract(input: { data: Buffer; mimeType: string }): Promise<{
    caption: string;
    objects: string[];
    text?: string; // OCR results
    embedding?: number[];
  }> {
    // 1. Run through Qwen3-VL for captioning
    // 2. Run OCR if text detected
    // 3. Generate multimodal embedding
  }
}

// src/pipeline/extractors/audio.ts
export class AudioExtractor {
  constructor(private asrClient: ASRModelClient) {}

  async extract(input: { data: Buffer; mimeType: string }): Promise<{
    transcript: string;
    duration: number;
    language?: string;
    segments?: Array<{ start: number; end: number; text: string }>;
  }> {
    // 1. Run through Whisper/local ASR
    // 2. Segment with timestamps
    // 3. Language detection
  }
}
```

---

### Phase 3: Query Orchestration & Retrieval (Week 3-4)

#### 3.1 — Hybrid Search

```typescript
// src/query/hybrid-search.ts
export class HybridSearchOrchestrator {
  async search(request: MemClawdQueryRequest): Promise<MemClawdQueryResult> {
    // Run in parallel:
    // 1. Vector search (multiple indices — one per embedding model)
    // 2. Full-text search (FTS5 / PostgreSQL tsvector)
    // 3. Graph traversal (Graphiti entity-centric)
    // Then:
    // 4. Score fusion (RRF — Reciprocal Rank Fusion)
    // 5. Optional cross-encoder reranking
    // 6. Result deduplication
    // 7. Context pack assembly
  }
}
```

#### 3.2 — Context Pack Builder

```typescript
// src/query/context-pack.ts
export class ContextPackBuilder {
  async build(
    results: QueryResult[],
    options: {
      maxTokens: number;
      format: "brief" | "detailed";
      includeSources: boolean;
    },
  ): Promise<string> {
    // 1. Rank results by relevance
    // 2. Estimate tokens per result
    // 3. Greedily pack results within token budget
    // 4. Format with source attribution
    // 5. Add graph context for top entities
  }
}
```

---

### Phase 4: GPU Worker Pool & Local Models (Week 4-6)

#### 4.1 — vLLM Management

```typescript
// src/models/manager.ts
export class ModelManager {
  private hotPathVLLM: VLLMClient; // GPU 0
  private throughputVLLM: VLLMClient; // GPU 1

  // Hot path models (<60% GPU 0 utilization):
  // - Qwen3-30B-A3B MoE (safety evaluator, ~8-10GB)
  // - BGE-M3 (real-time query embeddings, ~2GB)

  // Throughput path models (GPU 1, can saturate):
  // - Qwen3-Embedding-8B (heavy embeddings, ~16GB)
  // - Qwen3-VL-30B-A3B (vision/classification, ~8-10GB)
  // - Qwen2.5-7B-Instruct (entity extraction, ~5-8GB)
  // - Reranker model

  async healthCheck(): Promise<ModelHealthReport> {}
  async getEmbedding(text: string, model: "bge-m3" | "qwen3-embed"): Promise<number[]> {}
  async classify(input: MultiModalInput): Promise<ClassificationResult> {}
  async extractEntities(text: string): Promise<ExtractedEntity[]> {}
  async evaluateSignificance(content: string): Promise<SignificanceScore> {}
}
```

#### 4.2 — Workload Routing

```typescript
// src/models/pool.ts
export class GPUWorkerPool {
  // Route requests to appropriate GPU based on latency requirements

  routeRequest(request: ModelRequest): "hot" | "throughput" {
    if (request.category === "safety" || request.category === "realtime-embed") {
      return "hot"; // GPU 0 — sub-second, never preempted
    }
    return "throughput"; // GPU 1 — batch-optimized, can queue
  }
}
```

---

### Phase 5: Experiential Continuity (Meridia) Integration (Week 5-7)

Port the Meridia experiential continuity system from `~/clawd/existence/` into MemClawd as a first-class subsystem.

#### 5.1 — Experiential Record Pipeline

```typescript
// src/experiential/recorder.ts
export class ExperientialRecorder {
  // Maps to existence/schemas/experiential-record.schema.json

  async capture(event: {
    what_was_happening: string;
    emotional_signature: EmotionalSignature;
    engagement_quality: EngagementQuality;
    anchors: Anchor[];
    relationships: string[];
    unfinished_threads: string[];
  }): Promise<ExperientialRecord> {
    // 1. Score significance (heuristic + optional LLM)
    // 2. Generate embedding
    // 3. Store in experiential records table
    // 4. Update knowledge graph with experiential edges
    // 5. Trigger reflection if significance > threshold
  }
}
```

#### 5.2 — Reconstitution Engine

```typescript
// src/experiential/reconstitution.ts
export class ReconstitutionEngine {
  // Builds reconstitution prompts for session starts
  // Uses gap duration to select prompt depth

  async buildReconstitutionContext(params: {
    agentId: string;
    lastSessionEnd: string;
    currentTime: string;
  }): Promise<{
    prompt: string;
    recentExperiences: ExperientialRecord[];
    identityFragments: IdentityFragment[];
    relationshipTextures: RelationshipTexture[];
  }> {
    const gapHours = /* calculate */;
    const promptTemplate =
      gapHours < 4 ? 'quick' :
      gapHours < 24 ? 'standard' :
      isNewDay ? 'morning' : 'deep';

    // 1. Load prompt template
    // 2. Query recent experiential records
    // 3. Query identity evolution
    // 4. Query relationship updates
    // 5. Compose reconstitution context
  }
}
```

#### 5.3 — Scheduled Agents (Cron Workers)

```typescript
// src/experiential/agents/
// These run as scheduled workers within MemClawd

// Eidetic Recorder — every 60s during active sessions
// Experience Evaluator — on-demand per significant event
// Reconstitution Prompter — on session start + daily morning
// Daily Synthesizer — 4am daily
// Weekly Identity Review — weekly
// Relationship Dormancy Check — daily
```

---

### Phase 6: Storage Layer (Week 2-4, parallel)

#### 6.1 — Migration Strategy

```
Phase 6a: SQLite (immediate)
  - FTS5 for full-text search
  - sqlite-vec for local vector search
  - Zero external dependencies

Phase 6b: PostgreSQL + pgvector (week 4+)
  - Production-grade vector search
  - ACID transactions
  - Concurrent connections

Phase 6c: Neo4j / Graphiti (week 2+)
  - Already running for clawdbot
  - Shared instance, separate database/namespace

Phase 6d: LanceDB (future)
  - Multi-modal vector storage
  - Native image/audio embedding support
```

#### 6.2 — Multi-Index Vector Strategy

Critical architectural constraint: each embedding model creates an incompatible vector space. MemClawd must maintain separate indices:

```typescript
// src/storage/adapters/multi-vector.ts
export class MultiVectorStore {
  private indices: Map<string, VectorAdapter>;

  // Index per embedding model:
  // - bge-m3-text (1024d) — text-only queries
  // - qwen3-embed (4096d) — high-quality text
  // - nomic-multimodal (768d) — image+text queries

  async indexEpisode(episode: MemoryContentObject, embeddings: Map<string, number[]>) {
    for (const [modelName, vector] of embeddings) {
      await this.indices.get(modelName)!.upsert([
        {
          id: `${episode.id}:${modelName}`,
          values: vector,
          metadata: episode.metadata,
        },
      ]);
    }
  }

  async search(query: string, models?: string[]): Promise<QueryResult[]> {
    // Query all relevant indices in parallel
    // Fuse results with RRF
  }
}
```

---

### Phase 7: Observability & Operations (Week 6-8)

#### 7.1 — Metrics

```typescript
// Prometheus metrics exposed on :9090/metrics
//
// memclawd_ingest_events_total{stage, status}
// memclawd_ingest_duration_seconds{stage}
// memclawd_query_duration_seconds{source}
// memclawd_embed_duration_seconds{model}
// memclawd_gpu_utilization_percent{gpu, path}
// memclawd_entity_count{type}
// memclawd_vector_index_size{model}
// memclawd_queue_depth{queue}
// memclawd_queue_latency_seconds{queue}
// memclawd_model_health{model, status}
```

#### 7.2 — Structured Audit Log

Every pipeline run, query, and admin action gets a structured audit entry:

```typescript
{
  id: string;
  action: 'ingest' | 'query' | 'entity_write' | 'vector_write' | 'admin';
  status: 'success' | 'failure' | 'partial';
  agentId?: string;
  sessionKey?: string;
  traceId?: string;
  durationMs: number;
  details: Record<string, unknown>;
  ts: string;
}
```

---

### Phase 8: Docker & Deployment (Week 6-8)

#### 8.1 — Docker Compose (Local Dev)

```yaml
# docker/docker-compose.yml
services:
  memclawd:
    build:
      context: ..
      dockerfile: docker/Dockerfile.dev
    ports:
      - "3100:3100"
      - "9090:9090"
    environment:
      - MEMCLAWD_STORAGE__REDIS__URL=redis://redis:6379
      - MEMCLAWD_STORAGE__POSTGRES__CONNECTION_STRING=postgresql://memclawd:memclawd@postgres:5432/memclawd
      - MEMCLAWD_STORAGE__GRAPHITI__URL=bolt://neo4j:7687
    depends_on:
      - redis
      - postgres
      - neo4j
    volumes:
      - ../data:/app/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: memclawd
      POSTGRES_USER: memclawd
      POSTGRES_PASSWORD: memclawd
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  neo4j:
    image: neo4j:5-community
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      NEO4J_AUTH: neo4j/memclawd
    volumes:
      - neo4jdata:/data

volumes:
  pgdata:
  neo4jdata:
```

#### 8.2 — GPU Worker Dockerfile

```dockerfile
# docker/Dockerfile.gpu
FROM nvidia/cuda:12.4.1-runtime-ubuntu24.04

# Install vLLM + model dependencies
RUN pip install vllm

# Pre-download models (or mount from host)
# GPU 0: BGE-M3, Qwen3-30B-A3B
# GPU 1: Qwen3-Embedding-8B, Qwen3-VL-30B-A3B, Qwen2.5-7B-Instruct

COPY start-vllm.sh /app/start-vllm.sh
ENTRYPOINT ["/app/start-vllm.sh"]
```

---

### Phase 9: Integration Testing & Migration (Week 7-9)

#### 9.1 — Integration Test Suite

```typescript
// test/integration/pipeline-e2e/
describe("Full Pipeline E2E", () => {
  test("text ingestion → extract → embed → graph → index → query roundtrip");
  test("image ingestion → vision caption → embed → index → multimodal query");
  test("high significance event → experiential record capture");
  test("session end → summary → graph update → reconstitution available");
  test("concurrent agent ingestion → no data races");
  test("MemClawd down → clawdbot fallback to local pipeline");
});
```

#### 9.2 — Migration Checklist

```
□ 1. Deploy MemClawd alongside clawdbot (same host or K8s)
□ 2. Enable MemClawdBridge in clawdbot config (dual-write mode)
□ 3. Verify events flowing: clawdbot hooks → MemClawd ingest API
□ 4. Verify query results: MemClawd returns same quality as local
□ 5. Switch clawdbot memory tools to query MemClawd
□ 6. Monitor latency: ensure no degradation in agent response time
□ 7. Disable local pipeline in clawdbot (MemClawd is primary)
□ 8. Backfill historical data from clawdbot SQLite → MemClawd
```

---

## Entity Type Schema (Graphiti)

Confirmed entity types for the knowledge graph:

| Type           | Description                                   | Status              |
| -------------- | --------------------------------------------- | ------------------- |
| `Technology`   | Languages, frameworks, tools                  | ✅ Confirmed        |
| `Tool`         | Specific tool instances                       | ✅ Confirmed        |
| `Event`        | Timestamped occurrences                       | ✅ Confirmed        |
| `Activity`     | Ongoing work/tasks                            | ✅ Confirmed        |
| `Decision`     | Architectural/design decisions with lifecycle | ✅ Confirmed        |
| `Person`       | People (users, collaborators)                 | 🔲 Proposed Tier 1  |
| `Project`      | Projects/repos/workstreams                    | 🔲 Proposed Tier 1  |
| `Service`      | System components                             | 🔲 Proposed Tier 1  |
| `Document`     | Artifacts/references                          | 🔲 Proposed Tier 2  |
| `Concept`      | Patterns/principles                           | 🔲 Proposed Tier 2  |
| `Experience`   | Experiential records (Meridia)                | 🔲 NEW for MemClawd |
| `Identity`     | Identity fragments                            | 🔲 NEW for MemClawd |
| `Relationship` | Relationship textures                         | 🔲 NEW for MemClawd |

---

## API Endpoints Summary

| Method | Path                            | Description                             |
| ------ | ------------------------------- | --------------------------------------- |
| `POST` | `/v1/ingest`                    | Batch async ingestion (fire-and-forget) |
| `POST` | `/v1/ingest/sync`               | Synchronous single-item ingestion       |
| `GET`  | `/v1/ingest/:runId`             | Get pipeline run status                 |
| `POST` | `/v1/query`                     | Hybrid semantic search                  |
| `POST` | `/v1/context-pack`              | Build context pack for prompt           |
| `GET`  | `/v1/entities/:id`              | Get entity detail                       |
| `POST` | `/v1/entities/search`           | Search entities by type/name            |
| `POST` | `/v1/graph/traverse`            | Graph traversal query                   |
| `GET`  | `/v1/graph/neighbors/:nodeId`   | Get node neighbors                      |
| `POST` | `/v1/experiential/capture`      | Capture experiential record             |
| `POST` | `/v1/experiential/reconstitute` | Build reconstitution context            |
| `GET`  | `/v1/experiential/recent`       | Recent experiences                      |
| `GET`  | `/v1/health`                    | Service health                          |
| `GET`  | `/v1/health/ready`              | Readiness probe                         |
| `GET`  | `/v1/health/models`             | Model health status                     |
| `GET`  | `/v1/admin/stats`               | Pipeline/storage statistics             |
| `POST` | `/v1/admin/reindex`             | Trigger re-indexing                     |
| `GET`  | `/metrics`                      | Prometheus metrics                      |

---

## CRN Integration

MemClawd uses ClawdBrain Resource Names for all addressable resources:

```
crn:1:memory:{agentId}:episode:{episodeId}
crn:1:memory:{agentId}:entity:{entityId}
crn:1:memory:{agentId}:relation:{relationId}
crn:1:memory:{agentId}:experience:{recordId}
crn:1:memory:{agentId}:vector:{indexName}:{vectorId}
```

---

## Key Design Decisions

1. **Hono over Express/Fastify** — Fastest Node.js HTTP framework, excellent TypeScript support, works in edge/worker contexts
2. **BullMQ for job queue** — Reliable Redis-based queue with retries, priorities, rate limiting, and dashboard
3. **Drizzle ORM** — Type-safe, lightweight, supports both PostgreSQL and SQLite
4. **TypeBox for validation** — Compile-time + runtime type safety, generates JSON Schema
5. **Separate vLLM instances per GPU** — Process-level isolation prevents throughput work from starving latency-critical hot path
6. **Multi-index vector strategy** — One index per embedding model; RRF fusion at query time
7. **Fire-and-forget ingestion** — Agent never blocks on memory processing; query is synchronous
8. **SQLite as bootstrap** — Zero-dependency local development; PostgreSQL for production

---

## Success Metrics

| Metric                          | Target                             |
| ------------------------------- | ---------------------------------- |
| Ingest latency (agent-side)     | <10ms (fire-and-forget)            |
| Pipeline completion             | <5s for text, <30s for multi-modal |
| Query latency (hybrid search)   | <200ms p95                         |
| Context pack build              | <500ms p95                         |
| Entity extraction accuracy      | >85% F1                            |
| Embedding throughput            | >100 episodes/sec (batch)          |
| GPU 0 utilization               | <60% (hot path headroom)           |
| Pipeline reliability            | >99.5% success rate                |
| Zero agent response degradation | ±0ms impact on agent loop          |
