# WORKBOARD.md — Shared Task Board

# ⚠️ TEMPORARY — until workq extension is fully operational

# Last updated: 2026-02-21 17:50 MST (Luis — added Horizon UI v2 production build workstream; 11/12 tasks done, PR pending)

## How This Works

This is a shared file-based task board. It's not perfect (no locking, no atomic claims), but it works for 24 hours.

**Rules:**

1. **Before claiming a task:** Read this entire file. If someone else claimed it, pick another.
2. **To claim:** Edit this file — change `unclaimed` to your agent ID and set status to `in-progress`.
3. **To update status:** Edit your task's status line.
4. **If blocked:** Set status to `blocked` and add a reason.
5. **When done:** Set status to `done` and add your PR branch name.
6. **Check for conflicts:** If two agents touch the same files, coordinate in your squad.
7. **ALWAYS use git worktrees** per `_shared/WORK_PROTOCOL.md`.

**Status values:** `unclaimed` | `in-progress` | `blocked` | `in-review` | `done`

---

## Project: workq Extension

**Repo:** openclaw (local at `/Users/openclaw/openclaw/`)
**Extension dir:** `/Users/openclaw/.openclaw/extensions/workq/`
**Architecture spec:** `/Users/openclaw/.openclaw/workspace/_shared/specs/workq-architecture.md`
**Implementation plan:** `/Users/openclaw/.openclaw/workspace/_shared/specs/workq-implementation-plan.md`
**Tim's review:** `/Users/openclaw/.openclaw/workspace/_shared/specs/workq-arch-review-tim.md`
**Amadeus's review:** `/Users/openclaw/.openclaw/workspace/_shared/specs/workq-ai-review-amadeus.md`

### ⚠️ IMPORTANT: Read Tim's review before starting!

Tim flagged 3 blockers that MUST be addressed in implementation:

1. **Use `node:sqlite` or similar** — NOT `better-sqlite3` (native module packaging conflict)
2. **Ownership binding** — use `ctx.agentId` from tool factory context, not self-reported names
3. **Add `work_item_files` table** — normalized file tracking, not `files_json` blob scanning

Also incorporate the finalized Amadeus v0.1 additions from architecture:

- `priority`, `scope_json`, `tags_json` columns
- Inline conflict/scope warnings on `workq_claim` response
- Keep tool surface to 8 tools (no `workq_preflight` in v0.1)

---

### Phase 1: Project Scaffold + SQLite Core (BLOCKING — must complete first)

**Task 1.1 — Project scaffold**

- Status: `done`
- Assignee: Sandy
- Squad: Alpha
- Files: `package.json`, `openclaw.plugin.json`, `index.ts`, `src/types.ts`
- Spec ref: Implementation plan §Phase 1, items 1.1 + 1.5
- Notes: Use `node:sqlite` (NOT better-sqlite3). Reference voice-call extension for patterns.

**Task 1.2 — SQLite database module**

- Status: `done`
- Assignee: Sandy
- Squad: Alpha
- Files: `src/database.ts`
- Spec ref: Implementation plan §Phase 1, item 1.2. Architecture §2.1. Tim's review §1.
- Notes: Include `work_item_files` junction table per Tim's review. Include finalized v0.1 fields (`priority`, `scope_json`, `tags_json`) only.
- Depends on: Task 1.1 (scaffold must exist)

**Task 1.3 — State machine module**

- Status: `done`
- Assignee: Sandy
- Squad: Alpha
- Files: `src/state-machine.ts`
- Spec ref: Implementation plan §Phase 1, item 1.3. Architecture §2.2. Tim's review §3.
- Notes: Include Tim's edge cases (blocked reason clearing, reclaim semantics for dropped).

**Task 1.4 — File matcher module**

- Status: `done`
- Assignee: Sandy
- Squad: Alpha
- Files: `src/file-matcher.ts`
- Spec ref: Implementation plan §Phase 1, item 1.4
- Notes: Canonical path normalization per Tim's risk analysis §8.3.

### Phase 2: Agent Tools (after Phase 1)

**Task 2.1 — Tool registration (8 tools)**

- Status: `done`
- Assignee: Tony
- Squad: Alpha
- Files: `src/tools.ts`
- Spec ref: Implementation plan §Phase 2. Architecture §3. Tim's review §4. Amadeus's review final summary.
- Notes: 8 tools total (no `workq_preflight` in v0.1). Use `ctx.agentId` from tool factory context for ownership. Expand `workq_files` with modes (check|set|add|remove) per Tim. Add priority/scope filters, date-range + pagination to `workq_query`, and inline conflict warnings on claim.
- Depends on: Phase 1 complete

### Phase 3: CLI Commands (after Phase 1)

**Task 3.1 — CLI registration module**

- Status: `done`
- Assignee: Nate
- Squad: Bravo
- Files: `src/cli.ts`
- Spec ref: Implementation plan §Phase 3. Architecture §4. Tim's review §5.
- Notes: Include parity commands (release, done, files) per Tim's CLI review. Add date-range and pagination flags.
- Depends on: Phase 1 complete

### Phase 4: Export + Formatting (after Phase 1)

**Task 4.1 — Export module**

- Status: `done`
- Assignee: Oscar
- Squad: Bravo
- Files: `src/export.ts`
- Spec ref: Implementation plan §Phase 4
- Depends on: Phase 1 complete

### Phase 5: Tests (after Phases 1-4)

**Task 5.1 — Database + tool handler tests**

- Status: `done`
- Assignee: Barry
- Squad: Charlie
- Files: `src/database.test.ts`, `src/tools.test.ts`
- Spec ref: Implementation plan §Phase 5, items 5.1 + 5.4. Tim's review §7.8 (WAL file-backed tests).
- Depends on: Phases 1-2 complete

**Task 5.2 — State machine + file matcher tests**

- Status: `done`
- Assignee: Jerry
- Squad: Charlie
- Files: `src/state-machine.test.ts`, `src/file-matcher.test.ts`
- Spec ref: Implementation plan §Phase 5, items 5.2 + 5.3
- Depends on: Phase 1 complete

**Task 5.3 — CLI tests**

- Status: `done`
- Assignee: Harry
- Squad: Charlie
- Files: `src/cli.test.ts`
- Spec ref: Implementation plan §Phase 5, item 5.5
- Depends on: Phase 3 complete

### Phase 6: Integration + Polish (after all above)

**Task 6.1 — Integration testing + docs**

- Status: `done`
- Assignee: Vince
- Squad: Alpha
- Files: `README.md`, config integration
- Spec ref: Implementation plan §Phase 6
- Depends on: All phases complete

### Ops Check-in (2026-02-21 16:33 MST)

- State counts: `done` 11 | `in-progress` 0 | `blocked` 0 | `in-review` 0 | `unclaimed` 0
- Stalled `in-progress` (mark `reassign`): none
- Dependency-ready unclaimed tasks: none
- Recommended assignees for any reopen/new follow-up:
  - Phase 1/2/6 (Alpha): `Sandy`, `Tony`, `Joey`, `Harry`, `Vince`
  - Phase 3/4 (Bravo): `Barry`, `Jerry`, `Nate`, `Oscar`, `Wes`
  - Phase 5 (Charlie): `Larry`, `Sam`, `Piper`, `Quinn`, `Reed`

### Task → Implementation Plan Mapping (concise)

- `1.1` Project scaffold → §Phase 1 item 1.1 (+ item 1.5 install)
- `1.2` SQLite database module → §Phase 1 item 1.2
- `1.3` State machine module → §Phase 1 item 1.3
- `1.4` File matcher module → §Phase 1 item 1.4
- `2.1` Tool registration (8 tools) → §Phase 2 item 2.1
- `3.1` CLI registration module → §Phase 3 item 3.1
- `4.1` Export module → §Phase 4 item 4.1
- `5.1` DB + tool handler tests → §Phase 5 items 5.1 + 5.4
- `5.2` State machine + file matcher tests → §Phase 5 items 5.2 + 5.3
- `5.3` CLI tests → §Phase 5 item 5.5
- `6.1` Integration testing + docs/config → §Phase 6 items 6.1 + 6.2 + 6.3

---

## Squad Roster

### Squad Alpha (Core Implementation)

- **Lead:** Roman (Staff Engineer)
- Sandy, Tony, Joey, Harry, Vince

### Squad Bravo (CLI + UX)

- **Lead:** Claire (Staff Engineer)
- Barry, Jerry, Nate, Oscar, Wes

### Squad Charlie (Testing + QA)

- **Lead:** Roman or Claire (shared)
- Larry, Sam, Piper, Quinn, Reed

---

## Coordination Notes

- 2026-02-21 21:01 MST (Xavier, evening cron): **Evening review complete.** Key completions: PR #36 MERGED (P0 cron fix, 17:06 MST). TEL-01 done by David (PR #47 open, Xavier review queued for morning). PR #44 (Horizon UI v2) open — Xavier review needed. PR #43 (A2A) in staff review. PR #48 (integration test scaffold, David) OPEN — targets `main` which is protocol violation; do NOT merge, flag David morning. Tim briefed for overnight: Barry→ACP P0-01, Harry→P0-07, Larry→P0-08, Sandy→workq test improvements, Roman→review PR #48. No merges of PRs #43/#44/#47/#48 overnight — Xavier morning review required.
- 2026-02-21 17:50 MST (Luis): Added **Horizon UI v2 Production Build** project (HRZ2-01 through HRZ2-PR) — 11 tasks shipped today on `luis/ui-redesign` branch (`dgarson/clawdbot`), 1 task unclaimed (HRZ2-PR: open mega-branch PR to `dgarson/fork`). Distinct from the Horizon prototype (`apps/web-next/`) — this is the full production codebase with 424 source files, 29 TanStack Router routes, Radix/Shadcn design system, real gateway RPC integration. Updated board summary totals: 102 tasks / 46 done / 9 in-progress / 1 blocked / 34 unclaimed / 13 backlog.

- 2026-02-21 17:49 MST (Tim): Completed board population pass for currently tracked architecture work. Updated Discovery/UTEE lane to reflect reality: `DISC-02` moved to `done` (fixes landed), added `DISC-03` for Phase 1 canary execution decision flow (`unclaimed`, P1, owner Tim+Xavier), and added `OPS-08` for memory indexing health recovery surfaced by heartbeat telemetry. Updated summary counts accordingly.

- 2026-02-21 16:38 MST (Tim): Reviewed board for missing known/planned work and added/updated tasks for (a) ACP structured handoff/teamspace protocol spec package (`ACP-SPEC-08`, done), and (b) PR backlog reality (`PR-A2A` done via consolidation, `PR-43` added as in-review, `PR-36` moved to in-review, `PR-TRIAGE` moved to in-progress with reviewed PRs marked). Included explicit owner, team/squad composition, priority, status, and ordered workflow steps for each new/updated task.

- 2026-02-21 16:33 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; `_shared/WORKBOARD.md` was unexpectedly missing from the workspace and has now been restored from the latest known complete snapshot. Task state remains unchanged after restoration: tasks 1.1–6.1 are `done` (`done` 11 | `in-progress` 0 | `blocked` 0 | `in-review` 0 | `unclaimed` 0). Verified via `subagents list` that no workers are active/stalled. No dependency-ready backlog, no reassignments, no unblocks, and no worker spawns required this cycle.

- 2026-02-21 13:48 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; board remains fully complete with tasks 1.1–6.1 at `done` (`done` 11 | `in-progress` 0 | `blocked` 0 | `in-review` 0 | `unclaimed` 0). Verified via `subagents list` that no workers are active/stalled. No dependency-ready backlog, no reassignments, no unblocks, and no worker spawns required this cycle.

- 2026-02-21 13:33 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; board remains fully complete with tasks 1.1–6.1 at `done` (`done` 11 | `in-progress` 0 | `blocked` 0 | `in-review` 0 | `unclaimed` 0). Verified via `subagents list` that no workers are active/stalled. No dependency-ready backlog, no reassignments, no unblocks, and no worker spawns required this cycle.

- 2026-02-21 13:18 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; board remains fully complete with tasks 1.1–6.1 at `done` (`done` 11 | `in-progress` 0 | `blocked` 0 | `in-review` 0 | `unclaimed` 0). Verified via `subagents list` that no workers are active/stalled. No dependency-ready backlog, no reassignments, no unblocks, and no worker spawns required this cycle.

- 2026-02-21 13:03 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; board remains fully complete with tasks 1.1–6.1 at `done` (`done` 11 | `in-progress` 0 | `blocked` 0 | `in-review` 0 | `unclaimed` 0). Verified via `subagents list` that no workers are active/stalled. No dependency-ready backlog, no reassignments, no unblocks, and no worker spawns required this cycle.

- 2026-02-21 12:48 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; board remains fully complete with tasks 1.1–6.1 at `done` (`done` 11 | `in-progress` 0 | `blocked` 0 | `in-review` 0 | `unclaimed` 0). Verified via `subagents list` that no workers are active/stalled. No dependency-ready backlog, no reassignments, no unblocks, and no worker spawns required this cycle.

- 2026-02-21 12:33 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; board remains fully complete with tasks 1.1–6.1 at `done` (`done` 11 | `in-progress` 0 | `blocked` 0 | `in-review` 0 | `unclaimed` 0). Verified via `subagents list` that no workers are active/stalled. No dependency-ready backlog, no reassignments, no unblocks, and no worker spawns required this cycle.

- 2026-02-21 12:18 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; board remains fully complete with tasks 1.1–6.1 at `done` (`done` 11 | `in-progress` 0 | `blocked` 0 | `in-review` 0 | `unclaimed` 0). Verified via `subagents list` that no workers are active/stalled. No dependency-ready backlog, no reassignments, no unblocks, and no worker spawns required this cycle.

- 2026-02-21 12:03 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; board remains fully complete with tasks 1.1–6.1 at `done` (`done` 11 | `in-progress` 0 | `blocked` 0 | `in-review` 0 | `unclaimed` 0). Verified via `subagents list` that no workers are active/stalled. No dependency-ready backlog, no reassignments, no unblocks, and no worker spawns required this cycle.

- 2026-02-21 11:50 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; board remains fully complete with tasks 1.1–6.1 at `done` (`done` 11 | `in-progress` 0 | `blocked` 0 | `in-review` 0 | `unclaimed` 0). Re-verified via `sessions_list` + `subagents list` that no workers are active/stalled. No dependency-ready backlog, no reassignments, no unblocks, and no worker spawns required this cycle.

- 2026-02-21 11:33 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; board remains fully complete with tasks 1.1–6.1 at `done` (`done` 11 | `in-progress` 0 | `blocked` 0 | `in-review` 0 | `unclaimed` 0). Re-verified via `sessions_list` + `subagents list` that no workers are active/stalled. No dependency-ready backlog, no reassignments, no unblocks, and no worker spawns required this cycle.

- 2026-02-21 11:18 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; board remains fully complete with tasks 1.1–6.1 at `done` (`done` 11 | `in-progress` 0 | `blocked` 0 | `in-review` 0 | `unclaimed` 0). Verified via `sessions_list` + `subagents list` that no workers are active/stalled. No dependency-ready backlog, no reassignments, no unblocks, and no worker spawns required this cycle.

- 2026-02-21 11:03 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; board remains fully complete with tasks 1.1–6.1 at `done` (`done` 11 | `in-progress` 0 | `blocked` 0 | `in-review` 0 | `unclaimed` 0). Verified via `sessions_list` + `subagents list` that no workers are active/stalled. No dependency-ready backlog, no reassignments, no unblocks, and no worker spawns required this cycle.

- 2026-02-21 10:48 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; board remains fully complete with tasks 1.1–6.1 at `done` (`done` 11 | `in-progress` 0 | `blocked` 0 | `in-review` 0 | `unclaimed` 0). Verified via `sessions_list` + `subagents list` that no workers are active/stalled. No dependency-ready backlog, no reassignments, no unblocks, and no worker spawns required this cycle.

- 2026-02-21 10:33 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; board remains fully complete with tasks 1.1–6.1 at `done` (`done` 11 | `in-progress` 0 | `blocked` 0 | `in-review` 0 | `unclaimed` 0). Verified via `sessions_list` + `subagents list` that no workers are active/stalled. No dependency-ready backlog, no reassignments, no unblocks, and no worker spawns required this cycle.

- 2026-02-21 10:18 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; board remains fully complete with tasks 1.1–6.1 at `done` (`done` 11 | `in-progress` 0 | `blocked` 0 | `in-review` 0 | `unclaimed` 0). Verified no active worker drift via `sessions_list` and no running subagents. No dependency-ready backlog, no reassignments, no unblocks, and no worker spawns required this cycle.

- 2026-02-21 10:03 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; tasks 1.1–6.1 remain `done` with board counts unchanged (`done` 11 | `in-progress` 0 | `blocked` 0 | `in-review` 0 | `unclaimed` 0). No stalled ownership found in session/subagent checks; no dependency-ready backlog. No reassignments, unblocks, or worker spawns required this cycle.

- 2026-02-21 09:50 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; task board remains fully complete with tasks 1.1–6.1 all `done`. No `in-progress`, `blocked`, or `unclaimed` entries detected; no stalled ownership; no dependency-ready backlog. No reassignments, unblocks, or worker spawns required this cycle.

- 2026-02-21 09:33 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; task board remains fully complete with tasks 1.1–6.1 all `done`. No `in-progress`, `blocked`, or `unclaimed` entries detected; no stalled ownership; no dependency-ready backlog. No reassignments, unblocks, or worker spawns required this cycle.

- 2026-02-21 09:18 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; task board remains fully complete with tasks 1.1–6.1 all `done`. No `in-progress`, `blocked`, or `unclaimed` entries detected; no stalled ownership; no dependency-ready backlog. No reassignments, unblocks, or worker spawns required this cycle.

- 2026-02-21 08:33 MST (Tim, cron:4dd03dcb-e701-4dae-897b-07a2fec47500): 15-minute progress check complete; board remains fully complete with tasks 1.1–6.1 all `done`. No `in-progress`, `blocked`, or `unclaimed` entries; no stalled ownership; no dependency-ready backlog. No reassignments, unblocks, or worker spawns required this cycle.

- 2026-02-21 08:33 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; task board remains fully complete with tasks 1.1–6.1 all `done`. No `in-progress`, `blocked`, or `unclaimed` entries detected; no stalled ownership; no dependency-ready backlog. No reassignments, unblocks, or worker spawns required this cycle.
- 2026-02-21 08:26 MST (Tim, fast-pass triage): Board/spec audit complete. Status rollup unchanged: tasks 1.1–6.1 are `done`; `in-progress`: none; `blocked`: none; `unclaimed`: none; dependency-ready unclaimed: none; stalled in-progress: none. **Spawn recommendation now:** none. **If any task reopens, assign by phase constraints only:** Phase 1/2/6 → Sandy/Tony/Joey/Harry/Vince (Alpha); Phase 3/4 → Barry/Jerry/Nate/Oscar/Wes (Bravo); Phase 5 → Larry/Sam/Piper/Quinn/Reed (Charlie).
- 2026-02-21 08:06 MST (Tim, cron:4dd03dcb-e701-4dae-897b-07a2fec47500): 15-minute progress check complete; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` entries. No triage/reassignment/unblock/spawn actions required.
- 2026-02-21 08:06 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` entries. No triage actions, reassignments, unblocks, or worker spawns required.
- 2026-02-21 07:48 MST (Tim, cron:4dd03dcb-e701-4dae-897b-07a2fec47500): 15-minute progress check complete; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` entries. No triage, reassignment, unblock, or worker spawn actions required.
- 2026-02-21 07:48 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` entries. No triage actions, reassignments, unblocks, or worker spawns required.
- 2026-02-21 07:33 MST (Tim, cron:4dd03dcb-e701-4dae-897b-07a2fec47500): 15-minute progress check complete; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` entries. No triage, reassignment, unblock, or spawn actions required.
- 2026-02-21 07:33 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` entries. No triage actions, reassignments, unblocks, or worker spawns required.
- 2026-02-21 07:18 MST (Tim, cron:4dd03dcb-e701-4dae-897b-07a2fec47500): 15-minute progress check complete; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` entries. No triage/reassignment/unblock/spawn actions required.
- 2026-02-21 07:18 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` entries. No triage actions, reassignments, unblocks, or worker spawns required.
- 2026-02-21 07:03 MST (Tim, cron:4dd03dcb-e701-4dae-897b-07a2fec47500): 15-minute progress check complete; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` entries. No triage/reassignment/unblock/spawn actions required.
- 2026-02-21 07:03 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` items. No triage, reassignment, unblock, or worker spawn actions required.
- 2026-02-21 06:48 MST (Tim, cron:4dd03dcb-e701-4dae-897b-07a2fec47500): 15-minute progress check complete; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` items. No reassignment, unblock, or spawn actions required.
- 2026-02-21 06:48 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` items. No triage actions, reassignments, unblocks, or worker spawns required.
- 2026-02-21 06:33 MST (Tim, cron:4dd03dcb-e701-4dae-897b-07a2fec47500): Progress check complete; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` entries. No reassignment, unblock, or worker spawns required.
- 2026-02-21 06:33 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; tasks 1.1–6.1 remain `done` and board stays clear (`in-progress`/`blocked`/`unclaimed`: none). No triage, reassignment, unblock, or spawn actions required.
- 2026-02-21 06:18 MST (Tim, cron:4dd03dcb-e701-4dae-897b-07a2fec47500): 15-minute progress check complete; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` items. No reassignments, unblocks, or spawns required.
- 2026-02-21 06:18 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` work. No triage actions, reassignments, unblocks, or worker spawns required.
- 2026-02-21 06:07 MST (Tim, cron:4dd03dcb-e701-4dae-897b-07a2fec47500): Progress check complete; tasks 1.1–6.1 remain `done` with zero `in-progress`, `blocked`, or `unclaimed` work. No reassignments, unblocks, or worker spawns required.
- 2026-02-21 06:03 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` items. No triage actions, reassignments, unblocks, or worker spawns required.
- 2026-02-21 05:52 MST (Tim, cron:4dd03dcb-e701-4dae-897b-07a2fec47500): Progress check complete; tasks 1.1–6.1 remain `done` and board has no `in-progress`, `blocked`, or `unclaimed` entries. No reassignment, unblock, or spawn actions required.
- 2026-02-21 05:51 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): Progress check complete; tasks 1.1–6.1 remain `done` with no claimed `in-progress`, `blocked`, or `unclaimed` items. No triage action, reassignment, unblock, or worker spawns required.
- 2026-02-21 05:33 MST (Tim, cron:4dd03dcb-e701-4dae-897b-07a2fec47500): 15-minute progress check complete; board remains fully complete with tasks 1.1–6.1 `done` and no `in-progress`, `blocked`, or `unclaimed` items. No triage actions or spawns required.
- 2026-02-21 05:33 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): Progress check complete; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` work items. No reassignment, unblock, or spawn actions required this cycle.
- 2026-02-21 05:18 MST (Tim, cron:4dd03dcb-e701-4dae-897b-07a2fec47500): Progress check complete; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` work. No triage/reassignment/unblock/spawn actions required.
- 2026-02-21 05:18 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): 15-minute progress check complete; tasks 1.1–6.1 remain `done` and board is clear (`in-progress`/`blocked`/`unclaimed`: none). No triage actions, reassignments, unblocks, or worker spawns required.
- 2026-02-21 05:03 MST (Tim, cron:4dd03dcb-e701-4dae-897b-07a2fec47500): 15-minute check complete; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` work. No reassignment, unblock, or spawn actions required.
- 2026-02-21 05:03 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): Revalidated workboard; tasks 1.1–6.1 remain `done` and board has no `in-progress`, `blocked`, or `unclaimed` entries. No triage action, reassignment, unblock, or worker spawns required.
- 2026-02-21 04:48 MST (Tim, cron:4dd03dcb-e701-4dae-897b-07a2fec47500): 15-minute progress check complete; tasks 1.1–6.1 remain `done` with no claimed `in-progress`, `blocked`, or `unclaimed` items. No triage action, reassignment, unblock, or worker spawn required.
- 2026-02-21 04:48 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): Progress check complete; all tasks 1.1–6.1 remain `done` and board is fully clear (`in-progress`/`blocked`/`unclaimed`: none). No triage actions, reassignments, unblocks, or worker spawns required.
- 2026-02-21 04:33 MST (Tim, cron:4dd03dcb-e701-4dae-897b-07a2fec47500): 15-minute progress check completed; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` items. No reassignments, unblocks, or spawns needed.
- 2026-02-21 04:33 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): Board rechecked at 15-minute cadence; tasks 1.1–6.1 remain `done` with zero `in-progress`, `blocked`, or `unclaimed` entries. No triage actions, reassignments, unblocks, or worker spawns required.
- 2026-02-21 04:20 MST (Tim, cron:4dd03dcb-e701-4dae-897b-07a2fec47500): 15-minute progress check complete; all tasks 1.1–6.1 still `done`. No `in-progress`, `blocked`, or `unclaimed` work detected; no triage, reassignment, or worker spawns required.
- 2026-02-21 04:18 MST (Tim, cron:9b51578b-f9cc-4f31-a29d-81a67d185224): Revalidated board state; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` entries. No reassignment, unblock, or spawn actions required this cycle.
- 2026-02-21 04:03 MST (Tim, cron:4dd03dcb-e701-4dae-897b-07a2fec47500): Workq progress check complete; board still fully green. Tasks 1.1–6.1 remain `done` with zero `in-progress`, `blocked`, or `unclaimed` items. No triage actions, reassignments, or spawns required.
- 2026-02-21 04:03 MST (Tim, cron check-in): Board re-audited; tasks 1.1–6.1 remain `done` with no `in-progress`, `blocked`, or `unclaimed` items. No reassignments, unblocks, or new spawns required.
- 2026-02-21 03:48 MST (Tim, cron check-in): No changes required this cycle; board remains fully complete and in review/merge lane.
- 2026-02-21 03:48 MST (Tim, cron check-in): Re-checked board health; tasks 1.1–6.1 remain `done` with zero in-progress/blocked/unclaimed entries. No spawns or reassignment actions needed.
- 2026-02-21 03:33 MST (Tim, cron check-in): Confirmed no action required; build board remains complete and stable.
- 2026-02-21 03:33 MST (Tim, cron check-in): Board audited; status unchanged with all tasks 1.1–6.1 `done`. No in-progress/blocked/unclaimed work. No worker spawns or reassignment required.
- 2026-02-21 03:18 MST (Tim, cron check-in): No-op update; board remains fully complete and unchanged since prior check.
- 2026-02-21 03:18 MST (Tim, cron check-in): Re-validated task board; all tasks 1.1–6.1 remain `done`. No in-progress, blocked, or unclaimed items. No reassignments or spawns needed.
- 2026-02-21 03:03 MST (Tim, cron check-in): No board changes required this cycle; project remains complete and ready in review/merge lane.
- 2026-02-21 03:03 MST (Tim, cron check-in): Re-validated board; tasks 1.1–6.1 still `done`. No claimed/in-progress items, no blocked items, no unclaimed items. No spawns or reassignments required.
- 2026-02-21 02:48 MST (Tim, cron check-in): Board validated; all workq tasks remain `done` (1.1–6.1). Nothing to reassign, unblock, or newly spawn.
- 2026-02-21 02:48 MST (Tim): Re-checked board at 15-min cadence; still fully complete (Tasks 1.1–6.1 all `done`). No in-progress drift, no blocked items, no unclaimed tasks. No reassignment or new spawns needed.
- 2026-02-21 02:33 MST (Tim): Workq build board is fully complete (Tasks 1.1–6.1 all `done`). No stalled in-progress or blocked items. No new spawns required this check-in; ready for staff review → architect review → merge flow.
- Phases 2, 3, 4 can run in parallel once Phase 1 is done
- Phase 5 tests can start per-module as modules complete
- All PRs go through: Staff Review (Roman/Claire) → Architect (Tim) → Merge
- If you're blocked, update your task status and ping your squad lead
- If your squad has no unclaimed tasks matching your phase, help another squad

---

---

# ════════════════════════════════════════════════════════

# ADDITIONAL WORKSTREAMS (added by Amadeus, 2026-02-21 16:36 MST)

# ════════════════════════════════════════════════════════

---

## Project: ACP — Agent Communication Protocol

**Priority:** P0/P1 — Core infrastructure for agent-to-agent messaging
**Owner:** Tim (VP Architecture) — spec lead & execution coordinator
**Canonical Spec:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-canonical-spec.md`
**Task Breakdown:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-task-breakdown.md`
**Workstream Status:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-workstream-status.md`
**Xavier's Review:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-review-xavier-2026-02-21.md`
**Handoff Spec:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-handoff-spec.md`
**Timeline:** ~18 weeks (P0 week 1 → P1 weeks 2–6 → P2 weeks 7–11 → P3 weeks 12–18)

**Task ACP-SPEC-08 — Structured handoff + teamspace protocol spec package**

- Status: `done`
- Assignee: Tim
- Team/Squad: Architecture (Tim-led)
- Priority: P1
- Output: `/Users/openclaw/.openclaw/workspace/tim/agent-handoff-teamspace-spec-2026-02-21.md`
- Workflow (completed):
  1. Defined A2M v1 envelope + messaging semantics.
  2. Defined THP v1 handoff package + lifecycle and reason codes.
  3. Defined TSP v1 teamspace model (role ledger, task board, artifacts, conflict handling).
  4. Produced phased implementation plan (P0–P3) aligned with Amadeus Idea #8.

### Phase 0: Schema Freeze + Verification Spikes (Week 1)

**Task P0-04 — Spike: Session injection feasibility**

- Status: `done`
- Assignee: Roman
- Squad: Alpha
- Output: `_shared/specs/spikes/acp-spike-session-injection.md`
- Workflow: Verify extension can inject system messages into active sessions; document API constraints.
- Key Finding: `chat.inject` works but doesn't trigger agent processing; ACP bridge path needed.

**Task P0-05 — Spike: Heartbeat/wake trigger**

- Status: `in-progress`
- Assignee: Tony
- Squad: Alpha
- Output target: `_shared/specs/spikes/acp-spike-heartbeat-trigger.md`
- Workflow: Validate extension-triggered heartbeat/wake mechanism for urgent ACP delivery; report rate guardrails.

**Task P0-06 — Spike: Cross-extension integration (Gateway RPC)**

- Status: `done`
- Assignee: Sandy
- Squad: Alpha
- Output: `_shared/specs/spikes/acp-spike-extension-to-extension-calls.md`
- Key Finding: Direct plugin-tool calls unsupported; must use Gateway RPC (`api.registerGatewayMethod` + `callGateway`).

**Task P0-01 — Canonical schema freeze package**

- Status: `unclaimed`
- Suggested Assignee: Barry
- Squad: TBD
- Effort: 1.5d
- Workflow: Convert canonical spec into frozen schema set (envelope, handoff, teamspace manifest) + ADR + change-control process. Sign-off by CTO.

**Task P0-02 — JSON Schema authoring**

- Status: `unclaimed`
- Suggested Assignee: Claire
- Squad: TBD
- Effort: 2.0d
- Depends on: P0-01
- Workflow: Implement JSON Schema files for `ACPMessageEnvelope`, `ACPHandoffPackage`, `ACPTeamspaceManifest`. Commit under `_shared/specs/schemas/acp/`.

**Task P0-03 — Validation harness + golden tests**

- Status: `unclaimed`
- Suggested Assignee: Jerry
- Squad: TBD
- Effort: 2.0d
- Depends on: P0-02
- Workflow: Build test harness; validate >=20 fixtures; enforce 4KB payload cap; CI job green.

**Task P0-07 — Storage path convergence**

- Status: `unclaimed`
- Suggested Assignee: Harry
- Effort: 1.0d
- Workflow: Validate migration from `_teams/` to `_shared/teamspaces/`; backward-compat risk list.

**Task P0-08 — Security baseline requirements**

- Status: `unclaimed`
- Suggested Assignee: Larry
- Effort: 1.5d
- Depends on: P0-01
- Workflow: Draft P1 security requirements (identity derivation, anti-spoofing, ACL checks). Checklist adopted into P1 DoD.

**Task P0-09 — P0 gate review (GO / NO-GO)**

- Status: `blocked` (waiting on P0-05 spike completion)
- Suggested Assignee: Barry
- Effort: 1.0d
- Depends on: P0-03, P0-04, P0-05, P0-06, P0-08
- Workflow: Consolidate spike outcomes; produce gate decision memo with enabled/disabled channels and contingencies.

### Phase 1: Core Messaging + Handoffs — 16 tasks (Weeks 2–6)

> Full task list in `_shared/specs/acp-task-breakdown.md` (P1-01 through P1-16).
> Key assignments: Roman (P1-01 skeleton), Claire (P1-02 DB), Tony (P1-04 router), Sandy (P1-05 acp_send), Barry (P1-09 acp_handoff).
> Status: **Design docs in progress** — Sandy's acp_send plan and Barry's acp_handoff plan complete. Roman/Tony design docs pending.
> All P1 tasks blocked on P0-09 gate review.

### Phase 1 Design Docs (Pre-build)

**P1 Design: acp_send implementation plan**

- Status: `done`
- Assignee: Sandy
- Output: `_shared/specs/p1-design/p1-acp-send-plan-sandy.md`

**P1 Design: acp_handoff implementation plan**

- Status: `done`
- Assignee: Barry
- Output: `_shared/specs/p1-design/p1-acp-handoff-plan-barry.md`

**P1 Design: Extension skeleton plan**

- Status: `in-progress`
- Assignee: Roman
- Output target: `_shared/specs/p1-design/p1-extension-skeleton-plan-roman.md`

**P1 Design: Delivery router plan**

- Status: `in-progress`
- Assignee: Tony
- Output target: `_shared/specs/p1-design/p1-delivery-router-plan-tony.md`

**P1 Design: DB migration plan**

- Status: `in-progress`
- Assignee: Claire
- Output target: `_shared/specs/p1-design/p1-acp-db-migration-plan-claire.md`

### ACP Schema Review

**Claire's canonical spec review**

- Status: `done` (Conditional approval — 4 MUST-FIX applied, 8 SHOULD-FIX noted)
- Output: `_shared/specs/reviews/acp-canonical-review-claire.md`

### Phases 2–3: Negotiation + Teamspaces + Hardening (Weeks 7–18)

> Not yet staffed. Full task list in `_shared/specs/acp-task-breakdown.md`.
> Phase 2: 8 tasks (negotiation, teamspaces, artifact registry, role ledger).
> Phase 3: 8 tasks (conflict resolution, disagreement protocol, security hardening, retention, SLOs).

---

## Project: Telemetry Extension

**Priority:** P0 — Unanimous C-suite consensus (#1 priority)
**Owner:** Unassigned (spec by Drew/Merlin)
**Spec:** `/Users/openclaw/.openclaw/workspace/drew/TELEMETRY_SPEC.md` (7.2KB)
**Status:** Spec complete, awaiting implementation assignment

**Task TEL-01 — Implement telemetry extension (Phase 1: Foundation)**

- Status: `in-review`
- Assignee: David (dgarson) — implemented Sat 2026-02-21 evening
- Priority: P0
- PR: #47 `feat: Telemetry Extension — Phase 1 (structured event capture)` → `dgarson/fork`
- Reviewer: Xavier (queued for morning review)
- Workflow (completed by David):
  1. ✅ Extension scaffold created at `extensions/telemetry/`
  2. ✅ JSONL event sink (not SQLite — simpler flat-file approach)
  3. ✅ Gateway hook integration: session_start, session_end, agent_end, model_usage
  4. Pending Xavier review + merge
- Notes: David implemented directly. Scope is Phase 1 per Drew's spec. Xavier reviews PR #47 Sat morning.

---

## Project: Session Summarization & Agent STATUS.md

**Priority:** P1
**Owner:** Tim (VP Architecture) + Xavier (CTO)
**Brief:** `/Users/openclaw/.openclaw/workspace/_shared/specs/session-summarization-brief.md`
**Requested by:** David (CEO)
**Status:** Brief written, design decisions needed

**Task SUM-01 — Architecture decision: gateway core vs extension**

- Status: `unclaimed`
- Assignee: Tim + Xavier (joint)
- Priority: P1
- Workflow: Decide where summarization lives (gateway core vs extension); trigger mechanism (post-session hook, sync vs async); STATUS.md ownership model (platform-generated vs hybrid).

**Task SUM-02 — Implement session summarization**

- Status: `unclaimed` (blocked on SUM-01)
- Assignee: TBD
- Priority: P1
- Workflow:
  1. Post-session hook captures transcript
  2. Run through cheap model (MiniMax M2.5 or equiv) for summary
  3. Write to `~/.openclaw/sessions/summaries/{agentId}/{sessionId}.md`
  4. Optionally update agent's STATUS.md
- Notes: ~33+ summarizations/day at current cron volume. Cost must be acceptable.

**Task SUM-03 — Agent STATUS.md progressive disclosure system**

- Status: `unclaimed` (blocked on SUM-01)
- Assignee: TBD
- Priority: P1
- Workflow: Three-layer progressive disclosure (STATUS.md → linked summaries → raw logs). Auto-updated by platform after summarization.
- Notes: Solves the cron delivery failure problem (Joey/Amadeus standups fail because target agents have no active session). Agents read STATUS.md instead of requiring synchronous coupling.

---

## Project: Branch Merge Testing Protocol

**Priority:** P1
**Owner:** Amadeus (strategy) + Tim (execution)
**Strategy:** `/Users/openclaw/.openclaw/workspace/_shared/specs/testing-protocol-strategy.md`
**Execution Plan:** `/Users/openclaw/.openclaw/workspace/_shared/specs/testing-protocol-execution.md`
**Status:** Strategy and execution plan written, ready for execution

**Task TEST-01 — Execute branch merge test (dgarson/fork → main)**

- Status: `unclaimed`
- Assignee: Tim (recommended)
- Priority: P1
- Workflow:
  1. Git worktree setup + merge dgarson/fork
  2. P0 critical path tests (gateway startup, WebSocket, config)
  3. P1 core functionality (sessions, compaction, agent loop, auth)
  4. P2 integrations (channels, heartbeat, cron, tools)
  5. P3 edge cases
  6. Sign-off checklist
- Notes: Full protocol at 4 risk tiers (P0–P3). P0/P1 failures block merge. P2 conditional. P3 documented.

---

## Project: Cost Optimization Strategy

**Priority:** P1
**Owner:** Amadeus (CAIO)
**Doc:** `/Users/openclaw/.openclaw/workspace/_shared/specs/COST_OPTIMIZATION_STRATEGY.md`
**Status:** Strategy written, awaiting David's approval for implementation

**Task COST-01 — Model right-sizing (Phase 1: Quick wins)**

- Status: `unclaimed` (awaiting approval)
- Assignee: Amadeus + David (config changes)
- Priority: P1
- Workflow:
  1. Downgrade Amadeus from Opus 4.6 → Sonnet 4.6 for routine work
  2. Reduce `main` thinking from "high" to context-appropriate
  3. Downgrade Stephan (CMO) to T3 for marketing tasks
  4. Downgrade Roman/Claire from Sonnet to T3 for routine engineering
- Notes: Est. 40-60% cost reduction. Priority order: Effectiveness → Cost → Efficiency.

**Task COST-02 — Implement sub-agent spawn discipline**

- Status: `unclaimed`
- Assignee: All lead agents (policy enforcement)
- Priority: P2
- Workflow: Enforce MODEL_SELECTION_POLICY.md — cheapest model that reliably completes task. T3 should handle 60-70% of spawned work.

---

## Project: Routing Optimization

**Priority:** P1–P2
**Owner:** Julia (Chief Agent Officer)
**Proposal:** `/Users/openclaw/.openclaw/workspace/_shared/specs/ROUTING_OPTIMIZATION_PROPOSAL.md`
**Status:** Proposal written, awaiting David's review

**Task ROUTE-01 — Implement tiered main agent (Option D)**

- Status: `unclaimed` (awaiting approval)
- Assignee: Julia (design) + engineering TBD
- Priority: P1
- Workflow:
  1. Configure triage layer on main agent (fast/cheap model for initial classification)
  2. Route simple messages to cheap model path
  3. Escalate complex messages to full Sonnet/Opus path
  4. Measure and validate quality maintained
- Notes: Est. 60-80% reduction in inbound message costs. Immediate win.

**Task ROUTE-02 — Channel-based routing (Option B, Phase 2)**

- Status: `unclaimed` (future)
- Assignee: Julia + engineering TBD
- Priority: P2
- Workflow: Route specific Slack channels to specialized agents directly, bypassing main triage.

---

## Project: Executive Assistant Agent Pattern + Budget Governor

**Priority:** P1–P2
**Owner:** Amadeus (CAIO) + Julia (CoS)
**Investigation Brief:** `/Users/openclaw/.openclaw/workspace/investigations/exec-assistant-and-budget-management-2026-02-21.md`
**Proposal Context:** `/Users/openclaw/.openclaw/workspace/ea-proposal-context.md`
**Status:** Investigation in progress

**Task EA-01 — Investigation: EA agent pattern feasibility**

- Status: `in-progress`
- Assignee: Amadeus + Julia
- Priority: P1
- Workflow:
  1. Define implementation approach (new agent type vs convention with existing primitives)
  2. Solve dedup problem (prevent duplicate exec spawns — `sessions_list` + `maxConcurrent`?)
  3. Model event forwarding (heartbeat reads workspace vs deeper system event integration)
  4. Determine optimal cron interval (5-10min?)
  5. Cost-model the savings (codex-spark heartbeat vs Opus per-run)
- Deliverable: Findings doc + implementation proposal

**Task EA-02 — Investigation: Budget-aware model downgrade system**

- Status: `in-progress`
- Assignee: Amadeus + Julia
- Priority: P2
- Workflow:
  1. Audit existing provider-usage infrastructure (`src/infra/provider-usage.ts`)
  2. Design budget calculation algorithm (weekly usage + reset timing → daily budget)
  3. Define downgrade priority ordering (which agents step down first)
  4. Propose implementation surface (`src/agents/budget-governor.ts`, minimal merge conflict)
  5. Protected agents: never downgrade Tim, Luis; Amadeus floor = Sonnet 4.6
- Deliverable: Implementation spec + prototype

---

## Project: Discovery System — First Run

**Priority:** P1
**Owner:** Merlin (Main) — orchestration; Tim (Architect) — review
**Status:** Configured, first run Monday Feb 23

**Task DISC-01 — Monitor discovery system first run**

- Status: `unclaimed` (scheduled Mon 2026-02-23)
- Assignee: Tim (review) + Merlin (coordination)
- Priority: P1
- Workflow:
  1. 15 discovery cron jobs fire Mon–Fri AM
  2. 2 review jobs (Tim architect review, Roman/Claire staff review)
  3. Proposals land in PROPOSALS.md
  4. Monitor for: model failures (~15% malformed tool calls on MiniMax/GLM), delivery errors, quality
- Notes: First proposal (UTEE by Larry) already landed. Remaining 14 agents run first cycles Monday.

**Task DISC-02 — UTEE proposal: Phase 1 implementation hardening**

- Status: `done`
- Assignee: Sandy
- Team/Squad: Architecture implementation lane (Tim + Sandy)
- Priority: P2
- Workflow (completed):
  1. Implemented pass-through UTEE adapter behind feature flag.
  2. Fixed runtime wrap-toggle behavior (invocation-time flag check).
  3. Wired config init + hot reload path for `utee.enabled`.
  4. Hardened AsyncLocalStorage loading for ESM (`node:module` + `node:async_hooks`).
  5. Re-ran targeted suite (28/28 passing).
- Notes: Guardrails met; canary prep complete and branch is canary-ready.

**Task DISC-03 — UTEE Phase 1 canary execution + decision**

- Status: `unclaimed`
- Assignee: Tim (owner) + Xavier (approval)
- Team/Squad: Architecture + Platform Ops
- Priority: P1
- Workflow:
  1. Final architect sign-off and proposal state update in `PROPOSALS.md`.
  2. Open/merge rollout PR from `sandy/utee-phase1-observability`.
  3. Run 5% / 48h canary with `utee.enabled=true` and rollback watch.
  4. Evaluate thresholds (error-rate delta, latency delta, stability) and publish post-canary report.
  5. Decide GO/NO-GO for broader rollout and Phase 2 re-review.
- Notes: Canary runbook available at `/Users/openclaw/.openclaw/workspace/sandy/utee-phase1-canary-readiness.md`.

---

## Project: Open PRs — Review & Merge Backlog

**Priority:** P1–P2
**Status:** Active; A2A sub-PR consolidation complete, mega-branch PR in review

### A2A Protocol PRs (P1)

**Task PR-A2A — Review + consolidate A2A protocol PRs #37–#41**

- Status: `done`
- Assignee: Tim (review/coordination)
- Team/Squad: Tim + staff review lane (Roman/Claire)
- Priority: P1
- PRs: #37 Schema/Validator, #38 Audit Log, #39 Router, #40 SDK, #41 Integration Tests
- Workflow (completed):
  1. Tim posted start-review notes and reviewed each PR.
  2. Changes were consolidated into `a2a-protocol` mega-branch.
  3. Follow-up merge target opened as PR #43.
- Notes: Consolidation complete; follow-on merge tracked in PR-43.

**Task PR-43 — Merge A2A mega-branch to integration branch (`a2a-protocol` → `dgarson/fork`)**

- Status: `in-review`
- Assignee: Tim (owner), Roman/Claire (staff reviewers)
- Team/Squad: Architecture + Staff Review
- Priority: P1
- PR: #43 `feat(a2a): A2A Protocol — Mega-branch consolidation`
- Workflow:
  1. Complete staff review comments on #43.
  2. Confirm CI passes and mergeability stays green.
  3. Merge to `dgarson/fork`.
  4. Queue/execute next merge step to `main` per branch strategy.

### Cron Delivery Fix (P1)

**Task PR-36 — P0 cron delivery fix**

- Status: `done`
- Assignee: Xavier
- Team/Squad: Tim + Xavier
- Priority: P1
- PR: #36 `fix: P0 cron delivery threading + suppress no-change progress checks` — **MERGED 2026-02-21 17:06 MST**
- Notes: Merged direct-to-main per Tim's recommendation. P0 fix live.

### Feature PRs (P2)

**Task PR-TRIAGE — Triage feature PR backlog**

- Status: `in-progress`
- Assignee: Tim
- Team/Squad: Tim + staff reviewers as assigned
- Priority: P2
- PRs to triage:
  - #42: Exec deterministic gh/git guardrails (Codex) — reviewed/commented
  - #35: ACP Handoff skill — reviewed/commented
  - #33: Issue-tracking DAG query support (Codex) — reviewed/commented
  - #32: LiteLLM model usage config (DRAFT)
  - #31: Subagent delegation during voice calls (Codex) — reviewed/commented
  - #29: Session list UX fix (DRAFT)
  - #28: Tool schema descriptions (DRAFT)
  - #27: Per-agent thinkingDefault (DRAFT)
- Workflow:
  1. Classify each PR as ready-for-review, needs-author-rework, or still-WIP.
  2. Route ready PRs to reviewer owners.
  3. Track merge order and dependency constraints in coordination notes.

---

## Project: OAuth Integration

**Priority:** P1
**Owner:** Luis (Principal UX Engineer)
**Spec:** `/Users/openclaw/.openclaw/workspace/luis/OAUTH_INTEGRATION_SPEC.md` (10KB)
**Status:** COMPLETE — all components implemented in `apps/web-next/`

**Task OAUTH-01 — Implement OAuth integration components**

- Status: `done`
- Assignee: Luis
- Priority: P1
- Notes: Built in `apps/web-next/src/` — useGateway.ts, useWizard.ts, WizardModal.tsx, ProviderAuthManager.tsx, WhatsAppQrLogin.tsx all complete.

---

## Project: OpenClaw Horizon — New Frontend UI

**Priority:** P1 — David's deadline 7:30 AM MST Feb 22
**Owner:** Luis (Principal UX Engineer) — design + implementation lead
**Spec:** `/Users/openclaw/.openclaw/workspace/luis/UI_SPEC.md` (48KB, v1.0)
**Work Queue:** `/Users/openclaw/.openclaw/workspace/luis/UX_WORK_QUEUE.md`
**App Location:** `/Users/openclaw/.openclaw/workspace/luis/apps/web-next/`
**Stack:** Vite + React 19 + TypeScript + Tailwind CSS v3 + Lucide React
**Status:** 🟢 **All 16 views COMPLETE — build passes clean**

### Background

The existing OpenClaw UI (Lit SPA) is engineer-oriented and not beginner-friendly. Horizon is a ground-up redesign: beautiful, guided for non-technical users, with power-user density available on demand. Adaptive UX system with three proficiency tiers (Beginner / Standard / Expert).

### Architecture

- **Framework:** Vite + React 19 + TypeScript (static export, served by Gateway HTTP server)
- **Design system:** Dark theme — gray-950 bg, violet-600 primary, Lucide icons, Tailwind CSS
- **Gateway client:** Custom WebSocket RPC (useGateway hook) — no external libs
- **State:** Local React state + Zustand stores (planned)
- **Key files:**
  - `src/types.ts` — all TypeScript types
  - `src/lib/utils.ts` — cn() utility (clsx + tailwind-merge)
  - `src/mock-data.ts` — realistic mock data for all views
  - `src/App.tsx` — main shell with sidebar nav + lazy-loaded views
  - `src/hooks/useGateway.ts` — WebSocket RPC client hook
  - `src/hooks/useWizard.ts` — wizard session state hook

### Task UI-FOUND — Foundation files

- Status: `done`
- Assignee: Luis
- Priority: P0 (blocking all views)
- Completed: 2026-02-21 ~4:05 PM MST
- Workflow (completed):
  1. Created `src/types.ts` — GatewayTypes, WizardStep (flat interface), Agent/Session/Cron/Skill/Node/Usage types, AnimatedComponents types, WhatsApp login types
  2. Created `src/lib/utils.ts` — cn() via clsx + tailwind-merge
  3. Created `src/mock-data.ts` — realistic agents, sessions, cron jobs, skills, nodes, usage data
  4. Fixed `src/components/ui/AnimatedComponents.tsx` — added missing StatusBadgeVariant entries (offline, healthy, degraded, running, enabled, disabled), fixed TimeSeriesChart timestamp/date dual support
  5. Fixed `src/components/WizardModal.tsx` — resolved Extract<WizardStep> narrowing issue, added options null guard
  6. Fixed `src/components/WhatsAppQrLogin.tsx` — optional field handling for setQrDataUrl/setMessage

### Task UI-01 — AgentDashboard (landing page)

- Status: `done`
- Assignee: piper (spawned sub-agent)
- Priority: P0
- File: `src/views/AgentDashboard.tsx`
- Description: System overview — stats cards (active agents, health, chats, daily cost), quick action buttons, agent grid cards with status dots, recent activity feed, system health bar.
- Workflow: Spawned piper sub-agent; file written to disk.

### Task UI-02 — ChatInterface

- Status: `done`
- Assignee: piper (spawned sub-agent)
- Priority: P0
- File: `src/views/ChatInterface.tsx`
- Props: `{ agentId?, agentName?, agentEmoji? }`
- Description: Two-pane chat — session list sidebar (left), message thread (right). User messages right-aligned violet, assistant messages left-aligned gray. Tool call cards (expandable), streaming indicator, bottom input composer with send button.
- Workflow: Spawned piper sub-agent; file written to disk.

### Task UI-03 — AgentBuilderWizard

- Status: `done`
- Assignee: quinn (spawned sub-agent)
- Priority: P0
- File: `src/views/AgentBuilderWizard.tsx`
- Description: 5-step agent creation flow — template picker (grid cards), identity (name/emoji/role), personality (4 sliders), model selection (3 cards), review + create. Left sidebar step indicator, animated progress. Creates agent on final step.
- Workflow: Spawned quinn sub-agent; file written to disk.

### Task UI-04 — CronScheduleBuilder

- Status: `done`
- Assignee: quinn (spawned sub-agent)
- Priority: P1
- File: `src/views/CronScheduleBuilder.tsx`
- Description: Job management — job cards with status dots, schedule description, next/last run info, Run Now + Enable/Disable actions. New job slide-in panel with agent selector, schedule presets (hourly/daily/weekly/custom cron). Run history per job.
- Workflow: Spawned quinn sub-agent; file written to disk.

### Task UI-05 — AgentSoulEditor

- Status: `done`
- Assignee: reed (spawned sub-agent)
- Priority: P1
- File: `src/views/AgentSoulEditor.tsx`
- Description: File editor — left panel (file tree: AGENTS.md, SOUL.md, etc.), right panel (monospace textarea with line/char count, Cmd+S save, 2s auto-save indicator). Modified files marked with orange dot.
- Workflow: Spawned reed sub-agent; file written to disk.

### Task UI-06 — AgentIdentityCard

- Status: `done`
- Assignee: reed (spawned sub-agent)
- Priority: P1
- File: `src/views/AgentIdentityCard.tsx`
- Description: Agent identity grid — cards with large emoji avatars, role badge, status indicator, personality bars (Formality/Humor/Verbosity/Empathy), skill tags, tool chips. Click card to expand detail panel on right.
- Workflow: Spawned reed sub-agent; file written to disk.

### Task UI-07 — ModelSelector

- Status: `done`
- Assignee: reed (spawned sub-agent)
- Priority: P1
- File: `src/views/ModelSelector.tsx`
- Description: Model library — featured 3-card section (Opus/Sonnet/Haiku), full model table (8+ models), provider filter pills, cost/speed indicators, Set Default action, currently-selected model highlighted.
- Workflow: Spawned reed sub-agent; file written to disk.

### Task UI-08 — SkillsMarketplace

- Status: `done`
- Assignee: wes (spawned sub-agent)
- Priority: P1
- File: `src/views/SkillsMarketplace.tsx`
- Description: Skill management — tabs (Installed/Available/Featured), skill cards with install/configure/update actions, category filter pills, search bar.
- Workflow: Spawned wes sub-agent; file written to disk.

### Task UI-09 — SessionExplorer

- Status: `done`
- Assignee: wes (spawned sub-agent)
- Priority: P1
- File: `src/views/SessionExplorer.tsx`
- Description: Session management table — session key (monospace), agent, status, message count, token usage, cost, last active. Slide-in detail panel (Preview). Filter by status/agent.
- Workflow: Spawned wes sub-agent; file written to disk.

### Task UI-10 — UsageDashboard

- Status: `done`
- Assignee: wes (spawned sub-agent)
- Priority: P1
- File: `src/views/UsageDashboard.tsx`
- Description: Analytics — summary cards (total tokens, cost, requests, avg cost), 30-day CSS-only bar chart, by-model and by-agent horizontal bar breakdowns, top sessions table.
- Workflow: Spawned wes sub-agent; file written to disk.

### Task UI-11 — OnboardingFlow

- Status: `done`
- Assignee: Luis (self-built)
- Priority: P1
- File: `src/views/OnboardingFlow.tsx`
- Description: 4-step onboarding wizard — proficiency quiz (3 questions → Beginner/Standard/Expert), mode selection cards, first-agent template picker, success screen. Left progress sidebar, animated progress pills.
- Workflow: Built directly by Luis.

### Task UI-12 — SettingsDashboard

- Status: `done`
- Assignee: Luis (self-built)
- Priority: P1
- File: `src/views/SettingsDashboard.tsx`
- Description: Sectioned settings — 7 sections (General/Appearance/Notifications/Security/Performance/Data/Advanced). Left nav rail, right content panel. Toggle switches, select inputs, color accent picker, theme switcher, danger zone.
- Workflow: Built directly by Luis.

### Task UI-13 — NodeManager

- Status: `done`
- Assignee: Luis (self-built)
- Priority: P1
- File: `src/views/NodeManager.tsx`
- Description: Device management — node cards (platform icon, status dot, capabilities chips, last seen, IP), pending pairing approval card (approve/reject), detail panel on selection (stats grid, capability list, action buttons), filter tabs.
- Workflow: Built directly by Luis.

### Task UI-14 — AgentConfigReview

- Status: `done`
- Assignee: Luis (self-built)
- Priority: P2
- File: `src/views/AgentConfigReview.tsx`
- Description: AI-powered config review — agent selector, "Run Review" button triggers 2s analysis simulation, score gauge (0–100 SVG ring), review items categorized as good/suggestion/warning/issue, expandable items with auto-fix buttons.
- Workflow: Built directly by Luis.

### Task UI-15 — WorkspaceFileBrowser

- Status: `done`
- Assignee: Luis (self-built)
- Priority: P2
- File: `src/views/WorkspaceFileBrowser.tsx`
- Description: File tree browser — collapsible directory tree (left panel), file content viewer/editor (right). File type icons, syntax language tags, edit mode (textarea), save/cancel, download, copy, delete. Status bar with line/char count.
- Workflow: Built directly by Luis.

### Task UI-16 — ProviderAuthManager

- Status: `done`
- Assignee: Prior session (pre-existing)
- Priority: P0
- File: `src/views/ProviderAuthManager.tsx`
- Description: Provider OAuth management — grid cards per provider (Anthropic, OpenAI, MiniMax, etc.), connected/expired/error states with usage sparklines, connect via wizard.start flow.

### Upcoming / Backlog

**Task UI-TYPES — Full Gateway RPC integration (replace mock data)**

- Status: `unclaimed`
- Priority: P2
- Assignee: TBD
- Description: Replace all mock data in views with real Gateway `call()` invocations. Wire up WebSocket events for real-time updates. Add loading/error/refetch states.
- Workflow:
  1. Implement Zustand stores (gateway, agents, sessions, chat, cron, proficiency, ui)
  2. Wire each view to its Gateway methods (see UI_SPEC.md §8.1 for method mapping)
  3. Replace MOCK\_\* imports with store selectors
  4. Add error boundary wrapping all routes

**Task UI-ADAPTIVE — Adaptive UX proficiency system**

- Status: `unclaimed`
- Priority: P2
- Assignee: Luis
- Description: Implement ProficiencyStore (Zustand), ComplexityGate component, AdaptiveLabel component, proficiency switcher in sidebar footer. Wire OnboardingFlow quiz results to proficiency store. Adjust nav items by level.
- Spec: UI_SPEC.md §5

**Task UI-SHELL — App shell polish**

- Status: `unclaimed`
- Priority: P2
- Assignee: TBD
- Description: Sidebar responsive collapse (hamburger on mobile), command palette (Cmd+K), connection status dot in topbar, keyboard shortcut overlay (? key). Currently App.tsx is a basic sidebar nav.

**Task UI-A11Y — Accessibility audit**

- Status: `unclaimed`
- Priority: P2
- Assignee: TBD
- Description: WCAG 2.1 AA audit: keyboard navigation, ARIA landmarks, focus management, skip-to-content, reduced motion, color contrast. Target Lighthouse accessibility score > 95.

### Build Status

- **Last clean build:** 2026-02-21 ~4:40 PM MST
- **Output:** `dist/` — all 16 view bundles + shared chunks, ✓ 1.41s build time
- **No TypeScript errors**

### Squad Composition (Horizon)

| Role      | Agent | Responsibility                                     |
| --------- | ----- | -------------------------------------------------- |
| Lead      | Luis  | Architecture, spec, delegation, QA, direct builds  |
| Sub-agent | piper | AgentDashboard, ChatInterface                      |
| Sub-agent | quinn | AgentBuilderWizard, CronScheduleBuilder            |
| Sub-agent | reed  | AgentSoulEditor, AgentIdentityCard, ModelSelector  |
| Sub-agent | wes   | SkillsMarketplace, SessionExplorer, UsageDashboard |

---

## Blockers Requiring David's Action

These items are blocked on human intervention:

| ID     | Blocker                            | Required Action                                               | Priority |
| ------ | ---------------------------------- | ------------------------------------------------------------- | -------- |
| BLK-01 | GitHub CLI not fully authenticated | David runs `gh auth login`                                    | P0       |
| BLK-02 | Brave API key not configured       | David configures Brave API key                                | P1       |
| BLK-03 | `openclaw doctor --fix` regression | David runs `openclaw doctor --fix` (Slack dm.policy→dmPolicy) | P1       |
| BLK-04 | Multiple state directories         | Consolidate `/Users/dgarson/.openclaw` + `~/.openclaw`        | P1       |
| BLK-05 | Cost optimization approval         | David reviews & approves model right-sizing changes           | P1       |
| BLK-06 | Routing optimization approval      | David reviews Julia's routing proposal                        | P1–P2    |

---

## Infrastructure & Ops (Miscellaneous)

**Task OPS-01 — Non-Anthropic tool-calling reliability**

- Status: `unclaimed`
- Priority: P1
- Owner: Amadeus (analysis) + Tim (implementation)
- Description: MiniMax M2.5 and GLM-5 produce malformed tool calls ~15% of the time. Affects mid/senior discovery agents.
- Workflow: Evaluate tool-compatibility layer or model-specific prompt tuning.

**Task OPS-02 — Agent heartbeat enablement**

- Status: `unclaimed`
- Priority: P2
- Owner: Merlin (config)
- Description: Only `main` has heartbeat enabled (2h). Tim, Xavier, Amadeus should have periodic heartbeats for proactive work.

**Task OPS-03 — Memory file naming standardization**

- Status: `unclaimed`
- Priority: P2
- Owner: Any agent
- Description: Standardize daily memory files to one canonical daily file (`YYYY-MM-DD.md`) with timestamped entries inside. Currently 15 files with mixed naming patterns.

**Task OPS-04 — Workq plugin provenance**

- Status: `unclaimed`
- Priority: P2
- Owner: Tim or Merlin
- Description: Pin workq extension trust via `plugins.allow` or install records. Doctor warning.

**Task OPS-05 — Model-task performance matrix**

- Status: `unclaimed`
- Priority: P2
- Owner: Amadeus
- Description: Build lightweight eval harness + empirical benchmarks. 26 agents on 6+ model families, zero empirical data on per-task-class performance.
- Workflow: Design eval framework → instrument real agent task outputs → accuracy/latency/cost scoring → living matrix.

**Task OPS-06 — Agent failure recovery patterns**

- Status: `unclaimed`
- Priority: P2
- Owner: Amadeus + Tim
- Description: Define 3 standard recovery patterns: retry-with-backoff, model-fallback-cascade, task-reassignment. No defined patterns today.

**Task OPS-07 — Integration testing & CI pipeline**

- Status: `unclaimed`
- Priority: P2
- Owner: Xavier (CTO)
- Team/Squad: Platform + QA (Xavier/Tim + staff delegates)
- Description: No automated regression testing across the multi-agent system. Need: extension build verification, cron job smoke tests, basic agent spawn/respond integration tests.
- Workflow:
  1. Define minimum CI gate (build + smoke + targeted integration).
  2. Add pipeline jobs for extension build verification.
  3. Add cron job smoke checks and agent spawn/respond smoke checks.
  4. Set fail-fast policy and merge protections.
- Notes: Workq test suite (39/39 vitest) is a good pattern to follow.

**Task OPS-08 — Memory indexing health recovery (main session)**

- Status: `unclaimed`
- Priority: P1
- Owner: Drew (analysis) + Tim (execution)
- Team/Squad: Platform reliability
- Description: Memory index for `agent:main` is reporting dirty with zero indexed files/chunks, which degrades retrieval quality.
- Workflow:
  1. Reproduce current status via `openclaw status` and `openclaw memory status --agent main`.
  2. Run controlled reindex (`openclaw memory index --agent main --force`).
  3. Validate indexed file/chunk counts and query behavior.
  4. Add guardrail/alert to catch future dirty-empty states.
- Notes: This surfaced in heartbeat monitoring and should be cleared before weekday load.

---

## Project: AI Intelligence Layer — System Improvements

**Priority:** P1 — Direct request from David (CEO)
**Owner:** Amadeus (CAIO)
**Brainstorm Doc:** `/Users/openclaw/.openclaw/workspace/amadeus/brainstorm-2026-02-21-system-improvements.md`
**Status:** 3 of 5 ideas had prototype sub-agents spawned (2026-02-21 ~02:45 MST); sub-agents were lost when session ended. Prototypes need re-execution.

**Background:** David identified two key improvement areas: (1) intelligent classification of complexity/problem space → route to right model/thinking level, and (2) classification-augmented session priming. Amadeus expanded this to 5 concrete engineering improvements. Ideas #1-3 are Phase 1 (immediate); Ideas #4-5 are Phase 2 (build on #1-3).

### Phase 1: Immediate (P1)

**Task INTEL-01 — Intent Classifier + Dynamic Model Router**

- Status: `unclaimed` (prototype lost — needs re-execution)
- Assignee: Amadeus (design) + implementation TBD
- Priority: P1
- Effort: Medium (2-8h)
- Description: Lightweight pre-processing layer classifying incoming messages by complexity, domain, and required capabilities → routes to optimal model/thinking level. Currently every message gets Opus + thinking:high, even trivial queries. Rules-based Phase 1, optional lightweight model classifier Phase 2.
- Key files: `src/agents/intent-classifier.ts`, `src/agents/dynamic-model-router.ts`
- Integration point: `pi-embedded-runner.ts` before model selection
- Expected impact: 80%+ of messages are simple/moderate → 40-60% latency reduction
- Workflow:
  1. Design classification schema (complexity × domain × capabilities)
  2. Implement rules-based classifier
  3. Implement router mapping (classification → model + thinking level)
  4. Integration with runner
  5. Eval: measure latency/quality impact on representative tasks
- Cross-ref: Feeds into COST-01 (model right-sizing) and ROUTE-01 (tiered routing)

**Task INTEL-02 — Adaptive Session Priming (Context-Aware Prompt Assembly)**

- Status: `unclaimed` (prototype lost — needs re-execution)
- Assignee: Amadeus (design) + implementation TBD
- Priority: P1
- Effort: Medium (2-8h)
- Description: Instead of loading same ~200k context for every message, dynamically assemble prompt based on classified intent. A "set a reminder" request doesn't need full AGENTS.md + 14 memory files. Extends existing `PromptMode` ("full"/"minimal"/"none") to be classification-driven.
- Key files: `src/agents/context-assembler.ts`, extends `buildAgentSystemPrompt()`
- Expected impact: 30%+ token cost reduction, reduced needle-in-haystack degradation
- Workflow:
  1. Design context priority scoring for workspace files
  2. Define prompt assembly rules per classification output
  3. Implement context assembler with token budget allocation
  4. Integration with buildAgentSystemPrompt()
  5. Eval: measure token savings + quality maintenance
- Depends on: INTEL-01 (uses classification output)

**Task INTEL-03 — Tool-Calling Compatibility Layer for Non-Anthropic Models**

- Status: `unclaimed` (prototype lost — needs re-execution)
- Assignee: Amadeus (design) + implementation TBD
- Priority: P1
- Effort: Medium (2-8h)
- Description: Middleware that normalizes and validates tool calls from non-Anthropic models (MiniMax M2.5, GLM-5). Handles: malformed JSON, missing params, wrong types, tool name mismatches, duplicate IDs, tool calls embedded in text. Attempts repair before retrying. Tracks per-model success rates.
- Key files: `src/agents/tool-call-validator.ts`, `src/agents/tool-call-repair.ts`
- Integration: `pi-embedded-subscribe.handlers.tools.ts` — intercept before execution
- Expected impact: Non-Anthropic tool call success rate from ~85% → 98%+
- Workflow:
  1. Catalog per-model failure modes (from production observation)
  2. Implement JSON repair + type coercion + fuzzy name matching
  3. Implement retry-with-correction for unfixable cases
  4. Per-model config for known quirks
  5. Telemetry: log repair attempts and success rates
- Cross-ref: Overlaps with OPS-01 (same problem, this is the implementation approach)

### Phase 2: Foundation-Dependent (P2)

**Task INTEL-04 — Model Performance Telemetry & Auto-Evaluation**

- Status: `unclaimed`
- Assignee: Amadeus (design) + Drew (data pipeline)
- Priority: P2
- Effort: Large (>8h)
- Description: Instrument every model call with structured telemetry: p50/p95 latency, tokens/sec, error rate, tool call success rate, per-task-type performance. Store as JSONL, surface via CLI dashboard. Phase 2: feedback loop into router decisions.
- Key files: `src/agents/telemetry.ts`, `~/.openclaw/telemetry/`
- Workflow:
  1. Define telemetry schema
  2. Hook into runner + subscribe layers
  3. JSONL storage + rotation
  4. CLI summary command
  5. Phase 2: auto-routing feedback integration
- Cross-ref: Overlaps with TEL-01 (telemetry extension). Coordinate to avoid duplication — this may become a component of TEL-01 rather than standalone.

**Task INTEL-05 — Cascading Model Fallback with Quality Gates**

- Status: `unclaimed`
- Assignee: Amadeus (design) + Tim (implementation)
- Priority: P2
- Effort: Medium (2-8h)
- Description: Extend existing `model-fallback.ts` to handle _quality_ failures, not just auth/rate-limit failures. If a model produces malformed tool calls 3x, auto-cascade to a more capable model for that session. Budget controls prevent Opus escalation for trivial tasks. Cascade resets per-session.
- Cascade chain: GLM-5/MiniMax M2.5 → Sonnet 4.6 → Opus (critical only)
- Workflow:
  1. Define quality gates (tool validity, response coherence, task completion signals)
  2. Implement quality-aware cascade logic
  3. Budget controls per agent tier
  4. Alert on consistent cascading (model selection review signal)
  5. Integration with tool-call-validator for quality signal
- Depends on: INTEL-03 (tool validation) + INTEL-04 (telemetry)

---

## Project: AI Strategic Roadmap — R&D Pipeline

**Priority:** P2–P3 (research/backlog — no immediate execution)
**Owner:** Amadeus (CAIO)
**Full Doc:** `/Users/openclaw/.openclaw/workspace/amadeus/brainstorm-roadmap-2026-02-21.md` (12 ideas, 5 categories)
**Status:** Brainstorm complete, items catalogued for future prioritization

These are strategic R&D items identified by Amadeus. Items already tracked as separate projects above are noted with cross-references. Remaining items are staged for future prioritization cycles.

**Task RD-01 — Unified Model Abstraction Layer (Capabilities API)**

- Status: `backlog`
- Priority: P2 (phased: P2 capability tagging → P3 full abstraction)
- Owner: Amadeus (design) + Xavier (architecture)
- Description: Provider-agnostic capabilities API. Agents request _capabilities_ (tool-calling, vision, structured output), platform resolves to best available model. Decouples agent logic from model identity. Enables seamless provider switching on outage/price changes.
- Recommendation: Phase 1 (capability tagging) is tractable now. Full abstraction is 2-3 quarter journey.
- Cross-ref: INTEL-01 (dynamic routing is a subset), INTEL-03 (tool compat is a prerequisite)

**Task RD-02 — Agent Self-Reflection & Metacognition Layer**

- Status: `backlog`
- Priority: P2
- Owner: Amadeus
- Description: Periodic self-evaluation prompts (end-of-session, every N messages). Agents review own performance, identify failure patterns, adapt strategies. Structured self-evaluation feeds into agent config adjustments. Cheap (single short prompt), actionable (produces behavioral change).
- Recommendation: Start simple — end-of-session reflection appended to daily memory. Evolve toward structured self-eval.
- Cross-ref: Independent, but feeds into RD-05 (skill acquisition)

**Task RD-03 — Persistent Agent Learning via Skill Acquisition**

- Status: `backlog`
- Priority: P2–P3
- Owner: Amadeus
- Description: Agents crystallize successful multi-step workflows into reusable structured skills. Agent A solves complex workflow → encodes as skill → Agent B picks it up. Feeds ClawhHub ecosystem.
- Depends on: RD-02 (self-reflection), Skills system maturity
- Recommendation: Start with agents writing "playbooks" for complex solutions. Formalize format later.

**Task RD-04 — Contextual Tool Selection & Tool Chaining Intelligence**

- Status: `backlog`
- Priority: P2
- Owner: Amadeus + Tim
- Description: Dynamically present only relevant tools per task (reducing context bloat). Define optimal tool-use sequences for common patterns. Phase 1: tool filtering by intent classification (integrates with INTEL-01). Phase 2: template chains. Phase 3: learned chains from telemetry.
- Depends on: INTEL-01 (intent classification), INTEL-04 (tool usage telemetry)

**Task RD-05 — Agent Reputation & Trust System**

- Status: `backlog`
- Priority: P3
- Owner: Amadeus + Julia
- Description: Data-driven capability profiling per agent per task type. Agents earn trust through demonstrated competence. Influences task routing, review requirements, autonomy levels. Start with data collection only.
- Depends on: INTEL-04 (telemetry), task completion tracking

**Task RD-06 — Collective Memory & Knowledge Graph**

- Status: `backlog`
- Priority: P3
- Owner: Amadeus + Drew
- Description: Shared knowledge graph across agent org — entities, relationships, decisions, learnings. Phase 1: standardized shared decision/discovery logs. Phase 2: structured searchable index. Phase 3: true graph DB.
- Cross-ref: ACP project (communication layer), Session Summarization (feeds knowledge)

**Task RD-07 — Fine-Tuned OpenClaw Agent Models (Distillation Pipeline)**

- Status: `backlog`
- Priority: P3 (data collection starts P2)
- Owner: Amadeus
- Description: Distill high-quality Opus sessions into fine-tuned smaller models. "OpenClaw-7B" for routine tasks at 1/100th cost. Start collecting/tagging training data now; fine-tuning experiments Q4 2026.
- Depends on: INTEL-04 (session quality identification), data consent framework (Tyler)

**Task RD-08 — Autonomous Goal Decomposition & Long-Running Task Management**

- Status: `backlog`
- Priority: P3
- Owner: Amadeus + Tim
- Description: High-level goal → autonomous decomposition → multi-agent execution → progress tracking → delivery. The "holy grail" — delegation of complex projects to AI teams.
- Depends on: ACP (communication), RD-05 (reputation), RD-02 (self-reflection), reliable task tracking

**Task RD-09 — Distributed Agent Execution (Edge + Cloud Hybrid)**

- Status: `backlog`
- Priority: P3
- Owner: Xavier (architecture) + Amadeus (strategy)
- Description: Hybrid execution model: local (privacy), cloud (availability/team), edge (devices). Gateway evolves from local process to coordination layer. Essential for team/enterprise scaling.
- Recommendation: Design architecture now; build incrementally H2 2026+.

**Task RD-10 — Intelligent Context Window Management (Beyond Compaction)**

- Status: `backlog`
- Priority: P2–P3
- Owner: Amadeus + Tim
- Description: Hierarchical context with semantic retrieval. Active working memory + session memory (summarized, retrievable) + long-term memory (workspace files, semantic query). RAG for agent memory. Reduces compaction-related quality loss.
- Depends on: Embedding infrastructure, vector storage, retrieval-augmented prompt construction

---

## Project: Budget Management Findings (Deep Investigation)

**Priority:** P1–P2
**Owner:** Amadeus (CAIO)
**Findings Doc:** `/Users/openclaw/.openclaw/workspace/amadeus/findings/budget-management-findings-2026-02-21.md`
**Status:** Investigation complete, findings documented. Feeds into EA-02.

**Key Findings (for reference — no separate tasks, feeds EA-02):**

- Provider usage infrastructure already tracks 8 providers with percentage-based utilization + reset timestamps
- Claude exposes per-model-tier usage (Sonnet vs Opus separately) as 7-day utilization percentages
- Codex has dual-window rate limits (3h + 24h)
- `loadProviderUsageSummary()` fetches all providers in parallel (~5s worst case) — acceptable for periodic checks, not per-message
- Session-level cost tracking exists (retrospective, from transcript JSONL) — tells what you _spent_, not what you _have left_
- Both provider-level (remaining budget) and session-level (spent cost) data needed for budget governor

---

## Backlog / Someday (P3)

| ID    | Description                              | Owner   | Notes                                                    |
| ----- | ---------------------------------------- | ------- | -------------------------------------------------------- |
| P3-01 | Local LLM evaluation (Ollama + RTX 5090) | Amadeus | Cost-effective for repetitive tasks if hardware acquired |
| P3-02 | Richer experiential logging format       | Amadeus | Lightweight journaling in daily memory template          |
| P3-03 | Workflow starter packs (product)         | Drew    | Package 2-3 high-value workflows as one-click templates  |

---

## Project: OpenClaw Horizon UI — Production Build (v2)

**Priority:** P1 (shipped) → P1 PR merge pending
**Owner:** Luis (Principal UX Engineer)
**Repo:** `dgarson/clawdbot`
**Branch:** `luis/ui-redesign`
**App Location:** `/Users/openclaw/openclaw-ui-redesign/apps/web/`
**Stack:** Vite 7.3 + React 19 + TanStack Router (file-based, 29 routes) + Radix UI/Shadcn + Zustand + Framer Motion + TanStack Query + Lucide
**Squad:** Luis (lead) + Piper (heatmap) + Wes (Monaco) — subagents via isolated sessions
**Build:** ✅ `pnpm build` → 3,358 modules, 7s, zero errors (last verified 2026-02-21 ~3:43 PM MST)
**Note:** This is a separate, more complete production codebase from the Horizon UI prototype (`apps/web-next/`). 424 source files, real gateway RPC integration, full Radix/Shadcn design system.

### Task HRZ2-01 — P0: Brand + greeting fixes

- Status: `done`
- Assignee: Luis
- Priority: P0
- Commit: `a04c0a397`
- Workflow (completed):
  1. Removed all "Second Brain" references from `Sidebar.tsx`, `App.tsx`, `filesystem/index.tsx` → "OpenClaw"
  2. Home page: replaced hardcoded `"User!"` with live `useUserProfile()` hook → dynamic greeting

### Task HRZ2-02 — P1: Gateway log viewer (`/logs`)

- Status: `done`
- Assignee: Luis
- Priority: P1
- Commit: `9d79c3b4a`
- Workflow (completed):
  1. New route `src/routes/logs/index.tsx` (515 lines)
  2. `logs.tail` RPC with cursor-based polling (3s)
  3. Level filters (trace/debug/info/warn/error/fatal), text search, auto-follow scroll
  4. Pause/resume, JSONL export, dark terminal-style table with color-coded levels

### Task HRZ2-03 — P1: Usage analytics dashboard (`/analytics`)

- Status: `done`
- Assignee: Luis
- Priority: P1
- Commit: `2442ab470`
- Workflow (completed):
  1. New route `src/routes/analytics/index.tsx` (701 lines)
  2. Parallel `sessions.usage` + `usage.cost` gateway RPCs
  3. Stat cards, CSS-only bar charts (no charting library), model/agent/tool breakdowns
  4. Session table sortable by cost

### Task HRZ2-04 — P1: Route-level error boundary

- Status: `done`
- Assignee: Luis
- Priority: P1
- Commit: `ab6be3997`
- Workflow (completed):
  1. `RouteErrorComponent` in `__root.tsx` with `useRouter()` for router-aware recovery
  2. `router.invalidate()` retry and `router.navigate({ to: "/" })` home recovery
  3. Applied as `errorComponent` on `createRootRoute()`

### Task HRZ2-05 — P1: Loading skeleton audit (all 31 routes)

- Status: `done`
- Assignee: Luis
- Priority: P1
- Commit: `ab6be3997` (same sprint)
- Workflow (completed):
  1. Audited all 31 routes for loading states
  2. Verified `PageSkeletons.tsx` provides 7 content-shaped skeletons (HomeSkeleton, AgentListSkeleton, etc.)
  3. All routes confirmed to have appropriate loading states

### Task HRZ2-06 — P1/P2: Accessibility, a11y, i18n, UX polish (subagent sprint)

- Status: `done`
- Assignee: Subagent sprint (Luis-directed)
- Priority: P1–P2
- Commits: `eb51c350c` through `ed44fe634` (7 commits)
- Workflow (completed):
  1. Skip nav, reduced motion CSS, keyboard support, ARIA landmarks (`eb51c350c`)
  2. Route announcer + dynamic `document.title` (`88f136834`)
  3. Agent activity feed widget on home dashboard (`e6bb3c87b`)
  4. Agent status indicators on avatars (`c6a1309e3`)
  5. Keyboard shortcuts discoverability badge (`9e773c3f4`)
  6. Dark mode color contrast improvements (`b6b7d9a50`)
  7. i18n infrastructure — en/pt-BR/zh-CN/zh-TW via `react-i18next` (`ed44fe634`)

### Task HRZ2-07 — P3: Monaco editor integration for agent file editing

- Status: `done`
- Assignee: Wes (subagent, GLM-4.7-flash)
- Priority: P3
- Commit: `e0900f271` (merged `luis/monaco-editor`)
- Workflow (completed):
  1. Installed `@monaco-editor/react ^4.7.0`
  2. Created `MonacoFileEditor.tsx` with `React.lazy()`, language detection, vs-dark theme
  3. Updated `AgentFileEditor.tsx` — replaced `<textarea>` with Monaco component
  4. Preserved Cmd+S save binding; fallback skeleton while Monaco loads

### Task HRZ2-08 — P3: Agent relationship graph (`/agents/graph`)

- Status: `done`
- Assignee: Luis
- Priority: P3
- Commit: `9e9e905bc`
- Workflow (completed):
  1. New route `src/routes/agents/graph.tsx` + `graph.lazy.tsx`
  2. Session key parser — infers spawn edges from `agent:{parent}:subagent:{child}` pattern
  3. `buildAgentGraph()` → `GraphData<AgentNodeData, AgentEdgeData>` from live gateway data
  4. ReagraphView integration — health-based node coloring (emerald=active, amber=idle, orange=stalled, red=errored)
  5. CSS fallback hierarchical tree view when reagraph unavailable
  6. Slide-in detail panel on node click (task, model, tokens, cost, links)
  7. Stats bar + legend + 15s auto-refresh
  8. "Agent Graph" link in sidebar Team section; "Graph View" button in agent-status header

### Task HRZ2-09 — P3: Activity heatmap on agent-status dashboard

- Status: `done`
- Assignee: Piper (subagent, Gemini 3 Flash)
- Priority: P3
- Commit: `851c16ec1`
- Workflow (completed):
  1. Created `ActivityHeatMap.tsx` in `src/components/domain/agent-status/`
  2. 24h × 7d grid, CSS intensity classes, tooltip on hover
  3. Derives timestamps from `snapshot.agents[].lastActivityAt`
  4. Exported from domain index; wired into `/agent-status` page

### Task HRZ2-10 — P3: Chat-driven agent builder (`/agents/new`)

- Status: `done`
- Assignee: Luis
- Priority: P3
- Commit: `bfb308bec`
- Workflow (completed):
  1. New route `src/routes/agents/new.tsx` + `new.lazy.tsx`
  2. NLP parser: extracts name, role (8 categories), tags (15 domains), model preference, personality
  3. Split-panel UI: chat (left) + live config preview (right)
  4. Framer Motion flash-highlight on field updates; all fields manually editable
  5. Readiness checklist → "Create Agent" enabled when name + description filled
  6. 5 suggested starter prompts; animated typing indicator
  7. `useCreateAgent()` integration → navigates to agent config on creation
  8. "Chat Builder" secondary button added to agents list page header

### Task HRZ2-11 — Post-sprint fixes + code quality

- Status: `done`
- Assignee: Luis
- Priority: P1–P2
- Commits: `070c004c9`, `e32e5418a`
- Workflow (completed):
  1. Fixed `createAgent.mutateAsync` — added required `status: "offline"` field (was a type bug)
  2. Added "Graph View" ghost button in agent-status header → `/agents/graph`
  3. Removed `"use client"` Next.js directive from 8 Vite source files (subagent contamination)

### Task HRZ2-PR — Merge mega-branch PR #44: `luis/ui-redesign` → `dgarson/fork`

- Status: `in-review`
- Assignee: Tim (engineering review) + Xavier (product review)
- Priority: P1
- PR: <https://github.com/dgarson/clawdbot/pull/44|#44> `feat(ui): UI Redesign mega-branch — agent graph, chat builder, activity heatmap, Monaco editor, UX polish`
- Team/Squad: Luis (author) + Tim (engineering reviewer) + Xavier (product reviewer)
- Workflow:
  1. ✅ Branch rebased against `dgarson/fork`
  2. ✅ `pnpm build` clean (3,358 modules, zero errors)
  3. ✅ PR #44 open and `MERGEABLE`
  4. 🔲 Tim: engineering review (TypeScript, patterns, architecture)
  5. 🔲 Xavier: product review (UX direction, feature completeness)
  6. 🔲 Luis: address feedback (one revision cycle)
  7. 🔲 Merge to `dgarson/fork`
- Notes: No reviews yet as of 2026-02-21 9:03 PM MST. PR description includes full feature inventory and reviewer-specific notes.

---

## Board Summary (2026-02-21 17:50 MST — updated by Luis)

| Project                                          | Total Tasks | Done   | In-Progress | Blocked | Unclaimed | Backlog |
| ------------------------------------------------ | ----------- | ------ | ----------- | ------- | --------- | ------- |
| workq Extension                                  | 11          | 11     | 0           | 0       | 0         | 0       |
| ACP Protocol (P0)                                | 9           | 2      | 1           | 1       | 5         | 0       |
| ACP Protocol (P1 Design)                         | 5           | 2      | 3           | 0       | 0         | 0       |
| ACP Protocol (Cross-cut Specs)                   | 1           | 1      | 0           | 0       | 0         | 0       |
| AI Intelligence Layer (P1)                       | 3           | 0      | 0           | 0       | 3         | 0       |
| AI Intelligence Layer (P2)                       | 2           | 0      | 0           | 0       | 2         | 0       |
| AI Strategic Roadmap (R&D)                       | 10          | 0      | 0           | 0       | 0         | 10      |
| Telemetry Extension                              | 1           | 0      | 0           | 0       | 1         | 0       |
| Session Summarization                            | 3           | 0      | 0           | 0       | 3         | 0       |
| Testing Protocol                                 | 1           | 0      | 0           | 0       | 1         | 0       |
| Cost Optimization                                | 2           | 0      | 0           | 0       | 2         | 0       |
| Routing Optimization                             | 2           | 0      | 0           | 0       | 2         | 0       |
| EA + Budget Governor                             | 2           | 0      | 2           | 0       | 0         | 0       |
| Discovery System                                 | 3           | 1      | 0           | 0       | 2         | 0       |
| PR Backlog                                       | 4           | 1      | 3           | 0       | 0         | 0       |
| OAuth Integration                                | 1           | 1      | 0           | 0       | 0         | 0       |
| Horizon UI (prototype, apps/web-next)            | 20          | 16     | 0           | 0       | 4         | 0       |
| **Horizon UI v2 (production, luis/ui-redesign)** | **12**      | **11** | **1**       | **0**   | **0**     | **0**   |
| Infrastructure/Ops                               | 8           | 0      | 0           | 0       | 8         | 0       |
| Backlog/Someday (P3)                             | 3           | 0      | 0           | 0       | 0         | 3       |
| **TOTALS**                                       | **102**     | **46** | **9**       | **1**   | **34**    | **13**  |

---

## Project: Full Observability Stack

**Priority:** P0 — Overnight, burn Codex credits
**Owner:** Xavier (engineering) + Tim (architecture review)
**Kickoff:** Luis (UX) + Amadeus (AI telemetry)
**Spec:** `_shared/OBS_STACK_SPEC.md`
**Mega-branch:** `observability/main` (from `dgarson/fork`)
**Created:** 2026-02-21 22:05 MST by Merlin

### Sub-branches + Tasks

**OBS-01 — OTel Core Instrumentation** | `observability/otel-core`

- Status: `in-progress` — Merlin (spawned 2026-02-21 23:02 MST)
- Model: opus
- PR target: `observability/main`
- Deliverables: `src/telemetry/{otel,tracer,metrics,logger}.ts`, session span lifecycle, tool span via UTEE
- Spec: `/Users/openclaw/.openclaw/workspace/_shared/OBS_STACK_SPEC.md` §Phase 1

**OBS-02 — Prometheus /metrics Endpoint** | `observability/prometheus-exporter`

- Status: `in-progress` — Merlin (spawned 2026-02-21 23:02 MST)
- Model: opus
- PR target: `observability/main`
- Deliverables: `/metrics` HTTP endpoint, 6 metric families, per-agent/model labels
- Spec: `/Users/openclaw/.openclaw/workspace/_shared/OBS_STACK_SPEC.md` §Phase 2

**OBS-03 — Docker Compose Observability Stack** | `observability/docker-stack`

- Status: `done` — PR #55 merged → `observability/main` (2026-02-22 00:11 MST)
- Model: opus
- Deliverables: `observability/docker-compose.observability.yml`, Prometheus config, Grafana provisioning, 5 dashboards, Loki + Promtail, Jaeger, AlertManager (1799 lines added)
- Spec: `/Users/openclaw/.openclaw/workspace/_shared/OBS_STACK_SPEC.md` §Phase 3

**OBS-04 — A/B Testing + Experiment Tracking** | `observability/experiments`

- Status: `done` — PR #56 merged → `observability/main` (2026-02-22 00:11 MST)
- Model: minimax-m2.5 (flags) + zai/glm-5 (schema)
- Deliverables: `src/experiments/{flags,context,schema,index}.ts` + tests, Grafana A/B dashboard (1140 lines added)
- Spec: `/Users/openclaw/.openclaw/workspace/_shared/OBS_STACK_SPEC.md` §Phase 4

**OBS-05 — Analytics UI Wire-up** | `observability/analytics-ui`

- Status: `in-progress` — Merlin (spawned 2026-02-21 23:02 MST)
- Model: minimax-m2.5
- PR target: `observability/main`
- Deliverables: UsageDashboard on real data, Agent Activity Dashboard, Session Replay, A/B Dashboard, Cost Optimization view
- Spec: `/Users/openclaw/.openclaw/workspace/_shared/OBS_STACK_SPEC.md` §Phase 5

**OBS-06 — Regression Harness + Cost Optimizer** | `observability/regression-harness`

- Status: `done` — PR #57 merged → `observability/main` (2026-02-22 00:10 MST)
- Completed: 2026-02-21 23:17 MST (Merlin)
- Deliverables: `scripts/regression-check.ts`, `scripts/weekly-telemetry-digest.ts`, `openclaw telemetry {cost-optimize,regression,baselines}` CLI, 15 tests, cron docs
- Spec: `/Users/openclaw/.openclaw/workspace/_shared/OBS_STACK_SPEC.md` §Phase 6

### Architecture Decisions Locked

- **Tracing backend:** Jaeger (native OTLP, best UX, adaptive sampling)
- **Metrics:** Prometheus pull model (`/metrics` endpoint)
- **Logs:** pino, per-agent files at `~/.openclaw/logs/agents/{id}/YYYY-MM-DD.jsonl`, daily rotation + 30-day retention
- **OTel location:** `src/telemetry/` (core) + `extensions/observability/` (dashboard/CLI)
- **Docker:** Isolated `docker-compose.observability.yml` connects to app via Prometheus scrape URL

## Review Queue Policy Update (2026-02-21)

- Final senior review lane (Tim + Xavier) now runs at **consolidated megabranch** level, not incremental PR level.
- Incremental PR review/merge is delegated to Luis lane unless a P0 safety/security incident is declared.
- **Codex 5.3 Medium/High sweep is required before senior final review starts.**
- Senior review bar: architecture, correctness, security.
- Small isolated fixes can be patched directly during final review; non-trivial issues are returned to owning medium-tier engineer.
