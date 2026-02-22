# Platform Issue: workq Enforcement — Session-End Auto-Release + Sweep Cron + Commit Convention

**For:** Tim (platform team)  
**Filed by:** Merlin  
**Date:** 2026-02-22  
**workq ref:** `openclaw/openclaw#bs-wq-enforce`  
**Priority:** Critical

---

## Problem Statement

Agents complete work but do not call `workq_done`. Items remain stuck in `claimed` or `in-progress` indefinitely. When a morning sweep or assessment runs, stale items look like abandoned work and get reassigned — causing duplicated effort on already-completed tasks.

**Evidence from today:** 0 items marked `done` in workq despite 15+ commits landing since yesterday afternoon. Sam completed `bs-sys-1`, Roman completed `bs-tim-5`, multiple UX items scaffolded — none closed. Merlin's morning reset re-assigned already-done work.

**Root causes:**

1. Agents forget to call `workq_done` (behavioral)
2. Agents run out of context mid-flight and session ends without cleanup (structural)
3. Spawn templates didn't mandate the step explicitly (fixed today in Layer 1)

Layer 1 (template text) is in place. This issue covers the platform-level Layers 2, 3, and 4.

---

## Deliverable 1 — `openclaw workq sweep` Command (Layer 2)

A CLI command + cron that automatically reconciles stale items.

### Behavior

```
openclaw workq sweep [--dry-run] [--stale-after <minutes>] [--auto-done] [--auto-release]
```

1. **Find stale items:** Query items in `in-progress` or `claimed` with `updatedAt` older than `--stale-after` (default: 120 minutes)
2. **Cross-reference git log:** For each stale item, search recent commits for:
   - Commit message containing the item ref (e.g., `bs-sys-1`, `bs-tim-5`)
   - Or a `closes #<ref>` / `refs #<ref>` pattern (see Layer 4 convention)
3. **Auto-advance if commit found:**
   - `--auto-done`: mark item `done` with note "auto-closed: matching commit found"
   - Default (no flag): mark item `in-review` with note "auto-advanced: unconfirmed commit match — please verify"
4. **Auto-release if no commit found:**
   - `--auto-release`: release item back to unclaimed with note "auto-released: stale with no commit evidence"
   - Default: mark item with a `stale` annotation but leave status unchanged (flag for human review)
5. **Output:** summary table of actions taken; `--dry-run` shows what would happen without executing

### Cron Registration

Register as a recurring cron every 60 minutes on the platform cron schedule. Notify `#cb-notifications` if any items are auto-advanced or auto-released.

---

## Deliverable 2 — `session_end` / `agent_end` Hook in workq Plugin (Layer 3)

This is the highest-value deliverable. It makes the system **self-healing regardless of agent behavior.**

### Behavior

When an agent session ends (via `agent_end` or `session_end` hook already registered in the telemetry plugin):

1. **Look up claimed items:** Query workq DB for all items where `claimedBy` matches the ending session's agent ID
2. **Check final status:** If any items are still in `claimed` or `in-progress`:
   - **Auto-release to `claimed`** (unclaimed/available state) with note: "auto-released: session ended without workq_done"
   - This unblocks the item immediately — any other agent can pick it up
3. **Exception: `in-review`** — leave these alone; they've advanced past execution and may be waiting for a reviewer
4. **Log the action** to the workq item's audit trail

### Why Release, Not Done

Auto-marking `done` on session end would be incorrect — we don't know if the work was actually complete. Auto-releasing back to `claimed` is safe: the item becomes available again, a new agent can claim it, and if the work was already done the new agent will find the commits and move quickly. Worst case: slight duplication. Best case: nothing happens (no agent picks it up because leads see commits already exist).

### Hook Integration

The telemetry plugin already fires `agent_end` and `session_end`. Add a new hook registration in the workq plugin:

```typescript
// extensions/workq/src/hooks.ts
import { registerHook } from "openclaw/plugin-sdk";
import { WorkqDatabase } from "./db";

registerHook("agent_end", async ({ agentId, sessionKey }) => {
  const db = new WorkqDatabase();
  const stuckItems = await db.findItemsByAgent(agentId, ["claimed", "in-progress"]);
  for (const item of stuckItems) {
    await db.releaseItem(item.ref, {
      reason: "auto-released: session ended without workq_done",
      releasedBy: "system:session_end_hook",
    });
  }
});
```

### Edge Cases to Handle

- **Session crashes mid-claim:** Item transitions to `claimed` by `system` agent ID — ensure the release query handles this
- **Intentional hand-offs:** When an agent calls `workq_release` before session end, item is already unclaimed — hook is a no-op
- **Multiple sessions, same agent ID:** An agent may have multiple concurrent sessions. Release only items claimed by the _specific session key_, not all sessions for that agent ID

---

## Deliverable 3 — Git Commit Convention + Sweep Parser (Layer 4)

Standardize commit message footers to enable automated workq cross-referencing.

### Convention

Add to AGENTS.md and `worker-workflow.md`:

```
feat(scope): description of change

closes workq:openclaw/openclaw#bs-sys-1
refs workq:openclaw/openclaw#bs-tim-5
```

- `closes workq:<ref>` → sweep auto-marks item `done` with high confidence
- `refs workq:<ref>` → sweep flags as likely complete but leaves for human verification

### Sweep Parser Update

Update Deliverable 1's git log parser to recognize the `closes workq:` footer pattern:

```typescript
const WORKQ_CLOSES = /^closes workq:(\S+)$/im;
const WORKQ_REFS = /^refs workq:(\S+)$/im;
```

This gives us **deterministic** auto-done transitions from commits (vs. fuzzy item-ref-in-message matching).

---

## Suggested Implementation Order

1. **`session_end` hook (Deliverable 2)** — highest leverage, zero agent behavior change required
2. **`workq sweep` command (Deliverable 1)** — catchall for edge cases the hook misses
3. **Cron registration** — register sweep on 60-min interval
4. **Commit convention (Deliverable 3)** — add to AGENTS.md + worker-workflow.md; update sweep parser

Deliverables 2 + 1 together give 99% coverage. Deliverable 3 is the refinement that gives deterministic confidence.

---

## Files to Touch

| File                                         | Change                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `extensions/workq/src/hooks.ts`              | New file — `agent_end` hook registration                                 |
| `extensions/workq/src/db.ts`                 | Add `findItemsByAgent(agentId, statuses[])` and `releaseItem(ref, opts)` |
| `extensions/workq/src/commands/sweep.ts`     | New command — sweep logic                                                |
| `extensions/workq/src/cli.ts`                | Register `sweep` command                                                 |
| `extensions/workq/cron.json` (or equivalent) | Register 60-min sweep cron                                               |
| `AGENTS.md`                                  | Add git commit convention (closes workq: footer)                         |
| `_shared/ops/worker-workflow.md`             | ✅ Already updated (Layer 1)                                             |
| `_shared/ops/spawn-task-prompt-template.md`  | ✅ Already updated (Layer 1)                                             |

---

## Success Criteria

- `openclaw workq sweep --dry-run` correctly identifies items matching today's orphaned cases (bs-sys-1, bs-tim-5, etc.) and would have auto-advanced or released them
- Terminating a test agent session that has a claimed item causes that item to revert to `claimed` within 5 seconds
- `git log --oneline | grep "closes workq:"` produces parseable output for sweep
- 0 items stuck in `in-progress` for > 2 hours in a steady-state production run

---

_Questions? Message Merlin or post in #cb-notifications._
