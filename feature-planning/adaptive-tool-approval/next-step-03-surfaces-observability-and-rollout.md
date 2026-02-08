# Next Major Step 03 Prompt: Operator Surfaces, Observability, And Rollout Hardening

Use this as the full prompt for the next implementation conversation.

## Mission

Complete production readiness for adaptive tool approvals by:

- wiring canonical tool approvals into operator-facing surfaces (web UI, chat command, channel handlers)
- aligning forwarding/routing config to `approvals.tools`
- adding missing tests, audit/metrics hooks, and rollout gates

## Why This Is The Next Major Step

After Step 01 and Step 02:

- runtime and exec paths can produce canonical approval requests
- gateway can process canonical approvals

But current user/operator surfaces are still mostly exec-only or incomplete:

- event sync in web watches only `exec.approval.*`:
  - `apps/web/src/hooks/useGatewayEventSync.ts`
- chat `/approve` is exec-only:
  - `src/auto-reply/reply/commands-approve.ts`
- Discord interactive monitor is exec-specific:
  - `src/discord/monitor/exec-approvals.ts`
- tool forwarder config still reads `cfg.approvals.exec`:
  - `src/infra/tool-approval-forwarder.ts`
- no dedicated tests for tool forwarder:
  - no `src/infra/tool-approval-forwarder.test.ts`

This is now the main blocker to real operator usability and safe rollout.

## Hard Constraints

- Do not modify deprecated `ui/*`; use `apps/web/*`.
- Preserve existing exec workflows while adding tool-generic support.
- Keep channel auth/scope checks strict (`operator.approvals` etc.).
- Maintain fail-closed behavior for timeouts and unknown IDs.

## Files You Must Read Before Editing

### Gateway and infra

- `src/infra/tool-approval-forwarder.ts`
- `src/infra/exec-approval-forwarder.ts`
- `src/gateway/server-broadcast.ts`
- `src/gateway/server-methods-list.ts`
- `src/gateway/server.impl.ts`

### Chat/channel resolver paths

- `src/auto-reply/reply/commands-approve.ts`
- `src/auto-reply/reply/commands-approve.test.ts`
- `src/auto-reply/commands-registry.data.ts`
- `src/discord/monitor/exec-approvals.ts`
- `src/discord/monitor/exec-approvals.test.ts`

### Web app (`apps/web`)

- `apps/web/src/lib/api/gateway-client.ts`
- `apps/web/src/lib/api/index.ts`
- `apps/web/src/lib/api/nodes.ts`
- `apps/web/src/hooks/useGatewayEventSync.ts`
- `apps/web/src/hooks/useAgentApprovalActions.ts`
- `apps/web/src/hooks/queries/useNodes.ts`
- `apps/web/src/components/domain/home/ApprovalsInbox.tsx`
- `apps/web/src/lib/approvals/pending.ts`

### Audit and reliability

- `src/infra/audit/audit-log.ts`
- `src/infra/audit/audit-subscriber.ts`
- `docs/refactor/adaptive-tool-approval-implementation.md`
- `docs/refactor/adaptive-tool-approval-workplan/06-observability-and-audit-model.md`
- `docs/refactor/adaptive-tool-approval-workplan/09-rollout-migration-and-compatibility.md`

## Required Implementation

### 1) Move tool forwarding config to `approvals.tools.routing`

Update:

- `src/infra/tool-approval-forwarder.ts`
- `src/config/types.approvals.ts`
- `src/config/zod-schema.approvals.ts`

Behavior:

- Primary source: `cfg.approvals.tools.routing`
- Compatibility fallback: `cfg.approvals.exec` when `approvals.tools.routing` missing
- Keep delivery modes:
  - `session`
  - `targets`
  - `both`
- Keep dedup behavior for overlapping session+target destinations.

Add missing unit test coverage:

- new `src/infra/tool-approval-forwarder.test.ts`

Test cases:

- disabled -> no delivery
- session mode delivery
- targets mode delivery
- both mode dedup
- timeout expiry message delivery
- resolved message delivery
- fallback to `approvals.exec` for compatibility

### 2) Upgrade chat and channel approval resolvers to canonical tool approvals

#### Chat `/approve`

Update:

- `src/auto-reply/reply/commands-approve.ts`
- `src/auto-reply/reply/commands-approve.test.ts`
- `src/auto-reply/commands-registry.data.ts`

Required behavior:

- parse same command syntax (`/approve <id> allow-once|allow-always|deny`)
- resolve against canonical pending list first:
  - call `tool.approvals.get`
  - locate matching id
  - call `tool.approval.resolve` with `requestHash`
- fallback to legacy exec resolve if canonical pending entry not found
- preserve sender auth and scope checks
- user reply text should be tool-generic, not exec-only

#### Discord interactive approvals

Current file:

- `src/discord/monitor/exec-approvals.ts`

Implement either:

- extend existing class to handle both `exec.approval.*` and `tool.approval.*`, or
- create generic `tool-approvals` monitor and keep exec wrapper for compatibility

Requirements:

- button interactions can resolve canonical tool approvals (with hash lookup if needed)
- include tool name, params summary, risk class in embed for non-exec requests
- keep existing exec card format unchanged for compatibility

Update tests:

- `src/discord/monitor/exec-approvals.test.ts` (or new generic test file)

### 3) Add web UI support for canonical pending tool approvals

Implement lightweight but functional canonical approval inbox path in `apps/web`.

Add API layer:

- new `apps/web/src/lib/api/tool-approvals.ts`
- export from `apps/web/src/lib/api/index.ts`

Suggested API functions:

- `getToolApprovals()` -> `tool.approvals.get`
- `resolveToolApproval({ id, decision, requestHash })` -> `tool.approval.resolve`

Add query/mutation hooks:

- new `apps/web/src/hooks/queries/useToolApprovals.ts`
- optional new `apps/web/src/hooks/mutations/useToolApprovals.ts`

Event sync updates:

- `apps/web/src/hooks/useGatewayEventSync.ts`
  - include `tool.approval.requested`
  - include `tool.approval.resolved`
  - invalidate new tool approvals query key

Approval actions hook:

- `apps/web/src/hooks/useAgentApprovalActions.ts`
  - replace non-canonical `tool.approve` / `tool.reject` placeholder RPCs
  - use real canonical resolve flow with request hash

UI surface:

- either update existing approvals components (`ApprovalsInbox`, route-level panels) or add minimal dedicated panel
- must show:
  - pending count
  - tool name
  - risk class
  - decision controls

### 4) Add observability and audit fields for canonical tool approvals

At minimum add structured logs/counters for:

- approval requested
- approval resolved
- approval timeout
- resolver identity + transport
- tool name + risk class

Touch points likely include:

- `src/gateway/server-methods/tool-approval.ts`
- `src/infra/tool-approval-forwarder.ts`
- `src/infra/audit/*` as needed

Do not emit secrets from params summary.

### 5) Ensure lifecycle cleanup and reliability details are complete

Review gateway shutdown behavior:

- `src/gateway/server.impl.ts`

Ensure tool forwarder timers are cleaned up on shutdown/reload paths (no orphan pending timers).

## Acceptance Criteria

- Tool approvals can be resolved from:
  - chat `/approve`
  - web UI
  - at least one interactive channel path (Discord or equivalent)
- Web event sync reacts to canonical tool approval events.
- Forwarding uses `approvals.tools.routing` with compatibility fallback.
- Canonical tool approval forwarder has dedicated tests.
- Structured observability fields exist for request/resolve/timeout lifecycle.

## Verification Commands

Run at minimum:

- `pnpm test src/infra/tool-approval-forwarder.test.ts`
- `pnpm test src/auto-reply/reply/commands-approve.test.ts`
- `pnpm test src/discord/monitor/exec-approvals.test.ts`
- `pnpm -C apps/web test`
- `pnpm build`
- `pnpm check`

If any app/web test command differs in this repo, run the nearest equivalent and report exact command used.

## Deliverable Format Required From Implementer

Return:

1. surface coverage matrix (web, chat command, channel monitor) with implemented status
2. config compatibility matrix (`approvals.tools.routing` vs `approvals.exec`)
3. list of added observability fields
4. files changed
5. tests run + outcomes
6. explicit rollout risks remaining (if any)
