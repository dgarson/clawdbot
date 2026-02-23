# Memory Architecture 2.0 — Unified Schema + Scoped Retrieval

## Status

- Branch: `feat/memory-architecture-2`
- Phase: bootstrap+ (scoped retrieval + provenance + cascade deletion + in-memory scope indexing + migration helper)

## Goals

1. Unify memory schema so all memory records share scope, provenance, retention, and access metadata.
2. Support layered retrieval by scope precedence: **session → project → role → org**.
3. Keep provenance traceable on every item (source, timestamp, confidence).
4. Support deletion by scope with cascade semantics.

## Unified Schema (v2)

`MemoryNode` stores content plus structured metadata:

- `id`, `content`, `embedding`, `createdAt`, `updatedAt`, `version`
- `metadata`:
  - `domain`: memory domain (`user_pref`, `system_fact`, `session_summary`, `agent_eval`, `code_context`)
  - `scope`: `{ session?, project?, role?, org? }`
  - `scopeLevel`: inferred primary level (`session|project|role|org`)
  - `provenance`: `{ source, timestamp, confidence }`
  - `retention`: `{ ttlSec?, expiresAt? }`
  - `access` (bootstrap ACL): `{ read: { agentIds?, userIds? } }`
  - legacy compatibility aliases: `sourceId`, `confidenceScore`, `ttlSec`

## Retrieval Model

### Scoped hierarchy

`retrieveScoped(query, scope)` evaluates levels in this fixed order when present:

1. `session`
2. `project`
3. `role`
4. `org`

Within each level, results are ranked by text score and recency, then appended in priority order. This means the caller sees the most-specific context first.

### Filtering rules

- Expired records (`retention.expiresAt <= now`) are excluded.
- Optional ACL check uses requester context (`agentId`/`userId`).
- Optional metadata filters still apply.

## Retention Windows

- Default TTL derives from `memory.architecture.retention.defaultTtlDays`.
- Record-level retention can override with explicit `ttlSec` or `retention.expiresAt`.
- Expired records are ignored on read and cleaned up during compaction.

## Access Controls (bootstrap)

- Write control remains via governance (`allow`/`deny` rules).
- Read control now has a minimal ACL path in metadata (`access.read.agentIds/userIds`), enforced by scoped retrieval when requester info is provided.

## Deletion API (cascade semantics)

`deleteByScope(scope, { cascade })`:

- Most specific provided level is deletion target.
- Cascade default is `true`.

Examples:

- `{ session: "s1" }` removes that session scope.
- `{ project: "p1" }, cascade:true` removes project + session records under `p1`.
- `{ role: "r1" }, cascade:true` removes role + project + session records under `r1`.
- `{ org: "o1" }, cascade:true` removes all records under org.
- With `cascade:false`, only records whose primary `scopeLevel` matches the target level are removed.

## Notes / Follow-ups

- Current implementation is in-memory service for architecture bootstrap.
- In-memory scope indexes now back `retrieveScoped` and `deleteByScope` candidate selection (session/project/role/org maps).
- Added `migrateLegacyMemoryNode(...)` utility to normalize legacy records into v2 metadata shape.
- `deleteByScope` now honors parent scope constraints (e.g. `session+project`, `project+role+org`) to avoid cross-tenant over-deletion when IDs collide.
- Next step is wiring these semantics into persistent/vector-backed memory service(s).
- Add API/tool surface for scoped retrieval and scoped deletion once architecture path is promoted beyond shadow mode.
- Expand migration from utility-level conversion to end-to-end backfill job against persisted stores.
