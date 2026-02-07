# Webhook ingress platform primitive

**Goal:** Consolidate webhook handling so channels and plugins can share validation, path registration, public URL exposure, and security policy.

## Current state and pain points

- Multiple channels and plugins implement their own webhook server bindings and public URL configuration.
- Some channels use long polling and optional webhooks, while others require public webhook exposure and custom signature verification.
- Public URL exposure is often tied to tunnel and host configuration that is duplicated across plugins.

## Proposed primitive

Create a **Webhook Ingress Platform** that provides:

1. **Single webhook registry**
   - Central registry for all webhook endpoints with normalized routing, path conflicts, and versioning.

2. **Uniform security and signature validation**
   - Standard interface for shared verification and per-provider verification adapters.

3. **Public URL management**
   - One shared service for tunnel providers, reverse proxy metadata, and public URL wiring.

4. **Lifecycle hooks**
   - Startup and health checks to verify endpoints are reachable.
   - Optional provider specific auto sync hooks (for example, updating provider webhook URLs on startup).

5. **Webhook request normalization**
   - Standardized envelope so downstream handlers can log and trace requests consistently.

## API sketch

```ts
export interface WebhookEndpointConfig {
  id: string;
  path: string;
  verify: (request: Request) => Promise<VerifyResult>;
  handler: (payload: WebhookPayload) => Promise<WebhookResponse>;
  publicUrl?: string;
  requiresPublicUrl?: boolean;
  healthcheck?: boolean;
}

export function registerWebhookEndpoint(config: WebhookEndpointConfig): void;
export function resolvePublicWebhookUrl(id: string): string | null;
```

## Integration plan

### Phase 1: Core HTTP router

- Add a webhook registry that can be mounted on the gateway HTTP server.
- Convert existing webhook routes to register via this registry.

### Phase 2: Shared verification

- Introduce shared verification adapters for common patterns (HMAC headers, query tokens, bearer tokens).
- Migrate providers that already have signature verification to use the shared adapter.

### Phase 3: Public URL management

- Move tunnel and public URL computation into the shared ingress service.
- Expose a consistent API to fetch public URLs for provider config sync.

### Phase 4: Channel and plugin migrations

- Update channels that currently expose optional webhook paths to register through the registry.
- Update plugin webhooks such as voice call providers to use the shared ingress service.

### Phase 5: Observability

- Emit unified webhook metrics and error reporting for all channels.

## Targeted complexity reductions

- Remove duplicate webhook server setup and validation logic across channels and plugins.
- Centralize public URL handling and tunnel configuration so it is not reimplemented per plugin.
- Provide a single place to enforce security policy for webhook exposure.
