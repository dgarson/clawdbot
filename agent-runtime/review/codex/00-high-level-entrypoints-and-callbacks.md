# OpenClaw Agent Runtime: High-Level Entry Points and Callback Surface (Pi Runtime Baseline)

## Purpose

This document maps the current Pi runtime execution surface and callback points that must be preserved when adding a `csdk` runtime.

## Core public runtime façade

- `src/agents/pi-embedded.ts`
- `src/agents/pi-embedded-runner.ts`

These files re-export the same canonical run APIs used across CLI, auto-reply, cron, gateway, and extensions.

## High-level entry points

### 1) `runEmbeddedPiAgent`

Implemented in `src/agents/pi-embedded-runner/run.ts`.

Input:
- `RunEmbeddedPiAgentParams` from `src/agents/pi-embedded-runner/run/types.ts`

Output:
- `EmbeddedPiRunResult` (payloads, meta, messaging-tool telemetry, cron metadata).

Execution role:
- orchestrates prompt/model/agent selection
- drives attempt loop (retries, auth/profile rotation, compaction triggers)
- invokes attempt worker for streaming and tool execution

### 2) `subscribeEmbeddedPiSession`

Implemented in `src/agents/pi-embedded-subscribe.ts`.

Input:
- session context and callback map.

Execution role:
- attaches to provider stream/session callbacks
- turns provider events into OpenClaw assistant/tool/lifecycle events
- emits block-level and assistant stream callbacks

### 3) Run control plane (`queue/abort/wait/stream-state`)

Implemented in `src/agents/pi-embedded-runner/runs.ts`.

API surface:
- `setActiveEmbeddedRun`
- `clearActiveEmbeddedRun`
- `queueEmbeddedPiMessage`
- `isEmbeddedPiRunStreaming`
- `abortEmbeddedPiRun`
- `waitForEmbeddedPiRunEnd`

Execution role:
- keeps per-session run handles so callers can push messages, interrupt, and wait.

### 4) Runtime payload shaping + hooks and tools

Implemented via `run/payloads.ts`, `run/attempt.ts`, and `pi-embedded-subscribe.handlers.*`.

Execution role:
- transforms wire outputs into canonical payload objects
- applies verbosity/error/tool-redaction/suppression rules
- coordinates pre/post hook execution and tool approval behavior.

## Primary callback points

- Hook callbacks: `before_model_resolve`, `before_agent_start`, `before_prompt_build`, `llm_input`, `agent_end`, `llm_output`, `before_compaction`, `after_compaction`, `after_tool_call`.
- Stream callbacks:
  - `onPartialReply`
  - `onBlockReply`
  - `onBlockReplyFlush`
  - `onReasoningStream`
  - `onReasoningEnd`
  - `onAssistantMessageStart`
  - `onAgentEvent`
- Tool callbacks:
  - `onToolResult`
  - `handleToolExecutionStart`, `handleToolExecutionUpdate`, `handleToolExecutionEnd`
- Compaction callbacks:
  - `handleAutoCompactionStart`, `handleAutoCompactionEnd`

## External callers that consume entry points

- `src/commands/agent.ts` (primary CLI execution path)
- `src/auto-reply/reply/agent-runner*.ts` and `agent-runner-memory.ts` (scheduled and contextual triggers)
- `src/commands/agent.ts` fallback command wiring and streaming output path
- `src/cron/isolated-agent/run.ts` (automation path)
- `src/gateway/server-methods/sessions.ts` (abort/wait integration)
- `src/extensionAPI.ts` (SDK/API export)
- `extensions/voice-call/src/core-bridge.ts` and `extensions/voice-call/src/response-generator.ts`
- `extensions/llm-task/src/llm-task-tool.ts`
- `src/agents/tools/subagents-tool.ts`
- `src/agents/openclaw-tools.subagents.sessions-spawn.lifecycle.e2e` and related harness paths

## Why this matters for `csdk`

To reach parity, the new runtime should map to the same four public surfaces above, while preserving callback semantics, hook ordering, and error/payload behavior so external consumers remain unchanged.
