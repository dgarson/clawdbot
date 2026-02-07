# Execution Layer

> **Status**: Implemented — all phases complete  
> **Source**: `src/execution/`  
> **Design docs**: `docs/refactor/agent-session-kernel.md`, `docs/refactor/turn-execution-pipeline.md`, `docs/refactor/runtime-context-resolver.md`

## Overview

The Execution Layer is the unified orchestration architecture for all agent runs in OpenClaw. Every agent execution — whether triggered by a chat message, CLI command, cron job, or sub-agent spawn — flows through the same pipeline. This replaces previously scattered entry points that each assembled configuration, runtime context, and callbacks independently.

## Architecture

The execution layer is composed of four core services that form a layered stack:

```
┌─────────────────────────────────────────┐
│           Entry Points                  │
│  (auto-reply, CLI, cron, extensions)    │
│                                         │
│     Build ExecutionRequest              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         ExecutionKernel                 │
│  Orchestrates the full lifecycle        │
│  • Validates request                    │
│  • Generates runId                      │
│  • Emits lifecycle events               │
│  • Coordinates resolver → executor      │
│  • Persists state                       │
│  • Returns ExecutionResult              │
└──────────────┬──────────────────────────┘
               │
     ┌─────────┼─────────┐
     ▼         ▼         ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│ Runtime │ │  Turn   │ │  State  │
│Resolver │ │Executor │ │ Service │
└─────────┘ └─────────┘ └─────────┘
```

### ExecutionKernel (`kernel.ts`)

The single entry point for all agent execution. Composes RuntimeResolver, TurnExecutor, StateService, and EventRouter.

**Key invariants:**

- Exactly one `lifecycle.start` event per execution
- Exactly one `lifecycle.end` OR `lifecycle.error` event per execution
- No exceptions escape — all errors are captured in `ExecutionResult`

**Execution flow:**

1. Validate the `ExecutionRequest`
2. Generate a unique `runId`
3. Emit `lifecycle.start`
4. Resolve runtime context via `RuntimeResolver`
5. Execute the turn via `TurnExecutor`
6. Persist state via `StateService`
7. Emit `lifecycle.end` or `lifecycle.error`
8. Return `ExecutionResult`

```typescript
const kernel = createDefaultExecutionKernel({ config, logger });
const result = await kernel.execute({
  agentId: "main",
  sessionId: "abc-123",
  workspaceDir: "/path/to/workspace",
  prompt: "Hello, agent!",
  onPartialReply: (payload) => stream(payload),
});
```

### RuntimeResolver (`resolver.ts`)

Determines which runtime to use and builds `RuntimeContext` metadata. Centralizes logic previously scattered across multiple entry points.

**Responsibilities:**

- Resolve runtime kind (`pi`, `claude`, or `cli`) based on agent config, model, and provider
- Build tool policy (allow/deny lists, elevated permissions)
- Resolve sandbox context for tool execution
- Determine runtime capabilities (streaming, tools, images, thinking)

**Runtime selection rules:**

1. If `runtimeKind` is explicitly set in the request, use it
2. If the provider is a CLI provider (e.g., `claude-code`), use `cli`
3. If the model supports extended thinking AND the provider is Anthropic-native, use `claude` (SDK runtime)
4. Otherwise, use `pi` (the embedded Pi runtime)

### TurnExecutor (`executor.ts`)

Executes a single turn and normalizes all output. Handles the actual runtime invocation and streaming normalization.

**Responsibilities:**

- Invoke the appropriate runtime (Pi embedded, Claude SDK, or CLI)
- Apply streaming normalization (heartbeat stripping, reasoning tag removal)
- Accumulate block replies with configurable chunking
- Track tool calls and usage metrics
- Handle model fallback on errors/quota

**Normalization rules** (applied uniformly across all runtimes):

- Strip heartbeat tokens when the response has no meaningful content
- Strip reasoning tags and thinking blocks before delivery
- Normalize empty or whitespace-only payloads to no output
- Deduplicate partial replies that overlap with block replies
- Sanitize user-facing text (remove internal markers)

### StateService (`state.ts`)

Manages session state persistence after execution.

**Responsibilities:**

- Update session store entries with execution results
- Track token usage and cost metrics
- Persist session metadata (model, provider, timing)

### EventRouter (`events.ts`)

Fan-out event distribution for lifecycle, tool, and hook events.

**Event kinds:**
| Event | Description |
|-------|-------------|
| `lifecycle.start` | Execution began |
| `lifecycle.end` | Execution completed successfully |
| `lifecycle.error` | Execution failed |
| `tool.start` | Tool execution began |
| `tool.end` | Tool execution completed |
| `assistant.partial` | Streaming partial text received |
| `assistant.complete` | Final assistant reply |
| `compaction.start` | Context compaction began |
| `compaction.end` | Context compaction completed |
| `hook.triggered` | An extension hook fired |

## Core Types

### ExecutionRequest

The single input type that all entry points build. Contains:

- **Identity**: `agentId`, `sessionId`, `sessionKey`, `runId`
- **Context**: `workspaceDir`, `agentDir`, `config`, `messageContext`
- **Runtime hints**: `runtimeKind`, `embeddedOnly`, `spawnedBy`
- **Turn input**: `prompt`, `images`, `extraSystemPrompt`
- **Constraints**: `timeoutMs`, `maxTokens`
- **Callbacks**: `onPartialReply`, `onBlockReply`, `onToolResult`, `onToolStart`, `onToolEnd`, etc.
- **Runtime-specific hints**: `runtimeHints` bag for Pi/SDK-specific parameters

### ExecutionResult

The single output type that all entry points receive:

- **Status**: `success`, `aborted`, `error`
- **Output**: `reply` (text), `payloads` (structured)
- **Runtime info**: `kind`, `provider`, `model`, `fallbackUsed`
- **Usage**: `inputTokens`, `outputTokens`, `durationMs`, `costUsd`
- **Events**: All events emitted during execution
- **Tool activity**: `toolCalls` summaries, `didSendViaMessagingTool`

### RuntimeContext

Resolved by `RuntimeResolver`, consumed by `TurnExecutor`:

```typescript
interface RuntimeContext {
  kind: "pi" | "claude" | "cli";
  provider: string;
  model: string;
  toolPolicy: ToolPolicy;
  sandbox: SandboxContext | null;
  capabilities: RuntimeCapabilities;
}
```

### TurnOutcome

Internal result from `TurnExecutor`, consumed by `ExecutionKernel`:

```typescript
interface TurnOutcome {
  reply: string;
  payloads: ReplyPayload[];
  toolCalls: ToolCallSummary[];
  usage: UsageMetrics;
  fallbackUsed: boolean;
  didSendViaMessagingTool: boolean;
}
```

## Text Normalization (`normalization.ts`)

All text output passes through a consistent normalization pipeline:

```typescript
interface NormalizationOptions {
  stripHeartbeat?: boolean; // Remove heartbeat tokens
  stripThinking?: boolean; // Remove <thinking> tags
  stripSilent?: boolean; // Remove silent reply tokens
  stripCompactionHandoff?: boolean; // Remove compaction markers
  sanitize?: boolean; // Clean user-facing text
  normalizeWhitespace?: boolean; // Normalize spacing
}
```

Two normalization functions are provided:

- `normalizeText(text, options)` — For final reply text
- `normalizeStreamingText(text, options)` — For streaming partial text (preserves trailing whitespace for buffering)

## Error Handling

Execution errors are categorized by kind for programmatic handling:

| Error Kind             | Description                    | Retryable          |
| ---------------------- | ------------------------------ | ------------------ |
| `validation_failed`    | Invalid request parameters     | No                 |
| `runtime_unavailable`  | No suitable runtime found      | No                 |
| `runtime_error`        | Runtime threw during execution | Maybe              |
| `timeout`              | Execution exceeded time limit  | Yes                |
| `aborted`              | Execution was manually aborted | No                 |
| `quota_exceeded`       | Token/rate quota hit           | Yes (with backoff) |
| `tool_error`           | Tool execution failed          | Maybe              |
| `state_persist_failed` | Could not save state           | Yes                |
| `unknown`              | Unclassified error             | Maybe              |

## Migration from Legacy Entry Points

The execution layer replaced direct runtime calls in these locations:

| Legacy Location                                  | Replaced By                 |
| ------------------------------------------------ | --------------------------- |
| `src/auto-reply/reply/agent-runner-execution.ts` | `ExecutionKernel.execute()` |
| `src/commands/agent.ts`                          | `ExecutionKernel.execute()` |
| `src/cron/isolated-agent/run.ts`                 | `ExecutionKernel.execute()` |
| `src/agents/hybrid-planner.ts`                   | `ExecutionKernel.execute()` |
| `src/auto-reply/reply/followup-runner.ts`        | `ExecutionKernel.execute()` |

Entry points now only need to:

1. Build an `ExecutionRequest` from their input
2. Call `kernel.execute(request)`
3. Route the `ExecutionResult` to their output channel

## Testing

The execution layer includes comprehensive parity tests that verify the new unified path produces identical behavior to the legacy entry points:

- `kernel.test.ts` — Core kernel orchestration
- `executor.test.ts` — Turn execution and normalization
- `resolver.test.ts` — Runtime selection logic
- `resolver.parity.test.ts` — Parity with legacy runtime resolution
- `state.test.ts` — State persistence
- `state.parity.test.ts` — Parity with legacy state updates
- `normalization.test.ts` — Text normalization rules
- `normalization.parity.test.ts` — Parity with legacy normalization
- `events.test.ts` — Event routing
- `auto-reply.parity.test.ts` — Full auto-reply parity
- `cron.parity.test.ts` — Cron execution parity
- `cli-agent.parity.test.ts` — CLI agent parity
- `memory-flush.parity.test.ts` — Memory flush parity
- `hybrid-planner.parity.test.ts` — Hybrid planner parity

## Related Documentation

- [Architecture Overview](./architecture.md)
- [Agent Concepts](./agent.md)
- [Model Providers](./model-providers.md)
- [Model Failover](./model-failover.md)
- [Session Management](./session.md)
