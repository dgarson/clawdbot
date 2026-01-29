# PR 3: AgentRuntime Interface + Pi Implementation

## Summary

Define the `AgentRuntime` interface as the core abstraction for agent execution backends, and implement it for the existing Pi agent to validate the design.

## PR Description

```markdown
## Summary

- Define `AgentRuntime` interface with unified run parameters and result types
- Implement `createPiAgentRuntime()` wrapping existing embedded Pi agent
- Add `resolveAgentRuntimeKind()` for config-based runtime selection
- Create runtime factory with lazy loading support
- Extract common tool event logging

## Test plan

- [ ] `pnpm build` passes
- [ ] `pnpm test` passes
- [ ] Pi agent behavior completely unchanged
- [ ] New runtime interface correctly wraps Pi execution
- [ ] Runtime resolution follows config hierarchy (per-agent → defaults → "pi")

## Motivation

To support multiple agent backends (Pi, Claude Code SDK, future runtimes), we need
a common interface that:
1. Defines a unified parameter contract
2. Specifies streaming callback semantics
3. Standardizes result types with runtime metadata
4. Enables runtime selection via configuration

This PR establishes the interface and proves it with the Pi implementation.
```

## Files Changed

| File | Status | Purpose |
|------|--------|---------|
| `src/agents/agent-runtime.ts` | New | Core interface + types |
| `src/agents/pi-agent-runtime.ts` | New | Pi implementation |
| `src/agents/main-agent-runtime-factory.ts` | New | Factory + resolution |
| `src/agents/runtime-result-types.ts` | New | Shared result types |
| `src/agents/tool-event-logger.ts` | New | Centralized logging |
| `src/agents/pi-embedded-runner.ts` | Modified | Minimal adapter hooks |
| `src/agents/pi-embedded-runner/types.ts` | Modified | Type alignment |
| `src/agents/agent-scope.ts` | Modified | Export additions |

## Architecture

### AgentRuntime Interface

```typescript
interface AgentRuntime {
  kind: AgentRuntimeKind;  // "pi" | "ccsdk"
  displayName: string;
  run(params: AgentRuntimeRunParams): Promise<AgentRuntimeResult>;
}
```

### Parameter Structure

Parameters are organized into logical sections:

```typescript
interface AgentRuntimeRunParams {
  // Core (required by all runtimes)
  sessionId: string;
  sessionFile: string;
  workspaceDir: string;
  prompt: string;
  provider: string;
  model: string;
  // ...

  // Messaging context
  messageChannel?: string;
  senderId?: string;
  groupId?: string;
  // ...

  // Streaming callbacks
  onPartialReply?: (payload: ReplyPayload) => void;
  onBlockReply?: (payload: ReplyPayload) => void;
  onReasoningStream?: (payload: ReasoningPayload) => void;
  onToolResult?: (payload: ToolResultPayload) => void;
  onAgentEvent?: (evt: AgentEvent) => void;

  // Runtime-specific option bags
  piOptions?: PiRuntimeOptions;
  ccsdkOptions?: CcSdkRuntimeOptions;
}
```

### Pi Runtime Implementation

The Pi runtime is a thin wrapper:

```typescript
function createPiAgentRuntime(): AgentRuntime {
  return {
    kind: "pi",
    displayName: "Pi Agent",
    async run(params) {
      // Extract Pi-specific options
      const piOpts = params.piOptions ?? {};

      // Delegate to existing embedded runner
      return runEmbeddedPiAgent({
        ...params,
        enforceFinalTag: piOpts.enforceFinalTag,
      });
    }
  };
}
```

### Runtime Resolution

```typescript
function resolveAgentRuntimeKind(config: Config, agentId: string): AgentRuntimeKind {
  // 1. Check per-agent config
  const agentEntry = config.agents.list?.find(a => a.id === agentId);
  if (agentEntry?.runtime) return agentEntry.runtime;

  // 2. Check global defaults
  if (config.agents.defaults?.runtime) return config.agents.defaults.runtime;

  // 3. Fall back to Pi
  return "pi";
}
```

## Key Design Decisions

### 1. Option Bags for Runtime-Specific Parameters

Instead of polluting the shared interface with runtime-specific fields:

```typescript
// Bad: Shared interface has optional runtime-specific fields
interface Params {
  enforceFinalTag?: boolean;  // Pi only
  hooksEnabled?: boolean;     // CCSDK only
}

// Good: Isolated option bags
interface Params {
  piOptions?: { enforceFinalTag?: boolean };
  ccsdkOptions?: { hooksEnabled?: boolean };
}
```

### 2. Factory with Lazy Loading

CCSDK module is only loaded when needed:

```typescript
async function createAgentRuntime(config, agentId, forceKind?) {
  const kind = forceKind ?? resolveAgentRuntimeKind(config, agentId);

  if (kind === "ccsdk") {
    // Dynamic import - not loaded until needed
    const { createCcSdkAgentRuntime } = await import("./claude-agent-sdk/index.js");
    return createCcSdkAgentRuntime();
  }

  return createPiAgentRuntime();
}
```

### 3. Centralized Tool Event Logging

Extracted from per-runtime implementations:

```typescript
// Before: Each runtime logged tools differently
// After: Single logToolEvent() called from onAgentEvent handler

function logToolEvent(event: AgentEvent, context: LogContext) {
  if (event.type === "tool_start") {
    log.info(`Tool: ${event.name} starting...`);
  } else if (event.type === "tool_result") {
    log.info(`Tool: ${event.name} completed`);
  }
}
```

### 4. Result Type with Runtime Metadata

```typescript
interface AgentRuntimeResult {
  reply: string;
  usage: UsageInfo;
  meta: {
    runtime: AgentRuntimeKind;
    provider: string;
    model: string;
    sessionId?: string;
    // ...
  };
}
```

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Pi behavior change | Low | Wrapper delegates directly |
| Type misalignment | Medium | Extensive interface tests |
| Factory loading errors | Low | Fallback to Pi on CCSDK load failure |

## Dependencies

- PR 2: Session Adapters (for `SessionAdapter` type references)

## Testing Strategy

```typescript
describe("AgentRuntime Interface", () => {
  it("Pi runtime implements all required methods");
  it("run() returns correct result structure");
  it("callbacks are invoked in correct order");
});

describe("Runtime Factory", () => {
  it("resolves Pi by default");
  it("respects per-agent config");
  it("respects global defaults");
  it("falls back on CCSDK unavailable");
});

describe("Tool Event Logger", () => {
  it("logs tool_start events");
  it("logs tool_result events");
  it("includes context in log output");
});
```

## Rollback Strategy

1. Remove new files
2. Revert pi-embedded-runner changes
3. No config changes needed (runtime field ignored if absent)

## Migration Path

Existing code continues using `runEmbeddedPiAgent()` directly. The runtime abstraction is opt-in through:
1. Config: `agents.defaults.runtime: "ccsdk"`
2. Code: `createAgentRuntime(config, agentId)`

---

*Estimated Review Time: 45 minutes*
*Merge Complexity: Medium (new abstraction layer)*
