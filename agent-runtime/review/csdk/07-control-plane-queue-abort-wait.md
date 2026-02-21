# Control Plane Mapping: Queue, Abort, Wait

## Objective

Reuse existing control plane APIs unchanged while backing CSDK runs with equivalent mechanics.

Current API source:
- `src/agents/pi-embedded-runner/runs.ts`

## Existing behavior to preserve

- queue returns false if no active run.
- queue returns false if not streaming.
- queue returns false if compacting.
- abort returns false if no active run.
- wait resolves true when inactive, false on timeout.
- active run handle is registered and cleared in attempt lifecycle.

## CSDK mapping model

### queue

- Implement a run-local async queue feeding SDK streaming input iterator.
- `queueMessage(text)` pushes user message envelope into iterator.
- backpressure strategy: bounded queue with overflow safety log (do not drop silently).

### abort

- map to SDK interrupt on active query object.
- keep `runAbortController` behavior and session abort best-effort.

### wait

- waiters remain in existing global map in `runs.ts`.
- ensure `clearActiveEmbeddedRun(...)` runs in `finally` for all terminal paths.

## Handle shape parity

Continue to register a handle implementing:
- `queueMessage(text): Promise<void>`
- `isStreaming(): boolean`
- `isCompacting(): boolean`
- `abort(): void`

## Include

- one CSDK run handle object wired into existing `setActiveEmbeddedRun`.
- terminalization guard so `clearActiveEmbeddedRun` runs exactly once.

## Avoid

- a new control plane map specific to CSDK.
- queue writes after terminal result without explicit error handling.
- interrupt without state update, which can leave `isStreaming` stale.
