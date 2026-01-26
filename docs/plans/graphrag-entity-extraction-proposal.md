# GraphRAG Entity Extraction & Knowledge Graph Proposal

## Problem Statement

Clawdbrain's memory system is powerful but flat. The current pipeline — markdown files
chunked into ~400-token segments, embedded, and stored in SQLite with sqlite-vec — excels
at semantic similarity search but cannot answer structural questions:

- "What entities did we discuss across sessions last week?"
- "What is the dependency chain between the auth refactor and the migration goal?"
- "Which people/orgs/repos have been referenced in relation to this project?"
- "Show me how this goal's subtasks relate to entities in the codebase."

The Overseer already models hierarchical goals/phases/tasks/subtasks, but those nodes live
in a JSON store with no graph-traversal capability, no cross-referencing to extracted
entities, and no way to discover emergent structure across sessions or documents.

This proposal adds three capabilities:

1. **Entity extraction** — LLM-driven NER + relationship extraction on ingested content
2. **Knowledge graph persistence** — a lightweight embedded graph layer on top of the
   existing SQLite infrastructure (no external Neo4j dependency by default)
3. **Hybrid GraphRAG retrieval** — graph-augmented context hydration that combines the
   existing vector/BM25 search with graph neighborhood expansion
4. **Manual ingestion & crawling** — bring-your-own docs, URL crawling, and file upload
5. **Web visualization** — an interactive graph explorer in the existing Lit-based control UI

---

## Architecture Overview

```
                          ┌──────────────────────────────────────────┐
                          │            Ingestion Layer               │
                          │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
                          │  │  Memory   │ │  Manual  │ │  Web     │ │
                          │  │  Files    │ │  Upload  │ │  Crawler │ │
                          │  └────┬─────┘ └────┬─────┘ └────┬─────┘ │
                          │       └──────┬─────┴──────┬─────┘       │
                          │              ▼            ▼             │
                          │       ┌──────────┐ ┌────────────┐       │
                          │       │ Chunker  │ │ Doc Parser │       │
                          │       └────┬─────┘ └─────┬──────┘       │
                          └────────────┼─────────────┼──────────────┘
                                       ▼             ▼
                          ┌──────────────────────────────────────────┐
                          │         Extraction Pipeline              │
                          │  ┌──────────────────────────────┐        │
                          │  │  LLM Entity/Relation Extractor│       │
                          │  │  (structured output prompts) │        │
                          │  └──────────┬───────────────────┘        │
                          │             ▼                            │
                          │  ┌──────────────────────────────┐        │
                          │  │  Entity Consolidation &      │        │
                          │  │  Deduplication (MD5 + fuzzy)  │        │
                          │  └──────────┬───────────────────┘        │
                          └─────────────┼────────────────────────────┘
                                        ▼
              ┌─────────────────────────────────────────────────────────┐
              │                  Storage Layer                          │
              │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
              │  │  SQLite Vec  │  │  SQLite FTS5 │  │  SQLite      │  │
              │  │  (embeddings)│  │  (keywords)  │  │  Graph Tables│  │
              │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
              │         └────────┬────────┴────────┬────────┘          │
              │                  ▼                 ▼                   │
              │         ┌────────────────────────────────┐             │
              │         │   Hybrid GraphRAG Retriever    │             │
              │         │   vector + BM25 + graph hops   │             │
              │         └────────────────┬───────────────┘             │
              └──────────────────────────┼─────────────────────────────┘
                                         ▼
              ┌─────────────────────────────────────────────────────────┐
              │              Consumer Layer                             │
              │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
              │  │  Agent Tools │  │  Overseer    │  │  Web UI      │  │
              │  │  (memory_*,  │  │  Goal→Entity │  │  Graph       │  │
              │  │   graph_*)   │  │  Linking     │  │  Explorer    │  │
              │  └──────────────┘  └──────────────┘  └──────────────┘  │
              └─────────────────────────────────────────────────────────┘
```

---

## Component 1: Ingestion Layer

### 1A. Existing Memory File Ingestion (Enhanced)

**Purpose:** The current `MemorySearchManager` already watches `MEMORY.md` and
`memory/*.md` files, chunks them, and builds embeddings. This component adds entity
extraction as a post-chunking step on the same pipeline — zero new configuration required
for users who already have memory search enabled.

**Implementation:**

**File:** `src/memory/entity-extraction.ts` (new)

The extractor receives chunks from the existing `chunkMarkdown()` pipeline in
`src/memory/internal.ts` and runs LLM-based entity/relationship extraction on each chunk.

```typescript
export type ExtractedEntity = {
  id: string;              // MD5 hash of normalized name
  name: string;            // canonical name
  type: EntityType;        // person | org | repo | concept | tool | location | event
  description: string;     // LLM-generated description
  sourceChunkIds: string[];// provenance back to chunk table
  sourceFiles: string[];   // originating file paths
  firstSeen: number;       // epoch ms
  lastSeen: number;
  mentionCount: number;
};

export type ExtractedRelationship = {
  id: string;              // MD5 of sorted(sourceId + targetId)
  sourceEntityId: string;
  targetEntityId: string;
  type: string;            // uses | depends_on | authored_by | discussed_in | blocks | etc.
  description: string;
  keywords: string[];
  weight: number;          // accumulated strength from repeated mentions
  sourceChunkIds: string[];
  sourceFiles: string[];
};

export type EntityType =
  | "person"
  | "org"
  | "repo"
  | "concept"
  | "tool"
  | "location"
  | "event"
  | "goal"       // links to Overseer goals
  | "task"       // links to Overseer tasks
  | "file"       // codebase files
  | "custom";
```

**Extraction prompt strategy** (inspired by LightRAG):

The LLM receives each chunk with a structured extraction prompt:

```
Given the following text, extract all entities and relationships.

Entity types: person, org, repo, concept, tool, location, event, file
Output format (one per line):
  ("entity" | "<name>" | "<type>" | "<description>")

Relationship format (one per line):
  ("relationship" | "<source_name>" | "<target_name>" | "<rel_type>" | "<description>" | "<keywords>" | <strength 1-10>)

Relationship types: uses, depends_on, authored_by, discussed_in, blocks, related_to,
  implements, references, part_of, scheduled_for

Text:
---
{chunk_text}
---
```

**Gleaning loop:** After the initial extraction pass, the system optionally re-prompts
with "Many entities were missed in the previous extraction. Please identify additional
entities and relationships." (configurable `gleaning.passes: 0|1|2`, default 1). This is
LightRAG's strategy for improving recall without complex multi-pass architectures.

**Entity consolidation:** Multiple mentions of the same entity across chunks are merged:

- Name normalization: lowercase, strip whitespace, collapse aliases via embedding similarity
  (cosine > 0.92 on entity name embeddings triggers merge candidate, confirmed by LLM)
- Type conflict resolution: most-frequent-type wins (counter-based)
- Description merging: concatenate with `|||` separator; if fragments > 6, summarize via
  LLM into a single description
- Provenance union: merge `sourceChunkIds` and `sourceFiles` sets

**Integration point in `manager.ts`:**

The existing `syncFiles()` method (which calls `chunkMarkdown()` → embed → store) gets a
post-embedding hook:

```typescript
// In MemorySearchManager.syncFiles(), after embedding storage:
if (this.graphConfig.entityExtraction.enabled) {
  await this.entityExtractor.extractFromChunks(newChunks, { source: "memory" });
}
```

This means entity extraction piggybacks on the existing sync cycle (on-session-start,
on-search, watch, interval) with no new scheduling infrastructure.

### 1B. Manual Document Ingestion

**Purpose:** Allow users to ingest arbitrary documents (PDF, DOCX, plain text, markdown)
that aren't part of the memory directory — e.g. project specs, design docs, API references,
meeting notes. This is the "bring your own knowledge" pathway, inspired by Archon's
document upload feature.

**Implementation:**

**File:** `src/knowledge/ingest.ts` (new)

```typescript
export type IngestSource = {
  type: "file" | "url" | "text";
  path?: string;         // local file path
  url?: string;          // for URL sources
  content?: string;      // raw text for "text" type
  mimeType?: string;     // auto-detected if absent
  tags?: string[];       // user-supplied labels
  metadata?: Record<string, string>;
};

export type IngestResult = {
  sourceId: string;
  chunks: number;
  entities: number;
  relationships: number;
  durationMs: number;
};
```

**Document parsing pipeline:**

1. **MIME detection:** Use file extension + magic bytes (via `file-type` package already
   available in the ecosystem, or a lightweight heuristic for md/txt/json).

2. **Content extraction by type:**
   - **Markdown/Text:** Direct pass-through to chunker
   - **PDF:** Use `pdf-parse` (pure JS, no native deps) to extract text per page,
     concatenate with page markers
   - **DOCX:** Use `mammoth` (pure JS) to convert to markdown, then chunk
   - **HTML:** Strip tags, extract text content (reuse existing HTML-to-text from web
     provider if available)
   - **JSON/JSONL:** Flatten to text representation with key paths preserved

3. **Chunking:** Reuse `chunkMarkdown()` from `src/memory/internal.ts` with the same
   token/overlap config. For non-markdown content, apply paragraph-aware splitting first
   (respecting the existing `paragraph-aware newline chunking` logic from the recent commit
   `3145395`).

4. **Embedding + extraction:** Same pipeline as 1A — embed chunks, store in sqlite-vec,
   run entity extraction, store in graph tables.

**CLI surface:**

```
clawdbot knowledge ingest <path-or-url> [--tags tag1,tag2] [--agent <agentId>]
clawdbot knowledge ingest --text "inline content" [--tags tag1]
clawdbot knowledge list [--source memory|manual|crawl] [--agent <agentId>]
clawdbot knowledge remove <sourceId> [--agent <agentId>]
```

**Agent tool surface:**

```typescript
// New tool: knowledge_ingest
{
  name: "knowledge_ingest",
  description: "Ingest a local file or raw text into the knowledge graph for future retrieval.",
  parameters: {
    path: Type.Optional(Type.String()),  // local file
    text: Type.Optional(Type.String()),  // inline content
    tags: Type.Optional(Type.Array(Type.String())),
  }
}
```

This lets agents self-ingest relevant documents they discover during work — e.g. an agent
reading an API spec can ingest it for future sessions.

### 1C. Web Crawler

**Purpose:** Crawl documentation sites, sitemaps, and individual URLs to build a knowledge
base from external sources. Inspired by Archon's `CrawlingService` and `mcp-crawl4ai-rag`.

**Implementation:**

**File:** `src/knowledge/crawler.ts` (new)

```typescript
export type CrawlTarget = {
  url: string;
  mode: "single" | "sitemap" | "recursive";
  maxPages?: number;     // default 100
  maxDepth?: number;     // default 3 for recursive
  allowPatterns?: string[]; // URL glob patterns to follow
  blockPatterns?: string[]; // URL glob patterns to skip
  tags?: string[];
};

export type CrawlProgress = {
  crawlId: string;
  status: "queued" | "crawling" | "processing" | "done" | "error";
  pagesDiscovered: number;
  pagesCrawled: number;
  pagesProcessed: number;
  entitiesExtracted: number;
  errors: Array<{ url: string; error: string }>;
};
```

**Crawl strategy:**

1. **URL discovery:**
   - `single`: Fetch one page
   - `sitemap`: Fetch `/sitemap.xml` (and nested sitemaps), extract all `<loc>` URLs,
     filter by `allowPatterns`/`blockPatterns`
   - `recursive`: BFS from seed URL, follow same-origin links up to `maxDepth`, respect
     `robots.txt`

2. **Content fetching:** Use the existing HTTP infrastructure (the project already has
   fetch capabilities for web providers). For JavaScript-rendered pages, optionally use
   a headless browser via Playwright (already a dev dependency in `ui/package.json`).
   Default to plain HTTP fetch with a fallback note if JS rendering is needed.

3. **HTML-to-markdown conversion:** Convert fetched HTML to clean markdown, stripping
   navigation, footers, ads. Use a readability-style extraction (Mozilla Readability
   algorithm or `@mozilla/readability` + JSDOM, both pure JS).

4. **Deduplication:** MD5 hash of canonical URL → `source_id`. If a page has already
   been crawled and its content hash matches, skip re-processing. If content changed,
   re-extract (delta update).

5. **Rate limiting:** Configurable `requestsPerSecond` (default 2), polite delays,
   respect `Crawl-delay` from robots.txt.

6. **Pipeline handoff:** Each crawled page's markdown content feeds into the same
   chunking → embedding → entity extraction pipeline from 1A/1B.

**CLI surface:**

```
clawdbot knowledge crawl <url> [--mode single|sitemap|recursive] [--max-pages 100]
  [--tags tag1,tag2] [--agent <agentId>]
clawdbot knowledge crawl-status [crawlId]
```

**Agent tool surface:**

```typescript
{
  name: "knowledge_crawl",
  description: "Crawl a URL or documentation site and ingest into the knowledge graph.",
  parameters: {
    url: Type.String(),
    mode: Type.Optional(Type.String()),  // "single" | "sitemap" | "recursive"
    maxPages: Type.Optional(Type.Number()),
    tags: Type.Optional(Type.Array(Type.String())),
  }
}
```

**Progress reporting:** Crawl operations are long-running. Use the existing
`src/cli/progress.ts` (`osc-progress` + `@clack/prompts` spinner) for CLI display. For
agent contexts, emit progress via the existing event system and expose via
`knowledge_crawl_status` tool.

---

## Component 2: Entity Extraction Pipeline

### 2A. Extraction Engine

**Purpose:** The core LLM-driven extraction that transforms unstructured text chunks into
structured entity/relationship tuples.

**File:** `src/knowledge/extraction/extractor.ts` (new)

**Implementation details:**

```typescript
export type ExtractionConfig = {
  enabled: boolean;
  entityTypes: EntityType[];     // customizable per agent
  relationshipTypes: string[];   // customizable per agent
  model?: string;                // override model for extraction (default: agent's model)
  gleaning: {
    enabled: boolean;
    passes: number;              // 0 = no gleaning, 1 = one re-prompt, 2 = two
  };
  consolidation: {
    aliasMergeThreshold: number; // cosine similarity threshold (default 0.92)
    maxDescriptionFragments: number; // before triggering summarization (default 6)
  };
  batchSize: number;             // chunks per extraction call (default 1)
};
```

**Model selection:** Extraction is token-intensive but doesn't need frontier-level
reasoning. Default to the agent's configured model, but allow override to a cheaper/faster
model (e.g. `gpt-4.1-mini`, `gemini-2.0-flash`, or a local model via Ollama). The
extraction prompt is designed to work with models that support structured output.

**Structured output parsing:**

The extractor parses LLM output line-by-line using delimiter-based parsing (LightRAG
style), with fallback to JSON mode if the model supports it. Each line matching the
`("entity"|...)` or `("relationship"|...)` pattern is parsed; malformed lines are logged
and skipped (graceful degradation).

```typescript
function parseExtractionOutput(raw: string): {
  entities: ParsedEntity[];
  relationships: ParsedRelationship[];
  unparsed: string[];
} {
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  // ... delimiter parsing with ("entity"|...) and ("relationship"|...) patterns
  // Falls back to JSON parsing if delimiter format not detected
}
```

**Batch extraction optimization:**

For bulk ingestion (crawl, large file upload), chunks are batched and processed with
concurrency control (configurable, default 4 concurrent extraction calls). Uses the
existing LLM provider abstraction so any configured provider (OpenAI, Gemini, Anthropic,
local) can drive extraction.

### 2B. Entity Consolidation & Deduplication

**Purpose:** Merge entity mentions across chunks and sources into canonical nodes,
preventing graph bloat and maintaining a clean knowledge graph.

**File:** `src/knowledge/extraction/consolidation.ts` (new)

**Algorithm:**

1. **Exact match:** Normalize name (lowercase, trim, collapse whitespace) → MD5 hash.
   If hash matches existing entity, merge.

2. **Fuzzy match:** For new entities, compute embedding of entity name. Compare against
   existing entity name embeddings (cosine similarity). If score > `aliasMergeThreshold`
   (default 0.92), flag as merge candidate.

3. **LLM confirmation** (optional, for borderline cases): Ask LLM "Are these the same
   entity? A: '{name1}' ({type1}) — '{name2}' ({type2})" → yes/no. Only triggered when
   similarity is in the 0.88–0.92 band.

4. **Merge execution:**
   - Union of `sourceChunkIds`, `sourceFiles`
   - Increment `mentionCount`
   - Update `lastSeen`
   - Type: most-frequent wins
   - Description: append with `|||`, summarize if > `maxDescriptionFragments`

5. **Relationship merging:** When two entity nodes merge, their relationships are
   transitively re-pointed. Duplicate edges (same source+target+type) have their weights
   summed and descriptions/keywords merged.

---

## Component 3: Graph Storage Layer

### 3A. SQLite Graph Tables

**Purpose:** Store entity and relationship data in the same SQLite database that already
holds the vector index (`{agentId}.sqlite`), avoiding any new infrastructure dependency.

**File:** `src/knowledge/graph/schema.ts` (new)

**Schema** (added to the existing memory database via `ensureMemoryIndexSchema()`):

```sql
-- Entity nodes
CREATE TABLE IF NOT EXISTS kg_entities (
  entity_id    TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL,
  description  TEXT,
  mention_count INTEGER DEFAULT 1,
  first_seen   INTEGER NOT NULL,
  last_seen    INTEGER NOT NULL,
  source_files TEXT,  -- JSON array
  metadata     TEXT   -- JSON object for extensibility
);

CREATE INDEX IF NOT EXISTS idx_kg_entities_type ON kg_entities(type);
CREATE INDEX IF NOT EXISTS idx_kg_entities_name ON kg_entities(name);

-- Entity name embeddings (for dedup/consolidation)
CREATE TABLE IF NOT EXISTS kg_entity_embeddings (
  entity_id  TEXT PRIMARY KEY REFERENCES kg_entities(entity_id),
  embedding  BLOB NOT NULL,    -- float32 array
  model      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Relationship edges
CREATE TABLE IF NOT EXISTS kg_relationships (
  rel_id           TEXT PRIMARY KEY,
  source_entity_id TEXT NOT NULL REFERENCES kg_entities(entity_id),
  target_entity_id TEXT NOT NULL REFERENCES kg_entities(entity_id),
  type             TEXT NOT NULL,
  description      TEXT,
  keywords         TEXT,  -- JSON array
  weight           REAL DEFAULT 1.0,
  source_files     TEXT, -- JSON array
  metadata         TEXT  -- JSON object
);

CREATE INDEX IF NOT EXISTS idx_kg_rels_source ON kg_relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_kg_rels_target ON kg_relationships(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_kg_rels_type ON kg_relationships(type);

-- Entity ↔ chunk provenance (many-to-many)
CREATE TABLE IF NOT EXISTS kg_entity_chunks (
  entity_id TEXT NOT NULL REFERENCES kg_entities(entity_id),
  chunk_id  TEXT NOT NULL,
  PRIMARY KEY (entity_id, chunk_id)
);

-- Ingestion sources (for manual/crawl tracking)
CREATE TABLE IF NOT EXISTS kg_sources (
  source_id   TEXT PRIMARY KEY,
  type        TEXT NOT NULL,  -- "memory" | "manual" | "crawl"
  origin      TEXT,           -- file path or URL
  tags        TEXT,           -- JSON array
  content_hash TEXT,
  chunk_count  INTEGER,
  entity_count INTEGER,
  rel_count    INTEGER,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  metadata     TEXT           -- JSON object (crawl config, etc.)
);
```

### 3B. Graph Query Engine

**Purpose:** Provide graph traversal and neighborhood expansion queries without requiring
a dedicated graph database.

**File:** `src/knowledge/graph/query.ts` (new)

SQLite can model graph traversal via recursive CTEs. The query engine provides these
primitives:

```typescript
export type GraphQueryEngine = {
  /** Find entities by name (exact or fuzzy via FTS) */
  findEntities(query: string, opts?: { type?: EntityType; limit?: number }): Promise<ExtractedEntity[]>;

  /** Get 1-hop neighborhood: all entities connected to a given entity */
  getNeighborhood(entityId: string, opts?: {
    maxHops?: number;       // default 1, max 3
    relTypes?: string[];    // filter by relationship type
    limit?: number;         // max entities returned
  }): Promise<{ entities: ExtractedEntity[]; relationships: ExtractedRelationship[] }>;

  /** Find shortest path between two entities */
  findPath(fromEntityId: string, toEntityId: string, maxHops?: number):
    Promise<Array<{ entity: ExtractedEntity; relationship?: ExtractedRelationship }>>;

  /** Get entity with highest degree (most connected) */
  getHubs(opts?: { type?: EntityType; limit?: number }): Promise<ExtractedEntity[]>;

  /** Get all entities + relationships for a source (file, URL, crawl) */
  getSourceGraph(sourceId: string): Promise<GraphSnapshot>;

  /** Full subgraph for a set of entity IDs */
  getSubgraph(entityIds: string[]): Promise<GraphSnapshot>;

  /** Stats: entity count, relationship count, type distribution */
  getStats(): Promise<GraphStats>;
};

export type GraphSnapshot = {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
};
```

**Recursive CTE example for N-hop neighborhood:**

```sql
WITH RECURSIVE neighborhood(entity_id, depth) AS (
  SELECT :startEntityId, 0
  UNION
  SELECT
    CASE WHEN r.source_entity_id = n.entity_id
         THEN r.target_entity_id
         ELSE r.source_entity_id
    END,
    n.depth + 1
  FROM neighborhood n
  JOIN kg_relationships r
    ON r.source_entity_id = n.entity_id
    OR r.target_entity_id = n.entity_id
  WHERE n.depth < :maxHops
)
SELECT DISTINCT e.* FROM kg_entities e
JOIN neighborhood n ON e.entity_id = n.entity_id;
```

### 3C. Optional Neo4j Backend (Extension)

**Purpose:** For users with large-scale knowledge graphs (10k+ entities), provide an
optional Neo4j backend as a plugin extension.

**Implementation:** An extension package at `extensions/knowledge-neo4j/` that implements
the `GraphQueryEngine` interface against a Neo4j instance via the `neo4j-driver` package.
This keeps the core zero-dependency on Neo4j while allowing power users to scale.

```typescript
// extensions/knowledge-neo4j/src/index.ts
import type { GraphQueryEngine } from "clawdbot/knowledge";

export function createNeo4jGraphEngine(config: {
  uri: string;
  username: string;
  password: string;
  database?: string;
}): GraphQueryEngine {
  // Cypher-based implementation of the same interface
}
```

Configuration:

```yaml
agents:
  defaults:
    knowledge:
      graph:
        backend: "sqlite"  # or "neo4j"
        neo4j:
          uri: "bolt://localhost:7687"
          username: "neo4j"
          password: "..."
```

---

## Component 4: Hybrid GraphRAG Retriever

### 4A. Graph-Augmented Search

**Purpose:** Enhance the existing `mergeHybridResults()` pipeline with a graph expansion
step that pulls in structurally related context that pure vector/BM25 search would miss.

**File:** `src/knowledge/retrieval/graph-rag.ts` (new)

**Algorithm** (3-phase retrieval):

```
Phase 1: Existing Hybrid Search
  ├─ Vector search (cosine similarity via sqlite-vec)
  ├─ BM25 keyword search (FTS5)
  └─ Weighted merge → top-K candidates (existing pipeline, untouched)

Phase 2: Entity Recognition in Query
  ├─ Extract entity mentions from the query string
  │   (fast: regex + entity name index lookup, no LLM call)
  └─ If no entities found, embed query and find nearest entity name embeddings

Phase 3: Graph Expansion
  ├─ For each recognized entity, pull 1-hop neighborhood
  ├─ Collect related entity descriptions + relationship descriptions
  ├─ Retrieve source chunks for related entities via kg_entity_chunks
  └─ Score graph-sourced chunks with a graph proximity weight

Final Merge:
  combined_score = α * hybrid_score + β * graph_proximity_score
  (default: α=0.7, β=0.3)
  Deduplicate by chunk_id, return top-N
```

**Integration into existing search path:**

The `MemorySearchManager.search()` method currently calls `searchVector()` +
`searchKeyword()` + `mergeHybridResults()`. The graph expansion step is inserted after
the merge:

```typescript
// In manager.ts search():
let results = mergeHybridResults({ vector, keyword, vectorWeight, textWeight });

if (this.graphConfig.retrieval.graphExpansion.enabled) {
  results = await this.graphRetriever.expandWithGraph(query, results, {
    maxHops: this.graphConfig.retrieval.graphExpansion.maxHops,
    graphWeight: this.graphConfig.retrieval.graphExpansion.weight,
    maxGraphChunks: this.graphConfig.retrieval.graphExpansion.maxChunks,
  });
}
```

### 4B. Graph Context Formatter

**Purpose:** Format graph-derived context into a structured block that the agent can
reason over, rather than dumping raw entity data.

**Output format injected into search results:**

```
## Knowledge Graph Context
Query entities: [Auth Service, OAuth Provider]

### Auth Service (concept)
Related: OAuth Provider (depends_on, weight: 8), User Model (implements),
  Login Flow (part_of), Session Store (uses)
Description: Core authentication service handling JWT issuance and validation...

### OAuth Provider (tool)
Related: Auth Service (depended_on_by), Google OAuth (implements),
  GitHub OAuth (implements)
Description: External OAuth2 provider integration layer...

### Relevant Relationships:
- Auth Service → OAuth Provider: "depends_on" — Auth service delegates to OAuth
  provider for third-party login flows (strength: 8)
```

This gives agents structured, traversable context that enables multi-hop reasoning —
e.g. "the auth service depends on the OAuth provider which implements Google OAuth,
so changes to Google OAuth affect auth."

---

## Component 5: Overseer Integration

### 5A. Goal ↔ Entity Linking

**Purpose:** Bridge the Overseer's goal/task hierarchy with the knowledge graph so that
goals, tasks, and subtasks become first-class graph nodes with relationships to extracted
entities.

**File:** `src/knowledge/overseer-bridge.ts` (new)

**Mechanism:**

When the Overseer creates or updates a goal (`OverseerGoalRecord`), the bridge:

1. Creates a `goal` entity node in the knowledge graph:
   ```
   entity_id: "goal-{goalId}"
   name: goal.title
   type: "goal"
   description: goal.problemStatement
   ```

2. Creates `task` entity nodes for each task/subtask in the plan.

3. Runs entity extraction on `goal.problemStatement` + `goal.successCriteria` to discover
   which existing entities the goal relates to.

4. Creates relationships:
   - `goal → task` (has_task)
   - `task → subtask` (has_subtask)
   - `task → entity` (references, depends_on, modifies) — from extraction
   - `goal → goal` (blocks, depends_on) — from `dependsOn`/`blocks` fields

This means you can query: "What goals reference the Auth Service?" or "Show me all tasks
that modify files in `src/memory/`."

### 5B. Task Dependency Graph Queries

**Purpose:** Enable the Overseer planner to query the knowledge graph when decomposing
goals into tasks, discovering implicit dependencies.

When the planner creates a new plan, it can:

1. Extract entities from the goal's problem statement
2. Query the graph for related entities and their neighborhoods
3. Discover existing goals/tasks that touch the same entities
4. Surface these as potential dependencies or conflicts

This transforms the Overseer from a flat task tracker into a dependency-aware planner.

---

## Component 6: Agent Tools

### 6A. New Tools

Three new agent tools, following the existing pattern in `src/agents/tools/memory-tool.ts`:

**File:** `src/agents/tools/knowledge-tools.ts` (new)

```typescript
// 1. graph_search — entity-aware search
{
  name: "graph_search",
  description: "Search the knowledge graph for entities and their relationships. " +
    "Use when you need to understand how concepts, people, tools, or goals relate to each other.",
  parameters: {
    query: Type.String(),
    entityType: Type.Optional(Type.String()),  // filter by type
    maxHops: Type.Optional(Type.Number()),      // neighborhood depth (default 1)
    maxResults: Type.Optional(Type.Number()),
  }
}

// 2. graph_inspect — detailed entity view
{
  name: "graph_inspect",
  description: "Get detailed information about a specific entity including all its " +
    "relationships, source files, and description. Use after graph_search to drill down.",
  parameters: {
    entityName: Type.String(),
    includeNeighborhood: Type.Optional(Type.Boolean()),
  }
}

// 3. knowledge_ingest — self-serve ingestion (described in 1B above)
// 4. knowledge_crawl — web crawling (described in 1C above)
```

### 6B. Enhanced memory_search

The existing `memory_search` tool gets an optional `useGraph` parameter:

```typescript
{
  name: "memory_search",
  parameters: {
    query: Type.String(),
    maxResults: Type.Optional(Type.Number()),
    minScore: Type.Optional(Type.Number()),
    useGraph: Type.Optional(Type.Boolean()),  // NEW: enable graph expansion (default: true)
  }
}
```

When `useGraph` is true (the default when graph is enabled), the search transparently
includes graph expansion results alongside vector/BM25 results.

---

## Component 7: Web Visualization UX

### 7A. Graph Explorer Page

**Purpose:** An interactive force-directed graph visualization in the existing Lit-based
control UI (`ui/`), allowing users to explore entities, relationships, and their
connections to memory chunks and Overseer goals.

**Technology choice:**

The UI uses Lit (web components) + Tailwind. For graph rendering, use **D3-force** (pure
JS, no framework dependency, ~30KB gzipped). D3's force simulation is the industry
standard for interactive node-link diagrams and works cleanly with Lit's render lifecycle.

Alternative considered: Cytoscape.js (richer graph-specific features but heavier at ~100KB
and more opinionated layout). Sigma.js (WebGL-based, better for very large graphs but
overkill for knowledge graphs under 10K nodes). **Recommendation: Start with D3-force;
migrate to Cytoscape.js only if we need advanced layouts like hierarchical or circular.**

**File:** `ui/src/ui/pages/knowledge-graph.ts` (new Lit component)

**Features:**

1. **Force-directed layout:** Entities as nodes (colored by type), relationships as edges
   (labeled, thickness by weight). Physics simulation with drag, zoom, pan.

2. **Node interactions:**
   - Click: Show entity detail panel (description, type, mention count, source files)
   - Double-click: Expand neighborhood (lazy-load connected nodes)
   - Right-click: Context menu (inspect, find in memory, link to goal)

3. **Edge interactions:**
   - Hover: Show relationship description, keywords, weight
   - Click: Show source chunks where this relationship was extracted

4. **Filtering:**
   - Entity type filter (checkboxes: person, org, concept, tool, etc.)
   - Relationship type filter
   - Source filter (memory, manual, crawl)
   - Time range slider (first_seen / last_seen)
   - Search box (highlights matching nodes)

5. **Goal overlay:** Toggle to show Overseer goals/tasks as special nodes in the graph,
   with their relationships to entities highlighted.

6. **Stats sidebar:**
   - Total entities, relationships, sources
   - Type distribution (bar chart)
   - Most connected entities (hub list)
   - Recent extractions (timeline)

**Wireframe:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Knowledge Graph Explorer                          [Filters ▾]  │
├────────────────────────────────────────────┬────────────────────┤
│                                            │  Entity Detail     │
│                                            │                    │
│         ┌─────┐                            │  Name: Auth Service│
│        ╱       ╲     ┌──────┐              │  Type: concept     │
│  ┌────┤  OAuth  ├────┤ User │              │  Mentions: 47      │
│  │     ╲ Provider╱   │ Model│              │  Sources: 12 files │
│  │      └───┬───┘    └──┬───┘              │                    │
│  │          │           │                  │  Relationships (8) │
│  ▼          ▼           ▼                  │  ─ OAuth Provider  │
│ ┌────────┐ ┌────────┐ ┌────────┐           │    depends_on (w:8)│
│ │ Google │ │  Auth  │ │ Login  │           │  ─ User Model      │
│ │ OAuth  │ │Service │ │  Flow  │           │    implements (w:5)│
│ └────────┘ └────────┘ └────────┘           │  ─ Session Store   │
│                                            │    uses (w:6)      │
│                                            │                    │
│  [Entity types: ■ concept ■ tool ■ person] │  [View Sources]    │
├────────────────────────────────────────────┴────────────────────┤
│  Entities: 342  │  Relationships: 891  │  Sources: 28           │
└─────────────────────────────────────────────────────────────────┘
```

### 7B. Gateway API Endpoints

**Purpose:** Expose graph data to the web UI via the existing gateway HTTP API.

**New routes** (added to the gateway router):

```
GET  /api/knowledge/graph/stats
GET  /api/knowledge/graph/entities?type=&search=&limit=&offset=
GET  /api/knowledge/graph/entity/:entityId
GET  /api/knowledge/graph/entity/:entityId/neighborhood?hops=&relTypes=
GET  /api/knowledge/graph/relationships?sourceId=&targetId=&type=
GET  /api/knowledge/graph/subgraph?entityIds=id1,id2,id3
GET  /api/knowledge/graph/sources
POST /api/knowledge/ingest          (file upload or URL)
POST /api/knowledge/crawl           (start crawl job)
GET  /api/knowledge/crawl/:crawlId  (crawl status)
```

All endpoints are authenticated via the existing gateway auth mechanism. The graph query
engine is instantiated per-agent (using the agent's SQLite database).

### 7C. Ingestion Management UI

**Purpose:** A companion page to the graph explorer for managing knowledge sources —
viewing ingested documents, uploading new files, starting crawls, and monitoring progress.

**Features:**

1. **Source list:** Table of all knowledge sources (memory files, manual uploads, crawls)
   with columns: name, type, tags, chunks, entities, last updated
2. **Upload panel:** Drag-and-drop file upload (PDF, DOCX, MD, TXT) with tag input
3. **Crawl panel:** URL input + mode selector + start button, with real-time progress bar
4. **Source detail:** Click a source to see its entities, relationships, and chunks

---

## Component 8: Configuration

### 8A. Config Schema

All new capabilities are behind a single `knowledge` config block, nested under agent
defaults (matching the existing `memorySearch` pattern):

```typescript
// In types.agent-defaults.ts
export type KnowledgeConfig = {
  enabled: boolean;                  // master switch (default: false)

  entityExtraction: {
    enabled: boolean;                // default: true when knowledge.enabled
    entityTypes: EntityType[];       // default: all built-in types
    relationshipTypes: string[];     // default: all built-in types
    model?: string;                  // override extraction model
    gleaning: {
      enabled: boolean;             // default: true
      passes: number;               // default: 1
    };
    consolidation: {
      aliasMergeThreshold: number;  // default: 0.92
      maxDescriptionFragments: number; // default: 6
    };
    batchSize: number;              // default: 1
    concurrency: number;            // default: 4
  };

  graph: {
    backend: "sqlite" | "neo4j";    // default: "sqlite"
    neo4j?: {                       // only if backend = "neo4j"
      uri: string;
      username: string;
      password: string;
      database?: string;
    };
  };

  retrieval: {
    graphExpansion: {
      enabled: boolean;             // default: true when knowledge.enabled
      maxHops: number;              // default: 1
      weight: number;               // graph score weight in final merge (default: 0.3)
      maxChunks: number;            // max graph-sourced chunks (default: 4)
    };
  };

  ingestion: {
    allowedMimeTypes: string[];     // default: md, txt, pdf, docx, html, json
    maxFileSizeMb: number;          // default: 50
  };

  crawl: {
    maxPagesPerCrawl: number;       // default: 100
    requestsPerSecond: number;      // default: 2
    respectRobotsTxt: boolean;      // default: true
    userAgent: string;              // default: "Clawdbot-Crawler/1.0"
  };
};
```

**Per-agent override** (same as `memorySearch`):

```yaml
agents:
  defaults:
    knowledge:
      enabled: true
  my-agent:
    knowledge:
      entityExtraction:
        entityTypes: [person, org, concept, repo]
```

---

## Implementation Sequence

### Phase 1: Graph Storage + Entity Extraction Core

**Scope:** Schema, extraction engine, consolidation, basic graph queries.

**Files to create:**
- `src/knowledge/graph/schema.ts` — SQLite table creation
- `src/knowledge/extraction/extractor.ts` — LLM extraction pipeline
- `src/knowledge/extraction/consolidation.ts` — Entity merging
- `src/knowledge/extraction/parser.ts` — Output parsing (delimiter + JSON)
- `src/knowledge/graph/query.ts` — Graph query engine (recursive CTEs)
- `src/knowledge/graph/types.ts` — Shared types (ExtractedEntity, etc.)
- `src/knowledge/index.ts` — Public API barrel

**Files to modify:**
- `src/memory/memory-schema.ts` — Add graph tables to schema init
- `src/memory/manager.ts` — Hook extraction into `syncFiles()`
- `src/agents/memory-search.ts` — Add knowledge config resolution
- Config types + zod schemas — Add `KnowledgeConfig`

**Tests:**
- `src/knowledge/extraction/extractor.test.ts`
- `src/knowledge/extraction/consolidation.test.ts`
- `src/knowledge/graph/query.test.ts`

### Phase 2: Hybrid GraphRAG Retrieval + Agent Tools

**Scope:** Graph-augmented search, new agent tools, enhanced `memory_search`.

**Files to create:**
- `src/knowledge/retrieval/graph-rag.ts` — Graph expansion retriever
- `src/knowledge/retrieval/query-entity-recognizer.ts` — Fast entity mention detection
- `src/agents/tools/knowledge-tools.ts` — graph_search, graph_inspect tools

**Files to modify:**
- `src/memory/manager.ts` — Wire graph expansion into `search()`
- `src/agents/tools/memory-tool.ts` — Add `useGraph` parameter
- `src/agents/system-prompt.ts` — Add knowledge graph context section
- Agent tool registration — Register new tools

**Tests:**
- `src/knowledge/retrieval/graph-rag.test.ts`
- `src/agents/tools/knowledge-tools.test.ts`

### Phase 3: Manual Ingestion + Web Crawler

**Scope:** File upload, document parsing, URL crawling, CLI commands.

**Files to create:**
- `src/knowledge/ingest.ts` — Ingestion pipeline
- `src/knowledge/crawler.ts` — Web crawler
- `src/knowledge/parsers/pdf.ts` — PDF extraction
- `src/knowledge/parsers/docx.ts` — DOCX extraction
- `src/knowledge/parsers/html.ts` — HTML readability extraction
- `src/commands/knowledge.ts` — CLI commands (ingest, crawl, list, remove)

**Dependencies to add:**
- `pdf-parse` — PDF text extraction (pure JS)
- `mammoth` — DOCX to markdown (pure JS)
- `@mozilla/readability` + `linkedom` — HTML content extraction (pure JS, no Chromium)

**Tests:**
- `src/knowledge/ingest.test.ts`
- `src/knowledge/crawler.test.ts`
- `src/knowledge/parsers/*.test.ts`
- `src/commands/knowledge.test.ts`

### Phase 4: Overseer Bridge

**Scope:** Goal ↔ entity linking, dependency-aware planning.

**Files to create:**
- `src/knowledge/overseer-bridge.ts` — Goal/task → graph node sync

**Files to modify:**
- `src/infra/overseer/planner.ts` — Graph context in plan generation
- `src/infra/overseer/store.types.ts` — Optional entity references

### Phase 5: Web Visualization + Gateway API

**Scope:** Graph explorer UI, gateway endpoints, ingestion management page.

**Files to create:**
- `ui/src/ui/pages/knowledge-graph.ts` — Lit graph explorer component
- `ui/src/ui/pages/knowledge-sources.ts` — Ingestion management component
- `ui/src/ui/components/graph-renderer.ts` — D3-force rendering logic
- `ui/src/ui/components/entity-detail-panel.ts` — Entity sidebar
- Gateway routes for `/api/knowledge/*`

**Dependencies to add (ui/):**
- `d3-force` + `d3-selection` + `d3-zoom` — Graph rendering (~30KB)

### Phase 6: Neo4j Extension (Optional)

**Scope:** Plugin for Neo4j backend.

**Files to create:**
- `extensions/knowledge-neo4j/` — Extension package

---

## Demonstrating Value

### Demo 1: "What do we know?"

After enabling knowledge and running a few sessions:

```
> clawdbot knowledge stats

Knowledge Graph: my-agent
  Entities:      342 (87 concepts, 63 tools, 52 people, 41 files, 99 other)
  Relationships: 891
  Sources:       28 (14 memory, 8 manual, 6 crawl)
  Last updated:  2 minutes ago

Top hubs:
  1. Auth Service (concept)      — 23 relationships
  2. Peter (person)              — 19 relationships
  3. Gateway (concept)           — 17 relationships
```

### Demo 2: Structural Query

```
User: How does the auth system relate to the gateway?

Agent: [Uses graph_search to find Auth Service and Gateway entities]
       [Discovers path: Auth Service → JWT Validator → Gateway Middleware → Gateway]
       [Pulls source chunks for each relationship]

The auth system connects to the gateway through 3 hops:
1. Auth Service produces JWTs (implemented in src/auth/jwt.ts)
2. JWT Validator middleware consumes those tokens (src/gateway/middleware/auth.ts)
3. Gateway loads the validator as middleware on all authenticated routes

This was discussed in sessions on Jan 15 and Jan 20, and the design doc
you ingested (docs/auth-design.md) describes the original architecture.
```

### Demo 3: Visual Exploration

User opens `http://localhost:18789/knowledge` and sees:

- Force-directed graph with color-coded entity types
- Clicks "Auth Service" → sidebar shows all relationships
- Double-clicks → expands to show OAuth Provider, JWT Validator, User Model
- Toggles "Show Goals" → sees "Auth Refactor" goal node connected to Auth Service
- Filters to "last 7 days" → sees only recently-referenced entities

### Demo 4: Crawl + Discover

```
User: Crawl the Stripe API docs so you know how to integrate payments

Agent: [Uses knowledge_crawl tool with url="https://docs.stripe.com", mode="sitemap"]

Started crawl job crawl-abc123. Processing...
  Pages discovered: 847
  Pages crawled: 100 (hit limit)
  Entities extracted: 234 (89 concepts, 67 tools, 42 objects, 36 endpoints)
  Relationships: 412

Notable entities found:
  - PaymentIntent (concept) — 12 relationships
  - Customer (concept) — 9 relationships
  - Webhook (tool) — 8 relationships

These are now available in your knowledge graph. Try:
  "How does Stripe handle refunds?" → will use graph to find Refund → PaymentIntent → Charge chain
```

---

## Open Questions & Trade-offs

### SQLite vs. Dedicated Graph DB

**Choice:** SQLite by default, Neo4j as optional extension.

**Rationale:** Clawdbrain's existing infrastructure is entirely SQLite-based (memory index,
session store). Adding a mandatory Neo4j dependency would be a significant operational
burden for a CLI tool. Recursive CTEs in SQLite handle 1-3 hop traversals on graphs up
to ~50K nodes performantly (sub-100ms). Neo4j extension available for users who need
larger scale or complex graph algorithms (community detection, PageRank).

### Extraction Cost

Entity extraction adds LLM calls per chunk. For 100 chunks at ~400 tokens each, extraction
adds ~40K input tokens + ~10K output tokens per sync. At GPT-4.1-mini pricing
($0.40/1M input, $1.60/1M output), that's ~$0.03 per full sync. Mitigation:

- Only extract from new/changed chunks (delta sync, already the existing behavior)
- Use cheaper models for extraction (configurable)
- Batch extraction calls where possible
- Cache extraction results per chunk hash

### Graph Staleness

Entities extracted from old chunks may reference outdated information. Mitigation:

- `last_seen` timestamps enable recency-weighted retrieval
- Periodic re-extraction on changed files (piggybacks on existing file watcher)
- Manual `clawdbot knowledge reindex` command for full re-extraction
- Time-range filtering in both agent tools and web UI

### Prompt Context Budget

Graph context competes with vector/BM25 results for context window space. Mitigation:

- Configurable `maxChunks` for graph-sourced results (default 4)
- Graph context is formatted as structured summary (compact) rather than raw chunks
- `useGraph: false` escape hatch on `memory_search` for when agents want pure vector

---

## References

- [Archon OS — Knowledge and task management backbone for AI coding assistants](https://github.com/coleam00/Archon)
- [Archon Knowledge Management System (DeepWiki)](https://deepwiki.com/coleam00/Archon/5-knowledge-management)
- [LightRAG: Entity Extraction with Neo4j (Neo4j Blog)](https://neo4j.com/blog/developer/under-the-covers-with-lightrag-extraction/)
- [What is GraphRAG: Complete Guide 2026 (Meilisearch)](https://www.meilisearch.com/blog/graph-rag)
- [GraphRAG Explained: Building Knowledge-Grounded LLM Systems with Neo4j and LangChain](https://pub.towardsai.net/graphrag-explained-building-knowledge-grounded-llm-systems-with-neo4j-and-langchain-017a1820763e)
- [Intro to GraphRAG (graphrag.com)](https://graphrag.com/concepts/intro-to-graphrag/)
- [Hybrid GraphRAG with Qdrant and Neo4j](https://qdrant.tech/documentation/examples/graphrag-qdrant-neo4j/)
- [The Next Frontier of RAG: Enterprise Knowledge Systems 2026–2030](https://nstarxinc.com/blog/the-next-frontier-of-rag-how-enterprise-knowledge-systems-will-evolve-2026-2030/)
