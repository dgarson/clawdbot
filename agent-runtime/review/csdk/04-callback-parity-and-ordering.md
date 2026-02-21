# Callback Parity and Ordering Matrix

## Purpose

Define the exact callback ordering and parity behavior that CSDK path must preserve.

Primary reference baseline:
- `agent-runtime/review/codex/04-callbacks-hooks-lifecycle.md`
- `agent-runtime/review/codex/05-callbacks-tool-and-approval.md`
- `agent-runtime/review/codex/07-callbacks-streaming-output.md`

## Hook lifecycle parity

Order must stay:
1. `before_model_resolve`
2. `before_agent_start` (legacy model resolve path)
3. `before_prompt_build`
4. `before_agent_start` (legacy prompt path)
5. `llm_input`
6. stream callbacks + tool callbacks + compaction callbacks
7. `agent_end`
8. `llm_output`

## Stream callback parity

For each assistant turn:
1. `onAssistantMessageStart`
2. zero or more `onPartialReply`
3. zero or more `onAgentEvent(stream="assistant")`
4. `onBlockReply` chunks or message-end block
5. optional `onReasoningStream` / `onReasoningEnd`

On tool boundary:
1. `onBlockReplyFlush` before `tool_execution_start` side effects
2. tool summary or output callbacks as gated by verbose settings

## Compaction parity

For compaction pass:
1. `before_compaction` hook (fire-and-forget)
2. compaction start event
3. compaction end event
4. `after_compaction` hook when final (non-retry)

## Tool parity

For each tool call:
1. start event
2. optional update events
3. end event
4. `onToolResult` summary/output media behavior
5. `after_tool_call` hook (fire-and-forget)

## Ordering table

| Surface | Pi behavior | CSDK parity requirement |
|---|---|---|
| Assistant start | `message_start` starts turn | synthesize before first delta |
| Assistant text delta | `message_update` text_delta | map partial assistant text |
| Assistant finalize | `message_end` | emit once with final message |
| Tool flush boundary | on tool start | preserve pre-tool flush |
| Tool summary emission | at tool start (verbose on/full) | identical gating |
| Tool output emission | at tool end (verbose full) | identical gating |
| Reasoning stream | optional streaming mode | preserve mode gates |
| Lifecycle error | from last assistant error | preserve `formatAssistantErrorText` usage |
| Compaction wait | retry tracking promise | preserve wait semantics |
| Run end cleanup | unsubscribe, clear active run | preserve always-run finally behavior |

## Include

- adapter-level assertion checks for ordering in test mode.
- trace logging with runId/sessionId for each normalized event.

## Avoid

- emitting `agent_end` before late tool/assistant events are drained.
- calling callbacks from multiple competing code paths for same event.
- changing existing verbose, reasoning, and block-chunking gates.
