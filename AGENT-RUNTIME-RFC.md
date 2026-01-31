---
summary: "RFC: Introduce AgentRuntime abstraction for unified agent execution"
owner: "moltbot"
status: "draft"
last_updated: "2026-01-31"
read_when:
  - Planning agent architecture changes
  - Adding new agent execution backends
---

# RFC: AgentRuntime Abstraction

## Context

Moltbot executes agents through two main code paths:

1. **Embedded Pi Runtime** (`runEmbeddedPiAgent`) - Primary path for most agent runs,
   handling model inference, tool execution, and streaming.

2. **CLI Providers** (`runCliAgent`) - External CLI-based backends (Claude CLI, etc.)
   with their own session and tool management.

These paths implement similar concerns (run lifecycle, abort handling, event emission)
independently, making it harder to add new backends or ensure consistent behavior.

## Goals

1. **Unified Interface**: Define `AgentRuntime` interface that both execution paths
   implement, standardizing run/abort/status operations.

2. **Backend Pluggability**: Enable new execution backends without modifying
   calling code.

3. **Testability**: Allow unit tests to inject mock runtimes.

## Non-goals

- Replacing p-mono internals (this defines the boundary, not the guts)
- Refactoring fallback/retry logic (stays where it is)
- Changing external APIs (gateway RPC, CLI commands unchanged)
- Event normalization (future work)

## Proposed Interface

```typescript
export interface AgentRuntime {
  readonly id: string; // e.g., "pi-embedded", "cli"

  run(params: AgentRunParams): Promise<AgentRunResult>;

  abort(runId: string): Promise<void>;

  isRunActive(runId: string): boolean;
}

export type AgentRunParams = {
  runId: string;
  sessionId: string;
  prompt: string;
  provider: string;
  model: string;
  config: MoltbotConfig;
  workspaceDir: string;
  agentDir: string;
  onEvent?: (event: AgentEventPayload) => void;
  abortSignal?: AbortSignal;
  // ... other existing params from RunEmbeddedPiAgentParams
};

export type AgentRunResult = {
  payloads: ReplyPayload[];
  usage?: UsageLike;
  error?: { kind: string; message: string };
  sessionId?: string;
  compacted?: boolean;
};
```

## Implementation

### Phase 1: Interface + Wrappers

1. Define `AgentRuntime` interface in `src/agents/runtime.ts`
2. Create `PiEmbeddedRuntime` wrapping existing `runEmbeddedPiAgent`
3. Create `CliRuntime` wrapping existing `runCliAgent`
4. No behavioral changes; existing code paths unchanged

### Phase 2: Adoption

1. Update callers to use runtime implementations
2. Existing tests continue passing

## Alternatives Considered

### Keep Current Structure

Continue with separate execution paths.

**Pros**: No migration risk.

**Cons**: Adding new backends requires duplicating lifecycle logic.

### Merge into Single Runtime

Make `runEmbeddedPiAgent` handle CLI providers internally.

**Pros**: Single code path.

**Cons**: Conflates concerns; CLI providers have different session semantics.

## Consequences

**Positive**:
- Cleaner extension points for new backends
- Testability via mock runtimes

**Negative**:
- One more abstraction layer
- Migration effort (thin wrappers initially)

## Test Plan

- Unit tests for each runtime wrapper
- Existing integration tests continue passing
