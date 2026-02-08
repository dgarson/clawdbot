# Parallel Track 04 (Step 3): Web Inbox + Observability + Reliability

## Purpose

This workstream can run in parallel with Step 1 because it builds canonical tool approval visibility and controls in the active web app (`apps/web`) and adds non-runtime observability/reliability coverage.

## Scope

Add canonical tool approval inbox/query/action support in web UI and complete basic gateway/forwarder observability + cleanup hardening.

## Files In Scope

### Web UI/API

- `apps/web/src/lib/api/index.ts`
- `apps/web/src/lib/api/gateway-client.ts`
- new `apps/web/src/lib/api/tool-approvals.ts`
- `apps/web/src/hooks/useGatewayEventSync.ts`
- `apps/web/src/hooks/useAgentApprovalActions.ts`
- new `apps/web/src/hooks/queries/useToolApprovals.ts`
- existing approval UI surfaces:
  - `apps/web/src/components/domain/home/ApprovalsInbox.tsx`
  - `apps/web/src/lib/approvals/pending.ts`

### Gateway/Infra Observability

- `src/infra/tool-approval-forwarder.ts`
- `src/gateway/server-methods/tool-approval.ts`
- `src/gateway/server.impl.ts`
- `src/infra/audit/audit-log.ts`
- `src/infra/audit/audit-subscriber.ts`
- new `src/infra/tool-approval-forwarder.test.ts`

## Do Not Touch In This Track

- `src/agents/pi-tools.ts`
- `src/agents/pi-tools.before-tool-call.ts`
- `src/config/types.approvals.ts`
- `src/config/zod-schema.approvals.ts`

## Required Tasks

1. Add web API helpers for:
   - list pending tool approvals (`tool.approvals.get`)
   - resolve tool approval (`tool.approval.resolve`)
2. Update event sync to invalidate tool-approval data on:
   - `tool.approval.requested`
   - `tool.approval.resolved`
3. Replace placeholder approval actions in `useAgentApprovalActions.ts` with canonical resolve flow.
4. Add dedicated tests for `tool-approval-forwarder.ts` (delivery, dedup, timeout, resolved events).
5. Ensure forwarder timers/resources are cleaned during gateway shutdown/reload paths.
6. Add structured logging/audit fields for canonical request/resolution/timeout lifecycle.

## Acceptance Criteria

- Web UI can list and resolve canonical tool approvals.
- Web event sync reacts to canonical approval events.
- Tool forwarder has dedicated tests and reliable timer cleanup.
- Tool approval lifecycle is visible in logs/audit with resolver identity and decision.

## Verification

- `pnpm -C apps/web test`
- `pnpm test src/infra/tool-approval-forwarder.test.ts`
- `pnpm build`
- `pnpm check`
