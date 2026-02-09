# Refactoring & Simplification Proposals

_Evaluated: 2026-02-07_

---

## A. Consolidate from 14 components to 7 modules

The 14-component model in COMPONENT-MAP.md is aspirationally clean but introduces more boundary-management overhead than warranted at current scale. Propose collapsing to **7 modules**:

```
extensions/meridia/src/meridia/
  event.ts          # Components 1+2: MeridiaEvent envelope + gates/budgets
  decision.ts       # Component 3: Capture decision (current evaluate.ts + scoring/)
  phenomenology.ts  # Component 4: Phenomenology extraction (NEW)
  store/            # Components 6+7: Kit builder + canonical store (current db/)
  fanout.ts         # Component 9: Async dispatch to graph/vector (NEW)
  retrieve.ts       # Component 10: Hybrid retrieval (extend current search)
  reconstitute.ts   # Component 11: State-restoration reconstitution (enhance current)
```

Cross-cutting concerns (sanitization, migrations, observability) stay embedded within these modules rather than as separate components. This halves the module count while preserving clear boundaries.

---

## B. Implement phenomenology extraction as the highest-leverage change

Enhance `evaluateWithLlm()` to return the full `Phenomenology` type from COMPONENT-MAP.md alongside the score. The extraction prompt is already sketched in V2-PROPOSAL.md.

**Key design choice:** Only run phenomenology extraction on records that pass the significance threshold (score >= 0.6). This keeps LLM cost proportional to captures, not evaluations. Two-pass approach:

1. Fast heuristic or lightweight LLM call for score only (existing path)
2. If score >= threshold: richer LLM call for phenomenology extraction

Store results in the existing `content.facets` field of `MeridiaExperienceRecord`, which already has the right shape. Add new fields to the SQLite schema for direct querying:

```sql
ALTER TABLE meridia_records ADD COLUMN emotional_primary TEXT;
ALTER TABLE meridia_records ADD COLUMN emotional_intensity REAL;
ALTER TABLE meridia_records ADD COLUMN engagement_quality TEXT;
ALTER TABLE meridia_records ADD COLUMN anchors_json TEXT;
```

---

## C. Upgrade reconstitution incrementally

**Phase 1 (immediate):** Use an LLM to generate prose from the same records `reconstitute.ts` already fetches. Feed records as structured context and ask for "I remember..." framing with emotional threading. Uses existing `completeTextWithModelRef` infrastructure.

**Phase 2 (after vector search):** Add embedding similarity and graph context as additional inputs to the reconstitution LLM call. This enriches the context without changing the output format.

**Phase 3 (after relationship awareness):** Add reconstitution modes — session bootstrap, topic re-entry, relationship resumption, reflection — each with different retrieval strategies and output formats.

---

## D. Wire the multi-factor scoring into the capture pipeline

The `scoring/` module is fully built and tested but disconnected. In `hooks/experiential-capture/handler.ts`, replace:

```typescript
// Current (line ~233):
let evaluation = evaluateHeuristic(ctx);
if (cfg && evaluationModel) {
  evaluation = await evaluateWithLlm({ cfg, ctx, modelRef: evaluationModel, timeoutMs });
}
const shouldCapture = !limited && evaluation.score >= minThreshold;
```

With:

```typescript
// Proposed:
const breakdown = evaluateRelevance(ctx, { recentCaptures: buffer.recentCaptures });
const shouldCapture = !limited && shouldCaptureMultiFactor(breakdown);
const shouldUseLlm = shouldUseLlmEvalMultiFactor(breakdown);

let evaluation: MeridiaEvaluation = {
  kind: "heuristic",
  score: breakdown.composite,
  reason: formatBreakdown(breakdown),
};

if (shouldUseLlm && cfg && evaluationModel) {
  evaluation = await evaluateWithLlm({ cfg, ctx, modelRef: evaluationModel, timeoutMs });
}
```

This gives the scoring system control over both the capture decision and whether to invoke the (more expensive) LLM evaluation.

---

## E. Add embeddings via existing infrastructure

The project already has OpenClaw's memory pipeline with adapter-based embedding. Meridia should:

1. Emit `MemoryContentObject` items from experience kits (as ARCH.md section "Compatibility with core memory pipeline" suggests at line 117)
2. Let the existing pipeline handle embedding generation and vector indexing
3. Query via the existing search manager infrastructure

This avoids building a parallel embedding pipeline. If the core pipeline doesn't support the query patterns needed, consider adding `sqlite-vec` to the existing SQLite database for local vector search without requiring PostgreSQL.

---

## F. Extract shared utilities from hook handlers

`hooks/experiential-capture/handler.ts` and `hooks/compaction/handler.ts` both contain duplicated helpers. Extract to `src/meridia/hook-utils.ts`:

```typescript
// Shared utilities to extract:
export function asObject(value: unknown): Record<string, unknown> | null;
export function resolveHookConfig(
  cfg: OpenClawConfig | undefined,
  hookKey: string,
): Record<string, unknown> | undefined;
export function readNumber(
  cfg: Record<string, unknown> | undefined,
  key: string | string[],
  fallback: number,
): number;
export function readString(
  cfg: Record<string, unknown> | undefined,
  key: string | string[],
  fallback?: string,
): string | undefined;
export function readBoolean(
  cfg: Record<string, unknown> | undefined,
  key: string,
  fallback: boolean,
): boolean;
export function nowIso(): string;
```

---

## G. Simplify the storage decision

The design doc tension between SQLite and PostgreSQL is unresolved. Recommendation: **stay with SQLite as canonical store** but add vector capability via `sqlite-vec` (successor to `sqlite-vss`), which embeds vector search directly into the existing SQLite database.

This avoids the operational complexity of running PostgreSQL while enabling the "feels like this" similarity queries. If graph queries become important, Graphiti already provides that layer — no need for Apache AGE or a separate Neo4j deployment beyond what Graphiti manages.

Decision matrix:

| Approach                         | Pros                                                                        | Cons                                                   |
| -------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------ |
| SQLite + sqlite-vec + Graphiti   | Zero-config, embedded, single file, existing code works                     | No hybrid SQL+vector in one query, sqlite-vec is newer |
| PostgreSQL + pgvector + Graphiti | Unified queries, mature ecosystem, matches DATA-PERSISTENCE-ARCHITECTURE.md | Operational complexity, migration needed, dependency   |
| SQLite only (current)            | Simplest possible                                                           | No vector search, limited to FTS5                      |

**Recommendation:** SQLite + sqlite-vec. Revisit PostgreSQL only if query patterns demand it.

---

## H. Consolidate documentation

| Action                       | Documents                                                           | Destination                                                                     |
| ---------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Keep as living reference** | `extensions/meridia/ARCH.md`, `extensions/meridia/COMPONENT-MAP.md` | Stay in place; update to reflect current decisions                              |
| **Fold into ARCH.md**        | `docs/design/MERIDIA-V2-PROPOSAL.md` (accepted amendments)          | Update ARCH.md, then archive V2-PROPOSAL                                        |
| **Archive**                  | All `docs/experiential-engine/` documents                           | Move to `docs/experiential-engine/archive/` with a note that they're historical |
| **Archive**                  | `docs/design/meridia-graph-memory.md`                               | Historical context, superseded by ARCH.md's Graphiti approach                   |
| **Keep**                     | 7 component deep-dives under `extensions/meridia/docs/components/`  | Remain as detailed reference for complex components                             |

---

## Implementation Sequence (Recommended)

| Step | Change                                          | Impact                                                | Effort |
| ---- | ----------------------------------------------- | ----------------------------------------------------- | ------ |
| 1    | Wire multi-factor scoring into capture hook     | Improves capture decisions using existing tested code | Low    |
| 2    | Extract event normalization + hook utilities    | Reduces duplication, enables new event sources        | Low    |
| 3    | Add phenomenology extraction to LLM evaluator   | **Core thesis activation** — highest leverage         | Medium |
| 4    | Enhance reconstitution with LLM prose synthesis | **Primary output quality** — highest user impact      | Medium |
| 5    | Add sanitization (redact before persist)        | Privacy and safety                                    | Low    |
| 6    | Add sqlite-vec for local vector search          | Enables "feels like this" retrieval                   | Medium |
| 7    | Wire per-capture graph fanout (async)           | Real-time relationship linking                        | Medium |
| 8    | Implement `readFile` for `meridia://` protocol  | Inspectability                                        | Low    |
| 9    | Add schema migration system                     | Future-proofs schema evolution                        | Low    |

Steps 1-4 deliver the core experiential continuity value proposition. Steps 5-9 mature the system.
