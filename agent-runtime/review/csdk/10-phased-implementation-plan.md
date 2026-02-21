# Phased Implementation Plan

## Milestone 0: Preparation and guardrails

Deliverables:
- runtime feature gate strategy (default Pi)
- trace format for callback ordering in test mode
- no-op scaffolding files for CSDK adapter and attempt

Key checks:
- zero behavior change on Pi path

## Milestone 1: Dispatch and attempt shell

Changes:
- `src/agents/pi-embedded-runner/run.ts`
  - add runtime branch at attempt call site
- `src/agents/pi-embedded-runner/run/attempt-csdk.ts` (new)
  - implement attempt lifecycle shell with active run registration/cleanup

Deliverables:
- CSDK attempt returns shape-compatible `EmbeddedRunAttemptResult`
- no stream parity yet, but controlled terminal flow works

## Milestone 2: Streaming event normalization

Changes:
- `src/agents/csdk-adapter.ts` (new)
  - map SDK stream messages to normalized Pi-like events
- optional split file for mapping tables/state machine

Deliverables:
- adapter emits deterministic event sequence
- existing subscribe handlers can process normalized events

## Milestone 3: Tool and approval parity

Changes:
- complete tool event mapping and correlation ids
- bridge SDK permission model with existing OpenClaw tool policy semantics

Deliverables:
- tool summary/output parity
- after_tool_call parity
- messaging telemetry parity

## Milestone 4: Compaction and error parity

Changes:
- map compact boundary signals
- preserve compaction retry wait semantics
- normalize SDK terminal errors/stop reasons into existing payload shaping

Deliverables:
- compaction callback parity
- error shaping parity
- timeout during compaction parity

## Milestone 5: Rollout and fallback hardening

Changes:
- fallback policy for pre-stream CSDK initialization failures
- observability and diagnostics for runtime selection and fallback

Deliverables:
- controlled canary rollout
- documented rollback switch

## File change ranking by impact

1. High: `src/agents/pi-embedded-runner/run.ts`
2. High: `src/agents/pi-embedded-runner/run/attempt-csdk.ts` (new)
3. High: `src/agents/csdk-adapter.ts` (new)
4. Medium: `src/agents/pi-embedded-runner/run/attempt.ts` (only shared helper extraction if needed)
5. Low optional: `src/agents/pi-embedded-runner/run/params.ts` (optional runtime selector)

## Include

- keep each milestone mergeable with Pi default unchanged.
- keep runtime fallback and rollback simple and explicit.

## Avoid

- combining all milestones into one large PR.
- changing hooks/types early before proving necessity.
- introducing runtime-specific branching inside many existing handlers.
