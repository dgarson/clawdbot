# Events, Hooks, And Callbacks

## Table Of Contents

- Gateway event stream
- Plugin typed hooks
- Callback execution semantics
- Event-to-hook integration points
- High-signal callback examples

## Gateway Event Stream

Published gateway event names:

- `connect.challenge` — Handshake nonce challenge before first authenticated request.
- `agent` — Agent execution lifecycle events and tool output fragments.
- `chat` — Chat-native streaming events.
- `presence` — Presence state changes.
- `tick` — Heartbeat/timer cadence events.
- `talk.mode` — Talk mode changes.
- `shutdown` — Shutdown notice and optional restart expectations.
- `health` — Health status updates.
- `heartbeat` — Periodic heartbeat events.
- `cron` — Cron job execution/state callbacks.
- `automations` — Automation run/status callbacks.
- `node.pair.requested` — Node pairing request created.
- `node.pair.resolved` — Node pairing approved/rejected.
- `node.invoke.request` — Node invocation request lifecycle event.
- `device.pair.requested` — Device pairing request created.
- `device.pair.resolved` — Device pairing approved/rejected.
- `voicewake.changed` — Voice wake config/state changed.
- `exec.approval.requested` — Legacy exec approval requested.
- `exec.approval.resolved` — Legacy exec approval resolved.
- `tool.approval.requested` — Canonical tool approval requested.
- `tool.approval.resolved` — Canonical tool approval resolved.

Primary source:

- `src/gateway/server-methods-list.ts`

## Plugin Typed Hooks

Typed hook names exposed to plugins:

- `before_agent_start`
- `agent_end`
- `before_compaction`
- `after_compaction`
- `message_received`
- `message_sending`
- `message_sent`
- `before_tool_call`
- `after_tool_call`
- `tool_result_persist`
- `session_start`
- `session_end`
- `gateway_start`
- `gateway_stop`

Primary source:

- `src/plugins/types.ts`

## Callback Execution Semantics

Hook runner behavior matters for architecture and safety:

- Void hooks run in parallel (`Promise.all`) for throughput.
- Modifying hooks run sequentially in priority order.
- `tool_result_persist` is synchronous and sequential by design.
- Hook errors are normally caught and logged (non-fatal) unless configured otherwise.

Primary source:

- `src/plugins/hooks.ts`
- `src/plugins/hook-runner-global.ts`

## Event-To-Hook Integration Points

- RPC handler callbacks emit gateway events (`context.broadcast`) to operator surfaces.
- Plugin hooks run in agent/channel execution flow, not directly in WS transport handshake.
- Approval RPCs emit both canonical and legacy callback events for compatibility.
- Node role callbacks (`node.event`, `node.invoke.result`) are separate from operator role invocation methods.

Primary source:

- `src/gateway/server-methods/tool-approval.ts`
- `src/gateway/server-methods/exec-approval.ts`
- `src/gateway/server/ws-connection/message-handler.ts`

## High-Signal Callback Examples

### Approval lifecycle callback

1. `tool.approval.request` RPC is sent.
2. Server emits `tool.approval.requested` event.
3. Operator resolves via `tool.approval.resolve`.
4. Server emits `tool.approval.resolved` (and legacy `exec.approval.resolved` for exec requests).

### Node invoke callback

1. Operator calls `node.invoke`.
2. Node receives invoke request and executes locally.
3. Node reports completion via `node.invoke.result`.
4. Gateway routes result callback to waiting operator/session.

### Message sending hook callback

1. Outbound message enters `message_sending` hook chain.
2. Plugins can modify content or cancel send.
3. Final payload dispatches to channel adapter.
4. `message_sent` hooks run asynchronously for post-send side effects.
