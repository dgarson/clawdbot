# Plugin And Extension APIs

## Table Of Contents

- Core extension entrypoints
- When to use each API
- Execution and lifecycle model
- RPC and callback design patterns
- Example extension skeleton

## Core Extension Entrypoints

Plugin API surface (`OpenClawPluginApi`) includes:

- `registerGatewayMethod(method, handler)`
- `registerHttpRoute({ path, handler })`
- `registerHttpHandler(handler)`
- `registerHook(events, handler, opts)`
- `on(hookName, handler, opts)` (typed hooks)
- `registerService({ id, start, stop })`
- `registerTool(tool, opts)`
- `registerChannel(registration)`
- `registerProvider(provider)`
- `registerCli(registrar, opts)`
- `registerCommand(command)`
- `registerSearchBackend(backend)`

Primary source:

- `src/plugins/types.ts`
- `src/plugins/registry.ts`

## When To Use Each API

- Use `registerGatewayMethod` for WS RPC calls that must participate in gateway transport/auth/dispatch.
- Use `registerHttpRoute` for explicit path-based HTTP endpoints with deterministic route ownership.
- Use `registerHttpHandler` only for broad HTTP interception use cases where route-level scoping is not enough.
- Use `registerHook` for event-style behavior modifiers tied to existing hook events.
- Use typed `on(...)` hooks for lifecycle-aware plugin behavior (`gateway_start`, `before_tool_call`, etc.).
- Use `registerService` for long-lived background stateful workers.

## Execution And Lifecycle Model

- Plugins are discovered and loaded through `loadOpenClawPlugins(...)`.
- Registration populates a shared registry (methods, hooks, routes, tools, services).
- Gateway startup composes plugin handlers into `extraHandlers`.
- Service `start` runs during sidecar startup; `stop` runs on shutdown/reload paths.

Primary source:

- `src/plugins/loader.ts`
- `src/gateway/server-plugins.ts`
- `src/gateway/server.impl.ts`

## RPC And Callback Design Patterns

- Prefer `domain.action` method names for extension RPCs (`acme.backup.run`).
- Validate params defensively inside plugin handler even though frame-level validation exists.
- Emit stable response shapes and version your plugin RPC contracts explicitly.
- Use hook callbacks for cross-cutting concerns (audit, routing policy, message transforms) rather than duplicating handler logic.
- Avoid direct imports from unrelated core internals when plugin-sdk/runtime provides equivalents.

## Example Extension Skeleton

```ts
import type { OpenClawPluginDefinition } from "openclaw/plugin-sdk";

const plugin: OpenClawPluginDefinition = {
  id: "acme-gateway",
  name: "Acme Gateway",
  register(api) {
    api.registerGatewayMethod("acme.backup.run", async ({ params, respond }) => {
      // Validate params for extension-specific invariants
      const target = typeof params.target === "string" ? params.target : "default";
      respond(true, { ok: true, target, runId: crypto.randomUUID() });
    });

    api.on("before_tool_call", async (event) => {
      if (event.toolName === "exec" && String(event.params ?? "").includes("rm -rf /")) {
        return { block: true, blockReason: "unsafe command pattern" };
      }
      return undefined;
    });

    api.registerService({
      id: "acme-metrics",
      async start(ctx) {
        ctx.logger.info("acme metrics service started");
      },
      async stop(ctx) {
        ctx.logger.info("acme metrics service stopped");
      },
    });
  },
};

export default plugin;
```
