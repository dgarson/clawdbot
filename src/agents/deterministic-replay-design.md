# Deterministic Replay: Architecture + TDD Plan

## Goal

Build a deterministic replay system for OpenClaw agent runs that can:

1. Capture the minimum complete execution trace needed to replay behavior.
2. Re-run the same run offline (or in CI) without external provider/tool dependencies.
3. Detect and explain divergences with actionable diagnostics.
4. Reuse existing eventing/runtime seams to keep implementation small and low-risk.

---

## Existing scaffolding to reuse (high leverage)

### 1) Global event bus and run metadata (`src/infra/agent-events.ts`)

Current capabilities already provide most of the event substrate:

- Per-run monotonic sequence (`seq`) and wall-clock timestamp (`ts`).
- Stream names (`lifecycle`, `tool`, `assistant`, `error`, custom string streams).
- Per-run context registration (`sessionKey`, verbosity, heartbeat flag).
- Fan-out listener model (`onAgentEvent`) that we can subscribe to for capture sinks.

**Why this matters**: we can avoid invasive instrumentation by routing capture through existing events first, then adding precise hooks only where needed.

### 2) Main execution orchestration (`src/agents/pi-embedded-runner/run.ts`)

`runEmbeddedPiAgent` is the stable orchestration seam where we can inject:

- Capture/replay mode selection.
- Capture manifest lifecycle (start/end/final status).
- Context wiring into attempt-level execution.

**Why this matters**: one integration point for replay mode avoids scattering feature flags across all tools/providers.

### 3) Attempt-level execution seam (`src/agents/pi-embedded-runner/run/attempt.ts`)

Attempt execution is where model calls, tool interactions, and retries/looping are coordinated.

**Why this matters**: this seam is ideal for canonical `llm_request`/`llm_response` and `tool_call`/`tool_result` instrumentation with run-scope ordering.

### 4) Reasoning replay precedent (`src/agents/openai-responses.reasoning-replay.test.ts`)

OpenAI Responses test coverage already validates that reasoning/tool-call structures must be preserved and replayed in strict order.

**Why this matters**: deterministic replay must preserve structured model output (e.g., reasoning/function-call IDs), not only plain assistant text.

### 5) Existing nondeterministic boundaries

Useful seams already exist where nondeterminism enters:

- `Date.now()` / `Math.random()` calls in agent runtime code.
- Process execution path in `src/agents/bash-tools.exec-runtime.ts`.
- Network tools in `src/agents/tools/web-fetch.ts` and `src/agents/tools/web-search.ts`.

**Why this matters**: we can begin by capturing boundary outputs and only later replace internals with fully deterministic adapters.

---

## Proposed architecture

## Overview

Introduce five minimal core components:

1. **CaptureEvent**: canonical, versioned event envelope.
2. **CaptureSink**: append-only writer abstraction.
3. **CaptureContext**: runtime adapter for nondeterministic reads/writes.
4. **ReplaySource**: indexed event reader for deterministic playback.
5. **ReplayEngine**: orchestrates stubbing, matching, and divergence reporting.

Keep implementation incremental: event-first capture, then deeper deterministic adapters only where divergence indicates necessity.

---

## Component design

### A) CaptureEvent taxonomy

Use a versioned envelope to support forward compatibility:

```ts
export type CaptureEvent = {
  version: 1;
  runId: string;
  seq: number; // capture-order monotonic per run
  ts: number; // captured wall clock
  type:
    | "run_start"
    | "run_end"
    | "llm_request"
    | "llm_response"
    | "tool_call"
    | "tool_result"
    | "state_mutation"
    | "nondeterministic";
  data: Record<string, unknown>;
};
```

Notes:

- Keep `seq` independent from runtime stream internals if needed, but seed from existing `agent-events` sequence where possible.
- Include `version` at event level (not only manifest) to permit mixed replay migration tooling.

### B) Capture manifest

```ts
export type CaptureManifest = {
  version: 1;
  captureId: string;
  runId: string;
  createdAt: number;
  model: { provider: string; model: string };
  mode: "capture" | "replay";
  eventCount: number;
  eventLogPath: string;
  integrity: {
    sha256: string;
  };
  redaction: {
    enabled: boolean;
    profile: "none" | "default" | "strict";
  };
};
```

### C) CaptureSink interface

```ts
export interface CaptureSink {
  start(manifestSeed: Omit<CaptureManifest, "eventCount" | "integrity">): Promise<void>;
  append(event: CaptureEvent): Promise<void>;
  finalize(params: { status: "ok" | "error"; error?: string }): Promise<CaptureManifest>;
}
```

Initial implementation: JSONL append-only file sink.

- `events.jsonl` (one event per line)
- `manifest.json` (finalized metadata + hash)

### D) CaptureContext (runtime injection)

```ts
export interface CaptureContext {
  mode: "off" | "capture" | "replay";

  // Generic record/read API for nondeterministic values
  recordNondeterministic(key: string, payload: Record<string, unknown>): Promise<void>;
  nextNondeterministic(key: string): Promise<Record<string, unknown>>;

  // Event helpers
  recordEvent(type: CaptureEvent["type"], data: Record<string, unknown>): Promise<void>;
}
```

Keep API tiny; avoid early over-modeling.

### E) ReplaySource + ReplayEngine

ReplaySource responsibilities:

- Load manifest + events.
- Build indexes by type and seq.
- Provide strict next-event cursor semantics.

ReplayEngine responsibilities:

- For each runtime action, consume matching captured event.
- Return stubbed responses (LLM/tool/nondeterministic values).
- Emit divergence diagnostics when observed input differs.

Divergence should include:

- expected event type/shape
- observed event shape
- nearest prior matching seq
- field-level mismatch summary

---

## Instrumentation strategy (minimal complexity path)

## Phase 1: event-first capture

1. Subscribe once to `onAgentEvent` and map existing streams to `CaptureEvent` where possible.
2. Add targeted direct instrumentation only for missing fidelity-critical fields:
   - raw model request payload hash + normalized request body
   - full model response chunks/assembled object
   - tool args/result payloads
3. Persist as JSONL via `FileCaptureSink`.

This gives immediate value with low code churn.

## Phase 2: deterministic replay mode

1. Add `capture.mode` parameter to `runEmbeddedPiAgent`/attempt params.
2. When mode=`replay`:
   - bypass provider network calls
   - bypass real tool execution (unless explicitly `passthrough`)
   - serve recorded nondeterministic values
3. Add strict/lenient replay policies:
   - **strict**: fail on first mismatch
   - **lenient**: continue but emit structured divergence report

## Phase 3: deeper nondeterminism sealing

Add wrappers/adapters for high-variance sources:

- `clock.now()` wrapper replacing direct `Date.now()` in replay-critical paths.
- `rng.random()` wrapper for `Math.random()` usage.
- process and network adapters (bash/web-fetch/web-search).

Only migrate call sites proven to cause divergence to keep complexity bounded.

---

## Data minimization and redaction

Capture can accidentally store secrets/tool outputs with sensitive data.

Baseline policy:

1. Redact known secret env keys (`*_API_KEY`, tokens, auth headers) before sink append.
2. Store large binary/network payloads as content-addressed blobs by hash; keep event references.
3. Provide `redaction.profile` levels in manifest.

Avoid mutating source event semantics; redact copies at sink boundary.

---

## Fidelity contract

## Strong guarantees (phase 1 target)

- Identical event ordering for LLM and tool boundaries.
- Bit-identical structured fields for tool call IDs/names/args.
- Stable replay outputs for LLM and tool result payloads.

## Weak guarantees (documented)

- Wall-clock timing and microtask scheduling may vary.
- Non-captured side effects (external DB, filesystem outside workspace) are not automatically reproduced.

## Known gaps to defer

- Parallel tool call ordering under concurrent execution.
- Streaming chunk timing (while preserving final assembled outputs).

---

## Implementation plan (component-by-component)

1. **New module** `src/agents/replay/types.ts`
   - `CaptureEvent`, `CaptureManifest`, divergence types.

2. **New module** `src/agents/replay/sink.file.ts`
   - JSONL file sink + final hash generation.

3. **New module** `src/agents/replay/context.ts`
   - `CaptureContext` concrete implementation with mode switch.

4. **New module** `src/agents/replay/source.ts`
   - event load/index/cursor API.

5. **New module** `src/agents/replay/engine.ts`
   - deterministic matcher + stub responders.

6. **Runner integration** (`run.ts` + `run/attempt.ts`)
   - pass context; instrument llm/tool boundaries.

7. **Boundary adapters**
   - `bash-tools.exec-runtime.ts`, `web-fetch.ts`, `web-search.ts` replay hooks.

8. **CLI/debug support (optional but useful)**
   - internal command to replay from `manifest.json` and print divergence report.

---

## TDD strategy

Follow “test seam first” and add tests in this order to keep regressions localized.

## Unit tests

### 1) Event schema and ordering

**File**: `src/agents/replay/types.test.ts`

- validates discriminated union narrowing for all event types
- rejects unknown `version`
- preserves per-run monotonic seq behavior in capture append order

### 2) File sink integrity

**File**: `src/agents/replay/sink.file.test.ts`

- writes JSONL lines in append order
- finalizes manifest with deterministic `eventCount`
- hash changes when any line mutates
- redaction profile applied before persistence

### 3) Replay source cursor semantics

**File**: `src/agents/replay/source.test.ts`

- `next(type)` consumes exactly one matching event
- mismatch yields rich diagnostic payload
- EOF handling is explicit and typed

### 4) Replay engine matching

**File**: `src/agents/replay/engine.test.ts`

- returns stubbed llm response from captured event
- strict mode aborts on first mismatch
- lenient mode records divergence and continues

### 5) Nondeterministic adapter behavior

**File**: `src/agents/replay/context.test.ts`

- capture mode appends nondeterministic events
- replay mode returns captured sequence values
- underflow (read past recorded values) is surfaced deterministically

## Integration tests

### 6) Runner capture path

**File**: `src/agents/pi-embedded-runner/run.capture.e2e.test.ts`

- run with fake model/tool stubs in capture mode
- verify manifest + events produced
- verify llm/tool boundaries present and ordered

### 7) Runner replay path (offline)

**File**: `src/agents/pi-embedded-runner/run.replay.e2e.test.ts`

- replay previously captured run with network/tools disabled
- verify same final assistant output and tool transcript
- assert zero external network/provider calls

### 8) Reasoning fidelity regression

**File**: extend `src/agents/openai-responses.reasoning-replay.test.ts`

- capture/replay retains reasoning + function-call ID pairing
- mismatch in call ID raises divergence

### 9) Tool boundary adapters

**Files**:

- `src/agents/bash-tools.exec-runtime.replay.test.ts`
- `src/agents/tools/web-fetch.replay.test.ts`
- `src/agents/tools/web-search.replay.test.ts`

Validate that replay mode uses captured results and bypasses real execution.

## Contract tests

### 10) Cross-version manifest compatibility

**File**: `src/agents/replay/compatibility.test.ts`

- current reader accepts previous compatible manifest/event versions
- incompatible major version fails with migration hint

---

## Test fixtures and determinism rules

- Use fixed run IDs and seeded timestamps in fixtures.
- Store replay fixtures in small JSONL samples under `src/agents/replay/fixtures/`.
- Do not include real API keys, tokens, or user data.
- Keep tests independent from live providers/tools.

---

## Rollout strategy

1. Ship capture-only behind internal config flag (default off).
2. Run in CI on selected deterministic smoke scenarios.
3. Enable replay mode for debugging workflows.
4. Expand adapter coverage only where divergence reports indicate need.

This avoids over-engineering while creating immediate observability and reproducibility gains.

---

## Risks and mitigations

1. **Risk: capture log bloat**
   - Mitigation: payload hashing + external blob store for large artifacts.

2. **Risk: secret leakage in captured events**
   - Mitigation: mandatory redaction layer in sink; test fixtures for redaction.

3. **Risk: hidden nondeterminism causes flaky replay**
   - Mitigation: divergence telemetry + iterative adapter hardening.

4. **Risk: high integration complexity**
   - Mitigation: event-first integration; only add deep wrappers where needed.

---

## Definition of done (phase 1)

- Capture log + manifest generated for a run.
- Replay mode can reproduce final assistant output for baseline scenarios.
- Divergence report emitted with actionable diffs on mismatch.
- Unit + integration tests for sink/source/engine + runner capture/replay paths.
- No regression to existing event streams or reasoning replay behavior.
