# Parallel Track 03 (Step 3): Chat and Slack and Discord Resolver Upgrades

## Purpose

This track upgrades operator resolution surfaces to canonical tool approvals and can run in parallel with Step 1 because gateway `tool.approval.*` methods already exist.

## Dependency Status vs Step 1

- Blocked by Step 1: **No** for implementation/testing
- End-to-end non-exec volume depends on Step 1 later

## Scope

Make `/approve` and both Slack and Discord interactive approvals resolve canonical tool approvals first, with legacy fallback.

## Files In Scope

- `src/auto-reply/reply/commands-approve.ts`
- `src/auto-reply/reply/commands-approve.test.ts`
- `src/auto-reply/commands-registry.data.ts`
- `src/discord/monitor/exec-approvals.ts`
- `src/discord/monitor/exec-approvals.test.ts`
- `src/gateway/server-methods/tool-approval.ts` (read-only reference)

## Do Not Touch In This Track

- `src/agents/pi-tools.ts`
- `src/agents/pi-tools.before-tool-call.ts`
- `src/config/types.approvals.ts`
- `src/config/zod-schema.approvals.ts`

## Required Tasks

1. `/approve` command flow:
   - query `tool.approvals.get`
   - resolve via `tool.approval.resolve` with `requestHash` when matching record exists
   - fallback to legacy `exec.approval.resolve` path when no canonical record found
2. Update command help/description text to “tool approvals” (not exec-only).
3. Extend Slack / Discord approval handler to support canonical tool approval events and resolve actions for non-exec tool requests.
4. Preserve existing exec behavior/cards/buttons for backward compatibility.
5. Keep auth/scope checks unchanged (`operator.approvals`).

## Acceptance Criteria

- Authorized `/approve` can resolve canonical tool approvals.
- Discord handler can process canonical tool approval request/resolution lifecycle.
- Legacy exec-only approval flows still work.

## Verification

- `pnpm test src/auto-reply/reply/commands-approve.test.ts`
- `pnpm test src/discord/monitor/exec-approvals.test.ts`
- `pnpm build`
- `pnpm check`
