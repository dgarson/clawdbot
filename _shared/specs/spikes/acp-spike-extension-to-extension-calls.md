# Spike Report: Extension-to-Extension Tool Calls

**Date:** 2026-02-21
**Spike Owner:** Sandy (verification agent)
**Status:** COMPLETE
**Related:** ACP Canonical Spec, Workq Extension Brief

---

## Executive Summary

**Can one extension call tools provided by another extension?**

**Direct tool invocation: NO.** There is no supported API for one plugin to directly invoke another plugin's registered tools.

**Alternative: Gateway RPC: YES.** Plugins can call each other's **gateway methods** via the gateway client (`callGateway`). This is the supported pattern for cross-extension communication.

---

## Findings

### 1. Tool Registration Model

Tools registered via `api.registerTool()` are designed for **agent invocation only** — the LLM calls these tools during conversation turns. The tool registry is not exposed as a callable API for other plugins.

```typescript
// From: src/plugins/registry.ts
// Tools are registered into a list, not a callable interface
registry.tools.push({
  pluginId: record.id,
  factory,
  names: normalized,
  optional,
  source: record.source,
});
```

Tools are invoked through:
- Agent runtime during LLM tool-calling
- HTTP endpoint `/tools/invoke` (requires gateway auth, subject to policy filtering)

**Implication for ACP → workq**: ACP cannot directly call `workq_claim` or `workq_release` as function calls within plugin code.

### 2. Gateway RPC Methods (Supported Cross-Extension Pattern)

Plugins can register gateway RPC methods:

```typescript
// Plugin A registers a method
api.registerGatewayMethod("workq.claim", async ({ params, respond }) => {
  const result = await claimWorkItem(params);
  respond(true, result);
});
```

Other plugins can call these methods via the gateway client:

```typescript
// Plugin B (ACP) calls Plugin A's method
import { callGateway } from "openclaw/gateway/call";

const result = await callGateway({
  method: "workq.claim",
  params: { issue_ref: "openclaw/openclaw#142", agent_id: "tim" },
});
```

**This pattern is SUPPORTED and works today.**

### 3. Authentication and Session Context

When calling gateway methods from plugin code:

| Aspect | Behavior |
|--------|----------|
| **Auth** | Caller must provide gateway token (from config or env) |
| **Session context** | NOT automatically propagated; caller must pass explicitly |
| **Identity** | Gateway method sees the caller as the gateway client, not the original agent |
| **Scopes** | Uses `resolveLeastPrivilegeOperatorScopesForMethod(method)` |

**Recommendation for ACP**: When calling workq methods, ACP should pass the relevant session context (agent_id, session_key) as explicit parameters in the method call, not rely on ambient context.

### 4. Plugin Runtime API

The `api.runtime` object provided to plugins includes many helpers but **does not expose**:
- A tool invocation API
- A gateway method invocation helper
- Access to other plugins' registered capabilities

Available runtime helpers are primarily for:
- Config management (`config.loadConfig`, `config.writeConfigFile`)
- Media processing
- Channel-specific operations
- Text chunking and reply dispatch
- TTS

### 5. Error Handling

Gateway method calls follow standard patterns:

```typescript
try {
  const result = await callGateway({ method: "workq.claim", params });
  // result contains the response
} catch (err) {
  // Network errors, auth failures, method not found, timeout
  // Gateway method errors are returned in the response, not thrown
}
```

Method handlers use `respond(ok, payload, error?)`:
- `respond(true, result)` — success
- `respond(false, undefined, { code, message })` — failure

---

## Recommended Integration Pattern

For ACP to invoke workq operations (claim/release/query), we recommend:

### Option A: Gateway RPC (Recommended)

1. **workq registers gateway methods** for each operation:
   ```typescript
   api.registerGatewayMethod("workq.claim", claimHandler);
   api.registerGatewayMethod("workq.release", releaseHandler);
   api.registerGatewayMethod("workq.query", queryHandler);
   ```

2. **ACP calls via gateway client**:
   ```typescript
   import { callGateway } from "openclaw/gateway/call";
   
   async function claimForHandoff(params: ClaimParams) {
     return await callGateway({
       method: "workq.claim",
       params: {
         issue_ref: params.issueRef,
         agent_id: params.agentId,
         // Include session context explicitly
         session_key: params.sessionKey,
       },
     });
   }
   ```

3. **Error handling**:
   ```typescript
   const result = await claimForHandoff(params);
   if (!result.ok) {
     // Handle workq error (duplicate claim, etc.)
   }
   ```

### Option B: Shared Module (Not Recommended)

Import workq's internal logic directly:
- ❌ Tight coupling
- ❌ No isolation
- ❌ Breaks if workq refactors
- ❌ Not discoverable

**Do not use this pattern.**

---

## Concurrency and Safety

### Gateway Method Concurrency
- Gateway handles concurrent method calls via WebSocket message processing
- No special locking needed at the gateway layer
- workq must implement its own SQLite concurrency (WAL mode, busy_timeout)

### Rate Limiting
- Gateway has built-in rate limiting for auth attempts
- Method-specific rate limiting must be implemented in the handler

### Idempotency
- Gateway methods are NOT automatically idempotent
- workq should implement idempotent claim/release (e.g., using issue_ref as unique key)

---

## Session Injection and Context Propagation

For the ACP use case where agents communicate about work items:

1. **ACP tools receive session context** via `OpenClawPluginToolContext`:
   ```typescript
   {
     agentId,
     sessionKey,
     messageChannel,
     agentAccountId,
     // ...
   }
   ```

2. **When calling workq gateway methods**, pass this context:
   ```typescript
   await callGateway({
     method: "workq.claim",
     params: {
       issue_ref: "...",
       agent_id: ctx.agentId,        // From tool context
       session_key: ctx.sessionKey,  // From tool context
     },
   });
   ```

3. **workq handler uses passed context**:
   ```typescript
   async ({ params, respond }) => {
     const agentId = params.agent_id;  // Explicit, not ambient
     // ...
   }
   ```

---

## Implementation Checklist for ACP + Workq Integration

### Workq Extension
- [ ] Register gateway methods for `workq.claim`, `workq.release`, `workq.query`, etc.
- [ ] Accept `agent_id` and `session_key` as explicit parameters
- [ ] Return structured error codes for ACP to handle
- [ ] Implement idempotent operations

### ACP Extension
- [ ] Import `callGateway` from `openclaw/gateway/call`
- [ ] Create helper functions for workq RPC calls
- [ ] Pass session context from tool context to workq methods
- [ ] Handle workq errors and map to appropriate ACP responses

### Error Code Mapping
Define shared error codes between ACP and workq:
- `DUPLICATE_CLAIM` — item already claimed
- `NOT_FOUND` — item doesn't exist
- `UNAUTHORIZED` — wrong agent releasing
- `CONFLICT` — file path conflicts

---

## Verification Method

To verify this spike in practice:

1. Create a test plugin that registers a gateway method
2. From another plugin, call `callGateway` with that method
3. Verify response handling and error propagation
4. Test with concurrent calls to verify no race conditions

Example test case in: `/Users/openclaw/openclaw/src/gateway/tools-invoke-http.test.ts`

---

## Conclusion

**Extension-to-extension tool calls are NOT supported directly.**

**Gateway RPC methods ARE supported** and provide a clean, authenticated, session-aware mechanism for cross-plugin communication.

For ACP to invoke workq operations, use the gateway RPC pattern with explicit context propagation.

---

## References

- Plugin system: `/Users/openclaw/openclaw/docs/tools/plugin.md`
- Plugin registry: `/Users/openclaw/openclaw/src/plugins/registry.ts`
- Gateway client: `/Users/openclaw/openclaw/src/gateway/call.ts`
- Plugin types: `/Users/openclaw/openclaw/src/plugins/types.ts`
- Plugin runtime: `/Users/openclaw/openclaw/src/plugins/runtime/types.ts`
- Example plugin: `/Users/openclaw/openclaw/extensions/voice-call/index.ts`
- ACP spec: `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-canonical-spec.md`
- Workq brief: `/Users/openclaw/.openclaw/workspace/_shared/specs/workq-extension-brief.md`
