# Mid-Level Document: `subscribeEmbeddedPiSession`

## Scope

This document covers stream subscription behavior. It receives runtime events and transforms them into OpenClaw callback emissions.

## File boundaries

- `src/agents/pi-embedded-subscribe.ts`
- `src/agents/pi-embedded-subscribe.handlers.ts`
- `src/agents/pi-embedded-subscribe.handlers.messages.ts`
- `src/agents/pi-embedded-subscribe.handlers.tools.ts`
- `src/agents/pi-embedded-subscribe.handlers.lifecycle.ts`
- `src/agents/pi-embedded-subscribe.handlers.compaction.ts`
- `src/agents/pi-embedded-subscribe.raw-stream.ts`
- `src/agents/pi-embedded-subscribe.handlers.types.ts`
- `src/agents/pi-embedded-subscribe.ts` is the orchestrator; handlers split by function.

## Callback contract

- Message stream callbacks:
  - `onPartialReply`
  - `onBlockReply`
  - `onAgentEvent`
  - `onBlockReplyFlush`
  - `onReasoningStream`
  - `onReasoningEnd`
  - `onAssistantMessageStart`
- Tool callbacks:
  - `onToolResult`
- Lifecycle and completion callbacks:
  - subscription cleanup and stream completion handling

## Subscription lifecycle

- Starts with session metadata and handler registration.
- Receives and parses provider blocks/assistant deltas.
- Buffers and normalizes content blocks before flush.
- Emits block-level events, then route finalization to completion callbacks.
- Handles both normal completion and error termination states.

## Tool and message interaction

- Tool events are observed at low-level block boundaries and normalized through helper handlers.
- A dedicated output formatting path updates `blockReplies` and final `onBlockReply` content.
- Tool results route into `onToolResult` with optional tool summary data.

## Reasoning path

- If reasoning events are enabled/enforced by provider output and options, reasoning chunks route through dedicated callbacks.
- Reasoning completion uses `onReasoningEnd` and can influence stream ordering/flush semantics.

## Compaction stream integration

- Compaction-related blocks/events are routed through compaction handlers that participate in `before_compaction` and `after_compaction` callbacks at the attempt level.
- Retry and continuation are handled upstream by run orchestration.

## Cleanup semantics

- Stream close/abort triggers lifecycle-end behavior.
- Errors are surfaced to lifecycle handlers and can affect attempt retry decisions.

## Suggested `csdk` integration points

- Create a `csdk` event adapter that emits the same normalized events and callback calls:
  - assistant delta/block events
  - tool-result events with matching timing
  - reasoning lifecycle events when available
  - lifecycle close/error states with equivalent metadata
- Keep handler module boundaries and callback ordering stable; avoid changing callback signatures.
