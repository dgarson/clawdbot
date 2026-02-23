# Mid-Level Document: Callback Path (Tool Execution, Approval, and Sandbox)

## Scope

Defines tool-related callback behavior that must be preserved for `csdk` parity, especially for approval gates and side-effect controls.

## File boundaries

- `src/agents/pi-embedded-subscribe.handlers.tools.ts`
- `src/agents/pi-embedded-subscribe.handlers.lifecycle.ts`
- `src/agents/pi-embedded-runner/run/attempt.ts`
- `src/plugins/hooks.ts`
- plugin consumers and sandbox-related adapters in tools layer

## Core flow

1. A tool block is parsed from stream data and starts execution lifecycle.
2. `handleToolExecutionStart` emits metadata for tracking and can influence output behavior.
3. Tool progress can emit update events during streaming execution.
4. `handleToolExecutionEnd` finalizes and returns a stream-friendly representation.
5. `onToolResult` callback emits final result payload to upstream.
6. Messaging tool usage is tracked and marked in result metadata.
7. `after_tool_call` hook runs with structured tool output context.

## Approval and safety semantics

- Approval logic is tied to where tools are dispatched and how `onToolResult` is surfaced.
- Tool result formatting and output suppression rules determine what is emitted to users, especially for mutating actions.
- Tool usage that triggers sandboxed messaging targets is tracked and must retain redaction/metadata behavior.

## Messaging tool telemetry

- `didSendViaMessagingTool` and companion result fields are populated through the run result contract.
- `csdk` must maintain equivalent fields so callers can infer message-dispatch outcomes.

## Tool suppression and summarization

- Tool result payloads may be compacted or summarized depending on config and tool behavior.
- Messaging or side-effect tools require policy-sensitive shaping.

## Suggested `csdk` adapter pattern

- Keep existing tool-callback module boundaries.
- Introduce a provider adapter that emits normalized internal tool events.
- Keep tool lifecycle event boundaries identical:
  - start -> optional update -> end -> `onToolResult`.
