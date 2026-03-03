# Edge Cases (Tracked, Not Solved Yet)

This document is a long-term inventory of edge cases that must be handled eventually, but are not required to “solve now” in the Agent Configuration MVP. The goal is to avoid losing these requirements as we iterate.

**Canonical keys/terms:** `apps/web/ux-opus-design/00-CANONICAL-CONFIG-AND-TERMS.md`

## 1) Config Semantics + Override Rules

- **Inherit vs override representation**
  - How the system encodes “use system default” (missing key vs `null` vs sentinel).
  - Reset behavior: per-field reset and reset-all-overrides.
- **System defaults change after agent overrides**
  - If system default changes, the agent should update only where it still inherits.
- **Partial updates**
  - PATCH failures should not leave UI in an impossible “saved but not saved” state.
- **Schema migration**
  - Old configs must migrate forward without breaking the UI.
- **Validation vs editing**
  - What happens when a user enters a value that the backend rejects (e.g., invalid JSON, invalid enum, out-of-range number).

## 2) Concurrency + Multiple Surfaces

- **Two tabs editing the same agent**
  - Conflict resolution (last write wins, merge, warnings).
- **Web UI and CLI editing the same config**
  - Refresh strategy, “stale data” warnings, and recovery.
- **Live gateway vs mocked gateway**
  - When “live gateway” is enabled and the connection drops mid-edit.

## 3) Provider + Model Selection

- **Provider configured but models list fails**
  - Empty states and fallback UX.
- **Model ref points to a provider/model that is no longer available**
  - Display + remediation (“choose a new model”).
- **Fallback chain invalid**
  - Fallback list contains duplicates, unknown refs, or forbidden providers.
- **Provider auth rotation**
  - Re-test flows, “last tested” stamps, and invalidation.

## 4) Capability Gating (Provider/Model/Runtime)

We must support many power-user knobs, but only show them when supported.

- **Unsupported knob shown**
  - Must show as disabled with explanation, or hide entirely (consistent rule needed).
- **Runtime-specific behavior**
  - Some settings apply only to `pi` or only to `claude`.
- **Provider API differences**
  - Internal config uses canonical keys; provider adapters map to API-specific fields.

## 5) Secrets + Sensitive Data Handling

- **API keys**
  - Masking, reveal affordances, copy-to-clipboard warnings, never render full keys by default.
- **Audit events**
  - Capture events for secret updates at minimum.
  - Decide whether to log secret reveal/copy events (security posture dependent).
- **Auditability**
  - Track “who changed what” where possible; at minimum, log change intents.
- **Clipboard leakage**
  - Avoid copying secrets by default; require explicit “copy secret” action.

## 6) Tools + Toolsets

- **Toolset deletion while in use**
  - Prevent, warn, or allow with migration choice.
- **Built-in toolsets**
  - Ensure they are immutable; if cloned, new ID and provenance.
- **Toolset vs per-agent custom**
  - When switching from toolset → custom, define what the initial custom state is.
- **Allow/deny and elevated mode interactions**
  - How the UI explains precedence and risk.

## 7) Expert Mode / Power User Mode

- **Toggling expert mode mid-edit**
  - Ensure values don’t reset and expanded/collapsed state remains sensible.
- **Discoverability**
  - How users learn Expert Mode exists without forcing it.

## 8) Accessibility (a11y)

- **Keyboard navigation**
  - Tabs, accordions, sliders, and dialogs must be reachable and operable.
- **Color independence**
  - Status must be communicated via text/icons, not just color.
- **Focus management**
  - After save errors, focus should land on the failing control.
- **ARIA labeling**
  - Helper text association, error announcements, and tooltip semantics.

## 9) Observability + Supportability

- **Debug export**
  - “Copy diagnostics” should include relevant non-secret config snapshots and recent errors.
- **Reproducibility**
  - Include config paths and ids in error reports for power users.

## 10) Explicit Error States (Config UX)

- **Save failed**
  - Retry/undo/copy, and a clear statement of whether changes are still applied locally.
- **Test failed** (provider auth/connection)
  - Safe error message, last tested stamp, suggested next steps.
- **Models list fetch failed**
  - Distinguish “no models available” from “cannot load models” with recovery actions.

## 11) Quiet Hours (Policy vs Notifications)

Quiet hours has two related but distinct concerns:

1) **User-facing agent emission policy** (planned)
   - Default: respond only when mentioned (direct chats still respond).
   - Must not interrupt System Brain/background work.
   - Needs clear semantics for "queue vs skip" during quiet hours.

2) **Notification/event delivery suppression** (future)
   - Even if background work continues, the system may normally emit UI/email/push notifications.
   - A future "quiet notifications" layer could buffer/digest/suppress delivery until quiet hours end.
   - Requires decisions about which event types are suppressible (vs critical alerts).
