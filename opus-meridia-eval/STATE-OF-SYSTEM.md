# State of the Meridia System

_Evaluated: 2026-02-07_

## Document Corpus

The project has accumulated **8+ design documents** and **47 implementation files** across two eras:

| Era                                   | Documents                                                                                                                                                                                                      | Key Ideas                                                                                                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pre-Meridia** (experiential-engine) | `EXPERIENTIAL-CONTINUITY-PROJECT.md`, `MEMORY-AUDIT.md`, `MEMORY-CLASSIFICATION.md`, `DATA-PERSISTENCE-ARCHITECTURE.md`, `EVENT-SYSTEM-DESIGN.md`, `SKILL.md`, 3 schemas, 5 tool prototypes, 3 hook prototypes | Three memory types (factual/experiential/identity), PostgreSQL+pgvector+TimescaleDB+AGE, filesystem-first JSON records, continuous agents, local model inference |
| **Meridia** (current)                 | `ARCH.md`, `COMPONENT-MAP.md`, `MERIDIA-V2-PROPOSAL.md`, `meridia-graph-memory.md`, 7 component deep-dives                                                                                                     | Experience Kit abstraction, SQLite-first, polyglot persistence, 14-component model, Graphiti for graph, plugin-based                                             |

---

## Component Scorecard

ARCH.md defines two planes (capture, retrieval/reconstitution) and COMPONENT-MAP.md specifies 14 components. Here is the implementation fidelity of each:

| #   | Component                      | Role                                                  | Implementation Status                                                  | Fidelity    |
| --- | ------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------- | ----------- |
| 1   | Event Normalizer               | Convert hook/tool payloads into typed `MeridiaEvent`  | Inline parsing in capture hook handler, not extracted                  | **Partial** |
| 2   | Gates & Budget Manager         | Rate limits, token/storage budgets                    | Inline in capture hook (min_interval, max_per_hour)                    | **Partial** |
| 3   | Capture Decision Engine        | Decide capture worthiness and mode                    | `evaluate.ts` (heuristic + LLM) + `scoring/` module                    | **Good**    |
| 4   | Phenomenology Extractor        | Produce experiential facets (emotions, anchors, etc.) | **Not implemented.** Types exist in contracts but never populated      | **Missing** |
| 5   | Artifact & Reference Collector | Produce durable references (media, files, links)      | **Not implemented.** No media/artifact capture                         | **Missing** |
| 6   | Experience Kit Builder         | Assemble canonical `ExperienceKit` record             | Implicitly in capture hook — builds `MeridiaExperienceRecord` directly | **Minimal** |
| 7   | Canonical Store                | Persist and query kits and trace events               | SQLite backend fully implemented with FTS5, transactions               | **Good**    |
| 8   | Trace & Audit Stream           | Append trace events for every decision                | DB + optional JSONL trace implemented                                  | **Good**    |
| 9   | Fanout Dispatcher              | Async side effects (graph/vector/compaction)          | Only in compaction hook; no per-capture async fanout                   | **Partial** |
| 10  | Hybrid Retriever & Ranker      | Retrieve across canonical, graph, vector              | SQLite FTS5 only. No graph or vector retrieval                         | **Minimal** |
| 11  | Reconstitution Engine          | Build state-approach context pack                     | `reconstitute.ts` produces bullet lists, not state-restoration packs   | **Minimal** |
| 12  | Sanitization & Redaction       | Prevent secrets/unsafe payloads in persistence        | **Not implemented**                                                    | **Missing** |
| 13  | Schemas & Migrations           | Versioned schemas and store migrations                | Schema in SQLite backend, no versioned migration system                | **Minimal** |
| 14  | Observability                  | Metrics, structured logs, debug artifacts             | Trace events + JSONL; no metrics or structured logging                 | **Partial** |

**Summary:** 3 of 14 components at "Good" fidelity. 4 partial. 4 missing or minimal. The system functions as a **capture-and-search pipeline** but lacks the phenomenological, relational, and reconstitution dimensions that define experiential continuity.

---

## What Already Works Well

- **SQLite backend** (`src/meridia/db/backends/sqlite.ts`): proper schema, FTS5 virtual table, transactions, CRUD, stats, health checks. Production-quality code.
- **Multi-factor scoring** (`scoring/`): 5 independent factors (novelty, impact, relational, temporal, userIntent) with configurable weights, factor breakdowns, tool-specific overrides, and threshold profiles. The most architecturally complete subsystem.
- **Hook integration**: capture, reconstitution, session-end, and compaction hooks follow consistent patterns and integrate properly with the plugin system.
- **Compaction with Graphiti** push (`hooks/compaction/handler.ts`): includes entity extraction via `extractEntitiesFromEpisodes` and `writeEntitiesToGraph`.
- **CLI** (`src/cli/meridia-cli.ts`): status, doctor, export, reset, config commands provide operational visibility.
- **Graceful degradation**: LLM evaluation falls back to heuristic, graph failures don't block canonical writes, trace JSONL is optional.
- **Search adapter** (`src/meridia-search-adapter.ts`): integrates with core MemorySearchManager at weight 0.6.
- **Plugin architecture**: enabled by default, proper lifecycle management, registered as bundled plugin.

---

## Implementation File Inventory

### Core Source (8 files)

- `index.ts` — Plugin entry point (registers tools, CLI, hooks, search backend)
- `src/meridia/types.ts` — Core types (MeridiaExperienceRecord, MeridiaTraceEvent, etc.)
- `src/meridia/config.ts` — Configuration resolution & validation
- `src/meridia/paths.ts` — Path resolution utilities
- `src/meridia/fs.ts` — Filesystem utilities
- `src/meridia/storage.ts` — JSON/JSONL I/O helpers
- `src/meridia/evaluate.ts` — Heuristic & LLM evaluation + scoring bridge
- `src/meridia/reconstitute.ts` — Reconstitution context builder

### Database (5 files)

- `src/meridia/db/backend.ts` — Backend interface & types
- `src/meridia/db/index.ts` — Backend factory & exports
- `src/meridia/db/backends/index.ts` — Backend registry & lifecycle
- `src/meridia/db/backends/sqlite.ts` — Full SQLite implementation
- `src/meridia/db/backends/sqlite.test.ts` — Tests

### Scoring (7 files)

- `src/meridia/scoring/types.ts` — ScoringContext, ScoringBreakdown, etc.
- `src/meridia/scoring/defaults.ts` — Default weights & threshold profiles
- `src/meridia/scoring/factors.ts` — Individual factor implementations
- `src/meridia/scoring/factors.test.ts` — Tests
- `src/meridia/scoring/scorer.ts` — Main scoring composer
- `src/meridia/scoring/scorer.test.ts` — Tests
- `src/meridia/scoring/index.ts` — Module exports

### Tools (4 files)

- `src/tools/experience-capture-tool.ts` — Manual capture
- `src/tools/experience-search-tool.ts` — FTS5 search & filtering
- `src/tools/experience-reflect-tool.ts` — Reflection & analysis
- `src/tools/experience-reflect-tool.test.ts` — Tests

### Hooks (8 files)

- `hooks/experiential-capture/handler.ts` + `HOOK.md` — tool:result capture
- `hooks/meridia-reconstitution/handler.ts` + `HOOK.md` — bootstrap injection
- `hooks/session-end/handler.ts` + `HOOK.md` — session boundary snapshots
- `hooks/compaction/handler.ts` + `HOOK.md` — episode synthesis & graph linking

### Integration (2 files)

- `src/cli/meridia-cli.ts` — CLI commands
- `src/meridia-search-adapter.ts` — Core memory search integration

### Configuration (3 files)

- `package.json`, `openclaw.plugin.json`, `tsconfig.json`

### Documentation (10 files)

- `ARCH.md`, `COMPONENT-MAP.md`, `ARCHITECTURE-OVERVIEW.html`
- 7 component deep-dives under `docs/components/`
