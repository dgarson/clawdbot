# P1: Extension Skeleton Kickoff Plan

**Owner:** roman  
**Status:** Draft  
**Target:** Extension system for ACP integration

---

## Overview

This plan outlines the skeleton implementation for extensions in OpenClaw, specifically targeting ACP (Agent Client Protocol) integration. The extension system should allow third-party code to extend Gateway functionality with proper isolation, configuration, and lifecycle management.

---

## Plugin Structure

### Directory Layout

```
extensions/
├── my-extension/
│   ├── package.json          # Extension manifest
│   ├── src/
│   │   ├── index.ts          # Entry point
│   │   ├── gateway.ts        # Gateway method handlers
│   │   ├── hooks.ts          # Plugin hook registrations
│   │   └── commands.ts       # CLI commands
│   ├── config.schema.json    # JSON Schema for config
│   └── README.md
```

### Extension Manifest (`package.json`)

```json
{
  "name": "@openclaw/extension-acp-bridge",
  "version": "0.1.0",
  "openclaw": {
    "kind": "extension",
    "id": "acp-bridge",
    "permissions": ["gateway:chat.inject", "gateway:chat.send"],
    "configSchema": "./config.schema.json"
  },
  "dependencies": {
    "@openclaw/plugin-sdk": "*"
  }
}
```

---

## Module Boundaries

### 1. Core SDK (`@openclaw/plugin-sdk`)

**Exports:**
- `registerGatewayMethod(method, handler)` - Register RPC methods
- `registerHook(event, handler)` - Subscribe to agent lifecycle hooks
- `registerHttpRoute({ path, handler })` - HTTP endpoints
- `registerTool(tool)` - Agent tools
- `registerCommand(command)` - CLI commands
- `registerChannel(registration)` - Channel plugins
- `resolvePath(input)` - Workspace-relative path resolution

### 2. Extension API Surface

```typescript
interface OpenClawExtensionApi {
  id: string;
  name: string;
  version?: string;
  config: OpenClawConfig;
  pluginConfig: Record<string, unknown>;
  runtime: PluginRuntime;
  logger: PluginLogger;
  
  // Registration
  registerGatewayMethod(method: string, handler: GatewayRequestHandler): void;
  registerHook(events: string | string[], handler: InternalHookHandler): void;
  registerHttpRoute(params: { path: string; handler: HttpRouteHandler }): void;
  
  // State
  resolvePath(relative: string): string;
}
```

### 3. Isolation Boundaries

| Boundary | Mechanism |
|----------|-----------|
| **Code** | Separate package, no shared mutable state |
| **Config** | Plugin-specific config namespace |
| **Runtime** | Isolated module loader, sandboxed execution |
| **Network** | HTTP routes under `/plugins/:pluginId/` prefix |
| **Storage** | Dedicated state directory per extension |

---

## Startup Sequence

### Phase 1: Discovery (Gateway startup)

```
1. Gateway starts
2. Load extensions/ directory
3. Read each extension's package.json
4. Validate manifest (kind: extension, valid permissions)
5. Load config schema if present
```

### Phase 2: Registration

```
1. For each extension:
   a. Create ExtensionContext (config, logger, runtime)
   b. Load module (entry point)
   c. Call register(api) - synchronous registration
   d. Register gateway methods
   e. Register hooks
   f. Register HTTP routes
```

### Phase 3: Activation

```
1. Call activate(api) - async activation
2. Start any background services
3. Subscribe to events
4. Mark as ready
```

### Phase 4: Runtime

```
1. Handle incoming requests
2. Extension code executes in response to:
   - Gateway method calls
   - Hook events
   - HTTP requests
   - Timer/cron jobs
```

### Phase 5: Shutdown

```
1. Gateway shutdown signal
2. Call extension cleanup (if provided)
3. Stop background services
4. Flush state
5. Unload module
```

---

## Configuration Strategy

### Extension Config Schema

```typescript
// config.schema.json
{
  "type": "object",
  "properties": {
    "enabled": { "type": "boolean", "default": true },
    "apiKey": { "type": "string", "sensitive": true },
    "allowedSessions": { 
      "type": "array", 
      "items": { "type": "string" } 
    },
    "rateLimit": {
      "type": "object",
      "properties": {
        "maxPerMinute": { "type": "number", "default": 60 }
      }
    }
  }
}
```

### Config Loading Flow

```
1. Load base OpenClaw config
2. Extract extensions.* namespace
3. Validate each extension's config against its schema
4. Provide validated config to extension via api.config
```

### Environment Override

```
CLI:     openclaw config set extensions.acp-bridge.apiKey=xxx
ENV:     OPENCLAW_EXTENSION_ACP_BRIDGE_APIKEY=xxx
Config:  extensions.acp-bridge.apiKey in openclaw.json
```

---

## Permission Model

### Scope Definition

```typescript
const EXTENSION_PERMISSIONS = {
  "gateway:chat.send": "Send messages to sessions",
  "gateway:chat.inject": "Inject messages into sessions", 
  "gateway:chat.history": "Read session history",
  "gateway:sessions.list": "List sessions",
  "http:route": "Register HTTP routes",
  "hook:before_agent_start": "Hook into agent lifecycle",
} as const;
```

### Permission Request

```json
// package.json
{
  "openclaw": {
    "permissions": [
      "gateway:chat.send",
      "http:route"
    ]
  }
}
```

### Enforcement

1. **At Registration:** Validate extension requests against allowed permissions
2. **At Invocation:** Check permission before executing gateway method
3. **At Access:** Validate config access based on permissions

---

## ACP Integration Points

### For ACP Bridge Extension

| Capability | Implementation |
|------------|----------------|
| **Session Management** | `gateway:sessions.list`, `gateway:sessions.resolve` |
| **Message Injection** | `gateway:chat.inject` (admin scope required) |
| **Prompt Sending** | `gateway:chat.send` |
| **History Access** | `gateway:chat.history` |
| **Run Control** | `gateway:chat.abort` |

### Extension Skeleton

```typescript
// src/index.ts
import type { OpenClawPluginDefinition } from "@openclaw/plugin-sdk";

export const acpBridge: OpenClawPluginDefinition = {
  id: "acp-bridge",
  name: "ACP Bridge",
  description: "Bridge ACP clients to Gateway sessions",
  version: "0.1.0",
  
  register(api) {
    // Register gateway methods
    api.registerGatewayMethod("acp.initialize", handleInitialize);
    api.registerGatewayMethod("acp.prompt", handlePrompt);
    api.registerGatewayMethod("acp.listSessions", handleListSessions);
    
    // Register hooks if needed
    api.registerHook("agent_end", handleAgentEnd);
  },
  
  async activate(api) {
    api.logger.info("ACP Bridge activated");
  }
};
```

---

## Implementation Phases

### Phase 1: Core Framework (P1)
- [ ] Extension loader in Gateway
- [ ] Basic registration API
- [ ] Config loading
- [ ] Permission model

### Phase 2: Gateway Integration (P1)
- [ ] Gateway method registration
- [ ] Hook system integration
- [ ] HTTP route prefixing

### Phase 3: ACP-Specific (P2)
- [ ] ACP bridge extension
- [ ] Session mapping
- [ ] Message translation

### Phase 4: Security & Polish (P2)
- [ ] Permission enforcement
- [ ] Resource limits
- [ ] Extension marketplace

---

## Open Questions

1. **Sandboxing:** Should extensions run in isolated VM contexts?
2. **Versioning:** How to handle breaking changes in extension API?
3. **Distribution:** Local files vs. npm registry?
4. **Updates:** Hot-reload or restart required?

---

## References

- Existing plugin system: `src/plugins/`
- Plugin SDK: `src/plugin-sdk/index.ts`
- Gateway methods: `src/gateway/server-methods/`
- Hooks: `src/hooks/types.ts`
