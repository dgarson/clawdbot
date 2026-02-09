# Web Parity Task OAuth Delegated Auth End To End

## Task objective

Deliver a fully working delegated auth flow in the active `apps/web` settings UI so operators can connect and manage OAuth backed integrations from the control UI without using mocks.

This task is complete only when the active Settings page can:

1. Start OAuth authorization.
2. Receive callback completion.
3. Fetch connection status.
4. Disconnect.
5. Store non OAuth credentials where supported.

## Why this is critical for OpenClaw setup

Delegated auth is part of first run configuration for channels and external integrations. If this flow is broken, a user can open settings but cannot fully configure production integrations. That makes `apps/web` unsuitable as the primary control surface.

## Current behavior and evidence

### Active settings view mounts the mock component

- `apps/web/src/routes/settings/index.tsx:100` renders `<ConnectionsSection />`.
- `apps/web/src/components/domain/settings/ConnectionsSection.tsx:392` and `apps/web/src/components/domain/settings/ConnectionsSection.tsx:403` simulate connect and disconnect with `setTimeout`.
- The OAuth capable component exists but is not mounted:
  - `apps/web/src/components/domain/settings/ConnectionsSectionWithOAuth.tsx:379`

### Frontend OAuth calls do not send gateway auth headers

- `apps/web/src/hooks/useConnectionManager.ts:47` calls `/oauth/status/:provider`.
- `apps/web/src/hooks/useConnectionManager.ts:188` calls `DELETE /oauth/:provider`.
- `apps/web/src/hooks/useConnectionManager.ts:223` calls `POST /oauth/store/:provider`.
- All three rely on `credentials: "include"`, but no bearer token is attached.

### Backend OAuth handler requires auth for status store disconnect

- OAuth HTTP handler exists:
  - `src/gateway/server-methods/oauth.ts:444`
- For `store`, `status`, and `disconnect`, handler runs gateway auth check:
  - `src/gateway/server-methods/oauth.ts:481`
- Token is read from bearer header:
  - `src/gateway/server-methods/oauth.ts:481`

### OAuth HTTP handler is not mounted in HTTP server request pipeline

- Runtime creates hooks and plugin handlers then mounts HTTP server:
  - `src/gateway/server-runtime-state.ts:113`
  - `src/gateway/server-runtime-state.ts:130`
- HTTP server request chain has no OAuth handler branch:
  - `src/gateway/server-http.ts:320`

## Root cause summary

1. Wrong settings component is mounted.
2. OAuth handler exists but is not connected to gateway HTTP server.
3. Frontend OAuth API calls do not provide auth token required by backend.

## Implementation plan

### Step 1 mount OAuth HTTP handling in gateway runtime

Add an OAuth request handler in runtime state and pass it into `createGatewayHttpServer`.

Expected change areas:

- `src/gateway/server-runtime-state.ts`
- `src/gateway/server-http.ts`

Example patch shape:

```ts
// src/gateway/server-runtime-state.ts
import { createOAuthHttpHandler } from "./server-methods/oauth.js";

const handleOAuthRequest = createOAuthHttpHandler({
  auth: params.resolvedAuth,
  trustedProxies: params.cfg.gateway?.trustedProxies ?? [],
  bindHost: params.bindHost,
  port: params.port,
});

const httpServer = createGatewayHttpServer({
  ...,
  handleOAuthRequest,
});
```

```ts
// src/gateway/server-http.ts (in opts + request chain)
if (handleOAuthRequest && (await handleOAuthRequest(req, res))) {
  return;
}
```

### Step 2 add authenticated OAuth fetch helper in web

Update `useConnectionManager` so `/oauth/status`, `/oauth/store`, and `/oauth/:provider` calls include bearer auth from stored gateway credentials.

Expected change area:

- `apps/web/src/hooks/useConnectionManager.ts`

Example helper:

```ts
import { loadSharedGatewayToken, loadSharedGatewayPassword } from "@/lib/api/device-auth-storage";

function getGatewayAuthHeaders(): HeadersInit {
  const bearer = loadSharedGatewayToken() ?? loadSharedGatewayPassword();
  return bearer ? { Authorization: `Bearer ${bearer}` } : {};
}
```

Then include headers in `fetch` for protected OAuth endpoints.

### Step 3 mount OAuth capable settings component

Switch settings connections tab from `ConnectionsSection` to `ConnectionsSectionWithOAuth`.

Expected change area:

- `apps/web/src/routes/settings/index.tsx`

Use a gateway HTTP base URL derived from the configured gateway URL.

### Step 4 normalize gateway HTTP base URL

The app stores gateway URL as websocket (`ws://...` or `wss://...`). OAuth endpoints are HTTP.

Add or reuse a small utility to convert websocket URL to HTTP URL:

```ts
function toHttpBase(wsUrl: string): string {
  const u = new URL(wsUrl);
  u.protocol = u.protocol === "wss:" ? "https:" : "http:";
  u.pathname = "";
  u.search = "";
  u.hash = "";
  return u.toString().replace(/\/$/, "");
}
```

Suggested file for utility:

- `apps/web/src/lib/api/device-auth-storage.ts` or a small new `apps/web/src/lib/api/gateway-url.ts`.

### Step 5 improve OAuth UX failure handling

Add explicit UI states for:

- auth header missing
- callback timeout
- popup blocked fallback
- provider returned denial

Suggested areas:

- `apps/web/src/hooks/useConnectionManager.ts`
- `apps/web/src/components/domain/settings/ConnectionsSectionWithOAuth.tsx`

## Test plan

### Unit and integration

1. Add tests for OAuth request pipeline mount:
   - new test near gateway HTTP tests, for example in `src/gateway/server.canvas-auth.e2e.test.ts` style.
2. Add tests for `useConnectionManager` auth headers and status refresh behavior.

### Manual flow

1. Open settings connections tab.
2. Start OAuth for one provider.
3. Complete callback.
4. Confirm status badge changes to connected.
5. Disconnect and verify state updates.
6. Restart dashboard and verify status reload works.

### Required test gates

1. `pnpm test:affected`
2. `pnpm test:smart`
3. `pnpm test`
4. `pnpm build && pnpm check`

## Acceptance criteria

1. OAuth endpoints are reachable through gateway HTTP server.
2. Active settings page uses OAuth capable connections UI.
3. Protected OAuth endpoints succeed with configured gateway auth.
4. Connect and disconnect states are persisted and visible after refresh.
5. No mock timers remain in active connections flow.

## Out of scope

1. Reworking gateway login modal into OAuth based authentication.
2. Building brand new provider integrations.

## Related docs and references

- Related task docs:
  - [Channel Config Wiring Parity](/web/parity/02-channel-config-wiring-parity)
  - [Gateway Contract Parity](/web/parity/06-gateway-contract-parity-overseer-method-catalog)
- Existing OpenClaw docs:
  - [Configuration](/configuration)
  - [Gateway Doctor](/gateway/doctor)
