# CSDK to OpenClaw Event Normalization Contract

## Goal

Normalize CSDK output into the event shape already consumed by:
- `src/agents/pi-embedded-subscribe.handlers.ts`

This allows reuse of current message/tool/lifecycle/compaction handlers with minimal churn.

## Normalized event target

Adapter emits only existing internal event types:
- `agent_start`
- `message_start`
- `message_update`
- `message_end`
- `tool_execution_start`
- `tool_execution_update`
- `tool_execution_end`
- `auto_compaction_start`
- `auto_compaction_end`
- `agent_end`

## Mapping model

### Assistant stream

CSDK partial assistant events should map to `message_update` with `assistantMessageEvent` payloads:
- text begin -> `text_start`
- text delta -> `text_delta`
- text complete -> `text_end`
- thinking begin/delta/end -> `thinking_start` / `thinking_delta` / `thinking_end`

Emit `message_start` exactly once per assistant turn before first delta.
Emit `message_end` once when full assistant turn content is finalized.

### Tool lifecycle

CSDK tool use events map to:
- tool start -> `tool_execution_start`
- tool progress -> `tool_execution_update`
- tool finish -> `tool_execution_end`

Required fields preserved:
- `toolName`
- `toolCallId`
- `args` / `partialResult` / `result`
- `isError`

### Compaction lifecycle

CSDK compact boundary signals map to:
- boundary start or pre-compact signal -> `auto_compaction_start`
- compact completion -> `auto_compaction_end` with `willRetry` bool

### Agent lifecycle

- adapter start -> `agent_start`
- terminal result observed -> `agent_end`

## Ordering invariants

1. `agent_start` before any message/tool events.
2. `message_start` before first assistant `message_update` for that turn.
3. `tool_execution_start` before corresponding `tool_execution_end`.
4. `auto_compaction_start` before `auto_compaction_end`.
5. `agent_end` emitted once, last.

## Dedupe and monotonicity rules

- dedupe duplicate full-content `text_end` snapshots.
- ensure assistant deltas are monotonic when possible.
- suppress out-of-order late fragments after terminalization.

## Include

- explicit per-turn state machine in adapter.
- correlation maps for active tool calls and assistant turns.
- deterministic event queue (single writer) to preserve order.

## Avoid

- emitting raw SDK events directly to existing handlers.
- allowing concurrent emission from multiple async callbacks without queueing.
- creating new handler switch cases unless required.
