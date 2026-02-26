# Branch Audit vs `openclaw/openclaw:main`

Comparison basis:

- `upstream/main` fetched from `https://github.com/openclaw/openclaw.git`
- local branch: `work`

This document now tracks **remaining unresolved issues only**, followed by a section describing what was addressed in this remediation pass.

## Remaining issues (not yet addressed)

## 1) Lint coverage disabled for newly added surfaces

- **Where:** `.oxlintrc.json` ignores `apps/web-next/` and `apps/web/src/ui-refs/`.
- **Risk:** broad directory-level exclusions can hide correctness/suspicious regressions.
- **Why unresolved:** removing these ignores safely requires either substantial lint cleanup or a staged lint rollout plan.
- **Recommended next step:** replace broad ignores with narrow temporary suppressions (file/line-level) and enforce an incremental lint budget in CI.

## 2) Integration test location/intent mismatch

- **Where:** `test/integration/agent-spawn.integration.test.ts`.
- **Risk:** mostly-mocked behavior in integration location creates false confidence.
- **Why unresolved:** needs test-harness alignment and likely CI profile updates (live gateway expectations).
- **Recommended next step:** split into true integration tests (live gateway) and unit/contract tests; gate each in the correct pipeline stage.

## 3) RPC naming inconsistency risk (`sessions_spawn` vs `sessions.spawn`)

- **Where:** comments/intent around integration spawn flow.
- **Risk:** method naming drift can cause client/server mismatch defects.
- **Why unresolved:** needs shared API contract normalization across modules.
- **Recommended next step:** centralize RPC method constants/types and replace ad-hoc strings.

## 4) Monolithic `App.tsx` view registry hotspot

- **Where:** `apps/web-next/src/App.tsx`.
- **Risk:** high merge-conflict pressure and maintainability drag.
- **Why unresolved:** requires architectural decomposition (routing/manifest ownership).
- **Recommended next step:** move registration into route manifests + feature-level modules.

## 5) In-file production dummy datasets in some views

- **Where:** e.g. `apps/web-next/src/views/APIRateLimitManager.tsx`.
- **Risk:** accidental fake-data presentation in production-adjacent paths.
- **Why unresolved:** fixture strategy and backend adapter boundaries are not yet standardized for these views.
- **Recommended next step:** move fixtures to explicit mock modules/flags and default runtime to real data adapters or explicit empty/loading states.

---

## Addressed in this pass

## A) Gateway URL is now configurable (removed hardcoded endpoint dependency)

- **Previously identified issue:** hardcoded `ws://localhost:18789` in gateway hook.
- **What changed:** `useGateway` now reads `import.meta.env.VITE_GATEWAY_URL` with a local fallback default.
- **Impact:** deployment/staging environments can set endpoint without code edits.

## B) Handshake timeout no longer forces a false `connected` state

- **Previously identified issue:** hello timeout promoted state to `connected` anyway.
- **What changed:** timeout now sets error state, rejects pending connection promise, and closes socket.
- **Impact:** protocol correctness is preserved and connection failures are surfaced explicitly.

## C) RPC `call()` now waits for connection readiness instead of immediate failure

- **Previously identified issue:** call path triggered connect but rejected immediately.
- **What changed:** added connection promise management so calls can wait for handshake completion.
- **Impact:** reduced first-call race failures and fewer upstream retry hacks.

## D) E2E smoke tests no longer hardcode one dev URL/port

- **Previously identified issue:** tests assumed `http://localhost:3000`.
- **What changed:** tests now use `PLAYWRIGHT_BASE_URL` with fallback `http://127.0.0.1:5173`.
- **Impact:** better alignment with Vite defaults and CI-configurable base URL.

## E) E2E screenshots moved to ephemeral test output artifacts

- **Previously identified issue:** screenshots written into tracked `screenshots/*.png` paths.
- **What changed:** screenshots now use `testInfo.outputPath(...)`; previously committed screenshot binaries removed from tracked paths and `apps/web-next/screenshots/` ignored.
- **Impact:** less repository churn/noise and cleaner review diffs.
