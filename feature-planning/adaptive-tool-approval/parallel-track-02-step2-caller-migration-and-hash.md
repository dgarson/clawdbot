# Parallel Track 02 (Step 2): Exec/Node Caller Migration + Request Hash

## Purpose

This workstream can run in parallel with Step 1 because it migrates existing exec/node approval callers to canonical gateway methods and does not require runtime tool-orchestrator integration.

## Scope

Replace legacy approval request calls from exec/node paths with canonical `tool.approval.request` usage and deterministic request hash generation.

## Files In Scope

- `src/agents/bash-tools.exec.ts`
- `src/cli/nodes-cli/register.invoke.ts`
- `src/infra/exec-approvals.ts` (read for parity semantics)
- `src/gateway/tool-approval-manager.ts` (hash contract reference)
- `src/agents/bash-tools.exec.approval-id.test.ts`
- `src/cli/nodes-cli.coverage.test.ts`

## Do Not Touch In This Track

- `src/agents/pi-tools.ts`
- `src/agents/pi-tools.before-tool-call.ts`
- `src/config/types.approvals.ts`
- `src/config/zod-schema.approvals.ts`

## Required Tasks

1. Add a shared helper to compute canonical request hashes for exec/node requests.
2. Update exec caller sites in `bash-tools.exec.ts` to request approvals via `tool.approval.request`.
3. Update node CLI invoke path to use canonical approval request method.
4. Preserve existing behavior for:
   - `allow-once`
   - `allow-always`
   - timeout/empty decision fallback paths
   - allowlist persistence behavior
5. Keep response mapping and user-facing flow unchanged.

## Acceptance Criteria

- No `exec.approval.request` call remains in active exec/node runtime paths.
- Decision outcomes and fallback logic remain behaviorally equivalent.
- Existing parity tests pass with canonical request method.

## Verification

- `pnpm test src/agents/bash-tools.exec.approval-id.test.ts src/cli/nodes-cli.coverage.test.ts`
- `pnpm build`
- `pnpm check`
