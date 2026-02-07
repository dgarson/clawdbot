# Webhook Ingress Primitive Plan

## Goal

Create a shared webhook ingress primitive that standardizes webhook request parsing, authentication, body limits, and dispatch for webhook based channels and plugins.

## Current patterns and complexity

- Voice Call runs its own HTTP server and handles webhook request parsing and error handling, including media stream upgrades, which makes it responsible for body size limits and routing logic by itself.
- BlueBubbles registers webhook targets, performs custom request parsing, authorization checks, and debounced dispatch inside a large handler that duplicates patterns found in other webhook based integrations.
- Google Chat implements its own webhook routing, request body parsing, and authentication verification logic, which overlaps with other webhook handlers and increases maintenance cost.

## Proposed primitive

Introduce a `WebhookIngress` primitive that provides a shared HTTP request handler wrapper, signature verification hooks, and normalized event dispatch.

### Responsibilities

- Enforce a consistent request body size limit and JSON parsing behavior.
- Provide a reusable authorization and signature verification contract.
- Normalize webhook targets by path and route events to registered handlers.
- Provide standard logging and response behaviors for common error conditions.
- Support WebSocket upgrade routing when needed for media streaming.

### Proposed API shape

- `createWebhookIngress({ name, maxBytes, verify, onEvent, onUpgrade })`
- `registerWebhookTarget({ path, handler, auth })`
- `handleRequest(req, res)` returns `boolean` to indicate handled status.

### Example usage

- Voice Call uses `createWebhookIngress` with `onUpgrade` for media streams.
- BlueBubbles and Google Chat register webhook targets with per account auth and handler callbacks.

## Integration plan

1. Add `src/webhooks/ingress.ts` with body parsing helpers and shared error handling.
2. Provide a small adapter in `plugin-sdk` for plugin based channels to register webhook targets.
3. Migrate Voice Call to the shared ingress handler and keep its media stream wiring intact.
4. Migrate BlueBubbles webhook handling to the shared ingress logic with a dedicated event handler that preserves debouncing behavior.
5. Migrate Google Chat webhook handling to the shared ingress logic and keep its auth verification logic wired into the verification hook.
6. Add tests for body size limits, authentication failures, and routing to multiple targets.

## Expected impact

- Reduces duplicate request parsing and error handling across webhook based plugins.
- Makes webhook authentication and logging consistent across channels.
- Simplifies adding new webhook based integrations.
