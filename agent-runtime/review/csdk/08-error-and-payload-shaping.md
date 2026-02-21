# Error and Payload Shaping for CSDK Parity

## Goal

Preserve existing payload shaping, verbosity policy, and error classification across runtime implementations.

Baseline references:
- `agent-runtime/review/codex/08-callbacks-errors-and-payloads.md`
- `src/agents/pi-embedded-runner/run.ts`
- `src/agents/pi-embedded-runner/run/payloads.ts`

## Terminal result mapping

CSDK terminal result must map into existing attempt result fields:
- `promptError`
- `lastAssistant`
- `assistantTexts`
- `toolMetas`
- usage totals
- messaging telemetry

Map SDK stop reasons to existing behavior classes:
- normal end turn
- tool use required
- refusal/safety stop
- max turns / execution limit
- runtime execution errors

## User-facing error parity

Retain current shaped responses for:
- context overflow
- compaction failure
- role ordering conflicts
- image size/dimension issues
- timeout with empty payload
- failover/auth/rate limit classed failures

## Payload policy parity

Reuse existing payload builder:
- do not add runtime-specific formatting branch unless required.
- preserve suppression rules for mutating tool error warnings.
- preserve reasoning formatting behavior.

## Include

- adapter extraction utilities that normalize SDK error payloads to current format.
- stop reason translation table with tests.
- fallback to generic `describeUnknownError` path when classification is uncertain.

## Avoid

- leaking raw SDK internal error objects to user payloads.
- bypassing existing formatter (`formatAssistantErrorText`) for lifecycle errors.
- changing semantics of `payloads: undefined` vs `payloads: []`.
