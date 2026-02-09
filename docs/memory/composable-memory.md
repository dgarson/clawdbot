# Composable Memory Architecture

> **Status**: Implemented (PR #147)
> **Source**: `src/memory/`
> **Key files**: `composable-manager.ts`, `interfaces.ts`, `backend-config.ts`, `graphiti/`

## Overview

The Composable Memory Architecture provides a pluggable, multi-backend memory system for OpenClaw agents. Instead of a single monolithic memory store, it allows multiple backends (vector, graph, full-text) to operate in parallel with configurable routing, weighting, and deduplication.

## Architecture

```
┌──────────────────────────────────────────────────┐
│                Memory Query                       │
│  "What did we decide about the API design?"       │
└─────────────────┬────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────┐
│          ComposableMemoryManager                  │
│  • Intent parsing (optional)                      │
│  • Backend routing by condition                   │
│  • Parallel fan-out to active backends            │
│  • Weighted score merging                         │
│  • Deduplication by path+line range               │
│  • Ops logging with trace IDs                     │
└──────┬──────────┬──────────────┬─────────────────┘
       │          │              │
       ▼          ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────────┐
│ Built-in │ │ Graphiti │ │   QMD        │
│ SQLite   │ │ Graph    │ │  (External)  │
│ Store    │ │ Adapter  │ │              │
└──────────┘ └──────────┘ └──────────────┘
```

## Core Components

### ComposableMemoryManager (`composable-manager.ts`)

The central orchestrator that implements `MemorySearchManager`. Manages multiple backends with weighted scoring and deduplication.

**Key features:**

- **Parallel fan-out**: All active backends are queried simultaneously via `Promise.allSettled`
- **Intent-based routing**: Optional intent parser can filter backends per query
- **Weighted scoring**: Each backend has a configurable weight that multiplies result scores
- **Deduplication**: Results are deduplicated by `path:startLine:endLine` key, keeping the highest weighted score
- **Backend attribution**: Tracks which backend returned each result for observability
- **Graceful degradation**: If a backend fails, others continue — errors are logged but don't block

```typescript
const manager = new ComposableMemoryManager({
  backends: [
    { id: "builtin", manager: builtinStore, weight: 1.0 },
    { id: "graphiti", manager: graphitiAdapter, weight: 0.8 },
  ],
  primary: "builtin", // Used for readFile, sync
  intentParser: parseQueryIntent,
  opsLog: memoryOpsLogger,
});

const results = await manager.search("API design decisions", {
  maxResults: 10,
  minScore: 0.3,
});
```

### Backend Entry Configuration

Each backend is registered as a `ComposableBackendEntry`:

| Field       | Type                  | Description                             |
| ----------- | --------------------- | --------------------------------------- |
| `id`        | `string`              | Unique identifier for the backend       |
| `manager`   | `MemorySearchManager` | The backend implementation              |
| `weight`    | `number`              | Score multiplier (0.0–1.0+) for ranking |
| `condition` | `(intent) => boolean` | Optional routing predicate              |

### MemorySearchManager Interface

All backends implement this interface:

```typescript
interface MemorySearchManager {
  search(query: string, opts?: SearchOpts): Promise<MemorySearchResult[]>;
  readFile(params: {
    relPath: string;
    from?: number;
    lines?: number;
  }): Promise<{ text: string; path: string }>;
  status(): MemoryProviderStatus;
  sync?(params?: SyncParams): Promise<void>;
  probeEmbeddingAvailability(): Promise<MemoryEmbeddingProbeResult>;
  probeVectorAvailability(): Promise<boolean>;
  close?(): Promise<void>;
}
```

## Backend Types

### Built-in SQLite Store (`builtin-sqlite-store.ts`)

The default backend using Node.js native SQLite with optional FTS5 and vector similarity.

**Features:**

- File-based chunk indexing with content hashing
- FTS5 full-text search (when available)
- Vector similarity via cosine distance on stored embeddings
- Embedding cache with provider+model+hash deduplication
- Incremental sync with file change detection

**Schema:**

- `files` — Tracked files with path, hash, mtime, size
- `chunks` — Text chunks with embeddings, keyed by id
- `fts_index` — FTS5 virtual table for full-text search
- `embedding_cache` — Cross-provider embedding cache

### Graphiti Graph Adapter (`graphiti/`)

Graph-based memory using the Graphiti service for entity-relationship storage.

**Features:**

- Episode ingestion with temporal metadata
- Hybrid search across facts and relationships
- Compaction hook integration for episode merging
- Health check and graceful fallback

**Client API:**

```typescript
const client = new GraphitiClient({
  host: "localhost",
  servicePort: 8001,
  apiKey: "optional-key",
  timeoutMs: 10_000,
  opsLog: memoryOpsLogger,
});

// Ingest content as episodes
await client.ingestEpisodes({
  episodes: contentObjects,
  traceId: "abc-123",
});

// Search across the graph
const results = await client.queryHybrid({
  query: "API design patterns",
  limit: 10,
});
```

**Episode construction:**
Content objects are converted to Graphiti episodes with:

- `observed_at` from temporal metadata (validated as ISO date)
- `ingested_at` from update timestamp or current time
- Warnings generated for invalid/missing temporal data

### QMD Backend (External)

An external `qmd` command-line tool for memory indexing, configured through `backend-config.ts`.

**Configuration:**

```yaml
memory:
  backend: qmd
  qmd:
    command: qmd
    includeDefaultMemory: true
    paths:
      - path: ~/projects/notes
        pattern: "**/*.md"
        name: notes
    sessions:
      enabled: true
      exportDir: ./session-exports
      retentionDays: 30
    update:
      interval: 5m
      debounceMs: 15000
      onBoot: true
      embedInterval: 60m
    limits:
      maxResults: 6
      maxSnippetChars: 700
      maxInjectedChars: 4000
      timeoutMs: 4000
```

## Adapter Interfaces (`interfaces.ts`)

The composable architecture defines pluggable adapter interfaces for each concern:

### GraphAdapter

For entity-relationship graph storage:

```typescript
interface GraphAdapter {
  upsertNodes(nodes: GraphNode[]): Promise<void>;
  upsertEdges(edges: GraphEdge[]): Promise<void>;
  query(query: GraphQuery): Promise<GraphQueryResult>;
  health?(): Promise<{ ok: boolean; message?: string }>;
}
```

### VectorAdapter

For embedding-based similarity search:

```typescript
interface VectorAdapter {
  upsert(records: VectorRecord[]): Promise<void>;
  query(query: VectorQuery): Promise<VectorQueryResult>;
  delete?(ids: string[]): Promise<void>;
  health?(): Promise<{ ok: boolean; message?: string }>;
}
```

### EmbedderAdapter

For text embedding generation:

```typescript
interface EmbedderAdapter {
  embed(input: EmbedderInput): Promise<number[]>;
  embedBatch?(inputs: EmbedderInput[]): Promise<number[][]>;
  dimensions?: number;
}
```

### EntityExtractor

For extracting structured entities from content:

```typescript
interface EntityExtractor {
  extract(content: MemoryContentObject): Promise<ExtractedEntity[]>;
}
```

### TemporalPolicy

For managing content lifecycle:

```typescript
interface TemporalPolicy {
  evaluate(content: MemoryContentObject): Promise<TemporalPolicyDecision>;
}
```

### QueryOrchestrator

For unified query routing:

```typescript
interface QueryOrchestrator {
  query(request: QueryRequest): Promise<QueryResponse>;
  contextPack?(request: QueryRequest): Promise<{ pack: string; sources?: MemoryContentObject[] }>;
}
```

## Search Pipeline

1. **Intent parsing** (optional): Query text is parsed for entities, topics, and time hints
2. **Backend filtering**: Backends with `condition` functions are filtered based on the parsed intent
3. **Parallel fan-out**: Active backends are queried simultaneously
4. **Result collection**: Successful results are collected with backend attribution; failures are logged
5. **Deduplication**: Results are deduplicated by `path:startLine:endLine`, keeping the highest weighted score
6. **Sorting**: Results sorted by weighted score descending
7. **Truncation**: Top `maxResults` entries returned

## Ops Logging

The composable manager emits structured ops log entries for observability:

| Event                  | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| `query.start`          | Search initiated — query, intent, active backends       |
| `query.backend_result` | Per-backend results — count, scores, snippets           |
| `query.merged`         | Final merged results — dedup stats, backend attribution |
| `graphiti.ingest`      | Episode ingestion results — node/edge counts            |
| `graphiti.query`       | Graph query results — fact counts                       |

All events include a `traceId` for correlating related operations.

## Memory Feedback System (`feedback/`)

The feedback system evaluates memory search quality and adjusts backend weights over time:

- **LLM-based weight advisor**: Analyzes search quality and suggests weight adjustments
- **Feedback loop**: Results are evaluated against user satisfaction signals
- **Weight adaptation**: Backend weights evolve based on which backends consistently return relevant results

## Configuration

Memory backend is configured through `openclaw.yml`:

```yaml
memory:
  backend: builtin # "builtin" | "qmd"
  citations: auto # "auto" | "always" | "never"
  graphiti:
    enabled: true
    host: localhost
    servicePort: 8001
    apiKey: optional-api-key
```

## Related Documentation

- [Execution Layer](../concepts/execution-layer.md)
- [Meridia Experiential Memory](../../extensions/meridia/README.md)
