# Hook event pipeline primitive

**Goal:** Reduce hook plumbing complexity by introducing a typed event envelope, standardized metadata, and a shared router that handles filtering, ordering, and error policy.

## Current state and pain points

- The internal hook system registers handlers by string keys and triggers them with a minimal event object that is mostly untyped and string keyed.
- Bundled hooks are discovered from directories with HOOK.md metadata and are enabled or disabled in config, while plugin hooks can load from plugin directories and are registered via the plugin API.
- Plugin and bundled hooks have to re-implement event filtering in each handler (for example, checking event type and action strings) and manually shape context data, which increases the chance of mismatched fields and inconsistent error handling.
- Extension hooks such as the Meridia compaction hooks depend on context data being present and correctly typed, but they still need to guard and cast values at runtime.

## Proposed primitive

Create a **Hook Event Pipeline** that provides:

1. **Typed event envelope**
   - A shared event schema for each hook event type, with optional extensions for plugins.
   - First class fields for session identifiers, run identifiers, trigger source, and timing metadata.

2. **Declarative filters**
   - Replace manual string checks in handlers with built-in filtering on `type`, `action`, and optional qualifiers (for example, `session.kind`, `agent.id`, or `channel.id`).

3. **Router with policy hooks**
   - Centralized dispatch that handles ordering, deduping, timeouts, and error policy (retry, skip, or fail fast), with per-hook overrides.

4. **Event enrichment**
   - Inject standard context entries (config snapshot, workspace path, agent runtime metadata) so handler code does not need to re-resolve or cast values.

5. **Structured results and telemetry**
   - Each handler can emit standardized results and metrics (duration, success, error classification) that the router emits to tracing and logs.

## API sketch

```ts
export interface HookEventEnvelope<TContext extends object = object> {
  type: "command" | "session" | "agent" | "gateway";
  action: string;
  sessionKey: string;
  timestamp: Date;
  source: "core" | "plugin" | "hook" | "api";
  context: TContext;
  meta?: {
    runId?: string;
    agentId?: string;
    channelId?: string;
    traceId?: string;
  };
}

export interface HookRouterOptions {
  timeoutMs?: number;
  errorPolicy?: "skip" | "retry" | "fail";
  maxConcurrency?: number;
}

export function registerHook<TContext extends object>(
  filter: { type: HookEventEnvelope["type"]; action?: string | string[] },
  handler: (event: HookEventEnvelope<TContext>) => Promise<HookResult> | HookResult,
  options?: HookRouterOptions,
): void;
```

## Integration plan

### Phase 1: Core routing layer

- Add a typed `HookEventEnvelope` to the hooks module.
- Implement a router that converts the existing internal hook event into the new envelope.
- Provide compatibility shims so existing hooks continue to work with minimal changes.

### Phase 2: Migrate bundled hooks

- Update bundled hooks to use the typed envelope and declarative filters.
- Remove per-hook manual type checks.

### Phase 3: Plugin hook support

- Extend plugin hook registration to accept filters and router options.
- Ensure plugin hook metadata can map to router configuration.

### Phase 4: Extension migration

- Update Meridia hooks to use the new envelope, avoiding manual casts of context.
- Add shared context builders for session snapshot data used by compaction and capture hooks.

### Phase 5: Observability

- Emit standardized telemetry for hook execution results.
- Add docs showing how to set per-hook error policy and timeout defaults.

## Targeted complexity reductions

- Reduce repeated string checks and context guards in handlers.
- Remove divergent error handling between core hooks, bundled hooks, and plugin hooks.
- Make hook related code more reliable by enforcing a common schema for context data.
