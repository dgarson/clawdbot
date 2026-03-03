# Web Next Onboarding Backend API/RPC Specification

## Scope

This specification defines all backend APIs and Gateway RPCs needed to fully support the onboarding workflow implemented in `apps/web-next/src/views/OnboardingFlow.tsx`.

It extends the existing `wizard.start`, `wizard.next`, `wizard.cancel`, and `wizard.status` flow with onboarding-specific state, permission operations, CLI install telemetry, and onboarding-chat handoff.

## Protocol Overview

- Transport: Gateway WebSocket JSON-RPC (same channel as other app RPCs).
- Auth: Token required unless the operator explicitly disables auth.
- Idempotency: all state-mutating methods accept an optional `requestId` to dedupe retries.
- Versioning: all responses include `apiVersion` (`"2026-02-onboarding-v1"`).

## Shared Data Models

### OnboardingSession

```ts
interface OnboardingSession {
  apiVersion: '2026-02-onboarding-v1';
  sessionId: string;
  userId: string;
  status: 'active' | 'completed' | 'skipped' | 'cancelled';
  currentStep: 'welcome' | 'gateway' | 'permissions' | 'cli' | 'chat' | 'complete';
  totalSteps: 6;
  progressPercent: number;
  startedAt: string; // ISO8601
  updatedAt: string; // ISO8601
  completedAt?: string; // ISO8601
  state: {
    gateway: {
      mode: 'local' | 'remote';
      authMode: 'token' | 'none';
      host?: string;
      port?: number;
    };
    permissions: Record<string, {
      enabled: boolean;
      status: 'unknown' | 'prompted' | 'granted' | 'denied' | 'not_applicable';
      updatedAt: string;
    }>;
    cli: {
      desired: 'skip' | 'install';
      packageManager?: 'pnpm' | 'npm' | 'bun' | 'unknown';
      status: 'idle' | 'running' | 'success' | 'failed';
      lastError?: string;
    };
    chat: {
      selectedPrompt?: string;
      onboardingChatSessionId?: string;
    };
  };
}
```

### API Error Envelope

```ts
interface RpcError {
  code:
    | 'INVALID_INPUT'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'FORBIDDEN'
    | 'PRECONDITION_FAILED'
    | 'RATE_LIMITED'
    | 'INTERNAL_ERROR';
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}
```

## Required RPC Methods

## 1) Session lifecycle

### `onboarding.start`

Creates or resumes the onboarding session.

**Params**

```json
{
  "resume": true,
  "source": "web-next",
  "requestId": "uuid"
}
```

**Result**

```json
{
  "session": { "...": "OnboardingSession" },
  "resumed": true
}
```

### `onboarding.get`

Fetches current onboarding session state by `sessionId`.

### `onboarding.skip`

Marks onboarding as skipped and stores a `skippedAt` timestamp.

### `onboarding.complete`

Marks completion only after onboarding chat handoff succeeds.

Preconditions:
- `currentStep` is `chat` or `complete`
- `state.chat.onboardingChatSessionId` exists

## 2) Step transition and validation

### `onboarding.step.update`

Atomic update to step data and transition.

**Params**

```json
{
  "sessionId": "ob_123",
  "step": "gateway",
  "payload": {
    "gateway": {
      "mode": "local",
      "authMode": "token"
    }
  },
  "nextStep": "permissions",
  "requestId": "uuid"
}
```

**Validation rules**

- Remote + `authMode=none` => reject with `PRECONDITION_FAILED`.
- Required permission toggles cannot be unset after user enters step `chat`.
- `nextStep` must be either current step or the immediate next step.

## 3) Permissions operations

### `onboarding.permissions.list`

Returns server-resolved permission matrix for current OS/device.

### `onboarding.permissions.request`

Triggers OS permission prompt when supported.

**Params**

```json
{
  "sessionId": "ob_123",
  "permission": "automation"
}
```

### `onboarding.permissions.status`

Refreshes permission grant states.

## 4) CLI setup operations

### `onboarding.cli.detect`

Detects available package managers and returns preferred recommendation.

### `onboarding.cli.install`

Starts background CLI install job.

**Result**

```json
{
  "jobId": "job_123",
  "status": "running"
}
```

### `onboarding.cli.job`

Fetches install job status/log snippets.

## 5) Chat handoff operations

### `onboarding.chat.handoff`

Creates dedicated onboarding chat session and optional first assistant prompt.

**Params**

```json
{
  "sessionId": "ob_123",
  "suggestedPrompt": "Run a quick health check"
}
```

**Result**

```json
{
  "chatSessionId": "chat_987",
  "assistantMessageId": "msg_321",
  "openRoute": "/chat/chat_987"
}
```

### `onboarding.chat.suggestions`

Returns ranked suggested prompts for current user capability and channel availability.

## 6) Existing wizard integration (compatibility layer)

To avoid duplicating onboarding logic already present in Gateway wizard flows:

- `onboarding.step.update(step=gateway)` may internally call `wizard.start` + `wizard.next`.
- `onboarding.get` may expose `wizardSessionId` when applicable.
- If wizard returns a recoverable error, map it into `RpcError` envelope.

## Events (server push)

The client should subscribe to onboarding events via existing websocket message channel:

- `onboarding.session.updated`
- `onboarding.permission.changed`
- `onboarding.cli.progress`
- `onboarding.chat.ready`
- `onboarding.session.completed`

Event payloads must always include `sessionId`, `occurredAt`, and `apiVersion`.

## Observability and telemetry requirements

Server must emit structured events:

- `onboarding_step_viewed`
- `onboarding_step_submitted`
- `onboarding_validation_failed`
- `onboarding_permission_prompted`
- `onboarding_cli_install_started|succeeded|failed`
- `onboarding_chat_handoff_started|succeeded|failed`
- `onboarding_completed`
- `onboarding_skipped`

Required dimensions:
- `step`
- `gatewayMode`
- `authMode`
- `platform`
- `appVersion`
- `sessionDurationMs`

## Security requirements

- Enforce token auth by default for onboarding endpoints.
- Redact secrets from logs and event payloads (`token`, `apiKey`, `password`).
- Reject cross-user session access.
- Apply rate limits to mutation methods (10 req/10s/session).

## Retry/Recovery guarantees

- On reconnect, `onboarding.get` must return latest committed state.
- All mutation endpoints should support at-least-once retries via `requestId` dedupe.
- CLI install jobs survive websocket reconnects and can be queried by `jobId`.

## Compatibility + migration

- Persist sessions in existing OpenClaw config/session storage.
- Migration path:
  1. deploy read-only `onboarding.get`
  2. deploy mutation endpoints with validation
  3. switch web-next onboarding from local mock state to RPC-backed state
  4. remove legacy localStorage fallback after two stable releases

## Acceptance checklist

- [ ] User can start/resume/skip onboarding from web-next.
- [ ] Gateway mode step prevents insecure remote unauthenticated configuration.
- [ ] Permission statuses reflect real OS grants.
- [ ] CLI install supports progress, success, and failure states.
- [ ] Finishing onboarding opens dedicated chat session.
- [ ] Completion marker is written only after successful handoff.
- [ ] All critical onboarding events are logged with required dimensions.
