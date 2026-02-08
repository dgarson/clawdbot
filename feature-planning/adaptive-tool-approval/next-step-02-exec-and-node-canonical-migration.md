# Next Major Step 02 Prompt: Exec/Node Migration To Canonical `tool.approval.*`

Use this as the full prompt for the next implementation conversation.

## Mission

Migrate all exec and node approval request flows to the canonical `tool.approval.*` pipeline, while preserving full backward compatibility for existing `exec.approval.*` callers and behavior (`allow-once`, `allow-always`, `deny`, fallback semantics).

## Why This Is The Next Major Step

Current codebase status:

- Canonical generic tool approval pipeline exists in gateway:
  - `src/gateway/server-methods/tool-approval.ts`
  - `src/gateway/tool-approval-manager.ts`
- Legacy exec approval pipeline still exists separately:
  - `src/gateway/server-methods/exec-approval.ts`
  - `src/gateway/exec-approval-manager.ts`
- Runtime exec call sites still use legacy method:
  - `src/agents/bash-tools.exec.ts` (multiple `exec.approval.request` call sites)
  - `src/cli/nodes-cli/register.invoke.ts` (`exec.approval.request`)
- Legacy path has no anti-stale `requestHash`; canonical path does.

This split is now the highest technical risk:

- duplicate approval state machines
- mixed protocol semantics
- harder parity guarantees
- stale approval resolution protections only partially applied

## Hard Constraints

- Preserve current end-user behavior for exec approvals.
- Do not break existing callers of `exec.approval.request|resolve`.
- Keep `allow-once` / `allow-always` / timeout fallback behavior intact.
- Do not remove legacy methods in this step; alias/delegate them.
- No destructive API change for current channel `/approve` users.

## Files You Must Read Before Editing

- `src/agents/bash-tools.exec.ts`
- `src/cli/nodes-cli/register.invoke.ts`
- `src/gateway/server-methods/exec-approval.ts`
- `src/gateway/server-methods/tool-approval.ts`
- `src/gateway/exec-approval-manager.ts`
- `src/gateway/tool-approval-manager.ts`
- `src/gateway/server.impl.ts`
- `src/infra/exec-approvals.ts`
- `src/gateway/protocol/schema/exec-approvals.ts`
- `src/gateway/protocol/schema/tool-approvals.ts`
- `src/auto-reply/reply/commands-approve.ts`
- `src/gateway/server-methods/exec-approval.test.ts`
- `src/gateway/server-methods/tool-approval.test.ts`
- `src/agents/bash-tools.exec.approval-id.test.ts`
- `src/cli/nodes-cli.coverage.test.ts`

## Required Implementation

### 1) Route exec invocation requests through canonical API

Update exec runtime callers to use `tool.approval.request` with exec metadata.

Primary call sites:

- `src/agents/bash-tools.exec.ts`
- `src/cli/nodes-cli/register.invoke.ts`

Canonical request payload must include:

- `toolName: "exec"`
- `paramsSummary` (safe summary of command/context)
- `riskClass` (initially at least `"R3"` for exec if no orchestrator integration yet)
- `sessionKey`
- `agentId`
- `requestHash`
- legacy exec details for mirror events/compat:
  - `command`, `cwd`, `host`, `security`, `ask`, `resolvedPath`

Decision mapping:

- `allow-once` => approve this run
- `allow-always` => approve + persist allowlist behavior where currently supported
- `deny` or timeout/null => deny run

### 2) Implement shared hash helper for exec callers

Create a shared helper for computing canonical request hashes used by both runtime and CLI callers.

Recommended location:

- `src/infra/tool-approval-hash.ts` (or equivalent)

Use the same canonical fields as `ToolApprovalManager.computeRequestHash(...)` to avoid drift.

### 3) Collapse gateway approval state to one manager (or strict delegation)

Eliminate divergent pending stores between `ExecApprovalManager` and `ToolApprovalManager`.

Required outcome:

- Legacy `exec.approval.request|resolve` paths delegate into the canonical tool manager pipeline.
- `exec.approval.requested|resolved` events are still emitted for compatibility where needed.
- Canonical `tool.approval.*` events remain primary.

Likely files:

- `src/gateway/server-methods/exec-approval.ts`
- `src/gateway/server.impl.ts`

If keeping `ExecApprovalManager` temporarily, it must become a strict adapter backed by canonical records, not an independent store.

### 4) Add request-hash compatibility for legacy resolve callers

Legacy callers (for example `/approve`) only send `id + decision`.

Implement compatibility behavior:

- For canonical resolve path, continue requiring hash.
- For legacy exec resolve path, allow missing hash by internally resolving the pending canonical record hash for that id, then delegating.
- Reject if id not found or already resolved.

This preserves existing chat workflows while still enforcing anti-stale semantics internally.

### 5) Update `/approve` command path toward canonical resolution

Update:

- `src/auto-reply/reply/commands-approve.ts`

Behavior target:

- Resolve tool approvals first:
  - fetch pending approvals via `tool.approvals.get`
  - match by id to obtain `requestHash`
  - call `tool.approval.resolve`
- If not found in tool pending list, fallback to legacy `exec.approval.resolve` compatibility path.
- Keep sender auth checks unchanged.

Also update command description text:

- `src/auto-reply/commands-registry.data.ts`

Change from exec-only wording to generic tool approvals wording.

## Behavior Parity Requirements

Must preserve:

- existing fallback handling with `askFallback` in exec/node flows
- existing allowlist write behavior for `allow-always`
- existing user-facing messages for approval pending/denied where possible

Must improve:

- stale resolution protection and deterministic canonical request identity
- one source of truth for pending approval records

## Tests To Add/Update

### Gateway tests

- `src/gateway/server-methods/exec-approval.test.ts`
  - verify exec legacy handlers delegate to canonical pending records
  - verify compatibility resolve without explicit hash still works
- `src/gateway/server-methods/tool-approval.test.ts`
  - verify canonical and legacy events are emitted as expected for exec requests

### Runtime + CLI tests

- `src/agents/bash-tools.exec.approval-id.test.ts`
  - ensure exec approval ID and decision behavior remain unchanged after method switch
- `src/cli/nodes-cli.coverage.test.ts`
  - update expected gateway methods from legacy to canonical where appropriate

### Chat command tests

- `src/auto-reply/reply/commands-approve.test.ts`
  - tool pending lookup -> canonical resolve path
  - fallback to legacy exec resolve when needed
  - unauthorized sender behavior unchanged

## Acceptance Criteria

- Exec and node invocation approval requests no longer create independent legacy pending state.
- Legacy `exec.approval.*` calls still function for backward compatibility.
- Anti-stale hash protection is effectively applied for canonical records.
- `/approve` can resolve canonical tool approvals without user-visible workflow changes.
- Existing exec parity behavior remains intact.

## Verification Commands

Run at minimum:

- `pnpm test src/gateway/server-methods/exec-approval.test.ts src/gateway/server-methods/tool-approval.test.ts`
- `pnpm test src/agents/bash-tools.exec.approval-id.test.ts src/cli/nodes-cli.coverage.test.ts`
- `pnpm test src/auto-reply/reply/commands-approve.test.ts`
- `pnpm build`
- `pnpm check`

## Deliverable Format Required From Implementer

Return:

1. migration map (old method -> new method per call site)
2. compatibility behavior table (legacy caller scenarios)
3. files changed
4. tests run + pass/fail
5. explicit list of any intentionally deferred legacy cleanup
