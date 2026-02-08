# Parallel Track 01 (Step 2): Gateway Compatibility Unification

## Purpose

This workstream can run in parallel with Step 1 because it does not depend on runtime orchestrator integration in `pi-tools`. It focuses on unifying gateway approval state and compatibility behavior.

## Dependency Status vs Step 1

- Blocked by Step 1: **No**
- Optional integration touchpoint after Step 1: update payload richness only

## Scope

Unify legacy and canonical approval handlers so there is one pending approval source of truth.

## Files In Scope

- `src/gateway/server-methods/exec-approval.ts`
- `src/gateway/server-methods/tool-approval.ts`
- `src/gateway/server.impl.ts`
- `src/gateway/tool-approval-manager.ts`
- `src/gateway/exec-approval-manager.ts`
- `src/gateway/server-methods/exec-approval.test.ts`
- `src/gateway/server-methods/tool-approval.test.ts`

## Do Not Touch In This Track

- `src/agents/pi-tools.ts`
- `src/agents/pi-tools.before-tool-call.ts`
- `src/config/types.approvals.ts`
- `src/config/zod-schema.approvals.ts`

## Required Tasks

1. Route legacy `exec.approval.request|resolve` through canonical tool approval internals (direct delegation or strict adapter).
2. Preserve legacy events (`exec.approval.requested|resolved`) while keeping canonical events authoritative.
3. Add compatibility resolve behavior for legacy callers that only provide `{ id, decision }`.
4. Ensure anti-stale protections remain effective for canonical records.
5. Keep scope/authorization behavior unchanged.

## Acceptance Criteria

- No duplicate pending-state machines remain active for exec requests.
- Legacy method callers still function.
- Canonical and legacy events both emit correctly for exec-origin requests.
- Existing exec approval tests remain green after unification.

## Verification

- `pnpm test src/gateway/server-methods/exec-approval.test.ts src/gateway/server-methods/tool-approval.test.ts`
- `pnpm build`
- `pnpm check`
