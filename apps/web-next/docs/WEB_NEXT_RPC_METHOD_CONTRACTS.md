# Web Next RPC Contracts and Gap Analysis

Last verified: 2026-02-24

## Purpose

This file documents request/response contracts used by `apps/web-next`, current backend implementation status, and concrete frontend/backend contract mismatches.

## Implemented methods in use

### `config.get`

- Frontend callers:
  - `apps/web-next/src/views/ProviderAuthManager.tsx`
  - `apps/web-next/src/views/SettingsDashboard.tsx`
- Request shape:
  - `{}` (`ConfigGetParamsSchema`, no additional properties)
- Backend handler:
  - `src/gateway/server-methods/config.ts` (`configHandlers["config.get"]`)
- Backend response shape:
  - Redacted `ConfigFileSnapshot` object (includes `config`, `hash`, `issues`, etc.)
- Scope:
  - `operator.read`

### `wizard.start`

- Frontend caller:
  - `apps/web-next/src/hooks/useWizard.ts` (used by `ProviderAuthManager`)
- Request shape (backend schema):
  - `mode?: "local" | "remote"`
  - `workspace?: string`
  - No extra properties
- Backend handler:
  - `src/gateway/server-methods/wizard.ts`
- Backend response shape:
  - `{ sessionId, done, step?, status?, error? }`
- Scope:
  - Admin-only (`wizard.` method prefix)

### `wizard.next`

- Frontend caller:
  - `apps/web-next/src/hooks/useWizard.ts`
- Request shape:
  - `{ sessionId: string, answer?: { stepId: string, value?: unknown } }`
- Backend handler:
  - `src/gateway/server-methods/wizard.ts`
- Backend response shape:
  - `{ done, step?, status?, error? }`
- Scope:
  - Admin-only (`wizard.` method prefix)

### `wizard.cancel`

- Frontend caller:
  - `apps/web-next/src/hooks/useWizard.ts`
- Request shape:
  - `{ sessionId: string }`
- Backend handler:
  - `src/gateway/server-methods/wizard.ts`
- Backend response shape:
  - `{ status, error? }`
- Scope:
  - Admin-only (`wizard.` method prefix)

### `wizard.status`

- Frontend caller:
  - `apps/web-next/src/hooks/useWizard.ts`
- Request shape:
  - `{ sessionId: string }`
- Backend handler:
  - `src/gateway/server-methods/wizard.ts`
- Backend response shape:
  - `{ status, error? }`
- Scope:
  - Admin-only (`wizard.` method prefix)

### `sessions.list`

- Frontend caller:
  - `apps/web-next/src/hooks/useMissionControl.ts`
- Request shape:
  - `SessionsListParamsSchema` object (optional filters such as `limit`, `activeMinutes`, `agentId`, etc.)
- Backend handler:
  - `src/gateway/server-methods/sessions.ts`
- Backend response shape:
  - `SessionsListResult` object: `{ ts, path, count, defaults, sessions: [...] }`
- Scope:
  - `operator.read`

### `web.login.start`

- Frontend caller:
  - `apps/web-next/src/components/WhatsAppQrLogin.tsx`
- Request shape:
  - `{ force?: boolean, timeoutMs?: number, verbose?: boolean, accountId?: string }`
- Backend handler:
  - `src/gateway/server-methods/web.ts`
- Backend response shape:
  - `{ qrDataUrl?: string, message: string }`
- Scope:
  - `operator.admin`

### `web.login.wait`

- Frontend caller:
  - `apps/web-next/src/components/WhatsAppQrLogin.tsx`
- Request shape:
  - `{ timeoutMs?: number, accountId?: string }`
- Backend handler:
  - `src/gateway/server-methods/web.ts`
- Backend response shape:
  - `{ connected: boolean, message: string }`
- Scope:
  - `operator.admin`

## Missing backend methods currently referenced by web-next

### Mission Control methods (missing)

- `tools.history`
- `approvals.list`
- `approvals.approve`
- `approvals.deny`
- `alerts.list`
- `alerts.dismiss`

Used from `apps/web-next/src/hooks/useMissionControl.ts`.

### Horizon methods (missing)

- `horizon.brief.compose`
- `horizon.context.budgets`

Used from `apps/web-next/src/hooks/useHorizonOps.ts` and routed views:

- `apps/web-next/src/views/TodayCommandCenter.tsx`
- `apps/web-next/src/views/ContextBudgetInspector.tsx`

## Confirmed frontend/backend contract mismatches

### 1) `config.get` response shape mismatch

- Frontend expects `OpenClawConfig` directly.
- Backend returns `ConfigFileSnapshot` wrapper with config under `result.config`.
- Impact: provider/settings parsing can silently read the wrong object level.

### 2) `wizard.start` request schema mismatch

- Frontend sends `{ mode: "add-provider", provider: "..." }`.
- Backend only accepts `mode?: "local" | "remote"`, `workspace?: string`, and rejects extra fields.
- Impact: provider connect wizard start can fail at validation.

### 3) Wizard response typing mismatch in frontend

- Frontend types `wizard.next` and `wizard.status` as `WizardSession` (requires `sessionId`).
- Backend returns no `sessionId` for `wizard.next` or `wizard.status`.
- Impact: type contract is inaccurate and can hide runtime errors.

### 4) Wizard step schema mismatch

- Frontend `WizardStepType` allows values like `password`, `info`, `qr`, `device_code`.
- Backend schema uses `note`, `select`, `text`, `confirm`, `multiselect`, `progress`, `action`.
- Impact: renderer behavior may diverge from backend step payloads.

### 5) `sessions.list` response mismatch in Mission Control

- Frontend treats `sessions.list` as `ActiveSession[]`.
- Backend returns object with `sessions` array nested in `result.sessions`.
- Impact: Mission Control session table can fail and fall back to mock data.

### 6) `web.login.*` response enrichment mismatch

- Frontend types include optional `sessionId`, `status`, `phoneNumber`, `error` fields.
- Backend/channel adapter contracts only guarantee:
  - start: `{ qrDataUrl?: string, message: string }`
  - wait: `{ connected: boolean, message: string }`
- Impact: UI assumptions beyond guaranteed fields are not protocol-backed.

## Backend RPC TODO (Large)

This is a large backend task and should be tracked as a dedicated workstream.

Required for each missing method:

1. Add protocol request/response schemas in `src/gateway/protocol/schema/*`.
2. Register validators in `src/gateway/protocol/index.ts`.
3. Implement handlers in `src/gateway/server-methods/*`.
4. Add methods to `src/gateway/server-methods-list.ts`.
5. Add scope mapping in `src/gateway/method-scopes.ts`.
6. Add unit/integration coverage for success and failure paths.
7. Update docs (gateway + web-next RPC docs) after implementation.

Suggested implementation grouping:

1. Mission Control RPC bundle: `tools.history`, `approvals.*`, `alerts.*`
2. Horizon RPC bundle: `horizon.brief.compose`, `horizon.context.budgets`
3. Contract alignment pass for `config.get`, wizard payloads, and sessions response parsing
