# Unified event pipeline primitive

## Summary

The current hook ecosystem spans internal hooks, plugin hooks, and bundled hook discovery. A unified event pipeline would provide a single, typed event envelope and dispatcher with consistent filtering, prioritization, and delivery semantics. This primitive would reduce the duplicated hook registries and make it easier to add new event types without re-implementing eligibility, ordering, and error handling.

## Current state and primitives in use

- Internal hooks use a lightweight registry keyed by event type or type plus action, with a shared `InternalHookEvent` shape and a simple trigger function. This is the base primitive for built in hooks like `session-memory`, `command-logger`, `soul-evil`, and `boot-md`.
- Plugin hooks are a separate primitive, with typed hook names like `before_agent_start`, `agent_end`, `message_received`, `before_tool_call`, and `tool_result_persist`. A hook runner merges or sequences these hooks depending on whether a hook mutates output or is fire and forget. This is used for plugin lifecycle events like memory auto recall and auto capture in the LanceDB memory plugin, and Meridia hook registration via directory loading.
- Plugin hook packs reuse the internal hook format and are registered via `registerPluginHooksFromDir`, which loads HOOK metadata and handlers and then registers against the internal hook registry if eligible.

These systems share similar goals but operate as separate registries and lifecycle pipelines. The result is multiple event envelopes, duplicate eligibility gating, and separate ordering rules across internal hooks, plugin hooks, and plugin hook packs.

## Pain points and complexity

1. **Dual hook registries with different event models.** Internal hooks dispatch `type` and `action` pairs, while plugin hooks use a long list of specialized hook names. Adding a new lifecycle event requires wiring in both systems or bridging between them.
2. **Duplicated ordering and error handling.** Internal hooks run in registration order with basic error logging, while plugin hooks add priority ordering, sequential merge behavior, and parallel fire and forget. This leads to divergence in semantics and testing.
3. **Event eligibility scattered across subsystems.** Internal hooks rely on hook metadata and eligibility checks during registration, while plugin hooks register directly through the plugin API and apply eligibility elsewhere. This makes it harder to reason about the overall event surface.

## Proposed primitive

### Unified event pipeline

Introduce a single event pipeline with the following characteristics:

- **Event envelope:** a typed, versioned envelope that represents every internal, plugin, and tool related event. The envelope includes type, action, source, session, agent, message, and tool context in a normalized shape.
- **Unified registry:** a single registration API for handlers, with filters for event type, action, and optional predicates. This registry supports both priority ordering and fire and forget behavior via handler flags.
- **Delivery modes:** consistent sequential and parallel execution semantics configured per handler. Sequential handlers can opt into merge behavior for mutable events.
- **Compatibility bridge:** internal hooks and plugin hooks are implemented as adapters that register with the unified pipeline, so existing hook directories and plugin APIs remain stable while the backend consolidates.

### Example event envelope

```ts
export type EventEnvelope = {
  version: 1;
  type: "command" | "session" | "agent" | "gateway" | "message" | "tool";
  action: string;
  timestamp: Date;
  sessionKey?: string;
  agentId?: string;
  source?: "internal" | "plugin" | "channel" | "tool";
  context: Record<string, unknown>;
};
```

## Integration plan

### Phase 1: Introduce the unified event core

1. Add a new event pipeline module that defines the envelope, registry, and delivery modes.
2. Implement adapters for internal hooks, mapping `InternalHookEvent` into the envelope and preserving existing `hook:<name>` semantics.
3. Implement adapters for plugin hooks so the existing `createHookRunner` APIs can use the unified pipeline backend.

### Phase 2: Migrate built in hook triggers

1. Update built in hook triggers like `agent:bootstrap` and `command:*` to emit the unified envelope and invoke adapter shims.
2. Ensure bundled hooks such as `session-memory` and `command-logger` continue to work without changes, using the compatibility layer.

### Phase 3: Expand plugin and extension integration

1. Convert plugin lifecycle hooks like LanceDB memory auto recall and auto capture to register with the unified registry via the adapter, so existing `before_agent_start` and `agent_end` events map to envelope types.
2. Ensure plugin hook packs loaded via `registerPluginHooksFromDir` can target unified event types with a translation layer for the HOOK metadata.
3. For hook heavy plugins like Meridia, provide a compatibility check in the hook loader to detect the unified pipeline and log expected changes.

### Phase 4: De-duplicate event surface

1. Define a shared registry of canonical events and document which events map to old `type:action` or plugin hook names.
2. Deprecate new direct internal hook registration in favor of the unified pipeline API.

## Expected impact

- Fewer parallel hook systems and fewer hand rolled event adapters.
- A consistent event envelope makes it easier to build new primitives such as event persistence, auditing, and cross channel analytics without re-implementing hook runners.
- Reduced complexity in adding new events across internal and plugin hook ecosystems.
