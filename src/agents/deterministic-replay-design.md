# Deterministic Replay Architecture and TDD Plan

## Purpose

Design and implement deterministic replay for OpenClaw agent runs with **high fidelity**, **low operational risk**, and **incremental adoption**.

This plan intentionally reuses existing runtime seams so we can ship value quickly:

- event bus and sequencing in `src/infra/agent-events.ts`
- orchestration in `src/agents/pi-embedded-runner/run.ts`
- attempt execution in `src/agents/pi-embedded-runner/run/attempt.ts`
- reasoning fidelity precedent in `src/agents/openai-responses.reasoning-replay.test.ts`
- nondeterministic boundaries in:
  - `src/agents/bash-tools.exec-runtime.ts`
  - `src/agents/tools/web-fetch.ts`
  - `src/agents/tools/web-search.ts`

---

## Non-goals (phase 1)

- Perfect reproduction of wall-clock timing, microtask ordering, or host scheduler behavior.
- Full-system snapshotting beyond replay-critical boundaries.
- Provider-specific semantic equivalence across model/version changes (replay uses captured responses, not live model reruns).

---

## Success criteria

Phase 1 is complete when all are true:

1. We can run a real agent turn in `capture` mode and produce a replay artifact (`manifest.json` + `events.jsonl`).
2. We can replay the same run in `replay` mode without external provider calls and with equivalent final assistant output.
3. Divergences are surfaced with actionable diagnostics (expected vs observed event + path-level mismatch).
4. Existing behavior is unchanged when replay is disabled.

---

## Architecture overview

The architecture is intentionally small:

1. `CaptureEvent` (canonical envelope)
2. `CaptureSink` (append-only persistence)
3. `CaptureContext` (runtime API used by orchestrator/adapters)
4. `ReplaySource` (indexed reader + cursor)
5. `ReplayEngine` (matcher + stubbing + divergence diagnostics)

```text
runEmbeddedPiAgent
  -> run/attempt
    -> CaptureContext.recordEvent(...)
    -> CaptureSink.append(...)

replay mode:
runEmbeddedPiAgent
  -> ReplaySource + ReplayEngine
    -> attempt hooks ask ReplayEngine for next LLM/tool/nondeterministic value
    -> divergence emitted if mismatch
```

---

## Existing scaffolding leverage

## 1) Event bus (`src/infra/agent-events.ts`)

What we get today:

- per-run monotonic sequence (`seq`)
- timestamp (`ts`)
- stream channelization (`lifecycle`, `tool`, `assistant`, `error`, + custom)
- run context (`sessionKey`, verbose level, heartbeat)

How we use it:

- Start with an event-first capture subscriber that maps existing events into capture events.
- Avoid invasive edits in first milestone.

## 2) Runner orchestrator (`run.ts`)

How we use it:

- inject replay configuration once (`off`/`capture`/`replay`, strict/lenient)
- initialize and teardown capture lifecycle
- provide context to attempt execution

## 3) Attempt execution (`run/attempt.ts`)

How we use it:

- place LLM/tool instrumentation at a single coordination layer
- keep provider/tool modules mostly untouched until necessary

## 4) Reasoning replay precedent (`openai-responses.reasoning-replay.test.ts`)

How we use it:

- enforce reasoning/function-call ID preservation in replay contract
- ensure deterministic replay validates structured message semantics, not just final text

---

## Data model

## Capture event envelope

```ts
export type CaptureEventType =
  | "run_start"
  | "run_end"
  | "llm_request"
  | "llm_response"
  | "tool_call"
  | "tool_result"
  | "state_mutation"
  | "nondeterministic";

export type CaptureEvent = {
  version: 1;
  captureId: string;
  runId: string;
  seq: number;
  ts: number;
  type: CaptureEventType;
  data: Record<string, unknown>;
};
```

### Event payload requirements

Minimum fields by type:

- `llm_request`: provider, model, normalized input hash, tool schema hash (if tools present)
- `llm_response`: provider, model, stopReason, usage, response payload (or chunk refs)
- `tool_call`: tool name, normalized args, call id
- `tool_result`: call id, success/error, normalized result payload
- `nondeterministic`: source (`clock`/`rng`/`network`/`process`), key, value hash + optional inline value
- `state_mutation`: type (`file_write`/`env_read`/`cwd_change`/etc.), normalized details

## Capture manifest

```ts
export type CaptureManifest = {
  version: 1;
  captureId: string;
  runId: string;
  createdAt: number;
  completedAt?: number;
  mode: "capture" | "replay";
  model: { provider: string; model: string };
  eventCount: number;
  eventLogPath: string;
  redaction: {
    enabled: boolean;
    profile: "none" | "default" | "strict";
  };
  integrity: {
    algorithm: "sha256";
    eventsHash: string;
  };
  status: "ok" | "error";
  error?: string;
};
```

## Divergence report

```ts
export type ReplayDivergence = {
  code:
    | "event_type_mismatch"
    | "event_payload_mismatch"
    | "event_missing"
    | "event_unexpected"
    | "nondeterministic_underflow";
  expected?: CaptureEvent;
  observed?: { type: string; data: Record<string, unknown> };
  eventSeq?: number;
  jsonPath?: string;
  detail: string;
};
```

---

## Component contracts

## CaptureSink

```ts
export interface CaptureSink {
  start(seed: Omit<CaptureManifest, "eventCount" | "integrity" | "status">): Promise<void>;
  append(event: CaptureEvent): Promise<void>;
  finalize(params: { status: "ok" | "error"; error?: string }): Promise<CaptureManifest>;
}
```

Initial implementation: `FileCaptureSink`

- writes `events.jsonl` line-by-line
- writes `manifest.json` at finalize with event count + hash
- supports atomic finalize via temp file + rename

## ReplaySource

```ts
export interface ReplaySource {
  manifest(): CaptureManifest;
  next(expectedType: CaptureEventType): CaptureEvent | undefined;
  peek(): CaptureEvent | undefined;
  remaining(): number;
}
```

Behavior rules:

- strict cursor order by `seq`
- no implicit skipping of unmatched types in strict mode
- explicit “remaining events” surfaced for diagnostics

## ReplayEngine

```ts
export interface ReplayEngine {
  replayLlmRequest(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  replayToolCall(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  replayNondeterministic(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  divergences(): ReplayDivergence[];
}
```

Behavior rules:

- strict mode: throw on first divergence
- lenient mode: append divergence and continue
- all comparisons normalize object key order before hashing/comparison

## CaptureContext

```ts
export type CaptureMode = "off" | "capture" | "replay";

export interface CaptureContext {
  mode: CaptureMode;
  recordEvent(type: CaptureEventType, data: Record<string, unknown>): Promise<void>;
  nextNondeterministic(source: string, key: string): Promise<Record<string, unknown>>;
  recordNondeterministic(
    source: string,
    key: string,
    value: Record<string, unknown>,
  ): Promise<void>;
}
```

---

## Event mapping from existing streams

Event-first mapping table (initial bridge):

| `agent-events` stream | Capture event                              | Notes                                                               |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------------- |
| lifecycle             | `run_start` / `run_end`                    | derive start/end from lifecycle markers                             |
| assistant             | `llm_response` (partial)                   | phase 1 may supplement with direct instrumentation for full payload |
| tool                  | `tool_call` / `tool_result`                | split by tool event subtype                                         |
| error                 | `run_end` (error) or divergence diagnostic | include error class and message                                     |
| custom stream         | `state_mutation` / `nondeterministic`      | mapped by stream-specific adapters                                  |

This lets us capture quickly while preserving a path to fidelity improvements.

---

## Integration points and code-change plan

## Phase 1: capture-only foundation

1. Add replay package skeleton:
   - `src/agents/replay/types.ts`
   - `src/agents/replay/sink.file.ts`
   - `src/agents/replay/context.ts`
   - `src/agents/replay/source.ts`
   - `src/agents/replay/engine.ts` (stub in phase 1)
2. Wire `run.ts` to create `CaptureContext` based on config/params.
3. Subscribe to `onAgentEvent` and map to `CaptureEvent`.
4. Add targeted direct instrumentation in attempt seam for missing LLM/tool fidelity data.
5. Finalize manifest at run completion/error.

## Phase 2: replay mode

1. Enable `mode=replay` in runner params.
2. In `run/attempt.ts`, route LLM/tool operations through `ReplayEngine` when replaying.
3. Block live provider/network/tool execution by default in replay mode.
4. Emit divergences through existing event stream and structured return metadata.

## Phase 3: deterministic boundary hardening

1. Add `clock.now()` and `rng.random()` wrappers for replay-critical paths.
2. Add adapters for:
   - `bash-tools.exec-runtime.ts`
   - `web-fetch.ts`
   - `web-search.ts`
3. Add content-addressed payload storage for large responses.
4. Tune redaction and payload retention profile.

---

## Configuration and API surface

Proposed run params additions (names may be refined during implementation):

```ts
type ReplayConfig = {
  mode?: "off" | "capture" | "replay";
  policy?: "strict" | "lenient";
  captureDir?: string;
  replayManifestPath?: string;
  allowPassthroughTools?: boolean;
};
```

Defaults:

- `mode=off`
- `policy=strict` for CI replay, `lenient` for developer diagnostics
- `allowPassthroughTools=false`

---

## Redaction and data retention policy

### Redaction rules (default profile)

- redact environment-like keys: `*_API_KEY`, `*_TOKEN`, `AUTHORIZATION`
- redact HTTP auth headers
- preserve structural placeholders for diff stability (e.g., `"***REDACTED***"`)

### Payload retention

- inline small payloads
- hash + blob reference large payloads (`sha256:<digest>`)
- preserve hashes in event payload so diffs remain deterministic

### Safety invariant

Raw sensitive values must never be written to disk after redaction is enabled.

---

## Failure modes and fallback behavior

1. **Capture sink I/O failure**
   - continue run (best-effort mode), emit warning event, mark manifest status error if possible
2. **Replay artifact missing/corrupt**
   - hard fail replay startup with explicit diagnostics
3. **Divergence in strict mode**
   - fail immediately with machine-readable divergence payload
4. **Divergence in lenient mode**
   - continue replay and aggregate divergences in result metadata

---

## TDD plan (test-first execution order)

The following order keeps blast radius low and gives rapid confidence at each seam.

## A) Schema and sink tests

1. `src/agents/replay/types.test.ts`
   - validates event/manifest versioning behavior
   - validates event-type discriminants
2. `src/agents/replay/sink.file.test.ts`
   - appends events in order
   - finalizes manifest with deterministic event count/hash
   - verifies atomic finalize semantics
   - verifies redaction applied before persistence

## B) Replay cursor and engine tests

3. `src/agents/replay/source.test.ts`
   - cursor order and EOF behavior
   - strict mismatch behavior
4. `src/agents/replay/engine.test.ts`
   - returns stubbed llm/tool/nondeterministic values
   - strict vs lenient divergence behavior

## C) Runner integration tests

5. `src/agents/pi-embedded-runner/run.capture.e2e.test.ts`
   - capture artifact generated
   - expected llm/tool lifecycle events present
6. `src/agents/pi-embedded-runner/run.replay.e2e.test.ts`
   - replay final output matches captured run
   - confirms no live provider/network execution

## D) Fidelity and adapters

7. Extend `src/agents/openai-responses.reasoning-replay.test.ts`
   - verify reasoning/function-call identity preserved through replay
8. `src/agents/bash-tools.exec-runtime.replay.test.ts`
9. `src/agents/tools/web-fetch.replay.test.ts`
10. `src/agents/tools/web-search.replay.test.ts`

## E) Compatibility tests

11. `src/agents/replay/compatibility.test.ts`

- compatible older manifest versions accepted
- incompatible major versions rejected with migration hint

---

## Given/When/Then acceptance tests (human-readable)

### Scenario 1: capture baseline

- Given a run with one model response and one tool call
- When replay mode is `capture`
- Then `manifest.json` and `events.jsonl` exist and include ordered `llm_request`, `llm_response`, `tool_call`, `tool_result`

### Scenario 2: replay offline

- Given a valid capture artifact
- When replay mode is `replay`
- Then final assistant output matches capture and no outbound provider/network/tool execution occurs

### Scenario 3: strict divergence

- Given a replay where tool args differ from captured args
- When policy is `strict`
- Then replay fails with `event_payload_mismatch` and includes json path mismatch details

### Scenario 4: lenient divergence

- Given the same mismatch
- When policy is `lenient`
- Then replay completes and aggregates divergence diagnostics in result metadata

---

## Milestones and delivery plan

## Milestone M1 (capture-only)

- deliver replay package skeleton
- emit capture artifacts from real runs
- add tests A1-A4 + C5

## Milestone M2 (replay core)

- enable replay for baseline non-streaming scenarios
- add strict/lenient divergence policy
- add tests C6 + acceptance scenarios 2-4

## Milestone M3 (hardening)

- add nondeterministic adapters for clock/rng/process/network
- add compatibility + adapter tests
- tune redaction and payload blob handling

---

## Complexity controls (to avoid over-engineering)

1. Reuse event bus first; do not build a parallel instrumentation framework.
2. Start with JSONL + manifest; defer DB/indexing until a proven need.
3. Instrument only replay-critical seams in phase 1; expand based on divergence telemetry.
4. Keep replay API minimal and typed; avoid speculative abstraction layers.

---

## Open questions to resolve before implementation starts

1. Should context compaction decisions be replayed exactly or bypassed in replay mode?
2. What is the payload size threshold for blob indirection?
3. Which redaction profile should be default in CI vs local developer runs?
4. Should replay diagnostics flow only via result metadata or also through `agent-events` stream?

---

## Definition of done (implementation)

- deterministic replay architecture merged and documented
- M1 and M2 tests green in CI
- replay artifacts are stable across repeated runs of the same fixture
- divergence diagnostics are understandable without deep code inspection
- no behavioral regression when replay feature is disabled
