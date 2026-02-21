# Tools, Approvals, and Hook Semantics

## Objective

Preserve existing OpenClaw tool and hook behavior while integrating CSDK permission and tool execution model.

## Existing OpenClaw behavior to preserve

- `before_tool_call` may modify or block tool params.
- `after_tool_call` runs after completion with result/error context.
- tool summaries and outputs are emitted based on verbose level and tool type.
- messaging tool telemetry fields are tracked and surfaced in run result.

Current relevant files:
- `src/agents/pi-tool-definition-adapter.ts`
- `src/agents/pi-tools.before-tool-call.ts`
- `src/agents/pi-embedded-subscribe.handlers.tools.ts`
- `src/plugins/hooks.ts`

## CSDK permission alignment

SDK order (documented): hooks -> rules -> mode -> `canUseTool`.

Adapter requirements:
- integrate `canUseTool` decisions without bypassing existing OpenClaw policy.
- ensure blocked tools produce compatible payload/error behavior.
- ensure approval-required tools surface correctly in stream and lifecycle.

## Implementation model

- Keep OpenClaw tool wrappers as the policy source of truth.
- CSDK adapter should normalize tool lifecycle events rather than replace local policy stack.
- If CSDK can pre-block tools, map that into current blocked-tool semantics and avoid double execution.

## Messaging tool telemetry parity

Preserve from existing handlers:
- `didSendViaMessagingTool`
- `messagingToolSentTexts`
- `messagingToolSentMediaUrls`
- `messagingToolSentTargets`
- `successfulCronAdds`

## Include

- stable tool call ids across start/update/end.
- exact mapping of `isError`, result payload, and extracted media paths.
- after-tool hook event with duration and sanitized result.

## Avoid

- introducing a second independent path that also emits `after_tool_call` for the same call.
- changing hook context shape in `src/plugins/hooks.ts`.
- dropping pending message commit semantics on tool error.

## POC guardrails

- Fail closed on ambiguous approval state.
- Do not emit success telemetry for tool calls that were blocked or interrupted.
- Keep mutating action fingerprint behavior stable for unresolved tool errors.
