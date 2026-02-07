# GraphRAG Plan: Graphiti MCP Integration Diff

**Date:** 2026-02-05
**Purpose:** Integrate running Graphiti MCP server (localhost:8000) into our GraphRAG architectural plan
**Status:** Proposal for Review

---

## Executive Summary

Graphiti Agent Memory v1.26.0 is **already running** on localhost:8000 as an MCP server backed by Neo4j. This fundamentally changes the build-vs-integrate calculus from our original ZAI-GRAPHITI-ASSESSMENT.md, which concluded "build first" primarily due to operational complexity. **That operational complexity is now solved** — the infrastructure exists.

**Key Insight:** We don't need to choose between build OR integrate. **Graphiti becomes our graph storage + temporal layer**, while we still build our custom extraction pipeline, web crawler, retrieval integration, and visualization.

**Impact:** Eliminates ~3 weeks of Phase 1 + Phase 6 work. Shifts focus to integration and the unique value-add layers we planned.

---

## What Graphiti Provides (Already Running)

### MCP Tools Available

| Tool                                    | Purpose                                                                       | Maps to Our Plan                                          |
| --------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| `add_memory`                            | Ingest episodes (text/JSON/messages) → auto-extracts entities & relationships | Replaces: Entity extraction, consolidation, graph storage |
| `search_nodes`                          | Semantic search for entities, filterable by group_id and entity_types         | Replaces: Graph query engine for entity lookup            |
| `search_memory_facts`                   | Search for relationships/facts between entities, centered on a node           | Replaces: Graph expansion, neighborhood queries           |
| `get_entity_edge`                       | Get specific relationship by UUID                                             | Replaces: Direct graph queries                            |
| `get_episodes`                          | List source episodes by group                                                 | Replaces: Source tracking                                 |
| `delete_entity_edge` / `delete_episode` | Graph management                                                              | Replaces: Graph CRUD                                      |
| `clear_graph`                           | Reset by group                                                                | Replaces: Graph cleanup                                   |
| `get_status`                            | Health check                                                                  | New: monitoring endpoint                                  |

### Architecture

```
Graphiti MCP Server (Python, localhost:8000)
    ├── MCP Streamable HTTP Transport
    ├── Neo4j/FalkorDB Graph Database (persistent)
    ├── LLM-powered Entity Extraction (built-in)
    ├── Entity Consolidation & Dedup (built-in)
    ├── Temporal Fact Tracking (creation, invalidation)
    ├── Hybrid Search (semantic + graph)
    └── Group ID Isolation (multi-tenant/multi-domain)
```

---

## The Diff: What Changes in Our Plan

### 🔴 ELIMINATE (Graphiti Replaces)

These components from our plan are **no longer needed** because Graphiti handles them:

| Original Plan Component                | Files We Don't Need to Build                                                                        | Savings                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------- |
| **SQLite Graph Tables** (AD-01)        | `src/knowledge/graph/schema.ts` (~200 LOC)                                                          | Schema design + migration |
| **graphology integration** (AD-02)     | `src/knowledge/graph/query.ts` (~400 LOC)                                                           | Graph query engine        |
| **Entity Extraction Pipeline** (AD-03) | `src/knowledge/extraction/extractor.ts` (~300 LOC), `parser.ts` (~150 LOC), `prompts.ts` (~100 LOC) | LLM extraction            |
| **3-Tier Consolidation** (AD-04)       | `src/knowledge/extraction/consolidation.ts` (~300 LOC)                                              | Entity dedup              |
| **Extensible Schema** (AD-05)          | `kg_entity_types`, `kg_relationship_types` tables                                                   | Schema evolution          |
| **Temporal History Tables** (AD-09)    | `kg_entity_history`, `kg_relationship_history` tables                                               | Temporal tracking         |
| **Neo4j Extension** (Phase 6)          | Entire `extensions/knowledge-neo4j/` package (~380 LOC)                                             | Already running           |
| **Extraction Progress Tracking**       | `kg_extraction_progress` table                                                                      | Graphiti handles async    |

**Total eliminated:** ~1,830 LOC + schema design + Neo4j extension

**Decisions superseded:**

- AD-01 (SQLite graph storage) → Graphiti uses Neo4j
- AD-02 (graphology) → Graphiti has built-in graph operations
- AD-03 (delimiter extraction) → Graphiti has built-in LLM extraction
- AD-04 (3-tier consolidation) → Graphiti handles entity dedup
- AD-09 (temporal tables) → Graphiti has temporal fact tracking

**Dependencies no longer needed:**

```diff
- graphology          # Graph algorithms → Graphiti
- fast-levenshtein    # Edit distance for dedup → Graphiti
```

---

### 🟢 KEEP (Still Build Ourselves)

These components are still needed because Graphiti doesn't provide them:

| Component                             | Why We Still Need It                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Phase 0: Schema Validation**        | Ground truth testing is still essential for quality validation                                                                 |
| **Phase 2: Web Crawler**              | Graphiti ingests content but doesn't crawl — we still need `crawler.ts`, `crawler-discovery.ts`, `crawler-fetcher.ts`, parsers |
| **Phase 3: Retrieval Integration**    | Need to adapt our `memory_search` to include Graphiti results alongside existing hybrid search                                 |
| **Phase 4: Overseer Bridge**          | Goal-to-entity linking, planner injection — adapted to use Graphiti entities                                                   |
| **Phase 5: React Flow Visualization** | Graphiti has no UI — we still build the graph explorer, but pull data from Graphiti                                            |
| **Phase 7: Testing & Benchmarking**   | Quality validation, performance benchmarks against Graphiti                                                                    |

---

### 🟡 MODIFY (Adapt Existing Plan)

#### Phase 1: "Graph Storage + Entity Extraction Core" → "Graphiti Integration Layer"

**Before (2 weeks):**

- Build SQLite graph tables
- Build extraction pipeline
- Build consolidation algorithm
- Build graph query engine

**After (3-5 days):**

- Build MCP client bridge to Graphiti
- Create group_id management strategy
- Build ingestion adapter (our format → Graphiti `add_memory`)
- Build query adapter (Graphiti `search_nodes`/`search_memory_facts` → our `SearchResult` format)
- Sync progressive memory insights into Graphiti

**New files to create:**

```
src/knowledge/graphiti/
├── client.ts           # MCP client connection to Graphiti (localhost:8000)
├── types.ts            # Type mappings (Graphiti → our types)
├── ingestion.ts        # Adapter: our content → Graphiti add_memory
├── search.ts           # Adapter: Graphiti search → our SearchResult
├── group-manager.ts    # Group ID strategy (per-agent, per-domain)
└── sync.ts             # Bidirectional sync with progressive memory
```

**Estimated LOC:** ~600 (vs 1,830 eliminated)

#### Phase 3: Agent Tools Become Thin Wrappers

**Before:** Build custom `graph_search` and `graph_inspect` tools with SQLite CTEs

**After:** Thin wrappers around Graphiti MCP tools:

```typescript
// graph_search → calls Graphiti search_nodes + search_memory_facts
async function graph_search(query: string, options: GraphSearchOptions) {
  const [nodes, facts] = await Promise.all([
    graphitiClient.searchNodes(query, {
      group_ids: [options.groupId],
      max_nodes: options.maxResults,
    }),
    graphitiClient.searchFacts(query, {
      group_ids: [options.groupId],
      max_facts: options.maxResults,
    }),
  ]);
  return formatGraphResults(nodes, facts);
}

// graph_inspect → calls Graphiti search_nodes + get_entity_edge
async function graph_inspect(entityName: string) {
  const nodes = await graphitiClient.searchNodes(entityName, { max_nodes: 1 });
  if (nodes.length === 0) return null;
  const facts = await graphitiClient.searchFacts(entityName, { center_node_uuid: nodes[0].uuid });
  return formatEntityDetail(nodes[0], facts);
}
```

#### Phase 5: Visualization Pulls from Graphiti

**Before:** Query SQLite for graph data

**After:** Query Graphiti for nodes and facts, render in React Flow

```typescript
// Gateway API still the same, but backend queries Graphiti
GET /api/knowledge/graph/entities → graphitiClient.searchNodes(...)
GET /api/knowledge/graph/entity/:id/neighborhood → graphitiClient.searchFacts(..., { center_node_uuid })
```

---

### 🔵 NEW (Added by Integration)

| New Component                          | Purpose                                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **MCP Client Bridge**                  | Connect to Graphiti MCP server at localhost:8000 via Streamable HTTP                                             |
| **Group ID Strategy**                  | Map agents/domains to Graphiti group_ids (e.g., `agent:clawdbrain`, `domain:projects`, `crawl:docs.example.com`) |
| **Progressive Memory → Graphiti Sync** | When `memory_store` writes a fact/insight, also push to Graphiti for graph context                               |
| **Graphiti → memory_search Merge**     | When `memory_search` runs, also query Graphiti for graph-expanded results                                        |
| **Temporal Query Support**             | Expose Graphiti's fact invalidation in our tools (e.g., "what changed about entity X?")                          |
| **Episode Source Tracking**            | Track which crawl/ingestion episodes are in Graphiti for dedup                                                   |

---

## Revised Phase Timeline

| Phase                                       | Original       | With Graphiti      | Change               |
| ------------------------------------------- | -------------- | ------------------ | -------------------- |
| **Phase 0:** Schema Validation              | 2-3 days       | 2-3 days           | No change            |
| **Phase 1:** Foundation → Integration Layer | 2 weeks        | 3-5 days           | **-1.5 weeks**       |
| **Phase 2:** Web Crawler                    | 2 weeks        | 2 weeks            | No change            |
| **Phase 3:** Retrieval + Agent Tools        | 1.5 weeks      | 1 week             | **-0.5 weeks**       |
| **Phase 4:** Overseer Bridge                | 1 week         | 1 week             | No change            |
| **Phase 5:** Visualization                  | 2 weeks        | 2 weeks            | No change            |
| **Phase 6:** Neo4j Extension                | 1 week         | **Eliminated**     | **-1 week**          |
| **Phase 7:** Testing                        | 1 week         | 1 week             | No change            |
| **TOTAL**                                   | 5-7 weeks solo | **3-5 weeks solo** | **~2-3 weeks saved** |

---

## Revised Architecture Decisions

### AD-01 (Revised): Graphiti as Graph Storage Backend

**Status:** Supersedes original AD-01 (SQLite as default)
**Date:** 2026-02-05

**Decision:** Use Graphiti MCP server (backed by Neo4j) as the primary graph storage. SQLite remains for the progressive memory store (structured memory entries) but graph operations go through Graphiti.

**Consequences:**

- ✅ Production-proven graph storage from day 1
- ✅ Temporal fact tracking built-in
- ✅ Entity extraction + consolidation handled by Graphiti
- ✅ MCP integration — same protocol OpenClaw already speaks
- ⚠️ Requires Graphiti server running (additional process)
- ⚠️ Network hop for graph queries (localhost, sub-5ms)
- ⚠️ Loss of some extraction customization (Graphiti's prompts vs ours)

### AD-02 (Revised): Graphiti Replaces graphology

**Status:** Supersedes original AD-02
**Decision:** Graph operations go through Graphiti's `search_nodes` and `search_memory_facts` instead of graphology in-memory operations.

### AD-11 (New): Group ID Strategy

**Status:** Proposed
**Decision:** Map Graphiti group_ids as follows:

- `agent:{agentId}` — Per-agent knowledge isolation
- `domain:{category}` — Shared domain knowledge (projects, people, etc.)
- `crawl:{domain}` — Web crawl results per domain
- `session:{sessionKey}` — Ephemeral session context (auto-cleanup)

### AD-12 (New): Dual Memory Architecture

**Status:** Proposed
**Decision:** Two complementary memory systems:

1. **Progressive Memory Store** (SQLite) — Structured, categorized facts with token budgets. Fast, always-local.
2. **Graphiti Knowledge Graph** (Neo4j via MCP) — Entity-relationship graph with temporal tracking. Rich, queryable.

Sync direction: Progressive memory → Graphiti (one-way for now). Progressive memory stores the "what I need to remember" while Graphiti stores "how everything connects."

---

## Risk Analysis

| Risk                                                  | Mitigation                                                                                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Graphiti server goes down**                         | Graceful fallback to progressive memory + legacy search. Graph features degrade, core doesn't break. |
| **Graphiti extraction quality differs from our plan** | Phase 0 ground truth testing validates quality. Can supplement with our own extraction if needed.    |
| **Network latency to MCP server**                     | Localhost = sub-5ms. Acceptable for all operations.                                                  |
| **Graphiti version upgrades break MCP API**           | Pin version, test upgrades in staging. MCP protocol itself is stable.                                |
| **Group ID conflicts**                                | Namespace strategy (AD-11) prevents collisions.                                                      |
| **Data migration if we move away from Graphiti**      | Episodes are text — can re-ingest. Nodes/facts can be exported via search_nodes/search_memory_facts. |

---

## Implementation Priority

### Immediate (This Week)

1. ✅ Verify Graphiti server is healthy and responsive
2. Create MCP client bridge (`src/knowledge/graphiti/client.ts`)
3. Define group ID strategy
4. Test `add_memory` with sample content from our memory files
5. Test `search_nodes` and `search_memory_facts` quality

### Week 1

6. Build ingestion adapter (crawler output → Graphiti)
7. Build search adapter (Graphiti → our SearchResult format)
8. Integrate with `memory_search` (graph-expanded results)
9. Register `graph_search` and `graph_inspect` agent tools

### Week 2+

10. Build web crawler (Phase 2 — unchanged)
11. Build visualization (Phase 5 — data from Graphiti)
12. Overseer bridge (Phase 4 — adapted for Graphiti entities)

---

## Appendix: Graphiti MCP Server Details

**Service:** `graphiti-mcp`
**Version:** 1.26.0
**Transport:** MCP Streamable HTTP
**URL:** `http://localhost:8000/mcp`
**Health:** `http://localhost:8000/health`
**Process:** Python 3 (PID varies), listening on port 8000

### MCP Session Flow

```
1. POST /mcp with initialize → get Mcp-Session-Id header
2. POST /mcp with tools/list → get available tools
3. POST /mcp with tools/call → invoke tools
```

### Tool Schemas (Summary)

**add_memory:** `{ name: string, episode_body: string, group_id?: string, source?: "text"|"json"|"message", source_description?: string }`

**search_nodes:** `{ query: string, group_ids?: string[], max_nodes?: number, entity_types?: string[] }`

**search_memory_facts:** `{ query: string, group_ids?: string[], max_facts?: number, center_node_uuid?: string }`
