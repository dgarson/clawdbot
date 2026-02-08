# Approval Workflow (Tiered)

## Table Of Contents

- Current gateway primitives
- Target multi-tier model
- Escalation rules
- RPC/event mapping
- Implementation status guidance

## Current Gateway Primitives

Current implemented primitives you can rely on now:

- Approval state machine: `ToolApprovalManager`
- Canonical RPCs: `tool.approval.request`, `tool.approval.resolve`, `tool.approvals.get`
- Legacy compatibility RPCs: `exec.approval.request`, `exec.approval.resolve`
- Approval events: `tool.approval.requested`, `tool.approval.resolved`, legacy `exec.approval.*`

Primary source:

- `src/gateway/tool-approval-manager.ts`
- `src/gateway/server-methods/tool-approval.ts`
- `src/gateway/server-methods/exec-approval.ts`

## Target Multi-Tier Model

Use this user-specified tier model when designing approval architecture:

- Tier 0: Auto-approve read-only/introspection operations.
- Tier 1: Lightweight risk classification + rules engine + optional model consult. Always consult medium-intelligence model for non-destructive writes. Any sub-check can escalate onward.
- Tier 3: Heavier classification with richer context/RAG, multi-factor approver logic, and learned policy patterns. Primarily for escalated non-destructive writes.
- Tier 4: Maximum-context, high-intelligence model evaluation for destructive or high-risk paths; default outcome can queue for human reevaluation instead of immediate execution.
- Human approval gate (final authority): Human can explicitly approve/deny escalated operations, and human outcomes should feed policy learning.

## Escalation Rules

Use these default escalation triggers:

- Escalate from Tier 0 to Tier 1 for any write, external side effect, or privileged target.
- Escalate from Tier 1 to Tier 3 when risk factors are numerous, contradictory, or policy confidence is low.
- Escalate from Tier 3 to Tier 4 for destructive, irreversible, or high-blast-radius operations.
- Escalate to human gate whenever model/rules cannot establish confident safety or when policy mandates explicit human confirmation.

## RPC/Event Mapping

- Tier request/decision state should be carried via `tool.approval.request` metadata (`riskClass`, `reasonCodes`, summaries).
- Approval lifecycle visibility should flow through `tool.approval.requested` and `tool.approval.resolved` events.
- Legacy exec-only clients can remain on `exec.approval.*` during migration, but new systems should target canonical tool approval RPCs.

## Implementation Status Guidance

- Treat Tier 0 and Tier 1 patterns as directly implementable now.
- Treat Tier 3 and Tier 4 as architecture targets requiring additional approver orchestration and richer policy modules.
- When describing current system behavior, separate "implemented now" vs "target design" explicitly.

Related design docs:

- `docs/refactor/adaptive-tool-approval-architecture.md`
- `docs/refactor/adaptive-tool-approval-implementation.md`
