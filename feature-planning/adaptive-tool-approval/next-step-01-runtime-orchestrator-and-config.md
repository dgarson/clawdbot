# Next Major Step 01 Prompt: Runtime Orchestrator + `approvals.tools` Config

Use this as the full prompt for the next implementation conversation.

## Mission

Implement the runtime enforcement seam so **every tool call** can be evaluated by adaptive tool approval policy before execution, while remaining backward-compatible with current behavior when disabled.

This step is the missing bridge between:

- existing gateway support for `tool.approval.*`
- existing static tool risk modules (`src/agents/tool-risk/*`)
- actual tool execution in `src/agents/pi-tools.ts` and `src/agents/pi-tools.before-tool-call.ts`

## Why This Is The Next Major Step

Current codebase status:

- Already implemented:
  - `tool.approval.request|resolve|get` gateway methods:
    - `src/gateway/server-methods/tool-approval.ts`
  - Tool approval manager with anti-stale `requestHash`:
    - `src/gateway/tool-approval-manager.ts`
  - Tool approval protocol schemas:
    - `src/gateway/protocol/schema/tool-approvals.ts`
  - Tool risk taxonomy/static resolver:
    - `src/agents/tool-risk/types.ts`
    - `src/agents/tool-risk/tool-risk-catalog.ts`
    - `src/agents/tool-risk/tool-risk-static.ts`
    - `src/agents/tool-risk/tool-risk-resolver.ts`
  - Plugin `riskProfile` plumbing:
    - `src/plugins/types.ts`
    - `src/plugins/registry.ts`
    - `src/plugins/tools.ts`

- Not yet implemented (critical gap):
  - No runtime invocation path currently calls `assessToolRisk(...)`.
  - `wrapToolWithBeforeToolCallHook(...)` only runs plugin hook logic, no approval orchestration.
  - `approvals.tools` config does not exist in config types/schema:
    - `src/config/types.approvals.ts`
    - `src/config/zod-schema.approvals.ts`

## Hard Constraints

- Preserve existing behavior when tool approvals are disabled.
- Do not break `before_tool_call` plugin hook behavior.
- Keep `tools.allow/deny` and sandbox policy checks unchanged.
- Do not modify legacy `ui/*`; web UI work is in `apps/web/*` only.
- Keep code paths deterministic; no random/non-reproducible decisions.

## Files You Must Read Before Editing

- `feature-planning/adaptive-tool-approval/adaptive-tool-approval-architecture.md`
- `feature-planning/adaptive-tool-approval/adaptive-tool-approval-implementation.md`
- `src/agents/pi-tools.ts`
- `src/agents/pi-tools.before-tool-call.ts`
- `src/agents/tool-risk/tool-risk-resolver.ts`
- `src/config/types.approvals.ts`
- `src/config/zod-schema.approvals.ts`
- `src/config/types.openclaw.ts`
- `src/config/zod-schema.ts`
- `src/gateway/tool-approval-manager.ts`
- `src/gateway/server-methods/tool-approval.ts`
- `src/gateway/call.ts`

## Required Implementation

### 1) Add `approvals.tools` config model (types + zod)

Update:

- `src/config/types.approvals.ts`
- `src/config/zod-schema.approvals.ts`

Add a new `approvals.tools` section while keeping existing `approvals.exec` unchanged.

At minimum include:

- `enabled?: boolean`
- `mode?: "off" | "adaptive" | "always"`
- `timeoutMs?: number`
- `policy?: { requireApprovalAtOrAbove?: "R0" | "R1" | "R2" | "R3" | "R4"; denyAtOrAbove?: "R0" | "R1" | "R2" | "R3" | "R4"; requireApprovalForExternalWrite?: boolean; requireApprovalForMessagingSend?: boolean; }`
- `routing?: { mode?: "session" | "targets" | "both"; targets?: ExecApprovalForwardTarget[]; agentFilter?: string[]; sessionFilter?: string[]; }`
- optional classifier block reserved for later:
  - `classifier?: { enabled?: boolean; timeoutMs?: number; minConfidence?: number; onLowConfidence?: "require_approval" | "deny" | "allow"; provider?: string; model?: string; maxInputChars?: number; }`

Backwards compatibility requirements:

- If `approvals.tools` is missing, runtime behavior must match current behavior exactly.
- Existing `approvals.exec` remains valid and still used by legacy paths.

### 2) Create a runtime tool-approval orchestrator module

Add new files (or equivalent structure under `src/agents/`):

- `src/agents/tool-approvals/types.ts`
- `src/agents/tool-approvals/tool-approval-decision-engine.ts`
- `src/agents/tool-approvals/tool-approval-orchestrator.ts`
- `src/agents/tool-approvals/tool-approval-request.ts`
- `src/agents/tool-approvals/index.ts`

Core behavior:

- Input: `toolName`, normalized params object, invocation context (`agentId`, `sessionKey`, `channel`, config).
- Use `assessToolRisk(...)` from `src/agents/tool-risk/tool-risk-resolver.ts`.
- Decision model:
  - `mode="off"` -> allow.
  - `mode="always"` -> request approval for all tool calls except explicit deny rules.
  - `mode="adaptive"` -> use risk/policy thresholds to return allow, deny, or approval-required.
- If approval required:
  - compute request hash with `ToolApprovalManager.computeRequestHash(...)`.
  - call gateway `tool.approval.request` with payload:
    - `toolName`, `paramsSummary`, `riskClass`, `sideEffects`, `reasonCodes`, `sessionKey`, `agentId`, `requestHash`, `timeoutMs`.
  - allow execution only on `allow-once` or `allow-always`.
  - deny on timeout/null or explicit deny.

### 3) Integrate orchestrator into before-tool-call wrapper path

Update:

- `src/agents/pi-tools.before-tool-call.ts`
- `src/agents/pi-tools.ts`

Required ordering:

1. Run existing plugin `before_tool_call` hook logic (including param mutation).
2. Run new orchestrator on the final params after hook mutation.
3. Execute tool only if orchestrator allows.

When blocked, throw stable machine-readable error shape (not ad-hoc strings), e.g.:

- code: `TOOL_APPROVAL_BLOCKED`
- reason: `policy_deny | approval_denied | approval_timeout | approval_request_failed`
- include tool name + risk class metadata where safe

Update `wrapToolWithBeforeToolCallHook` context type to include values needed for orchestration without leaking extra mutable state.

### 4) Implement summary + redaction for approval request payload

Add reusable helper to summarize params for operator prompts:

- bounded size (for example <= 1000 chars)
- secret-key redaction (token/password/secret/api_key/auth/cookie/etc.)
- stable deterministic serialization order

### 5) Add tests for runtime orchestration seam

Add/extend tests:

- `src/agents/pi-tools.before-tool-call.test.ts`
- new tests under `src/agents/tool-approvals/*.test.ts`
- verify tool risk modules remain green:
  - `src/agents/tool-risk/tool-risk-static.test.ts`
  - `src/agents/tool-risk/tool-risk-resolver.test.ts`

Minimum test matrix:

- `approvals.tools` missing -> current behavior unchanged.
- mode off -> always allow.
- adaptive + low-risk -> allow without gateway call.
- adaptive + high-risk -> gateway approval requested.
- approval allow-once -> execute.
- approval deny -> blocked.
- approval timeout/null -> blocked.
- `before_tool_call` hook mutated params are what orchestrator evaluates.

## Acceptance Criteria

- Every tool invocation passes through one centralized approval seam before execution.
- Approval policy is config-driven via `approvals.tools`.
- No behavior regression when disabled.
- Deterministic blocked reason codes are returned.
- Unit tests cover all mode/decision branches.

## Verification Commands

Run at minimum:

- `pnpm test src/agents/pi-tools.before-tool-call.test.ts`
- `pnpm test src/agents/tool-risk/tool-risk-static.test.ts src/agents/tool-risk/tool-risk-resolver.test.ts`
- `pnpm build`
- `pnpm check`

## Deliverable Format Required From Implementer

Return:

1. concise summary of what changed
2. exact files changed
3. decision table for mode/risk outcome behavior
4. test commands run + results
5. explicit note of any remaining gaps deferred to Step 02/03
