# WorkQ System Audit Report
**Filed by:** Merlin  
**Date:** 2026-02-22  
**Scope:** Full workq system — design, implementation, agent integration, SKILL.md, and the SystemPromptContributors concept

---

## Executive Summary

The workq extension has a solid architectural foundation — SQLite-backed, transactional, WAL-mode, with sensible ownership semantics and a clean tool surface. However, there are **8 critical issues** that are causing or will cause active failures in production, several design gaps that create friction and inconsistency, and a structural gap in how workq instructions reach agents. The most urgent: the `workq_done` SKILL.md example is **missing the required `pr_url` field** (every agent following the docs will hit an error), inbox tools documented in SKILL.md **don't exist**, and the session-end auto-release mechanism proposed in the enforcement doc is **entirely unimplemented**.

---

## Part 1: Implementation Bugs & Design Gaps

### 1. 🔴 CRITICAL — SKILL.md `workq_done` Example Is Wrong (Missing `pr_url`)

**File:** `skills/workq/SKILL.md`

The minimal example:
```
- Finish: workq_done({ issue_ref: "acme/repo#123" })
```

The actual `DoneInput` type (`types.ts`):
```typescript
export interface DoneInput {
  issueRef: string;
  agentId: string;
  prUrl: string;   // <-- REQUIRED, not optional
  summary?: string;
}
```

And `database.ts` enforces it:
```typescript
if (!issueRef || !agentId || !prUrl) {
  throw new Error("issueRef, agentId, and prUrl are required");
}
```

The tool schema in `tools.ts` also marks `pr_url` as required (non-optional `Type.String()`). Every agent following the SKILL.md minimal example will get an error. **Fix:** Update SKILL.md immediately.

**Correct example:**
```
- Finish: workq_done({ issue_ref: "acme/repo#123", pr_url: "https://github.com/dgarson/clawdbot/pull/55" })
```

### 2. 🔴 CRITICAL — Inbox Tools Documented But Not Implemented

**File:** `skills/workq/SKILL.md` (Section B)

The SKILL.md declares 3 inbox tools with **REQUIRED** usage discipline:
- `workq_inbox_send`
- `workq_inbox_read`
- `workq_inbox_ack`

None of these exist. The tools array in `tools.ts` registers exactly 8 tools: `workq_claim`, `workq_release`, `workq_status`, `workq_query`, `workq_files`, `workq_log`, `workq_done`, `workq_export`. There is no inbox schema in `database.ts`, no inbox tools in `tools.ts`, no inbox CLI in `cli.ts`.

The WORKSTREAM.md correctly identifies inbox as Phase D (not yet implemented), but the SKILL.md is presenting it as live. Any agent that reads the SKILL.md and tries to call `workq_inbox_read` will get a tool-not-found error.

**Fix:** Either remove inbox section from SKILL.md and replace with `[Coming in Phase D — inbox tools not yet available]`, or ship Phase D. Do not leave phantom tool documentation in the agent-facing SKILL.

### 3. 🔴 CRITICAL — State Machine: `workq_done` Requires `in-review` First, SKILL.md Hides This

**File:** `database.ts`

```typescript
done(input: DoneInput): ... {
  // ...
  if (row.status !== "in-review") {
    throw new Error(`Cannot mark done from status ${row.status}; expected in-review`);
  }
```

The SKILL.md standard flow says:
```
1. workq_claim first
2. Do the work
3. use workq_status as state changes
4. workq_done on completion
```

An agent reading this will try: `claim` → work → `workq_done`. This fails. The actual required path is:

```
claim                            → status: claimed
workq_status({ "in-progress" })  → status: in-progress
workq_status({ "in-review" })    → status: in-review
workq_done({ pr_url: "..." })    → status: done
```

That's **4 tool calls minimum** (plus any `blocked` round-trips). The SKILL.md implies 3. The additional `in-progress` and `in-review` steps are mandatory, not optional, yet they're not shown in the example flow.

**Fix:** SKILL.md minimal example must show the full required path, including the mandatory `in-review` transition before `done`.

### 4. 🔴 CRITICAL — Session-End Auto-Release Hook Does Not Exist

**File:** `_shared/ops/tim-workq-enforcement.md` (filed by Merlin), `oscar/extensions/workq/`

The enforcement doc proposes a session-end hook (`extensions/workq/src/hooks.ts`) that auto-releases items when an agent session ends without calling `workq_done`. This is described as the highest-value deliverable. It does not exist. There is no `hooks.ts`, no `findItemsByAgent` DB method, and no `releaseItem` method.

This explains why items get stuck indefinitely — there is no safety net at the platform level.

**Fix:** Implement per the enforcement doc. Requires Tim to add:
- `extensions/workq/src/hooks.ts` with `registerHook("agent_end", ...)` 
- `findItemsByAgent(agentId, statuses[])` on `WorkqDatabase`
- Auto-release logic (note: actual behavior is `dropped`, not "available" — see Issue #7 below)

### 5. 🔴 CRITICAL — `openclaw workq sweep` Does Not Exist

**File:** `_shared/ops/tim-workq-enforcement.md`, `oscar/extensions/workq/src/cli.ts`

The enforcement doc describes an `openclaw workq sweep` command. The CLI registers: `list`, `claim`, `status`, `export`, `log`, `release`, `done`, `files`, `stale`. No `sweep`.

The `stale` command exists (lists stale items) but does NOT auto-resolve them. Sweep would cross-reference git commits to auto-advance or auto-release stale items. Without it, stale detection exists but remediation is entirely manual.

### 6. 🟡 HIGH — TypeBox `Type.Union` Violations

**File:** `oscar/extensions/workq/src/tools.ts`

`AGENTS.md` explicitly states:
> **Tool schema guardrails: no `Type.Union`/`anyOf`/`oneOf`/`allOf`; use `stringEnum`/`optionalStringEnum`, `Type.Optional`.**

`tools.ts` uses `Type.Union` in 6 locations:
- Line 28: `PRIORITY_SCHEMA = Type.Union([Literal, Literal, Literal, Literal])`
- Line 35: `STATUS_SCHEMA = Type.Union([Literal, Literal, Literal, Literal, Literal, Literal])`
- Line 226: `status: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())]))`
- Line 227: `priority: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())]))`
- Line 303: `mode: Type.Optional(Type.Union([Literal, Literal, Literal, Literal]))`
- Line 434: `format: Type.Optional(Type.Union([Literal, Literal]))`

These need to be converted to the approved schema helpers. This is not just style — `Type.Union` with mixed types (string vs. array) generates `anyOf` in JSON Schema, which the guardrail explicitly forbids.

### 7. 🟡 HIGH — `workq_release` Marks Items `dropped`, Not Available

**File:** `database.ts`, `tim-workq-enforcement.md`

The enforcement doc discusses "auto-releasing back to `claimed` (unclaimed/available state)." But the actual `release()` implementation sets status to `dropped` (a terminal state). Once dropped, an item is only reclaimable with `reopen: true` in `workq_claim`.

The conceptual mismatch:
- **Intent:** release item so another agent can pick it up
- **Reality:** item is terminated; must be explicitly reopened

This affects the proposed session-end hook too. "Auto-releasing" items actually terminates them. The fix is either:
1. Add a new `unclaim()` operation that resets `agent_id` but keeps `status: claimed` (true "unclaim")
2. Or reframe `release` → `drop` semantics consistently in all docs and SKILL.md

### 8. 🟡 HIGH — Gateway RPC `agentId` Spoofing

**File:** `oscar/extensions/workq/index.ts`

The tool layer correctly derives `agentId` from runtime context (`ctx.agentId`). The gateway RPC handlers accept `agent_id` from the request payload:

```typescript
api.registerGatewayMethod("workq.claim", async ({ params, respond }) => {
  const payload: ClaimInput = {
    agentId: asString(input.agent_id) ?? "",  // ← attacker-controlled
    ...
  };
  respond(true, db.claim(payload));
});
```

Any caller of the gateway RPC can claim work as any agent by passing a different `agent_id`. The `assertOwnedBy` check then validates against this self-reported ID. This creates an avenue for ownership manipulation.

**Fix:** Gateway handlers should validate that the caller's authenticated identity matches the requested `agent_id`, or reject unauthenticated `agent_id` overrides.

### 9. 🟡 HIGH — Spawn Template CLI `workq done` Missing `--pr` Requirement

**File:** `_shared/ops/spawn-task-prompt-template.md`, `_shared/ops/worker-workflow.md`

Both files tell agents:
```bash
openclaw workq done openclaw/openclaw#<item-ref>
```

But the CLI `done` command has `--pr <url>` as a `requiredOption`. Without it, the CLI call fails. Non-code tasks (audits, investigations, docs) don't always produce PRs but still need to be closeable.

The spawn template should either:
1. Show the full call: `openclaw workq done <ref> --pr <pr-url> --agent <agent-id>`
2. Or add an escape hatch for non-PR tasks in the `done` command (e.g., allow `--pr none` for tasks without PRs)

### 10. 🟡 MEDIUM — Stale-Beat Circumvention via `workq_log`

**File:** `database.ts`

`workq_log` calls `touchWorkItem(issueRef)`, updating `updated_at`. Stale detection is based on `updated_at`. An agent can prevent its items from ever being flagged stale by logging a note periodically — without making real progress. This could mask stuck work in automated sweeps.

**Fix:** Either use `last_active_at` (actual work progress) separately from `updated_at` (any mutation), or add a note to staleness docs that `workq_log` resets the staleness clock.

### 11. 🟡 MEDIUM — `workq_files` Check Only One Path at a Time

**File:** `tools.ts`, `database.ts`

`workq_files` mode `check` accepts `path` (singular, string). If an agent wants to check whether a batch of files it plans to touch have conflicts, it must call `workq_files` N times (one per file). This is expensive in tool calls and context.

**Fix:** Allow `paths: string[]` in check mode, or document the workaround clearly in SKILL.md.

### 12. 🟢 LOW — `workq_query` Silently Scopes to Caller When No Filters Given

**File:** `tools.ts`

```typescript
const effectiveAgentId =
  explicitAgentFilter ?? (hasFilterBeyondPaging ? undefined : agentId);
```

When an agent calls `workq_query({})` (no filters), it gets only its own items. This is a reasonable default but poorly documented. An agent trying to see the full board view must know to pass `{ active_only: false }` or any other filter to disable self-scoping. The SKILL.md doesn't mention this behavior.

### 13. 🟢 LOW — No Schema Migration System

**File:** `database.ts`

The schema is initialized with `CREATE TABLE IF NOT EXISTS` and a hardcoded `schema_version = '1'` in `workq_meta`. There is no migration runner. When inbox tables are added (Phase D), there's no mechanism to update existing DBs. The hardening backlog identifies this (item 1), but the risk is real: inbox schema will break existing deployments if not migrated.

### 14. 🟢 LOW — WAL Checkpoint Not Periodic

The WAL checkpoint fires once at DB startup. Under sustained concurrent multi-agent write load, WAL files can grow significantly between startups. There's no periodic checkpoint or monitoring. The hardening backlog notes this (item 4).

---

## Part 2: Agent Integration — SKILL.md Sufficiency

### What the SKILL.md Gets Right

- Clear purpose statement (work queue + inbox)
- Named the 8 work queue tools
- Stated the standard flow
- Guardrails section (no self-reporting identity, prefer structured payloads)
- Inbox ack discipline stated explicitly

### What the SKILL.md Gets Wrong or Missing

| Gap | Impact |
|-----|--------|
| `workq_done` example missing `pr_url` | Every agent following docs hits an error |
| State machine path not shown (must hit `in-review` before `done`) | Agents fail the transition |
| Inbox tools documented but non-existent | Tool-not-found errors on any inbox call |
| No mention of `workq_files` check-before-claim pattern | Agents skip conflict detection |
| No explanation that `workq_release` = `dropped` (terminal) | Agents think "release" = unclaim |
| No mention that `workq_query({})` scopes to self only | Board-view queries return wrong results |
| No explanation of stale threshold or `is_stale` field | Agents don't know when to check for reassignment |
| No example of `workq_files` in the claim flow | File conflict detection is never used |

### AGENTS.md Coverage

`AGENTS.md` and `WORK_PROTOCOL.md` reference workq in the "Step 9 — Close Your workq Item" section of `worker-workflow.md` and in the spawn template. Coverage is decent for the concept but:

1. **The CLI example is broken** (missing `--pr`, missing `--agent`)
2. **No mention of the state machine requirement** (must `in-review` before `done`)
3. **No inbox reference** (Phase D isn't ready, but also no note it's coming)

---

## Part 3: SystemPromptContributors — Design Proposal

David's concept is sound and addresses a real structural gap. Currently, SKILL.md is passive (agents may never read it), system prompts are monolithic, and session classification doesn't happen. Here's a concrete architecture:

### The Core Problem

The workq SKILL.md relies on agents self-selecting it as relevant. An agent doing coding work may not recognize that the workq skill applies, especially when the task doesn't mention "work queue" explicitly. Critical instructions (claim → in-progress → in-review → done with PR URL) only reach agents who happen to read the skill.

### SystemPromptContributor Interface

```typescript
interface SessionContext {
  sessionKey: string;
  sessionType: 'main' | 'subagent' | 'cron' | 'heartbeat';
  sessionDepth: number;           // 0 = main, 1 = first subagent, etc.
  channel: string;
  agentId: string;
  promptMode: 'full' | 'minimal' | 'none';
  spawnTags?: string[];           // Tags passed via sessions_spawn
  agentProfile?: AgentProfile;   // From agent registry
  initialMessageHint?: string;   // First message (for intent classification)
}

interface SystemPromptContributor {
  id: string;
  priority: number;               // Injection order (lower = earlier)
  shouldActivate(ctx: SessionContext): boolean | Promise<boolean>;
  contribute(ctx: SessionContext): string | Promise<string>;
}
```

### Activation Strategies (Ordered by Cost)

1. **Tag-based** (zero cost): Spawn params include `tags: ['engineering', 'workq']`
2. **Agent-ID-based** (zero cost): Lookup agent profile from registry (squad, role, tier)
3. **Session-type-based** (zero cost): Subagents get minimal contributors; main gets full
4. **Rule-based classifier** (cheap): Pattern match on first message content
5. **LLM-based classifier** (expensive): Use a cheap model to classify intent — use sparingly, only for ambiguous main sessions

### Built-In Contributors

#### `WorkqEngineeringContributor`

Activates when: agent is in Platform Core squad (Tim, Sandy, Oscar, Roman, Nate, Vince, Tony) OR spawn tags include `engineering` OR session is a subagent spawned from an engineering context.

Injects (condensed, system-prompt-safe):
```markdown
## Work Queue (workq — REQUIRED)

Full flow before announcing done:
1. workq_claim({ issue_ref: "owner/repo#N" })
2. workq_status({ issue_ref: "...", status: "in-progress" })
3. [do work]
4. workq_status({ issue_ref: "...", status: "in-review" })
5. workq_done({ issue_ref: "...", pr_url: "https://..." })  ← pr_url REQUIRED

CLI equivalent: openclaw workq done <ref> --pr <url> --agent <id>
Do NOT skip in-review. Do NOT call workq_done without pr_url.
Items not closed in workq are treated as abandoned and reassigned.
```

#### `WorkqHeartbeatContributor`

Activates when: session type is `cron` or `heartbeat`, OR session is spawned with tag `heartbeat`.

Injects:
```markdown
## Heartbeat Workq Check

At session start: workq_query to check for stale or blocked items in your squad.
[When inbox is live] workq_inbox_read({ unreadOnly: true }) → process → workq_inbox_ack.
```

#### `WorkqLeadContributor`

Activates when: agent profile tier ≥ T2 (lead, staff) OR spawn tags include `lead`.

Injects:
```markdown
## Workq Board Check

Run workq_query({ squad: "<your-squad>", active_only: true }) at session start.
Flag stale items (is_stale: true) and reassign or escalate.
```

### Extensibility Requirements

1. **Registration API:** Contributors must be registrable from extensions, not hardcoded in core.
2. **Ordering:** Priority number (0-100) controls injection order. Core contributors at 10-20; extension contributors at 50+.
3. **Composability:** Multiple contributors can fire in one session. Their output is concatenated (with separator) in priority order.
4. **Testing:** Each contributor must be independently unit-testable with a mock `SessionContext`.
5. **Disableability:** Contributors should be disableable per-agent-profile or per-session via config.

### Recommended Implementation Approach

```typescript
// extensions/workq/src/system-prompt-contributor.ts
import type { SystemPromptContributor, SessionContext } from 'openclaw/plugin-sdk';

export const WorkqEngineeringContributor: SystemPromptContributor = {
  id: 'workq-engineering',
  priority: 15,
  shouldActivate(ctx: SessionContext): boolean {
    const engineeringAgents = new Set(['oscar', 'sandy', 'tim', 'roman', 'nate', 'tony', 'vince']);
    const isEngineeringAgent = ctx.agentId && engineeringAgents.has(ctx.agentId.toLowerCase());
    const hasEngineeringTag = ctx.spawnTags?.includes('engineering') ?? false;
    const isSubagentWithContext = ctx.sessionDepth > 0 && ctx.promptMode === 'minimal';
    return Boolean(isEngineeringAgent || hasEngineeringTag || isSubagentWithContext);
  },
  contribute(): string {
    return `## Work Queue (workq — REQUIRED)
...`;
  }
};
```

### When NOT to Augment

- `promptMode === 'none'` (bare identity sessions)
- Sessions explicitly tagged `skip-workq`
- Read-only analysis or reporting sessions (no task to claim)

---

## Part 4: Priority Action Plan

### Immediate (this sprint)

| # | Action | Owner | File |
|---|--------|-------|------|
| 1 | Fix SKILL.md `workq_done` example — add `pr_url` | Merlin/Claire | `skills/workq/SKILL.md` |
| 2 | Fix SKILL.md to show full state machine flow | Merlin/Claire | `skills/workq/SKILL.md` |
| 3 | Remove inbox section from SKILL.md (or flag as upcoming) | Merlin | `skills/workq/SKILL.md` |
| 4 | Fix spawn template + worker-workflow `workq done` CLI call | Merlin | `_shared/ops/spawn-task-prompt-template.md`, `worker-workflow.md` |
| 5 | Fix TypeBox `Type.Union` violations in `tools.ts` | Tim/Sandy | `oscar/extensions/workq/src/tools.ts` |

### Near-term (next sprint)

| # | Action | Owner | File |
|---|--------|-------|------|
| 6 | Implement `session_end` auto-release hook | Tim | `extensions/workq/src/hooks.ts` (new) |
| 7 | Implement `openclaw workq sweep` command | Tim | `extensions/workq/src/commands/sweep.ts` (new) |
| 8 | Resolve `release` vs `drop` semantic mismatch (new `unclaim` op?) | Tim/Xavier | `database.ts`, `types.ts`, `tools.ts` |
| 9 | Fix gateway RPC `agentId` spoofing | Tim/Oscar | `extensions/workq/index.ts` |
| 10 | Add `workq done` `--pr` to spawn template or add non-PR closure path | Merlin/Tim | Templates + CLI |

### Medium-term

| # | Action | Owner |
|---|--------|-------|
| 11 | Design + implement `SystemPromptContributor` API in plugin-sdk | Tim |
| 12 | Implement `WorkqEngineeringContributor` + registration in workq extension | Tim/Oscar |
| 13 | Implement schema migration runner (Phase B hardening item 1) | Tim |
| 14 | Implement inbox (Phase D) — currently phantom in SKILL.md | Tony/Barry |
| 15 | Add idempotency keys to mutating operations (Phase B item 2) | Tim |

---

## Part 5: SKILL.md Rewrite (Proposed)

The SKILL.md should be updated to:

```markdown
# SKILL.md — workq (Task Queue)

## Purpose

workq provides multi-agent work coordination via claim/status/done flow with file conflict detection.

**Inbox tools (workq_inbox_send/read/ack) are coming in Phase D — not yet available.**

---

## Work Queue Tools (8)

1. `workq_claim` — claim a work item
2. `workq_status` — update status (must progress through states in order)
3. `workq_files` — check/register file ownership overlap
4. `workq_query` — list/filter work items
5. `workq_done` — complete a work item (requires `pr_url`, requires `in-review` first)
6. `workq_release` — drop a claimed item (sets to `dropped` — terminal state)
7. `workq_log` — append a decision note
8. `workq_export` — export queue state

---

## REQUIRED State Machine Flow

Status MUST progress in this order. You CANNOT skip steps.

```
claimed → in-progress → in-review → done
         ↓         ↑
        blocked ───┘
```

**Mandatory flow:**
1. `workq_claim({ issue_ref: "owner/repo#N" })`
2. `workq_status({ issue_ref: "...", status: "in-progress" })`
3. [do the work]
4. `workq_status({ issue_ref: "...", status: "in-review" })`
5. `workq_done({ issue_ref: "...", pr_url: "https://github.com/..." })`

**pr_url is REQUIRED in workq_done. It will fail without it.**

---

## Board Query

```
workq_query({})              ← shows YOUR active items only (default)
workq_query({ squad: "..." }) ← shows squad board (explicit filter)
```

---

## File Conflict Check (Do Before Claiming)

```
workq_files({ mode: "check", path: "/abs/path/to/file" })
```

---

## Guardrails

- Never self-report identity; `agentId` is injected from runtime context.
- `workq_release` = permanent drop, not "unclaim". Reraise with `workq_claim({ reopen: true })`.
- Always mark done before announcing completion.
```

---

## Appendix: File Inventory Read

| File | Status |
|------|--------|
| `skills/workq/SKILL.md` | Needs fixes (pr_url, state machine, inbox) |
| `oscar/extensions/workq/src/types.ts` | Sound |
| `oscar/extensions/workq/src/state-machine.ts` | Sound |
| `oscar/extensions/workq/src/database.ts` | Sound, but missing `findItemsByAgent`, `releaseItem` |
| `oscar/extensions/workq/src/tools.ts` | TypeBox violations, needs schema fixes |
| `oscar/extensions/workq/src/cli.ts` | Solid, missing `sweep` and `inbox` |
| `oscar/extensions/workq/src/export.ts` | Sound |
| `oscar/extensions/workq/src/file-matcher.ts` | Sound |
| `oscar/extensions/workq/index.ts` | RPC agentId spoofing gap |
| `_shared/ops/tim-workq-enforcement.md` | Unimplemented (hooks, sweep, DB methods) |
| `_shared/ops/spawn-task-prompt-template.md` | CLI call broken (missing --pr, --agent) |
| `_shared/ops/worker-workflow.md` | Step 9 CLI call broken |
| `_shared/workstreams/workq-extension/WORKSTREAM.md` | Accurate, Phase D pending |

---

*Report generated by Merlin · workq-investigation subagent · 2026-02-22*
