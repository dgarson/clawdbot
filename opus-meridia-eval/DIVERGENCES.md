# Divergences: Design Intent vs. Implementation

_Evaluated: 2026-02-07_

This document catalogs specific places where the running Meridia system has diverged from the architecture described in its design documents.

---

## A. Phenomenology is entirely absent from the running system

**Design:** The `experiential-record.schema.json` (under `docs/experiential-engine/schemas/`) and `COMPONENT-MAP.md` define emotional signatures, engagement quality, anchors, uncertainties, and reconstitution hints as core to the Experience Kit.

**Implementation:** The `MeridiaExperienceRecord` type in `types.ts:12-38` has a `content.facets` field with `emotions`, `uncertainty`, `relationship`, and `consequences` sub-fields. However, the capture hook (`hooks/experiential-capture/handler.ts:266-281`) **never populates these fields**. The record is created with only:

```typescript
content: {
  summary: evaluation.reason,  // Just the score reason string
}
```

The LLM evaluator (`evaluate.ts:96-143`) only extracts `{ score, reason }` — it does not request or parse phenomenological data. The extraction prompt (line 103-118) asks only for scoring guidance, not emotional signatures or anchors.

**Impact:** Critical. Everything downstream (reconstitution quality, graph relationship richness, similarity search) depends on this content existing.

---

## B. Reconstitution is a bullet list, not state restoration

**Design:** ARCH.md, V2-PROPOSAL.md, and EXPERIENTIAL-CONTINUITY-PROJECT.md all describe reconstitution as an active, prose-based process — "how to re-become" rather than "what happened." V2-PROPOSAL.md includes a detailed example output using "I remember..." framing with emotional context.

**Implementation:** `reconstitute.ts:70-149` generates markdown formatted as:

```
## Experiential Continuity — Recent Context
_N significant experiences from the last 48h_

### Key Experiences
- **[0.8]** topic (2h ago)
- **[0.7]** topic (5h ago)
```

This is functionally a search result formatter. No LLM is used for synthesis. No emotional threading. No prose narrative. No relationship context. No "I remember..." framing.

**Impact:** High. Reconstitution is the system's primary user-facing output. The current format provides factual context but does not enable experiential state restoration.

---

## C. Graph integration is compaction-only, not per-capture

**Design:** ARCH.md (line 66-68) shows fanout from canonical store to graph linker, vector index writer, and compaction engine after every persist. COMPONENT-MAP.md defines the Fanout Dispatcher (component 9) as running "async side effects with retries + backpressure" per kit.

**Implementation:** The only Graphiti integration is in `hooks/compaction/handler.ts:312-369`. Individual experience captures (`hooks/experiential-capture/handler.ts`) write only to SQLite — no graph fanout occurs. This means:

- The graph stays empty during normal operation
- Per-experience entity extraction doesn't happen
- Relationship linking is only visible after batch compaction runs
- If compaction is disabled or hasn't run, the graph has zero data

**Impact:** Medium-high. Graph relationships are what make an experience system more than a log, but deferring them to compaction is a reasonable interim tradeoff.

---

## D. Vector search doesn't exist

**Design:** Multiple documents describe pgvector as essential:

- `DATA-PERSISTENCE-ARCHITECTURE.md` recommends pgvector for "find experiences that felt like X"
- `MERIDIA-V2-PROPOSAL.md` proposes a `meridia_experience_embeddings` PostgreSQL table
- `COMPONENT-MAP.md` lists vector index writer as component in the index plane
- `ARCH.md` shows vector index as part of async fanout

**Implementation:** No embedding generation or vector search exists anywhere in the codebase. The search adapter reports `probeVectorAvailability() → false` (`src/meridia-search-adapter.ts:93-95`). The `experience_search` tool uses SQLite FTS5 only. No embedding model is configured or called.

**Impact:** High for "feels like this" retrieval. FTS5 handles keyword queries well but cannot do semantic similarity, which is the core retrieval pattern for experiential data.

---

## E. Storage decision diverged from design recommendation

**Design:** `DATA-PERSISTENCE-ARCHITECTURE.md` conducted an extensive analysis and recommended PostgreSQL 16 with pgvector + TimescaleDB + Apache AGE as a single unified database. It includes a complete schema proposal with 10+ tables, views, hypertables, and stored functions.

**Implementation:** Went with SQLite as canonical store. Config has a placeholder for PostgreSQL (`src/meridia/config.ts`) but no PostgreSQL backend exists.

**Assessment:** This was a pragmatic and defensible choice — SQLite is zero-config, embedded, and sufficient for the current record volume. However, it means the design's vision of hybrid queries (semantic + structured + temporal + graph in a single query) isn't achievable without significant rework or adding sqlite-vec.

---

## F. MeridiaEvent envelope doesn't exist as a type

**Design:** `COMPONENT-MAP.md:86-108` defines a detailed `MeridiaEvent` type with `id`, `kind`, `ts`, `session`, `channel`, `tool`, `payload`, and `provenance` fields. This is the input contract for the Event Normalizer (component 1).

**Implementation:** Hook handlers parse the raw `HookEvent` context object inline using ad-hoc property access:

```typescript
// hooks/experiential-capture/handler.ts:173-181
const toolName = typeof context.toolName === "string" ? context.toolName : "";
const toolCallId = typeof context.toolCallId === "string" ? context.toolCallId : "";
const meta = typeof context.meta === "string" ? context.meta : undefined;
const isError = Boolean(context.isError);
```

There's no shared `MeridiaEvent` type, no normalization step, and no provenance tracking. Each hook re-implements its own context parsing.

**Impact:** Medium. Adds maintenance burden and makes it harder to add new event sources. Every new hook or event type requires duplicating parsing logic.

---

## G. readFile / meridia:// protocol is a no-op

**Design:** COMPONENT-MAP.md (line 204) states: "today `MeridiaSearchAdapter.readFile()` is empty; implement to render kits."

**Implementation:** Confirmed — `src/meridia-search-adapter.ts:63-69`:

```typescript
async readFile(_params: { relPath: string; from?: number; lines?: number }): Promise<{ text: string; path: string }> {
  return { text: "", path: "" };
}
```

Search results reference `meridia://<id>` paths but these aren't resolvable.

**Impact:** Low. Doesn't block core functionality but reduces inspectability.

---

## H. Duplicate utility code across hooks

**Design:** Not explicitly addressed.

**Implementation:** The following utility functions are duplicated between `hooks/experiential-capture/handler.ts` and `hooks/compaction/handler.ts`:

- `asObject()` — identical in both
- `resolveHookConfig()` — identical in both
- `readNumber()` — slightly different signatures (one takes `keys: string[]`, other takes `key: string`)
- `readString()` — slightly different signatures
- `nowIso()` — identical in both

**Impact:** Low but adds unnecessary maintenance surface. Should be extracted to a shared `hook-utils.ts`.

---

## I. Scoring system exists but isn't wired into capture decisions

**Design:** The multi-factor scoring system in `scoring/` was designed to be "the primary entry point for the new scoring system" (`evaluate.ts:187`).

**Implementation:** The capture hook (`hooks/experiential-capture/handler.ts:233-248`) uses `evaluateHeuristic()` and optionally `evaluateWithLlm()` — it does **not** call `evaluateRelevance()` from the scoring module. The multi-factor scoring system is fully implemented and tested but the capture pipeline doesn't use it. The bridge functions (`buildScoringContext`, `evaluateRelevance`) exist in `evaluate.ts:154-207` but are never called from any hook.

**Impact:** Medium. The scoring system was built to improve capture decisions but isn't connected. The capture hook still uses the simpler heuristic + optional LLM path.
