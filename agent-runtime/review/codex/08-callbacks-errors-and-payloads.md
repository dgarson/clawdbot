# Mid-Level Document: Callback Path (Error Handling and Payload Shaping)

## Scope

This document tracks how raw provider outputs and failures are turned into user-visible payloads.

## File boundaries

- `src/agents/pi-embedded-runner/run/payloads.ts`
- `src/agents/pi-embedded-subscribe.handlers.tools.ts`
- `src/agents/pi-embedded-subscribe.handlers.messages.ts`
- `src/agents/pi-embedded-runner/run/attempt.ts`

## Error shaping path

- Tool errors and execution exceptions are converted into payload-level results.
- Error verbosity is policy-driven and may depend on session verbosity settings.
- Duplicate payload suppression avoids repeated error floods.
- Certain mutating tool actions may be intentionally suppressed from user-facing text.

## Non-error payload shaping

- Tool output is formatted into one or more payload blocks to keep streaming compatibility.
- Messaging-tool outcomes can produce dedicated metadata fields and message text.
- Compaction or retry retries can append follow-up payload content without dropping prior messages.

## Failure paths

- Transport disconnect and timeout errors are propagated while still allowing cleanup and control-plane clear/reset.
- Error callbacks should still route through stream/lifecycle handlers so upstream callers can render diagnostics.

## Suggested `csdk` adapter pattern

- Maintain payload shaping semantics independently of transport.
- Preserve error redaction and verbosity behavior to avoid accidental policy drift.
- Reuse existing payload formatter modules where possible; isolate transport mapping at the subscription adapter boundary.
