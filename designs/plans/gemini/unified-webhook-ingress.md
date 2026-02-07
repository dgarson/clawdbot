# Unified Webhook Ingress

**Source Material:** Synthesized from `designs/primitive-brainstorms/results-2/webhook-ingress-primitive.md` and `designs/primitive-brainstorms/results-1/webhook-ingress-platform.md`.

## Goal

Create a single, consolidated platform for managing all webhook ingress. This primitive unifies the **low-level mechanics** (HTTP handling, body limits, signature verification) with the **high-level platform** (registry, public URL management, tunnel integration).

## Problem Statement

Currently, webhook integrations (e.g., Voice, BlueBubbles, Google Chat) are fragmented.

- **Inconsistent Security:** Some verify signatures, others rely on obscure paths.
- **Duplicated Infrastructure:** Each plugin spins up its own server logic or hooks into Express ad-hoc.
- **Configuration Pain:** Users must manually configure public URLs (ngrok/tunnel) for each plugin separately.
- **Unsafe Defaults:** No global body size limits or timeout policies for plugin webhooks.

## Proposed Primitive: `WebhookIngress`

The `WebhookIngress` is a robust service that acts as the single entry point for all external HTTP callbacks.

### 1. The Registry & Router

A central registry where plugins register their intent to receive webhooks.

**Responsibilities:**

- **Path Management:** Allocates unique paths (e.g., `/hooks/v1/plugin-id/endpoint`).
- **Collision Detection:** Prevents plugins from overwriting each other's routes.
- **Lifecycle Management:** Starts/stops endpoints based on plugin health.

**API:**

```ts
interface WebhookEndpointDef {
  id: string; // e.g., "google-chat-incoming"
  pluginId: string;
  pathSegment?: string; // defaults to id
  auth: WebhookAuthPolicy;
  handler: (ctx: WebhookContext) => Promise<WebhookResponse>;
}

// Registry
webhookIngress.register(def);
```

### 2. Standardized Security & Mechanics

Eliminate ad-hoc parsing and validation.

**Responsibilities:**

- **Body Parsing:** Enforce global `maxBytes` (e.g., 1MB) and JSON parsing rules.
- **Signature Verification:** Provide a library of standard verifiers (HMAC-SHA256, Bearer Token, Query Param).
- **Auth Policy:** Enforce `WebhookAuthPolicy` _before_ the handler is invoked.

**API:**

```ts
type WebhookAuthPolicy =
  | { kind: "none" } // Discouraged, warns
  | { kind: "hmac"; secret: string; header: string; algo: "sha256" }
  | { kind: "bearer"; token: string }
  | { kind: "custom"; verify: (req: Request) => Promise<boolean> };
```

### 3. Public URL & Tunnel Management

Centralize the concept of "My Public URL".

**Responsibilities:**

- **Tunnel Integration:** Automatically register with the active tunnel provider (if configured) to expose routes.
- **URL Resolution:** Provide a method `getPublicUrl(endpointId)` so plugins can tell their upstream providers where to send events.
- **Health Checks:** Periodically verify the public URL is reachable.

## Integration Plan

### Phase 1: Core Service Implementation

1.  Create `src/webhooks/ingress-service.ts`.
2.  Implement the Registry, Express Router wrapper, and Body Parser limits.
3.  Implement the `WebhookAuthPolicy` verifiers.

### Phase 2: Plugin SDK Exposure

1.  Update `plugin-sdk` to expose `api.webhooks.register(...)`.
2.  Deprecate direct Express app access for plugins.

### Phase 3: Infrastructure Integration

1.  Connect `ingress-service` to the `Gateway Configuration` to read Tunnel settings.
2.  Implement `getPublicUrl()` logic (resolving `gateway.publicUrl` or tunnel address).

### Phase 4: Migration

1.  **Voice Call:** Migrate to `api.webhooks` (handling the Upgrade request for WebSockets via a specialized flag).
2.  **BlueBubbles:** Migrate its debounced webhook handler to a standard registered endpoint.
3.  **Google Chat:** Switch to the standardized `hmac` auth policy.

## Expected Impact

- **Security:** All webhooks have size limits and verified signatures by default.
- **Usability:** "It just works" - plugins automatically get the correct public URL from the gateway configuration.
- **Stability:** A rogue plugin receiving massive payloads won't crash the gateway (due to global limits).
