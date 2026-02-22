# HITL Gateway — Phase 1 (Core Infrastructure)

This document describes what is delivered in Phase 1 of the Human-in-the-Loop (HITL) Gateway workstream on branch `feat/hitl-gateway`.

## Scope

Phase 1 establishes reusable primitives only. It does **not** yet wire full approval gating into all tool invocation paths.

Delivered components:

1. `ExecApprovalManager` payload generalization (gateway runtime)
2. `HitlRequestStore` (SQLite-backed request/decision/audit persistence)
3. `HitlPolicyEngine` (policy resolution + authorization checks)
4. Config schema support for HITL policy declarations (`approvals.hitl`)

## Component Details

### 1) Generic HITL payloads in `ExecApprovalManager`

File:

- `/Users/openclaw/.openclaw/workspace/clawdbot-hitl-gateway/src/gateway/exec-approval-manager.ts`

Changes:

- Introduces `HitlRequestPayload` with optional `tool` and `category` metadata.
- Keeps backward compatibility via `ExecApprovalRequestPayload` alias.
- Preserves existing lifecycle behavior (`create` → `register`/`awaitDecision` → `resolve`/timeout).

### 2) Durable HITL request store

File:

- `/Users/openclaw/.openclaw/workspace/clawdbot-hitl-gateway/src/gateway/hitl-request-store.ts`

Provides SQLite tables and helpers for:

- `hitl_requests`
- `hitl_decisions`
- `hitl_audit`

Capabilities:

- Create/get/list/update request records
- Record/list decisions
- Record/list audit events
- Return timeline view (`request + decisions + audit`)
- Deterministic SHA-256 audit hash generation for event integrity

### 3) HITL policy engine

File:

- `/Users/openclaw/.openclaw/workspace/clawdbot-hitl-gateway/src/gateway/hitl-policy-engine.ts`

Resolution priority:

1. Exact tool (`policy.tool`)
2. Category fallback (`policy.category`)
3. Wildcard pattern (`policy.pattern`, supports `*` and `?`)
4. Default policy (`defaultPolicyId` or unscoped policy)

Authorization checks:

- Minimum role requirement (`minApproverRole`) using configurable role ordering
- Optional requester/approver separation (`requireDifferentActor`)

### 4) HITL config schema

Files:

- `/Users/openclaw/.openclaw/workspace/clawdbot-hitl-gateway/src/config/types.approvals.ts`
- `/Users/openclaw/.openclaw/workspace/clawdbot-hitl-gateway/src/config/zod-schema.approvals.ts`

Adds `approvals.hitl` config surface:

- `defaultPolicyId`
- `approverRoleOrder`
- `policies[]` with `tool | category | pattern`, role requirements, and actor-separation controls

## Tests Added

- `/Users/openclaw/.openclaw/workspace/clawdbot-hitl-gateway/src/gateway/hitl-policy-engine.test.ts`
- `/Users/openclaw/.openclaw/workspace/clawdbot-hitl-gateway/src/gateway/hitl-request-store.test.ts`
- `/Users/openclaw/.openclaw/workspace/clawdbot-hitl-gateway/src/gateway/exec-approval-manager.test.ts`

## Follow-on Work (Phase 2+)

- Integrate policy gating into `node.invoke` and other tool entry points
- Forward HITL approval requests to operator channels
- Add request APIs/CLI for decision workflows
- Add escalation and timeout fallback behavior in gateway orchestration
