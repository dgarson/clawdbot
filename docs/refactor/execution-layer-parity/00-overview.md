# Execution Layer Runtime Parity — Overview

> **Status**: Active gap analysis
> **Date**: 2026-02-08
> **Source**: `src/execution/`, `src/agents/`
> **Related docs**: `docs/refactor/agent-session-kernel.md`, `docs/refactor/turn-execution-pipeline.md`, `docs/refactor/runtime-context-resolver.md`

## Purpose

This document set tracks feature parity between the two primary `AgentRuntime` implementations — **Pi Runtime** and **Claude Agent SDK** — within the unified execution layer. The goal is to identify every capability supported by one runtime but not the other, classify each gap by severity, and provide a concrete action plan.

## Documents

| File                                                                       | Contents                                                         |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [`01-pi-only-features.md`](./01-pi-only-features.md)                       | Features present in Pi Runtime but missing from Claude Agent SDK |
| [`02-sdk-only-features.md`](./02-sdk-only-features.md)                     | Features present in Claude Agent SDK but missing from Pi Runtime |
| [`03-execution-layer-asymmetries.md`](./03-execution-layer-asymmetries.md) | Bugs and inconsistencies in the shared execution layer itself    |
| [`04-recommendations.md`](./04-recommendations.md)                         | Prioritized action plan and next 20 steps                        |

## Architecture Context

The unified execution layer routes all agent runs through a common pipeline:

```
Entry Points (CLI, auto-reply, cron, extensions)
        │
        ▼
ExecutionKernel (unified orchestration)
        │
        ▼
RuntimeResolver → RuntimeContext (provider, model, kind, capabilities)
        │
        ▼
TurnExecutor → AgentRuntime interface
        ├── PiAgentRuntime  (src/agents/pi-agent-runtime.ts)
        └── SdkAgentRuntime (src/agents/claude-agent-sdk/sdk-agent-runtime.ts)
        │
        ▼
Normalization → StateService → ExecutionResult
```

Both runtimes implement the common `AgentRuntime` interface (`src/agents/agent-runtime.ts`), which provides a shared contract for `run()`, but the underlying implementations diverge significantly in capabilities.

## Shared Interface

```typescript
interface AgentRuntime {
  readonly kind: AgentRuntimeKind; // "pi" | "claude"
  readonly displayName: string;
  run(params: AgentRuntimeRunParams): Promise<AgentRuntimeResult>;
}
```

Common `AgentRuntimeRunParams` includes: `sessionId`, `sessionKey`, `sessionFile`, `workspaceDir`, `agentDir`, `config`, `prompt`, `extraSystemPrompt`, `ownerNumbers`, `timeoutMs`, `runId`, `abortSignal`, `images`, `blockReplyBreak`, `blockReplyChunking`, `streamMiddleware`, and streaming callbacks (`onPartialReply`, `onBlockReply`, `onReasoningStream`, `onToolResult`, `onAgentEvent`, `onAssistantMessageStart`).
