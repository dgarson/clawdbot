# Testing Strategy (apps/web Agent Configuration)

This document defines how we test the Agent Configuration MVP in `apps/web/`, including happy paths, unhappy paths, and failure modes.

It is intentionally explicit so future subagents can implement tests without “interpreting” intent.

## 1) Testing Levels (What goes where)

### Unit tests (Vitest)
Use for:
- pure functions (terminology mapping, formatting helpers, config patch builders)
- capability gating logic (show/hide/disable decisions)
- diff/override computation

Framework:
- `vitest` + `@testing-library/react` where needed

### Component tests (Vitest + Testing Library)
Use for:
- `SystemDefaultToggle` variants
- validation/error rendering
- save status indicators (“Saving…”, “Failed to save” banner)
- secrets fields (mask/reveal/copy affordances)

### Integration tests (Vitest)
Use for:
- a config surface interacting with mocked query/mutation hooks
- “save failed” recovery actions (retry/undo/copy)
- “models list fetch failed” behavior without breaking unrelated saves

### E2E tests (Playwright recommended)
Use for:
- routing + URL state (`?tab=…`, `?section=…`)
- command palette jump flows
- connect provider flows (including headless fallback screens)
- wizard mode selection (Basic vs Advanced) and completion

Decision: use the **Playwright test runner** for `apps/web` E2E.

## 1.1 E2E Setup Plan (Playwright)

This is how a subagent should add Playwright E2E to `apps/web/`:

1) Add dependencies in `apps/web/package.json` (local to the app):
   - `@playwright/test`
   - (optional) `playwright` (if we want `npx playwright install` conveniences)

2) Add config:
   - `apps/web/playwright.config.ts` (baseURL, retries, reporters, trace/video policies)

3) Add scripts in `apps/web/package.json`:
   - `test:e2e` (runs Playwright)
   - `test:e2e:ui` (optional)

4) Add an E2E folder structure:
   - `apps/web/e2e/*.spec.ts`

5) Run against the real dev server (recommended):
   - start `apps/web` dev server during E2E (either via Playwright webServer config or CI orchestration)

6) Define a stable test strategy for gateway dependencies:
   - Either run a mocked gateway mode, or run a deterministic local gateway for E2E.
   - Tests must cover both “happy” and “unhappy” network cases deterministically (see Failure Mode Inventory).

## 2) What Must Be Tested (MVP Gate)

### Routing and URL state
Happy:
- deep link to `/agents/:id?tab=basics` lands correctly
- deep link to `/settings?section=model-provider` lands correctly

Unhappy:
- unknown tab id falls back to a safe default
- missing params don’t crash

### Expert Mode and view override (Simple/Full)
Happy:
- Expert Mode ON reveals advanced sections and technical tooltips
- per-page Simple/Full override inverts the default without changing global preference

Unhappy:
- toggling modes mid-edit does not lose draft state

### Save behavior (patch config / mutations)
Happy:
- autosave triggers and “All changes saved” appears

Unhappy:
- save fails -> persistent banner with Retry/Undo/Copy
- retry succeeds -> banner clears and state matches server
- undo restores last-known saved state

### Providers: auth + test + models list
Happy:
- API key save succeeds
- test succeeds and shows “Connected”
- models list loads and selectors populate

Unhappy:
- test fails -> shows safe error + “Test again” + “Edit credentials”
- models list fetch fails -> shows “Unable to load models” with retry
- saving unrelated fields still works when models list is down

### Secrets UX
Happy:
- secrets are masked by default
- reveal works and re-masks on blur/close
- copy requires explicit action and shows warning copy

Unhappy:
- copy errors handled (clipboard permission denied)
- secret values never appear in logs or diagnostics output

### Create Agent wizard (Basic vs Advanced)
Happy:
- mode chooser appears before steps
- Basic completes in 3 steps (or 4 if provider-connect gate is needed)
- Advanced completes existing multi-step flow

Unhappy:
- incomplete required fields block “Next”
- create mutation failure shows recoverable error and preserves input

### Command palette (configuration)
Happy:
- `Cmd+K` opens
- typing finds commands (agents/settings/providers)
- selecting a command navigates to correct deep link

Unhappy:
- palette does not navigate to invalid routes
- keyboard focus returns to prior location on close

## 3) Failure Mode Inventory (Must Cover)

Minimum failures to test in integration/e2e:
- Save failed
- Test failed (provider/channel/connection)
- Models list fetch failed
- Pop-up blocked for OAuth (fallback to “open in new tab”)
- Headless gateway OAuth callback not reachable (fallback to pairing)

## 4) Fixtures and Mocks (Canonical)

### Config fixtures
- Provide minimal valid config snapshots for:
  - no providers configured
  - one provider configured with models list
  - heartbeat configured/unconfigured
  - agent with no overrides vs agent with overrides

### Network mocks
- Mock gateway RPC responses and failure codes consistently.
- Always include “safe error message” and “machine error code” separately.

## 5) Definition of Done (Testing)

Before declaring the Agent Configuration MVP ready:
- Unit tests exist for terminology + override/diff computations.
- Component tests exist for:
  - `SystemDefaultToggle` variants
  - save failed banner
  - secret field UX
- At least one E2E flow covers:
  - wizard (Basic)
  - provider connect/test unhappy case
  - command palette jump to settings and agent tabs
