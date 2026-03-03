# Agent Runtime Interface — Unifying Pi and Claude SDK

**Date:** 2026-02-24
**Status:** Draft
**Goal:** Replace the runtime-conditional branches scattered through `attempt.ts` with a shared `AgentRuntime` interface and adapter pattern, reducing upstream diff invasiveness while maintaining full behavioral parity between the Pi and Claude SDK runtimes.

**Source branch:** `dgarson/fork` (all file references below are relative to that branch unless marked `[main]`)

---

## Table of Contents

- [Problem](#problem)
- [Design](#design)
- [File Reference: Existing Code](#file-reference-existing-code)
- [File Reference: Claude SDK Runner Module](#file-reference-claude-sdk-runner-module)
- [Event Parity Matrix](#event-parity-matrix)
- [Impact Assessment](#impact-assessment)
- [Known Limitations](#known-limitations)
- [Implementation Order](#implementation-order)

---

## Problem

The `dgarson/fork` branch integrates the Claude Agent SDK by inserting runtime-conditional branches directly into `attempt.ts` (~1400 lines, already the most complex file in the agent runner). This creates:

1. **Invasive diff**: ~674 lines changed in `attempt.ts`, most of which are `if/else` branches
2. **Dual-path reasoning**: Every future feature addition must consider both code paths
3. **Unsafe typing**: `as unknown as typeof session` cast at the branch point
4. **Scattered concerns**: Pi-specific streamFn wiring (~110 lines) gated by runtime checks

### Branch points in `attempt.ts` (on `dgarson/fork`)

| Location       | Guard                                            | Concern                                                                                                                                      |
| -------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| ~line 622      | `runtime === "claude-sdk" ? false : ...`         | Disable synthetic tool result repairs                                                                                                        |
| ~lines 694-725 | `if (runtime === "claude-sdk") {...} else {...}` | Two entirely different session creation paths                                                                                                |
| ~lines 730-744 | `if (runtime !== "claude-sdk")`                  | Tool result context guard (Pi only)                                                                                                          |
| ~lines 770-879 | `if (runtime !== "claude-sdk")`                  | StreamFn assignment, extra params, cost attribution headers, cache tracing, thinking block drops, tool call ID sanitization, payload logging |
| ~line 1000     | `runtime === "claude-sdk" ? false : ...`         | Final tag enforcement                                                                                                                        |

---

## Design

### Core: `AgentRuntime` interface

A minimal interface representing the session surface that `attempt.ts` actually consumes. Both runtimes produce objects conforming to this interface. `attempt.ts` becomes runtime-agnostic.

```
┌─────────────┐     ┌──────────────────┐
│ attempt.ts  │────>│  AgentRuntime    │ (interface)
│ (generic)   │     │  subscribe()     │
│             │     │  prompt()        │
└─────────────┘     │  steer()         │
                    │  abort()         │
                    │  dispose()       │
                    │  messages        │
                    │  isStreaming     │
                    │  replaceMessages │
                    │  runtimeHints    │
                    └──────┬───────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
     ┌────────▼─────────┐    ┌─────────▼──────────┐
     │ PiRuntimeAdapter │    │ ClaudeSdkRuntime    │
     │ (wraps AgentSes) │    │ (native impl)       │
     │                  │    │                      │
     │ streamFn wiring  │    │ query() loop         │
     │ context guard    │    │ MCP tool bridge      │
     │ thinking drops   │    │ event translation    │
     │ tool ID sanitize │    │ provider env         │
     │ payload logging  │    │ session resume       │
     └──────────────────┘    └──────────────────────┘
```

#### Interface definition (new file: `src/agents/agent-runtime.ts`)

```typescript
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { EmbeddedPiSubscribeEvent } from "./pi-embedded-subscribe.handlers.types.js";

export interface AgentRuntime {
  subscribe(handler: (evt: EmbeddedPiSubscribeEvent) => void): () => void;
  prompt(
    text: string,
    options?: { images?: Array<{ type: string; media_type: string; data: string }> },
  ): Promise<void>;
  steer(text: string): Promise<void>;
  abort(): void;
  abortCompaction(): void;
  dispose(): void;
  replaceMessages(messages: AgentMessage[]): void;
  readonly isStreaming: boolean;
  readonly isCompacting: boolean;
  readonly messages: AgentMessage[];
  readonly sessionId: string;
  readonly runtimeHints: AgentRuntimeHints;
}

export interface AgentRuntimeHints {
  /** Whether to allow synthetic tool result repair in SessionManager. */
  allowSyntheticToolResults: boolean;
  /** Whether to enforce <final> tag extraction. */
  enforceFinalTag: boolean;
}
```

### Adapter 1: `PiRuntimeAdapter` (new file: `src/agents/pi-embedded-runner/pi-runtime-adapter.ts`)

Wraps Pi's `AgentSession` (from `@mariozechner/pi-coding-agent`) to conform to `AgentRuntime`. Absorbs all Pi-specific streamFn wiring currently scattered in `attempt.ts` lines ~730-879:

1. `applySystemPromptOverrideToSession()` — system prompt injection
2. `installToolResultContextGuard()` — context guard wrapping `agent.transformContext`
3. StreamFn assignment — Ollama native API vs `streamSimple`
4. `applyExtraParamsToAgent()` — model-specific extra params
5. Cost attribution headers (`X-OpenClaw-Session-Id`, `X-OpenClaw-Agent-Id`)
6. Cache tracing (`cacheTrace.wrapStreamFn()`)
7. Thinking block drops (`dropThinkingBlocks` streamFn wrapper)
8. Tool call ID sanitization (`sanitizeToolCallIdsForCloudCodeAssist` wrapper)
9. Payload logging (`anthropicPayloadLogger.wrapStreamFn()`)

The adapter delegates `subscribe`, `prompt`, `steer`, `abort`, `abortCompaction`, `dispose` directly to the wrapped session. `replaceMessages` delegates to `session.agent.replaceMessages()`. Properties `isStreaming`, `isCompacting`, `messages`, `sessionId` are pass-through getters.

**`runtimeHints`** are set from the resolved transcript policy and `enforceFinalTag` param.

### Adapter 2: `ClaudeSdkRuntime` (modify existing `src/agents/claude-sdk-runner/`)

The existing `ClaudeSdkSession` type (in `types.ts`) already implements most of the `AgentRuntime` surface. Changes needed:

1. Add `replaceMessages()` as a top-level method (currently nested under `.agent`)
2. Add `runtimeHints` with hardcoded values:
   - `allowSyntheticToolResults: false` — server-side session; no local repair needed
   - `enforceFinalTag: false` — Claude uses structured thinking, not XML tags
3. Update the type to extend/implement `AgentRuntime`
4. Remove the `.agent` shim (no longer needed by attempt.ts)

### What `attempt.ts` becomes

The ~130 lines of runtime branching collapse to a single factory dispatch:

```typescript
// One remaining branch: factory selection. Everything else is generic.
const agentRuntime: AgentRuntime = runtime === "claude-sdk"
  ? await createClaudeSdkRuntime(params, claudeSdkConfig, sessionManager, ...)
  : createPiRuntimeAdapter({ session: piSession, systemPromptText, model, ... });

// All downstream code uses agentRuntime uniformly:
const subscription = subscribeEmbeddedPiSession({
  session: agentRuntime,
  enforceFinalTag: agentRuntime.runtimeHints.enforceFinalTag,
  ...
});

sessionManager = createSessionManager({
  allowSyntheticToolResults: agentRuntime.runtimeHints.allowSyntheticToolResults,
  ...
});
```

No more `if (runtime !== "claude-sdk") { ... 110 lines ... }` blocks.

---

## File Reference: Existing Code

These are the files on `main` (or the Pi runtime path) that are relevant to understanding the current architecture and what the adapter pattern wraps.

### Config and types

| File                                             | Purpose                                                                                                                                                                                   | Key exports/types                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/config/zod-schema.agent-runtime.ts` [main]  | Agent entry schema (Zod). On `dgarson/fork`, this file also contains `ClaudeSdkConfigSchema`, `runtime: z.enum(["pi","claude-sdk"])`, and `claudeSdk` fields added to `AgentEntrySchema`. | `AgentEntrySchema`, `ClaudeSdkConfigSchema` (fork), `ClaudeSdkConfig` (fork) |
| `src/config/zod-schema.agent-defaults.ts` [main] | Agent defaults schema. Fork adds matching `runtime` and `claudeSdk` fields here.                                                                                                          | `AgentDefaultsSchema`                                                        |
| `src/config/types.agents.ts` (fork)              | TypeScript types for agent config entries. Fork adds `runtime?: "pi" \| "claude-sdk"` and `claudeSdk?: ClaudeSdkConfig`.                                                                  | `AgentConfig`                                                                |
| `src/config/types.agent-defaults.ts` (fork)      | TypeScript types for agent defaults. Fork adds same fields.                                                                                                                               | `AgentDefaultsConfig`                                                        |

### Agent runner (Pi path)

| File                                           | Purpose                                                                                                                                                     | Key exports                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `src/agents/pi-embedded-runner/run.ts`         | Entry point: `runEmbeddedPiAgent()`. Resolves model, auth, retries with failover. Passes `params.runtime` through to `attempt.ts`.                          | `runEmbeddedPiAgent()`                                 |
| `src/agents/pi-embedded-runner/run/params.ts`  | `RunEmbeddedPiAgentParams` type. Fork adds `runtime?: "pi" \| "claude-sdk"`.                                                                                | `RunEmbeddedPiAgentParams`                             |
| `src/agents/pi-embedded-runner/run/types.ts`   | `EmbeddedRunAttemptParams` and `EmbeddedRunAttemptResult`. Fork adds `resolvedProviderAuth`, `toolDiagnosticExtraInfos`, `toolDiagnosticDebugInfos`.        | `EmbeddedRunAttemptParams`, `EmbeddedRunAttemptResult` |
| `src/agents/pi-embedded-runner/run/attempt.ts` | The core prompt execution logic (~1400 lines). Creates session, subscribes to events, runs prompt loop. **This is the file with all the runtime branches.** | `runEmbeddedAttempt()`                                 |

### Event subscription pipeline

| File                                                      | Purpose                                                                                                                                                                                         | Key exports                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `src/agents/pi-embedded-subscribe.ts`                     | `subscribeEmbeddedPiSession()` — registers handler on session, accumulates `assistantTexts`, `toolMetas`, `usageTotals`. Returns accessor functions.                                            | `subscribeEmbeddedPiSession()` |
| `src/agents/pi-embedded-subscribe.handlers.ts`            | Event router — dispatches `evt.type` to handler functions. Handles 10 event types.                                                                                                              | `createBaseEventHandler()`     |
| `src/agents/pi-embedded-subscribe.handlers.types.ts`      | `EmbeddedPiSubscribeEvent` union type. Also `SubscribeEmbeddedPiSessionParams`, handler context types.                                                                                          | `EmbeddedPiSubscribeEvent`     |
| `src/agents/pi-embedded-subscribe.handlers.lifecycle.ts`  | `handleAgentStart`, `handleAgentEnd` — lifecycle events, `emitAgentEvent`, `onAgentEvent` callback.                                                                                             |                                |
| `src/agents/pi-embedded-subscribe.handlers.messages.ts`   | `handleMessageStart`, `handleMessageUpdate`, `handleMessageEnd` — text/thinking streaming, `onPartialReply`, `onReasoningStream`, `onReasoningEnd`, `onAssistantMessageStart`, usage recording. |                                |
| `src/agents/pi-embedded-subscribe.handlers.tools.ts`      | `handleToolExecutionStart`, `handleToolExecutionUpdate`, `handleToolExecutionEnd` — tool lifecycle, `onToolResult`, `after_tool_call` hook, diagnostic info accumulation.                       |                                |
| `src/agents/pi-embedded-subscribe.handlers.compaction.ts` | `handleAutoCompactionStart`, `handleAutoCompactionEnd` — compaction events, `before_compaction`/`after_compaction` hooks.                                                                       |                                |
| `src/agents/pi-embedded-subscribe.types.ts`               | Callback type definitions: `onPartialReply`, `onAssistantMessageStart`, `onToolResult`, `onAgentEvent`, `onReasoningStream`, `onReasoningEnd`, `onBlockReplyFlush`.                             |                                |

### Usage tracking

| File                  | Purpose                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/agents/usage.ts` | `normalizeUsage()` — handles both `input_tokens`/`output_tokens` (Anthropic) and `input`/`output` (Pi) field naming conventions. Called from `handleMessageEnd`. |

### Pi session wiring (functions that move into `PiRuntimeAdapter`)

| File                                                         | Function                                                                                             | Currently called from             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------- |
| `src/agents/pi-embedded-runner/system-prompt-override.ts`    | `applySystemPromptOverrideToSession()`                                                               | `attempt.ts` ~line 724            |
| `src/agents/pi-embedded-runner/tool-result-context-guard.ts` | `installToolResultContextGuard()`                                                                    | `attempt.ts` ~line 735            |
| `src/agents/pi-embedded-runner/extra-params.ts`              | `applyExtraParamsToAgent()`                                                                          | `attempt.ts` ~line 787            |
| `src/agents/pi-embedded-runner/ollama.ts`                    | `createOllamaStreamFn()`                                                                             | `attempt.ts` ~line 781            |
| `src/agents/pi-embedded-runner/cache-trace.ts`               | `createCacheTrace()` + `.wrapStreamFn()`                                                             | `attempt.ts` ~line 813-819        |
| `src/agents/pi-embedded-runner/payload-logger.ts`            | `createAnthropicPayloadLogger()` + `.wrapStreamFn()`                                                 | `attempt.ts` ~line 874-877        |
| `src/agents/pi-embedded-runner/transcript-policy.ts`         | `resolveTranscriptPolicy()` — provides `dropThinkingBlocks`, `sanitizeToolCallIds`, `toolCallIdMode` | `attempt.ts` (multiple locations) |
| `src/agents/tool-call-id.ts`                                 | `sanitizeToolCallIdsForCloudCodeAssist()`                                                            | `attempt.ts` ~line 859            |
| `src/agents/pi-embedded-helpers/google.ts`                   | `dropThinkingBlocks()`                                                                               | `attempt.ts` ~line 833            |

### Hooks and plugins

| File                                | Purpose                                                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/plugins/types.ts`              | `PluginHookBeforeToolCallEvent`, `PluginHookAfterToolCallEvent`, `PluginHookBeforeAgentStartResult` type definitions. |
| `src/plugins/hooks.ts`              | `runAfterToolCall()`, `runBeforeToolCall()` — hook execution.                                                         |
| `src/plugins/hook-runner-global.ts` | `getGlobalHookRunner()` — singleton hook runner access.                                                               |

---

## File Reference: Claude SDK Runner Module

All files under `src/agents/claude-sdk-runner/` on the `dgarson/fork` branch. This module is a **clean addition** — no files on `main` are modified by it.

### Source files (2,118 lines total)

| File                      | Lines | Purpose                                                                                                                                                                                                                                                |
| ------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.ts`                | 1     | Barrel export: `export { createClaudeSdkSession } from "./create-session.js"`                                                                                                                                                                          |
| `types.ts`                | 138   | Type definitions: `ClaudeSdkCompatibleTool`, `ClaudeSdkSessionParams`, `ClaudeSdkSession`, `ClaudeSdkEventAdapterState`, `ClaudeSdkMcpToolServerParams`                                                                                                |
| `create-session.ts`       | 491   | Main factory: `createClaudeSdkSession()`. Builds query options, runs the `query()` async generator loop, handles steer-interrupt-resume, implements the session object.                                                                                |
| `prepare-session.ts`      | 71    | Glue: validates credentials, loads resume session ID from SessionManager, calls `createClaudeSdkSession()`. Called from `attempt.ts`.                                                                                                                  |
| `event-adapter.ts`        | 668   | Translates SDK `query()` messages to `EmbeddedPiSubscribeEvent` format. Handles `system/init`, `stream_event`, `assistant`, `result`, `compact_boundary`. Does NOT emit tool events (those come from `mcp-tool-server.ts`).                            |
| `mcp-tool-server.ts`      | 238   | In-process MCP server bridging OpenClaw tools to the SDK subprocess. Emits `tool_execution_start`/`update`/`end` events. Handles TypeBox→Zod schema conversion, tool result formatting, JSONL persistence.                                             |
| `provider-env.ts`         | 148   | Builds subprocess `env` for non-Anthropic providers. Hardcoded URLs and model names for minimax, minimax-portal, zai, openrouter. Custom provider escape hatch. Returns `undefined` for claude-code/anthropic.                                         |
| `schema-adapter.ts`       | 194   | Converts TypeBox JSON Schema to Zod for the SDK's `tool()` helper. Handles String, Number, Boolean, Array, Object, Optional, Union, Enum, Literal, Unsafe, Null.                                                                                       |
| `error-mapping.ts`        | 111   | Maps SDK error types to messages/names that pass through existing Pi error classifiers (`isTimeoutError`, `isAuthAssistantError`, `isBillingAssistantError`, `isRateLimitAssistantError`, `isFailoverAssistantError`, `isLikelyContextOverflowError`). |
| `spawn-stdout-logging.ts` | 58    | Wraps subprocess spawn to capture stdout tail (last 4096 chars) on exit code 1 for diagnostics.                                                                                                                                                        |

### Test files (3,773 lines total)

| File                                     | Lines | Covers                                                                            |
| ---------------------------------------- | ----- | --------------------------------------------------------------------------------- |
| `__tests__/session-lifecycle.test.ts`    | 956   | Session creation, resume, session ID capture, prompt loop, steer-interrupt, abort |
| `__tests__/event-contract.test.ts`       | 1,606 | All event type emissions, streaming, thinking, text, compaction, agent lifecycle  |
| `__tests__/mcp-tool-server.test.ts`      | 559   | Tool registration, execution lifecycle, error handling, concurrent calls          |
| `__tests__/schema-adapter.test.ts`       | 244   | TypeBox→Zod conversions for all supported types                                   |
| `__tests__/error-mapping.test.ts`        | 177   | All SDK error → Pi classification mappings                                        |
| `__tests__/provider-env.test.ts`         | 131   | Env building per provider, credential stripping/injection                         |
| `__tests__/spawn-stdout-logging.test.ts` | 100   | Stdout tail capture, exit code handling                                           |

### Additional files on `dgarson/fork` related to Claude SDK

| File                                                     | Purpose                                                                                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/agents/pi-embedded-runner/claude-sdk-hooks.test.ts` | Tests that MCP tool server events use correct Pi field names (`toolCallId` not `toolId`, `args` not `input`). Verifies hook integration. |
| `src/config/zod-schema.agent-runtime.ts` (diff)          | Adds `ClaudeSdkConfigSchema` (discriminated union on `provider`), `runtime` and `claudeSdk` fields to `AgentEntrySchema`.                |
| `docs/plans/2026-02-20-claude-sdk-runtime-config.md`     | Original implementation plan from the fork (5 tasks, provider-env focused).                                                              |
| `agent-runtime/review/`                                  | Codex-generated review documents (10 files each for codex/ and csdk/ subdirs). Reference material, not implementation.                   |

---

## Event Parity Matrix

All 13 event types handled by `subscribeEmbeddedPiSession` are emitted by both runtimes through `subscribe()`:

| Event                             | Pi Source              | Claude SDK Source                   | Status                                                                                   |
| --------------------------------- | ---------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `agent_start`                     | AgentSession           | event-adapter.ts (system/init)      | Parity                                                                                   |
| `agent_end`                       | AgentSession           | event-adapter.ts (result)           | Parity                                                                                   |
| `message_start`                   | AgentSession           | event-adapter.ts (stream/assistant) | Parity                                                                                   |
| `message_update` (text_delta)     | AgentSession streaming | event-adapter.ts                    | Parity                                                                                   |
| `message_update` (text_end)       | AgentSession streaming | event-adapter.ts                    | Parity                                                                                   |
| `message_update` (text_start)     | AgentSession streaming | NOT emitted                         | Intentional — first text_delta subsumes it; handler uses it only for monotonicity checks |
| `message_update` (thinking_start) | AgentSession           | event-adapter.ts                    | Parity                                                                                   |
| `message_update` (thinking_delta) | AgentSession           | event-adapter.ts                    | Parity                                                                                   |
| `message_update` (thinking_end)   | AgentSession           | event-adapter.ts                    | Parity                                                                                   |
| `message_end`                     | AgentSession           | event-adapter.ts                    | Parity                                                                                   |
| `tool_execution_start`            | AgentSession tool loop | mcp-tool-server.ts                  | Parity                                                                                   |
| `tool_execution_update`           | AgentSession tool loop | mcp-tool-server.ts                  | Parity                                                                                   |
| `tool_execution_end`              | AgentSession tool loop | mcp-tool-server.ts                  | Parity                                                                                   |
| `auto_compaction_start`           | AgentSession           | event-adapter.ts (compact_boundary) | Parity                                                                                   |
| `auto_compaction_end`             | AgentSession           | event-adapter.ts (compact_boundary) | Parity                                                                                   |

### Callback parity

| Callback                  | Triggered by                      | Both runtimes? |
| ------------------------- | --------------------------------- | -------------- |
| `onPartialReply`          | `message_update` (text_delta)     | Yes            |
| `onAssistantMessageStart` | `message_start`                   | Yes            |
| `onToolResult`            | `tool_execution_end`              | Yes            |
| `onAgentEvent`            | All event types                   | Yes            |
| `onReasoningStream`       | `message_update` (thinking_delta) | Yes            |
| `onReasoningEnd`          | `message_update` (thinking_end)   | Yes            |
| `onBlockReplyFlush`       | `tool_execution_start`            | Yes            |

### Hook parity

| Hook                | Trigger                                                                    | Both runtimes? |
| ------------------- | -------------------------------------------------------------------------- | -------------- |
| `before_tool_call`  | Wrapped `.execute()` in tool definitions (applied upstream at pi-tools.ts) | Yes            |
| `after_tool_call`   | `tool_execution_end` in handlers.tools.ts                                  | Yes            |
| `before_compaction` | `auto_compaction_start` in handlers.compaction.ts                          | Yes            |
| `after_compaction`  | `auto_compaction_end` in handlers.compaction.ts                            | Yes            |

### Usage tracking

Both runtimes attach `usage` to assistant messages. `handleMessageEnd` calls `recordAssistantUsage()` which uses `normalizeUsage()` (in `src/agents/usage.ts`). The normalizer handles both `input_tokens`/`output_tokens` (Anthropic/Claude SDK format) and `input`/`output` (Pi format).

---

## Impact Assessment

### Files changed (net from `main`)

| File                                                       | Change                                                                                        | Net LOC             |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------- |
| `src/agents/agent-runtime.ts`                              | **New** — interface + hints type                                                              | +55                 |
| `src/agents/pi-embedded-runner/pi-runtime-adapter.ts`      | **New** — wraps Pi session, absorbs streamFn wiring moved from attempt.ts                     | +150                |
| `src/agents/pi-embedded-runner/pi-runtime-adapter.test.ts` | **New** — tests for Pi adapter wiring                                                         | +80                 |
| `src/agents/claude-sdk-runner/types.ts`                    | Update `ClaudeSdkSession` to implement `AgentRuntime`, add `replaceMessages` + `runtimeHints` | ~15                 |
| `src/agents/claude-sdk-runner/create-session.ts`           | Add `replaceMessages` and `runtimeHints` to session object, remove `.agent` shim              | ~10 net             |
| `src/agents/pi-embedded-runner/run/attempt.ts`             | Remove 12 branch points, replace with factory call                                            | **~-130 net**       |
| `src/agents/claude-sdk-runner/` (all other files)          | Clean addition from fork, no changes needed                                                   | +2,118 (new module) |
| Config schema files                                        | Add `runtime`, `claudeSdk`, `ClaudeSdkConfigSchema`                                           | ~50                 |

### What does NOT change

- Pi's `AgentSession` class (external package `@mariozechner/pi-coding-agent`)
- `subscribeEmbeddedPiSession()` and all 6 handler modules
- Event types and callback signatures
- Hook contracts and plugin types
- `run.ts` entry point (still passes `runtime` param)
- `resolveAgentRuntime()` / `resolveClaudeSdkConfig()` helper functions in attempt.ts

### Upstream diff improvement

- Current fork: attempt.ts is +674 lines of diff, dominated by `if/else` branching
- With this refactoring: attempt.ts diff becomes **net negative** (deletions > additions)
- New files (`agent-runtime.ts`, `pi-runtime-adapter.ts`) are clean additions with no merge risk
- The `claude-sdk-runner/` directory is a clean addition (no conflicts with `main`)

---

## Known Limitations

These are inherent to the Claude SDK runtime, not introduced by this design:

1. **Steer injection delay**: Claude SDK queues steer text for the next `prompt()` call. Pi injects mid-loop between tool call rounds. (create-session.ts:414-419)
2. **Local-only message history**: `replaceMessages()` on Claude SDK updates a local mirror only. The server-side session (via `resume` parameter with `session_id`) holds the truth. (create-session.ts:482-486)
3. **No `text_start` event**: Intentionally skipped. The first `text_delta` subsumes it. The Anthropic streaming API never sends content on `content_block_start` for text blocks, so emitting it would be a no-op. (event-adapter.ts:464-467)
4. **Compaction is server-side**: `abortCompaction()` is a no-op. `auto_compaction_start/end` events come from `compact_boundary` system messages, not local detection. (create-session.ts:433-437)

---

## Implementation Order

1. **Create `src/agents/agent-runtime.ts`** — interface definition + `AgentRuntimeHints` type
2. **Create `src/agents/pi-embedded-runner/pi-runtime-adapter.ts`** — move Pi-specific streamFn wiring from attempt.ts into the adapter factory
3. **Update Claude SDK types and session** — `ClaudeSdkSession` implements `AgentRuntime`, add `replaceMessages()` + `runtimeHints`, remove `.agent` shim
4. **Refactor `attempt.ts`** — replace all runtime branches with factory dispatch to `AgentRuntime`
5. **Add tests for Pi adapter** — verify streamFn wiring, context guard installation, hint values
6. **Full typecheck + test suite pass** — `pnpm tsgo && pnpm test`
