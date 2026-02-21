# `csdk` POC Parity Matrix and Scope Risk Register

## High-level parity matrix

| Area | Pi path | `csdk` target | Risk |
|---|---|---|---|
| Run orchestration | `runEmbeddedPiAgent` | keep orchestrator unchanged | Low |
| Hooks | `before_model_resolve` through `after_tool_call` | keep full ordering | Medium |
| Streaming callbacks | `subscribeEmbeddedPiSession` and message handlers | adapter must preserve ordering | High |
| Tool approval / sandbox behavior | tool execution handler chain | verify with existing test fixtures | High |
| Compaction | before/after compaction hooks + retry loop | requires event mapping | Medium |
| Abort/queue/wait | run control plane | reuse existing APIs | Low |
| Payload shaping | `run/payloads.ts` | reuse existing shaping | Medium |

## Callback surface dependency map

- Streaming layer depends on `onPartialReply`, `onBlockReply`, and `onBlockReplyFlush` ordering.
- Tool layer depends on `onToolResult`, tool start/update/end timing, and hook firing after tool completion.
- Compaction layer depends on before/after compaction timing and final result merging.
- Error layer depends on verbosity and mutating-action suppression rules.

## Implementation risks

- Reasoning tag differences in `csdk` streams may reorder flush boundaries.
- Tool result payload shape differences can create hook regressions in extension tools.
- Missing compaction equivalent in `csdk` stream can lead to silent context overrun failures.
- Run control queueing may deadlock if csdk stream lifecycle does not clear active runs in all branches.

## Validation tasks for downstream POC (informational, non-blocking for docs)

- Build a trace harness that records callback order against existing Pi tests.
- Replay the same callback-order assertions for a synthetic csdk session stream.
- Confirm no caller imports changed except dispatch internals.
