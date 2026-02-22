# Spike: ACP P0-05 Heartbeat/Wake Trigger Feasibility

**Date:** 2026-02-22
**Investigator:** tony
**Status:** Complete

---

## Question
Can ACP trigger heartbeat delivery for urgent items via an existing Gateway wake path, and what are the safe rate guardrails + trigger conditions?

---

## Findings (Feasibility)

### 1) Existing API path is available and runnable today
- Gateway exposes a top-level `wake` RPC method (`method-scopes.ts` puts it in `operator.write`).
- Parameters are validated by `WakeParamsSchema`:
  - `mode: "now" | "next-heartbeat"`
  - `text: NonEmptyString`
  - no session/agent targeting fields are exposed at API level.
- CLI implementation confirms this is the public control surface for on-demand wake:
  - `openclaw system event --mode now --text ...` -> calls `wake`.
- `wake` handler (`src/gateway/server-methods/cron.ts`) path:
  - `mode: "now"` calls `enqueueSystemEvent(text, { sessionKey: resolveMainSessionKeyFromConfig() })`
  - then `requestHeartbeatNow({ reason: "wake" })`
- Result: one ACP-triggered wake now can force an immediate scheduler pass.

### 2) What this means for ACP
- **Yes, feasible** to implement urgent wake without new infra by calling `wake` (write scope).
- **No direct targeting from current API**: ACP cannot pass `{sessionKey, agentId}` in `wake`.
- `wake` reason is generic (`"wake"`), so it does not get the same explicit action priority as `manual`/`hook`/`exec-event`.
- `wake` currently enqueues a system event to the main session, but system-event inspection in heartbeat flow is only automatic for `exec`/`cron`/`hook`-scoped reasons; it behaves as an urgent poke, not a guaranteed per-event payload carrier.

### 3) Operational constraints (non-negotiable)
- If heartbeats are disabled, or active-hour checks fail, wake returns skip.
- If main execution lane is busy (`requests-in-flight`), the wake attempt is skipped and may not yet deliver in that cycle.
- `quiet-hours` and notification visibility still apply to delivery.

---

## Rate Guardrails (what already exists)

Existing guardrails in `src/infra/heartbeat-wake.ts` + `src/infra/heartbeat-runner.ts`:

1. **Coalescing (built-in):**
   - default coalesce window: **250ms**.
   - same wake target key is deduped to one pending request.
   - wake reason priority uses `retry < interval < default/action`; `wake` uses default-level reason.
2. **Retry on contention:**
   - heartbeat call path can return `requests-in-flight`.
   - wake scheduler retries with **1s backoff** when this occurs.
3. **Duplicate suppression at heartbeat output level:**
   - repeated identical heartbeat payloads within ~24h are suppressed as duplicate sends.
4. **No hard per-second/minute quota in wake path itself:**
   - burst control is limited to coalescing + queue behavior + runner contention checks.
5. **Scope limit:**
   - `wake` is write-scoped, no admin-level elevation needed, unlike `system-event`.

---

## Delivery Trigger Recommendation

### Recommended production pattern (P0 posture)
- Use `wake` with `mode: "now"` **only for urgent ACP items**.
- For normal/non-urgent backlog, use `mode: "next-heartbeat"` (or no immediate trigger).
- Add an ACP-side guard before calling wake:
  - de-dupe by `(thread/session/item)` in a short window,
  - limit repeated urgent triggers (example: max **1 wake / 30s** per thread, configurable),
  - no trigger if heartbeat infrastructure is globally down or user session not enabled.

### Suggested decision rule for P0-05
- **Trigger now** when: ACP receives new urgent/critical item and user has heartbeat enabled.
- **Do not trigger now** when: existing same-session urgent wake already queued in the last short interval.
- **Fallback if wake fails or is skipped for long-tail reasons**: channel notification path already defined by canonical spec (urgent path fallback).

---

## Caveats / blockers to call out

1. `wake` currently cannot target specific `{agentId, sessionKey}`; this is broad and may over-trigger in multi-agent setups.
2. Urgent priority reason classification is not exposed on this API surface (`wake` is not `manual`/`hook` priority).
3. System-event text from `wake` is not guaranteed to be surfaced in heartbeat reasoning path (current `isWakeReason` handling does not set pending-event inspection).

If the canonical plan needs strict per-session routing or richer wake metadata, the clean route is a small gateway method extension for ACP (explicit fields: reason/target/session + stricter auth checks).

---

## References

- `src/gateway/method-scopes.ts`
- `src/gateway/protocol/schema/agent.ts` (`WakeParamsSchema`)
- `src/cli/system-cli.ts`
- `src/gateway/server-methods/cron.ts`
- `src/cron/service/timer.ts`
- `src/infra/heartbeat-wake.ts`
- `src/infra/heartbeat-runner.ts`
- `src/gateway/server/hooks.ts` (for comparison path using `requestHeartbeatNow`)
