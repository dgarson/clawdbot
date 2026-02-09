# Gap Analysis: Prioritized by Impact

_Evaluated: 2026-02-07_

Gaps are prioritized into tiers based on their impact on having a functioning experiential continuity system.

---

## Tier 1: Without these, the system is a structured log, not an experiential memory

| Priority | Gap                       | Current State                                                                                                                  | Why It's Critical                                                                                                                                                                                                               |
| -------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0**   | Phenomenological capture  | Not implemented. `content.facets` field exists in types but is never populated. LLM evaluator only extracts `{score, reason}`. | The entire thesis of the project. Without emotional signatures, engagement quality, and anchors, records are tool-result summaries. Everything downstream (reconstitution, graph, similarity) depends on this content existing. |
| **P0**   | Meaningful reconstitution | Produces bullet lists of `[score] topic (time ago)`. No LLM synthesis, no prose, no emotional threading.                       | This is the system's primary output — what makes captured experiences useful. A list of scores and topics doesn't enable "re-becoming."                                                                                         |
| **P1**   | Event normalization       | Inline ad-hoc parsing in each hook handler. No shared `MeridiaEvent` type.                                                     | Without a typed event envelope, every new hook or event source requires duplicating parsing logic, and the system can't easily extend to new event types (user messages, session transitions, relationship moments).            |

---

## Tier 2: Required for the system to scale beyond basic capture

| Priority | Gap                                         | Current State                                                                                                                                                 | Why It Matters                                                                                                                                                                                          |
| -------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1**   | Embedding & vector search                   | Not implemented anywhere. `probeVectorAvailability() → false`.                                                                                                | "Find experiences that felt like this" is the marquee query pattern. Without it, retrieval is limited to keyword matching. This is what makes reconstitution contextually relevant.                     |
| **P1**   | Multi-factor scoring not wired into capture | `scoring/` module is fully built and tested but the capture hook doesn't call `evaluateRelevance()`. It still uses the simpler heuristic + optional LLM path. | The scoring system was specifically designed to improve capture decisions with 5 factors and configurable weights, but it's not connected.                                                              |
| **P2**   | Per-capture graph linking                   | Only happens during compaction. Individual captures don't fan out to Graphiti.                                                                                | Graph relationships (causal chains, people, topic threading) are what distinguish an experience system from a log. Deferring to compaction means relationships are only visible after batch processing. |
| **P2**   | Sanitization layer                          | Not implemented. Raw tool args/results stored directly.                                                                                                       | Privacy risk — tool args may contain secrets, PII, or large payloads. Also a storage concern.                                                                                                           |

---

## Tier 3: Quality and operational maturity

| Priority | Gap                             | Current State                                                                       | Why It Matters                                                                                                                                                                |
| -------- | ------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P2**   | Schema migrations               | No versioned migration system. Schema defined inline in SQLite backend.             | As the schema evolves (especially to add phenomenology columns), there's no way to upgrade existing databases without data loss.                                              |
| **P3**   | Artifact & reference collection | Not implemented. No media/artifact capture.                                         | Multi-modal references (files, images, links) are part of the Experience Kit spec but not captured. Lower priority because text records are sufficient for initial viability. |
| **P3**   | `meridia://` resolution         | `readFile()` returns empty strings.                                                 | Nice for inspectability but not blocking core functionality.                                                                                                                  |
| **P3**   | Reconstitution modes            | One-size-fits-all output regardless of context.                                     | Session bootstrap, topic re-entry, relationship resumption, and reflection all need different retrieval and formatting strategies.                                            |
| **P3**   | Relationship awareness          | No concept of who the agent is interacting with. Every session treated identically. | Relationship context should shape capture sensitivity and reconstitution content.                                                                                             |

---

## Mapping to Existing Code

| Gap                       | Relevant Files                                                                         | What Needs to Change                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Phenomenological capture  | `evaluate.ts:96-143`, `hooks/experiential-capture/handler.ts:266-281`, `types.ts`      | Enhance LLM prompt to extract Phenomenology type; populate `content.facets` in capture hook                  |
| Meaningful reconstitution | `reconstitute.ts:70-149`                                                               | Add LLM synthesis step; use "I remember..." framing; include emotional threading                             |
| Event normalization       | `hooks/experiential-capture/handler.ts:161-212`, `hooks/compaction/handler.ts:636-716` | Extract shared `MeridiaEvent` type and normalization to `src/meridia/event.ts`                               |
| Vector search             | `src/meridia-search-adapter.ts`, `src/tools/experience-search-tool.ts`                 | Add sqlite-vec or pgvector; generate embeddings post-capture; blend into search                              |
| Scoring wiring            | `hooks/experiential-capture/handler.ts:233-248`, `evaluate.ts:154-207`                 | Replace heuristic+LLM path with `evaluateRelevance()` call in capture hook                                   |
| Per-capture graph         | `hooks/experiential-capture/handler.ts`, `hooks/compaction/handler.ts:312-369`         | Add async fanout to Graphiti after canonical persist in capture hook                                         |
| Sanitization              | `hooks/experiential-capture/handler.ts:266-281`                                        | Add redaction pass before persisting `data.args` and `data.result`                                           |
| Schema migrations         | `src/meridia/db/backends/sqlite.ts`                                                    | Add version tracking in `meridia_meta` table; migration runner                                               |
| Duplicate utilities       | Both hook handlers                                                                     | Extract `asObject`, `resolveHookConfig`, `readNumber`, `readString`, `nowIso` to `src/meridia/hook-utils.ts` |

---

## Document Consolidation Gap

There are **15+ design documents** across three locations with overlapping and contradictory proposals:

| Location                    | Count                                                 | Status                                                          |
| --------------------------- | ----------------------------------------------------- | --------------------------------------------------------------- |
| `extensions/meridia/`       | 3 docs + 7 component deep-dives                       | Active — should be the living reference                         |
| `docs/design/`              | 2 docs (V2-PROPOSAL, graph-memory)                    | Mixed — V2 should fold into ARCH.md, graph-memory is historical |
| `docs/experiential-engine/` | 6 architecture docs + SKILL.md + schemas + prototypes | Historical — superseded by Meridia implementation               |

**Contradictions:**

- `DATA-PERSISTENCE-ARCHITECTURE.md` recommends PostgreSQL+AGE; `ARCH.md` says SQLite; `meridia-graph-memory.md` proposes a third data model
- `EVENT-SYSTEM-DESIGN.md` proposes continuous agents (Eidetic Recorder, Experience Evaluator, Reconstitution Prompter) that were never built and aren't in ARCH.md
- `SKILL.md` documents 5 tools including `experience_reconstitute` and `uncertainty_log` that don't exist in the implementation (only 3 tools exist)
- The experiential-engine tool prototypes under `docs/experiential-engine/tools/` are different from the actual implementations under `extensions/meridia/src/tools/`

**Recommendation:** Keep `ARCH.md` and `COMPONENT-MAP.md` as living docs, archive the experiential-engine documents, fold V2-PROPOSAL decisions into ARCH.md.
