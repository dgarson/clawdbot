# Provider Auth Flow Primitive Plan

## Goal

Create a shared provider auth flow primitive that consolidates OAuth and device code logic used by provider plugins into a single, reusable module with consistent UX, error handling, and config patching.

## Current patterns and complexity

- Google Antigravity OAuth includes PKCE generation, localhost callback server, WSL and remote fallbacks, and token exchange logic inside the plugin implementation, which duplicates flow state management and server lifecycle concerns.
- Gemini CLI OAuth repeats PKCE, localhost callback handling, WSL fallback, and environment credential resolution in its own flow helper with similar error handling and progress updates.
- Qwen OAuth uses a device code flow with its own progress UX and config patching logic inside the plugin registration, reinforcing that providers are hand-rolling flow orchestration in multiple places.
- The plugin API already supports provider auth methods but leaves the flow implementation to each plugin, which encourages duplication across new providers.

## Proposed primitive

Introduce a `provider-auth` primitive that encapsulates the common flow mechanics and exposes a typed interface to plugins.

### Responsibilities

- Provide flow helpers for:
  - OAuth with PKCE and localhost callback server
  - OAuth device code flow
  - Manual copy and paste fallback for remote or WSL sessions
- Standardize:
  - Progress and note UX
  - Open URL behavior
  - Token exchange retries and timeout handling
  - Config patch application
  - Default model and provider config setup

### Proposed API shape

- `createProviderAuthFlow({ kind, context, config })` returns a runner with:
  - `start()` to kick off flow steps
  - `awaitCallback()` for localhost flows
  - `awaitDeviceCode()` for device code flows
  - `buildResult()` that produces `ProviderAuthResult`

### Example usage

- Plugin registers provider auth by calling the primitive with the plugin-specific parameters, but avoids reimplementing PKCE or server logic.

## Integration plan

1. Add `src/providers/auth/flows` with shared utilities for PKCE, localhost callback server, and device code polling.
2. Add a small facade in `plugin-sdk` to expose the new flow helpers for plugins.
3. Migrate `google-antigravity-auth` to the primitive first as a reference implementation and verify that the manual callback and localhost flows still work.
4. Migrate `google-gemini-cli-auth` to reuse the same PKCE and callback helpers and delete its duplicate utilities.
5. Migrate `qwen-portal-auth` to use the shared device code flow helper for consistent UX and error handling.
6. Add unit tests for the new flow helpers and update existing provider tests to target the shared utilities.

## Expected impact

- Removes repeated PKCE and callback server implementations across provider plugins.
- Ensures consistent OAuth UX and error handling across providers.
- Lowers maintenance burden when auth flow requirements change.
