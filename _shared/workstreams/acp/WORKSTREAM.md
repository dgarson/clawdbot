# WORKSTREAM.md — ACP (Agent Communication Protocol)

_Mega-branch:_ `acp`
_Owner:_ **Tim** (VP Architecture)
_Created:_ 2026-02-21
_Last updated:_ 2026-02-21

> ⚠️ **Owner's responsibility:** Keep this file updated as design evolves, decisions are made, and task status changes. Delete this entire directory (`_shared/workstreams/acp/`) ONLY after `acp` is confirmed merged into `dgarson/fork` — NOT when the PR is opened.

---

## Deliverable

A native, first-class agent-to-agent (A2A) communication layer for OpenClaw. Enables agents to send structured messages, delegate tasks, and coordinate workflows across sessions — without going through human-facing channels. Built as a core gateway extension with SQLite-backed queue, TypeScript tooling, and a canonical wire protocol.

---

## Design

**Canonical spec:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-canonical-spec.md`
**Task breakdown:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-task-breakdown.md`
**Xavier's review:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-review-xavier-2026-02-21.md`
**Handoff spec:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-handoff-spec.md`

Key design decisions:

- **Extension model** — ACP lives in `extensions/acp/`, not core gateway
- **SQLite-backed queue** — `node:sqlite`, not `better-sqlite3` (native module packaging constraint)
- **Gateway RPC integration** — cross-extension calls via `api.registerGatewayMethod`/`callGateway`; direct extension-to-extension tool invocation not supported
- **Identity derivation** — agent identity from gateway context, never self-reported
- **Wire protocol** — semver (`1.0.0`), `to: string[]`, top-level `status`, decoupled from workq via `external_refs`
- **Deferred (post-v1):** custom URI scheme, signing infra, ML routing, knowledge dedup, federation/reputation

---

## Strategy

Timeline: ~18 weeks total (P0 → P1 → P2 → P3)

- **P0** (week 1): Verification spikes — session injection, heartbeat/wake trigger, cross-extension integration
- **P1** (weeks 2–6): Core infrastructure — extension skeleton, DB schema, `acp_send`, `acp_handoff`, delivery router
- **P2** (weeks 7–11): Reliability — retries, circuit breakers, SLA enforcement, monitoring
- **P3** (weeks 12–18): Intelligence — routing optimization, priority scheduling, analytics

---

## Tasks & Status

See workboard for current task detail: `/Users/openclaw/.openclaw/workspace/_shared/WORKBOARD.md` (Project: ACP — Agent Communication Protocol)

| Phase                 | Status                                                      | Notes                                                                    |
| --------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| P0 Spikes             | ✅ Complete (Roman, Sandy spikes done; Tony spike complete) | Session injection confirmed viable; extension-to-extension RPC confirmed |
| P1 Spec & Design      | ✅ Complete                                                 | Canonical spec consolidated, Xavier-reviewed, Claire-reviewed            |
| P1 DB Migration Plan  | 🟡 In progress (Claire)                                     | Output: `_shared/specs/p1-design/p1-acp-db-migration-plan-claire.md`     |
| P1 Extension Skeleton | 🟡 In progress (Roman)                                      | Output: `_shared/specs/p1-design/p1-extension-skeleton-plan-roman.md`    |
| P1 `acp_send`         | ✅ Design complete (Sandy)                                  | Output: `_shared/specs/p1-design/p1-acp-send-plan-sandy.md`              |
| P1 Delivery Router    | 🟡 In progress (Tony)                                       | Output: `_shared/specs/p1-design/p1-delivery-router-plan-tony.md`        |
| P1 `acp_handoff`      | ✅ Design complete (Barry)                                  | Output: `_shared/specs/p1-design/p1-acp-handoff-plan-barry.md`           |
| P2–P3                 | ⬜ Not started                                              | Pending P1 completion                                                    |

---

## Squad

| Agent  | Role               | Owns                                                      |
| ------ | ------------------ | --------------------------------------------------------- |
| Tim    | Lead / Owner       | Spec, architecture decisions, final review of all sub-PRs |
| Roman  | Staff reviewer     | Extension skeleton plan, session injection spike          |
| Sandy  | Senior implementer | `acp_send` implementation, cross-extension spike          |
| Tony   | Senior implementer | Delivery router, heartbeat/wake spike                     |
| Claire | Staff reviewer     | Schema review, DB migration plan                          |
| Barry  | Mid implementer    | `acp_handoff` implementation                              |

Workers submit sub-PRs into `acp` branch. Tim reviews and merges. Tim PRs `acp` → `dgarson/fork` when workstream complete.

---

## Open Questions / Blockers

- ACP↔workq integration: workq must be live (or at minimum at MVP) before ACP can use it for `external_refs` tracking
- Delivery guarantees for P2: at-least-once vs exactly-once semantics decision deferred to P2
