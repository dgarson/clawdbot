# TypeScript SDK Mode Selection

## POC runtime choice

Use Claude Agent SDK V1 `query()` for the first parity implementation.

Reason:
- V1 has the mature behavior needed for parity work.
- V2 is preview and explicitly incomplete for some runtime/session features.

## Query mode decision

Use **streaming input mode**:
- `query({ prompt: AsyncIterable<SDKUserMessage>, ... })`

Why:
- It is the closest fit to OpenClaw run control semantics:
  - queue/steer follow-up messages during active run
  - interrupt support
  - deterministic run lifecycle ownership

## Required SDK options for parity

- `includePartialMessages: true`
  - needed to preserve current partial stream behavior (`onPartialReply`, `onAgentEvent`).

- hook configuration (if exposed in SDK options)
  - needed to observe compact boundaries and permission decisions.

- permission control surface
  - integrate SDK `canUseTool` and approval modes with existing OpenClaw policy behavior.

## Message/event classes to normalize

At minimum support:
- partial assistant stream messages (raw stream events)
- user/assistant/tool messages
- system compact boundary messages
- result terminal message (success/error)

## Queue and interrupt mapping

- queue: append to AsyncIterable source backing `prompt`.
- abort: call SDK interrupt capability on active query object.
- wait: resolve when result terminal event is observed and stream closes.

## Include

- one queue feeder abstraction for streaming input mode.
- one event reader abstraction that emits normalized Pi-like events.
- one result collector that can derive `lastAssistant`, usage, stop reason, and error.

## Avoid

- single-turn mode as default for parity POC.
- mixed V1 and V2 within the same runtime path.
- bypassing SDK-defined result messages and stop reasons.
