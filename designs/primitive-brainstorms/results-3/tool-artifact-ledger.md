# Tool artifact ledger primitive

## Summary

Tool call persistence and result handling currently span multiple layers: session tool result guards, tool result persistence hooks, and transcript update events. A unified tool artifact ledger would standardize tool call lifecycles, provide reliable persistence for tool results, and expose a single integration surface for hooks, storage, and observability.

## Current state and primitives in use

- The session tool result guard patches the session manager to ensure tool results are persisted, synthesizes missing tool results when required, and emits transcript updates.
- The guard wrapper integrates the plugin hook runner to allow `tool_result_persist` hooks to transform or persist tool results before they are appended.
- Plugin hooks define tool related hook names like `before_tool_call`, `after_tool_call`, and `tool_result_persist`, giving plugins a path to observe tool execution.

## Pain points and complexity

1. **Tool result persistence is split across layers.** The guard must synthesize missing tool results, apply hook based transforms, and update transcripts, while plugins also want consistent access to tool results.
2. **No single source of truth for tool lifecycles.** Tool calls, results, and persistence are not captured in a single ledger, which makes downstream tooling (analytics, memory capture, audit logs) harder to build.
3. **Implicit behavior around synthetic tool results.** The logic for when synthetic tool results are emitted is embedded in the guard and not shared as a reusable primitive.

## Proposed primitive

### Tool artifact ledger

Introduce a `ToolArtifactLedger` that records tool call lifecycles in a durable, queryable way. The ledger would provide:

- A normalized record of tool calls, tool results, and tool metadata.
- A unified persistence pipeline for tool results that can be consumed by hooks or storage backends.
- Explicit policies around synthetic tool results and tool result sanitization.
- A simple event emitter for tool lifecycle events that feeds plugin hooks and internal logs.

### Example API

```ts
const ledger = createToolArtifactLedger({
  sessionKey,
  agentId,
  allowSyntheticResults: true,
});

ledger.recordToolCall({ id, name, input });
ledger.recordToolResult({ id, name, result, isSynthetic });
ledger.flushPending();
```

## Integration plan

### Phase 1: Add ledger module and hook integration

1. Implement `ToolArtifactLedger` with in memory tracking and a pluggable persistence adapter.
2. Move hook execution for `tool_result_persist` into the ledger so the transformation and persistence logic is centralized.

### Phase 2: Replace session tool result guard

1. Replace `installSessionToolResultGuard` with a ledger backed adapter that wraps the session manager but delegates persistence and synthetic result policy to the ledger.
2. Ensure transcript updates are emitted from the ledger instead of the guard, with the same session file update behavior.

### Phase 3: Extend for analytics and memory capture

1. Provide optional ledger export for memory plugins and audit logs to consume tool call data reliably.
2. Add a direct query interface for recent tool activity per session, reducing the need for ad hoc session transcript scanning.

## Expected impact

- Single source of truth for tool call and result persistence.
- Reduced duplication across guard logic, hook transforms, and downstream analytics.
- Better reliability when providers require strict tool result ordering or completeness.
