# Mid-Level Document: Callback Path (Streaming Assistant Output)

## Scope

Assistant message and block streaming callbacks are consumed by CLI UX, auto-reply tests, and real-time clients.

## File boundaries

- `src/agents/pi-embedded-subscribe.handlers.messages.ts`
- `src/agents/pi-embedded-subscribe.handlers.ts`
- `src/agents/pi-embedded-subscribe.handlers.lifecycle.ts`
- `src/agents/pi-embedded-subscribe.raw-stream.ts`
- `src/commands/agent.ts`

## Callback categories

- `onPartialReply`: progressive rendering events.
- `onBlockReply`: block-level finalized output.
- `onBlockReplyFlush`: flush boundary emitted before sensitive lifecycle transitions.
- `onAssistantMessageStart`: indicates stream-start semantics for assistant message lifecycle.
- `onReasoningStream` and `onReasoningEnd`: reasoning-channel emissions when enabled.
- `onAgentEvent`: generic structured event stream used by tools/observability.

## Ordering expectations

- `onAssistantMessageStart` should fire before initial assistant blocks.
- `onBlockReplyFlush` can happen before tool execution starts in certain block transitions.
- Reasoning streams should not break main assistant block ordering.
- Block flush must still fire for finalization when stream ends.

## Suggested `csdk` adapter pattern

- Implement deterministic event sequencing in adapter so existing consumers receive equivalent ordering.
- Ensure flush semantics are preserved even if csdk streams differently by default.
