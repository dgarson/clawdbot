# OpenClaw Integration Deprecation Proposal

## Summary

With the implementation of the unified v3 gateway client, the legacy OpenClaw integration in `apps/web/src/integrations/openclaw/` is no longer needed. This document outlines what should be removed and the reasoning behind each decision.

## Migration Completed

The following migrations have been completed as part of this work:

1. **Unified v3 Gateway Client** (`apps/web/src/lib/api/gateway-client.ts`)
   - Protocol v3 with challenge/nonce handshake
   - Device identity + signature authentication
   - Standard frame shapes: `{ type: "req" | "res" | "event" }`
   - Client ID: `openclaw-control-ui`, mode: `webchat`
   - Role: `operator`, scopes: `["operator.admin", "operator.approvals", "operator.pairing"]`

2. **Device Auth & Identity** (`apps/web/src/lib/api/device-auth.ts`, `device-identity.ts`)
   - Device token storage in localStorage
   - Ed25519 key generation and signing
   - v2 payload format with nonce support

3. **New GatewayProvider** (`apps/web/src/providers/GatewayProvider.tsx`)
   - React context wrapper for the unified client
   - Hooks: `useGateway`, `useOptionalGateway`, `useGatewayClient`, `useGatewayEvent`
   - Event listener pattern for gateway events

4. **Updated Consumers**
   - `main.tsx` - Now uses `GatewayProvider`
   - `useAgentApprovalActions.ts` - Uses `useOptionalGateway`
   - `useAgentLiveUpdates.ts` - Uses `useOptionalGateway`
   - `terminal.lazy.tsx` - Uses `createGatewayClient` directly

---

## Files Proposed for Removal

### 1. `apps/web/src/integrations/openclaw/` (entire directory)

**Files:**
- `apps/web/src/integrations/openclaw/index.ts`
- `apps/web/src/integrations/openclaw/openclaw.ts`
- `apps/web/src/integrations/openclaw/react.tsx`

**Reason:** These files contain the legacy gateway client (`OpenClawGatewayClient`) and event bus (`OpenClawEventBus`) that have been replaced by the unified v3 client and new `GatewayProvider`.

**What was in them:**
- `OpenClawGatewayClient` - Custom WebSocket client with v1 protocol and `rpc/response/event` frame types
- `OpenClawEventBus` - Custom event emitter for workflow events
- `OpenClawProvider` - React context provider
- Various hooks: `useOpenClawEvents`, `useOpenClawGateway`, `useOpenClawWorkflow`, etc.
- Type definitions for OpenClaw events

**Why safe to remove:**
- No files in `apps/web/src` import from `@/integrations/openclaw` anymore
- All functionality has been migrated to the new unified client

---

### 2. `apps/web/src/ui-refs/openclaw-integration.tsx`

**Reason:** This is a reference implementation/example file for the legacy OpenClaw integration. It's not used in production and serves as documentation for the old pattern.

**Contents:**
- Duplicate implementation of `OpenClawEventBus`, `OpenClawGatewayClient`
- Example usage patterns
- Hook examples

---

### 3. `apps/web/src/ui-refs/openclaw-integration-examples.tsx`

**Reason:** Example usage file for the legacy integration. Not used in production.

**Contents:**
- Example React components showing OpenClaw usage patterns
- Demo code for workflows and tool approval UI

---

## Files to KEEP (Not Proposed for Removal)

### Keep: Other `ui-refs/` files

The following files in `ui-refs/` are NOT related to OpenClaw and should be kept:
- `agentic-workflow-vercel-ai.jsx`/`.tsx` - Vercel AI SDK examples
- `agentic-workflow.tsx` - Agentic workflow reference
- `api-chat-route.ts` - API route example
- `command-palette-ultra-compact.jsx`/`.tsx` - UI reference
- `use-workflow.ts` - Workflow hook reference
- `web-terminal/` - WebTerminal component reference

These are reference implementations for other features and are unrelated to the gateway client migration.

---

## Verification Checklist

Before deleting, verify:

- [ ] `pnpm build` succeeds in `apps/web`
- [ ] `pnpm test` passes in `apps/web`
- [ ] No runtime errors when connecting to gateway
- [ ] Debug terminal page works (`/debug/terminal`)
- [ ] Agent approval actions work (if gateway is running)

---

## Questions for Review

1. **Keep ui-refs for historical reference?**
   - The `ui-refs/openclaw-*.tsx` files could be useful as historical documentation of the old pattern
   - Recommendation: Delete them since the new pattern is documented in the actual implementation

2. **Archive vs Delete?**
   - Option A: Delete entirely (recommended - git history preserves the old code)
   - Option B: Move to a `.deprecated/` folder (not recommended - clutters the codebase)

---

## Summary of Removable Files

```
apps/web/src/integrations/openclaw/
├── index.ts                              ← DELETE
├── openclaw.ts                           ← DELETE
└── react.tsx                             ← DELETE

apps/web/src/ui-refs/
├── openclaw-integration.tsx              ← DELETE
└── openclaw-integration-examples.tsx     ← DELETE
```

**Total: 5 files, ~900 lines of code**

---

## Approval Request

Please review and approve this deprecation proposal. Once approved, I will delete the listed files.

Reply with:
- **"Approved"** - Delete all listed files
- **"Approved with exceptions: [list files to keep]"** - Delete some files
- **"Rejected"** - Keep all files, provide feedback
