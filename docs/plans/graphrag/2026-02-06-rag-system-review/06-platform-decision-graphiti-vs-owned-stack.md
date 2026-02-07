# Platform Decision: Graphiti vs Self-Owned Neo4j/Postgres+pgvector

## Question

Should Clawdbrain move to a self-owned `neo4j` or `postgresql+pgvector` stack now, instead of continuing with current Graphiti-adjacent scaffolding?

## Decision Summary

- **Do not make Neo4j mandatory by default right now.**
- **Adopt a staged architecture:**
  1. SQLite-first graph+vector baseline in current Node/TS runtime
  2. Postgres+pgvector as the first scale-up backend
  3. Neo4j (or Graphiti-backed graph DB) as an optional advanced mode for complex temporal/path workloads

This keeps near-term delivery velocity while preserving an enterprise-grade path.

## Option Analysis

### Option A: Fully adopt Graphiti stack now (Python + Neo4j/FalkorDB/Kuzu/Neptune)

Pros:

- Best-in-class temporal KG semantics already implemented
- Mature hybrid search patterns
- Existing MCP/server ecosystem

Cons:

- Introduces Python runtime + graph DB operations burden immediately
- Stack split (Node/TS core + Python memory service)
- Higher deployment complexity and operational surface

Best when:

- You need advanced temporal/path semantics immediately and can absorb ops complexity.

### Option B: Build self-owned Neo4j + pgvector now

Pros:

- Full control over schema and query layer
- Strong graph traversal and vector capabilities

Cons:

- Running and maintaining two databases early (Neo4j + Postgres) is high complexity
- Significant implementation and migration overhead before proving product fit

Best when:

- You already have sustained graph-heavy query demand and dedicated infra ownership.

### Option C: Build self-owned Postgres + pgvector first (graph tables in Postgres)

Pros:

- Single operational backend for scale-up
- Easier fit with existing service patterns than adding Neo4j immediately
- Good transactional and multi-tenant behavior

Cons:

- Graph traversal ergonomics weaker than native graph DBs
- Complex path queries may become expensive or awkward

Best when:

- You prioritize operational simplicity and need multi-tenant scale before deep graph analytics.

### Option D: Keep SQLite-first local mode + optional provider abstraction (recommended)

Pros:

- Fastest path from current code and draft docs to production value
- Preserves local-first behavior and low-friction deployment
- Enables measured migration rather than premature infra commitment

Cons:

- Requires disciplined interface design to avoid future migration pain
- Advanced temporal graph features remain incremental

Best when:

- You need to ship reliable memory improvements now while retaining optionality.

## Direct Answer: Neo4j or Postgres+pgvector?

### Postgres+pgvector

**Yes, as the first "scale" backend.**

Reasoning:

- Better operational fit as the next step after SQLite
- Single data platform for metadata + vectors + relational graph structures
- Lower complexity than running a dedicated graph DB from day one

### Neo4j

**Not as default now; yes as optional advanced mode later.**

Reasoning:

- Strong for deep path queries, graph algorithms, and temporal graph workloads
- But significantly increases operational complexity and stack divergence
- Should be activated by objective thresholds, not by default preference

## Trigger Thresholds for Neo4j/Graphiti Mode

Move beyond Postgres+pgvector when one or more hold consistently:

1. Entity graph size and traversal depth:

- > 100k entities and frequent multi-hop path queries (>3 hops)

2. Temporal query complexity:

- Frequent point-in-time/contradiction-history queries requiring graph-native semantics

3. Latency under real traffic:

- P95 graph expansion latency >500ms despite indexing/tuning

4. Operational fit:

- Team can sustainably own graph DB operations

## Implementation Guidance

1. Define one `MemoryGraphProvider` interface now:

- `upsertEpisodes`
- `queryHybrid`
- `queryFactsAtTime`
- `expandNeighborhood`

2. Provide providers in sequence:

- `sqliteProvider` (default)
- `postgresProvider` (scale)
- `graphitiProvider`/`neo4jProvider` (advanced)

3. Keep tooling/API contracts stable while backend changes behind interface.

This avoids lock-in and enables migration without rewriting agent/tool UX.
