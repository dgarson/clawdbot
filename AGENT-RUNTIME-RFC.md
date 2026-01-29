---
summary: "RFC: Introduce AgentRuntime abstraction for unified agent execution"
owner: "moltbot"
status: "draft"
last_updated: "2026-01-29"
read_when:
  - Planning major agent architecture changes
  - Adding new agent execution backends
  - Refactoring agent lifecycle management
---

# RFC: AgentRuntime Abstraction

## Context

Moltbot currently executes agents through several distinct code paths:

1. **Embedded Pi Runtime** (`runEmbeddedPiAgent`) - The primary path for most agent runs,
   derived from p-mono and handling model inference, tool execution, and streaming.

2. **CLI Providers** (`runCliAgent`) - External CLI-based backends (Claude CLI, etc.)
   that manage their own sessions and tool execution.

3. **Subagent Registry** - Tracks spawned subagent runs, handles lifecycle events,
   and coordinates announcements.

4. **Gateway Service Runtime** (`GatewayServiceRuntime`) - Platform-specific daemon
   management (launchd, systemd, scheduled tasks) separate from agent execution.

These paths share common concerns (session management, event emission, timeout handling,
model fallback) but implement them independently, leading to:

- Inconsistent event emission across execution paths
- Duplicated session lifecycle logic
- Difficulty adding new execution backends
- Fragmented error handling and recovery strategies

## Goals

1. **Unified Execution Interface**: Define a single `AgentRuntime` interface that all
   agent execution backends implement, standardizing:
   - Run initiation and cancellation
   - Event stream emission (lifecycle, tool, assistant, error)
   - Session state management
   - Timeout and abort handling

2. **Backend Pluggability**: Enable new execution backends (local models, alternative
   CLI tools, cloud-hosted runtimes) without modifying core orchestration code.

3. **Consistent Lifecycle Events**: Guarantee that all agent runs emit the same
   lifecycle events (`start`, `end`, `error`) regardless of backend, enabling
   reliable subagent coordination and UI updates.

4. **Centralized Fallback Logic**: Move model fallback, auth profile rotation, and
   retry logic into a shared orchestration layer that wraps any `AgentRuntime`.

5. **Testability**: Allow unit tests to inject mock runtimes without spawning real
   model inference or external processes.

## Non-goals

- **Replacing p-mono internals**: The embedded Pi runtime's internal session/tool
  wiring remains owned by that module. This RFC defines the boundary, not the guts.

- **Unifying daemon/service management**: `GatewayServiceRuntime` (launchd, systemd)
  is orthogonal to agent execution and stays separate.

- **Changing external APIs**: Gateway RPC methods (`agent`, `agent.wait`) and CLI
  commands remain unchanged; this is an internal refactor.

- **Multi-tenant isolation**: This RFC does not address running multiple isolated
  agent instances in a single process.

## Proposed Architecture

### Core Interface

```typescript
export interface AgentRuntime {
  readonly id: string; // e.g., "pi-embedded", "claude-cli", "ollama"

  run(params: AgentRunParams): Promise<AgentRunResult>;

  abort(runId: string): Promise<void>;

  isRunActive(runId: string): boolean;

  // Optional: inject a user message into an active run (steering)
  queueMessage?(runId: string, message: string): Promise<boolean>;
}

export type AgentRunParams = {
  runId: string;
  sessionId: string;
  sessionKey?: string;
  prompt: string;
  provider: string;
  model: string;
  config: MoltbotConfig;
  workspaceDir: string;
  agentDir: string;
  // ... other existing params from RunEmbeddedPiAgentParams
  onEvent?: (event: AgentEventPayload) => void;
  abortSignal?: AbortSignal;
};

export type AgentRunResult = {
  payloads: ReplyPayload[];
  usage?: UsageLike;
  meta?: AgentRunMeta;
};

export type AgentRunMeta = {
  error?: { kind: string; message: string };
  sessionId?: string;
  compacted?: boolean;
  fallbackProvider?: string;
  fallbackModel?: string;
};
```

### Runtime Registry

```typescript
export const AgentRuntimeRegistry = {
  runtimes: new Map<string, AgentRuntime>(),

  register(runtime: AgentRuntime): void {
    this.runtimes.set(runtime.id, runtime);
  },

  get(id: string): AgentRuntime | undefined {
    return this.runtimes.get(id);
  },

  resolve(provider: string, config: MoltbotConfig): AgentRuntime {
    // Determine appropriate runtime based on provider type
    if (isCliProvider(provider, config)) {
      return this.get("cli") ?? this.get("pi-embedded")!;
    }
    return this.get("pi-embedded")!;
  },
};
```

### Orchestration Layer

The existing `runAgentTurnWithFallback` logic moves into a runtime-agnostic
orchestrator:

```typescript
export async function executeAgentRun(params: {
  runtime: AgentRuntime;
  params: AgentRunParams;
  fallbacks?: ModelRef[];
}): Promise<AgentRunResult> {
  // Wraps runtime.run() with:
  // - Model fallback iteration
  // - Auth profile rotation
  // - Consistent event emission
  // - Error classification and recovery
}
```

### Migration Path

1. **Phase 1: Interface Definition**
   - Define `AgentRuntime` interface and types in `src/agents/runtime/types.ts`
   - Create `PiEmbeddedRuntime` implementing the interface, wrapping existing
     `runEmbeddedPiAgent`
   - Create `CliRuntime` wrapping `runCliAgent`
   - No behavioral changes; existing code paths unchanged

2. **Phase 2: Registry Integration**
   - Introduce `AgentRuntimeRegistry`
   - Update `runAgentTurnWithFallback` to resolve runtime via registry
   - Existing tests continue passing

3. **Phase 3: Orchestration Extraction**
   - Extract fallback/retry logic into `executeAgentRun`
   - Remove duplicated fallback handling from individual runtimes
   - Update `agent-runner-execution.ts` to use new orchestrator

4. **Phase 4: Event Normalization**
   - Ensure all runtimes emit consistent lifecycle events
   - Update subagent registry to rely on normalized events
   - Remove runtime-specific event handling workarounds

## File Organization

```
src/agents/runtime/
  types.ts              # AgentRuntime interface and related types
  registry.ts           # AgentRuntimeRegistry
  orchestrator.ts       # executeAgentRun and fallback logic
  pi-embedded.ts        # PiEmbeddedRuntime implementation
  cli.ts                # CliRuntime implementation
  index.ts              # Public exports
```

## Alternatives Considered

### Alternative 1: Keep Current Structure

Continue with separate execution paths and accept the duplication.

**Pros**: No migration risk, no new abstractions to learn.

**Cons**: Adding new backends requires duplicating fallback logic, event emission,
and session handling. Subagent coordination remains fragile across CLI vs embedded.

### Alternative 2: Merge Everything into Pi Runtime

Make `runEmbeddedPiAgent` the only entry point, with CLI providers as a special
case inside it.

**Pros**: Single code path, simpler mental model.

**Cons**: Conflates concerns; CLI providers have fundamentally different session
semantics (external process, own transcript). Makes the embedded runtime's
responsibilities unclear.

### Alternative 3: Event-Driven Architecture

Replace direct function calls with an event bus where runtimes publish and
orchestration subscribes.

**Pros**: Maximum decoupling, easy to add observers.

**Cons**: Over-engineered for current needs; harder to trace execution flow;
async coordination complexity.

## Consequences

### Positive

- **Cleaner extension points**: Adding Ollama, local LLMs, or alternative CLI
  tools becomes straightforward.
- **Consistent behavior**: Users see the same lifecycle events, timeout behavior,
  and error messages regardless of backend.
- **Testability**: Mock runtimes enable fast unit tests without model inference.
- **Reduced duplication**: Fallback, retry, and event emission logic lives in
  one place.

### Negative

- **Migration effort**: Existing code must be refactored to use the new interface.
- **Abstraction overhead**: One more layer to understand for contributors.
- **Potential regressions**: Subtle behavioral differences may surface during
  migration.

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing behavior | Phase migration with extensive test coverage |
| Performance overhead | Interface is thin; no additional allocations on hot path |
| Contributor confusion | Document the architecture in `docs/concepts/agent.md` |

## Open Questions

1. Should the runtime interface expose streaming callbacks or return an async
   iterator? Current design uses callbacks to match existing `onPartialReply`
   patterns.

2. How should runtime-specific configuration (e.g., Claude CLI flags, Ollama
   endpoint URL) be passed? Via `config` object or dedicated runtime options?

3. Should `queueMessage` for steering be required or optional on the interface?
   CLI backends may not support mid-run injection.

4. What's the right granularity for `AgentRunMeta`? Should it include detailed
   token counts, or keep that in `usage`?

## Test Plan

- Unit tests for each runtime implementation in isolation
- Integration tests verifying event emission consistency across runtimes
- E2E tests confirming subagent coordination works with both embedded and CLI
- Regression tests for existing `agent` RPC and CLI command behavior

## Doc Updates (Follow-up)

- Update `docs/concepts/agent.md` with runtime architecture overview
- Update `docs/concepts/agent-loop.md` to reference the orchestration layer
- Add contributor guide section on implementing new runtimes

---

*This RFC proposes a path toward a cleaner agent execution architecture. Feedback
welcome on the interface design, migration strategy, and open questions.*
