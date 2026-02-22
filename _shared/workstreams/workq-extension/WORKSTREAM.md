# WORKSTREAM.md — workq Extension

_Mega-branch:_ `feat/workq-extension` _(NOT YET CREATED — Tim must create this)_
_Owner:_ **Tim** (VP Architecture)
_Created:_ 2026-02-21
_Last updated:_ 2026-02-21

> ⚠️ **ATTENTION — Tim:** This workstream is actively in progress but has no registered mega-branch. Squad members are currently working on worktrees without a consolidated mega-branch. Tim must:
>
> 1. Create `feat/workq-extension` from `dgarson/fork` and push it immediately
> 2. Update `_shared/MEGA_BRANCHES.md` to register it
> 3. Have all agents working on workq target their PRs at `feat/workq-extension` (not `main` or `dgarson/fork` directly)
>
> Delete this entire directory (`_shared/workstreams/workq-extension/`) ONLY after `feat/workq-extension` is confirmed merged into `dgarson/fork`.

---

## Deliverable

A workq OpenClaw extension providing multi-agent work queue management via tool API and CLI. Enables agents to claim work items, track file ownership (conflict detection), coordinate across squads, and transition task status atomically. Built as `extensions/workq/` within the OpenClaw repo using `node:sqlite`, 8 tool functions, and 5+ CLI commands.

**Architecture spec:** `/Users/openclaw/.openclaw/workspace/_shared/specs/workq-architecture.md`
**Implementation plan:** `/Users/openclaw/.openclaw/workspace/_shared/specs/workq-implementation-plan.md`
**Tim's review:** `/Users/openclaw/.openclaw/workspace/_shared/specs/workq-arch-review-tim.md`
**Amadeus's review:** `/Users/openclaw/.openclaw/workspace/_shared/specs/workq-ai-review-amadeus.md`

---

## Design

Key decisions:

- **`node:sqlite`** — NOT `better-sqlite3` (native module packaging conflict)
- **Ownership binding** — `ctx.agentId` from tool factory context, never self-reported agent name
- **`work_item_files` junction table** — normalized file tracking, not `files_json` blob
- **8 tools** — `workq_claim`, `workq_status`, `workq_files`, `workq_query`, `workq_transition`, `workq_comment`, `workq_release`, `workq_export` (no `workq_preflight` in v0.1)
- **Priority/scope/tags** — `priority`, `scope_json`, `tags_json` columns per Amadeus review
- **Inline conflict warnings** — on `workq_claim` response, not a separate tool call
- **Extension-first** — lives entirely in `extensions/workq/`, zero core modifications

---

## Strategy

6-phase implementation:

- **Phase 1:** Project scaffold + SQLite core (BLOCKING)
- **Phase 2:** Agent tools (8 tool functions)
- **Phase 3:** CLI commands
- **Phase 4:** Export/formatting
- **Phase 5:** Tests
- **Phase 6:** Integration testing

---

## Tasks & Status

See workboard: `/Users/openclaw/.openclaw/workspace/_shared/WORKBOARD.md` (Project: workq Extension)

| Phase                      | Status                                 | Squad   |
| -------------------------- | -------------------------------------- | ------- |
| Phase 1: Scaffold + SQLite | ✅ Done (Sandy)                        | Alpha   |
| Phase 2: Agent Tools       | ✅ Done (Tony)                         | Alpha   |
| Phase 3: CLI               | ✅ Done (Nate)                         | Bravo   |
| Phase 4: Export/Formatting | 🟡 In progress                         | Bravo   |
| Phase 5: Tests             | ⬜ Not started (blocked on Phases 1-4) | Charlie |
| Phase 6: Integration       | ⬜ Not started                         | Alpha   |

---

## Squad

| Agent  | Role               | Squad   |
| ------ | ------------------ | ------- |
| Tim    | Lead / Owner       | —       |
| Roman  | Staff reviewer     | Alpha   |
| Sandy  | Senior implementer | Alpha   |
| Tony   | Senior implementer | Alpha   |
| Joey   | Mid implementer    | Alpha   |
| Harry  | Mid implementer    | Alpha   |
| Vince  | Mid implementer    | Alpha   |
| Claire | Staff reviewer     | —       |
| Barry  | Mid implementer    | Bravo   |
| Jerry  | Mid implementer    | Bravo   |
| Nate   | Mid implementer    | Bravo   |
| Oscar  | Mid implementer    | Bravo   |
| Wes    | Mid implementer    | Bravo   |
| Larry  | Engineer/tester    | Charlie |
| Sam    | Engineer/tester    | Charlie |
| Piper  | Engineer/tester    | Charlie |
| Quinn  | Engineer/tester    | Charlie |
| Reed   | Engineer/tester    | Charlie |

---

## Open Questions / Blockers

- **Mega-branch not yet created** — Tim must create `feat/workq-extension` immediately
- workq must be live before ACP can use it for `external_refs` task tracking (ACP dependency)
- Phase 5 (tests) blocked until Phases 1-4 complete
