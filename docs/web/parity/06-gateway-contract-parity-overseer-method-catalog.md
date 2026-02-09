# Web Parity Task Gateway Contract Overseer And Method Catalog

## Task objective

Align web client RPC method names with gateway handlers and make gateway method discovery truthful so clients can rely on `hello.features.methods` and docs without hidden runtime surprises.

## Why this is critical for OpenClaw setup

Method contract mismatches cause hard runtime failures that look like random UI breakage. Method catalog drift makes debugging and onboarding significantly harder because advertised capabilities do not match actual handlers.

## Current behavior and evidence

### Overseer name mismatch between web client and gateway

- Web client calls plural methods:
  - `apps/web/src/lib/api/overseer.ts:74` uses `overseer.goals.list`
  - `apps/web/src/lib/api/overseer.ts:82` uses `overseer.goals.create`
- Gateway handlers are singular:
  - `src/gateway/server-methods/overseer.ts:255` uses `overseer.goal.create`
  - `src/gateway/server-methods/overseer.ts:374` uses `overseer.goal.status`

### Method catalog drift in `server-methods-list`

- Static list source:
  - `src/gateway/server-methods-list.ts:3`
- Core handlers source:
  - `src/gateway/server-methods.ts:220`
- Server startup computes exposed methods from `listGatewayMethods` and plugins:
  - `src/gateway/server.impl.ts:252`

### Confirmed drift example

Repro command:

```bash
bun -e 'import { coreGatewayHandlers } from "./src/gateway/server-methods.ts"; import { listGatewayMethods } from "./src/gateway/server-methods-list.ts"; const core=new Set(Object.keys(coreGatewayHandlers)); const listed=new Set(listGatewayMethods()); const missing=[...core].filter((m)=>!listed.has(m)).sort(); const extra=[...listed].filter((m)=>!core.has(m)).sort(); console.log("missing",missing.length); console.log(missing.join("\n")); console.log("extra",extra.length); console.log(extra.join("\n"));'
```

Observed missing methods include important APIs such as:

- `automations.*`
- `web.login.start`
- `web.login.wait`
- `worktree.*`
- `tokens.*`
- `sessions.resolve`
- several `security.*` methods

Also confirmed in web comments:

- `apps/web/src/lib/api/worktree.ts:10` notes worktree methods are callable but not listed.

## Resolution strategy

## Part A overseer method compatibility

Choose one canonical naming scheme and provide compatibility aliases for the other to avoid breakage.

Recommended:

1. Canonicalize on singular `overseer.goal.*` in backend and docs.
2. Add temporary plural aliases in backend (`overseer.goals.*`) mapped to same handlers.
3. Update web client to canonical names.
4. Remove aliases in a scheduled cleanup release.

Implementation areas:

- `src/gateway/server-methods/overseer.ts`
- `apps/web/src/lib/api/overseer.ts`
- `src/gateway/server-methods-list.ts`

## Part B method catalog truthfulness

Replace static drift prone method list behavior with derived method list from registered handlers plus plugin methods.

Recommended implementation:

1. Build base methods from `Object.keys(coreGatewayHandlers)`.
2. Merge plugin methods.
3. Optionally maintain an explicit denylist for intentionally hidden methods.

Potential change locations:

- `src/gateway/server.impl.ts`
- `src/gateway/server-methods-list.ts`
- `src/gateway/server-plugins.ts`

## Code sample for compatibility alias

```ts
// in overseerHandlers map
"overseer.goal.create": createGoalHandler,
"overseer.goals.create": createGoalHandler, // temporary alias
```

## Code sample for truthful method exposure

```ts
const coreMethods = Object.keys(coreGatewayHandlers);
const pluginMethods = Object.keys(pluginRegistry.gatewayHandlers);
const gatewayMethods = Array.from(new Set([...coreMethods, ...pluginMethods]));
```

## Testing plan

### Contract tests

1. Add tests asserting both canonical and alias overseer methods resolve during transition.
2. Add tests asserting exposed method list includes all core handlers except intentional denylist entries.

### Manual verification

1. Connect debug terminal and inspect hello method count.
2. Invoke `overseer.goal.create` and `overseer.goals.create` during transition.
3. Verify `web.login.start` and `worktree.list` appear in discovered methods.

### Required test gates

1. `pnpm test:affected`
2. `pnpm test:smart`
3. `pnpm test`
4. `pnpm build && pnpm check`

## Acceptance criteria

1. Web overseer calls no longer hit unknown method errors.
2. Method discovery list reflects actual callable handlers.
3. No critical API family is omitted from discovery by accident.
4. Compatibility aliases are documented and scheduled for removal.

## Out of scope

1. Full protocol redesign.
2. Role scope policy changes beyond naming and discovery parity.

## Related docs and references

- Related task docs:
  - [OAuth Delegated Auth End To End](/web/parity/01-oauth-delegated-auth-e2e)
  - [Debug Workspace Filesystem Parity](/web/parity/05-debug-workspace-filesystem-parity)
- Existing OpenClaw docs:
  - [Configuration](/configuration)
  - [Gateway Doctor](/gateway/doctor)
