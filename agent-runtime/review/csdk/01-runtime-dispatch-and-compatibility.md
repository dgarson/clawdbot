# Runtime Dispatch and Compatibility Strategy

## Existing stable caller contract

Current callers import Pi-named functions from:
- `src/agents/pi-embedded.ts`
- `src/agents/pi-embedded-runner.ts`

Do not change these call sites for POC.

## Single dispatch branch

Add runtime selection only at attempt execution boundary in:
- `src/agents/pi-embedded-runner/run.ts`

Current seam:
- The loop calls `runEmbeddedAttempt(...)`.

Target seam:
- Resolve runtime once per run.
- Call one of:
  - `runEmbeddedAttempt(...)` for Pi
  - `runEmbeddedAttemptCsdk(...)` for CSDK

## Runtime selection policy

Recommended order:
1. Explicit per-run runtime override (if added as optional param).
2. Config default (if supported in current config model).
3. Implicit default: `pi`.

If runtime selector is not added in public params, use internal config/env gate for POC and keep params untouched.

## Compatibility invariants

`runEmbeddedPiAgent` must continue to:
- return `EmbeddedPiRunResult`
- preserve retry/fallback loop
- preserve compaction fallback path
- preserve hook invocation order
- preserve result metadata fields, including messaging telemetry

## Import churn minimization

- Keep new imports local to `run.ts` and new adapter files.
- Keep SDK package imports inside new `csdk` files (lazy import where useful).
- Avoid adding `csdk` imports across existing handler files.

## Include

- Optional runtime discriminator in internal attempt params.
- One new attempt implementation file for `csdk`.
- One adapter file for stream/event normalization.

## Avoid

- New top-level runtime facade exports for POC.
- Branching in many call sites.
- Duplication of orchestration logic from `run.ts`.

## Proposed file touch ranking

High impact:
- `src/agents/pi-embedded-runner/run.ts`

Medium impact:
- `src/agents/pi-embedded-runner/run/attempt-csdk.ts` (new)
- `src/agents/csdk-adapter.ts` (new)

Low impact (optional only):
- `src/agents/pi-embedded-runner/run/params.ts`
- `src/agents/pi-embedded-runner/run/types.ts`
