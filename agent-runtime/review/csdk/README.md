# OpenClaw CSDK Runtime Review Set

This folder is a new, TypeScript-SDK-specific implementation review set for adding a `csdk` runtime with Pi parity and minimal churn.

Canonical baseline docs remain in:
- `agent-runtime/review/codex/*.md`

This set extends that baseline with SDK-specific guidance and implementation guardrails:
- `00-scope-and-principles.md`
- `01-runtime-dispatch-and-compatibility.md`
- `02-typescript-sdk-mode-selection.md`
- `03-event-normalization-contract.md`
- `04-callback-parity-and-ordering.md`
- `05-tools-approvals-and-hooks.md`
- `06-compaction-and-retry-model.md`
- `07-control-plane-queue-abort-wait.md`
- `08-error-and-payload-shaping.md`
- `09-test-strategy-and-acceptance.md`
- `10-phased-implementation-plan.md`
- `11-handoff-implementation-prompt.md`

External references used during this review:
- https://platform.claude.com/docs/en/agent-sdk/typescript
- https://platform.claude.com/docs/en/agent-sdk/streaming-vs-single-mode
- https://platform.claude.com/docs/en/agent-sdk/streaming-output
- https://platform.claude.com/docs/en/agent-sdk/permissions
- https://platform.claude.com/docs/en/agent-sdk/user-input
- https://platform.claude.com/docs/en/agent-sdk/hooks
- https://platform.claude.com/docs/en/agent-sdk/stop-reasons
- https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview
