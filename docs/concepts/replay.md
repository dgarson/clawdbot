---
summary: "Deterministic replay: record event traces, validate order, and debug regressions"
read_when:
  - You want deterministic test fixtures for agent/tool flows
  - You are debugging replay mismatches or manifest parsing errors
  - You need to capture and compare execution traces across runs
title: "Deterministic Replay"
---

# Deterministic Replay

Deterministic replay in OpenClaw lets you record a normalized event stream (LLM/tool/message/file/state/system/user), then verify future runs match the expected sequence.

Current implementation focus:

- In-memory recording (`src/replay/recorder.ts`)
- Deterministic/realtime clocks (`src/replay/clock.ts`)
- Scenario runner + sequence checks (`src/replay/runner.ts`)
- JSON/JSONL schema validation helpers (`src/replay/types.ts`)
- Session-level replay metadata + lifecycle types (`src/sessions/replay-manifest.ts`)

## What you get

A replay run produces:

- **Event stream** (JSONL): ordered events with `seq`, `ts`, `category`, `type`, and `data`
- **Replay manifest** (JSON): metadata, environment, category config, per-category counts, and a SHA-256 `eventFingerprint`

This is useful for:

- Locking down regressions after model/provider behavior changes
- Asserting tool-call/message ordering in tests
- Comparing two runs by fingerprint and by per-event sequence

## Quick usage

Use the helpers exported from `src/replay/index.ts`.

```ts
import {
  createDeterministicReplayClock,
  runReplayScenario,
  checkReplaySequence,
} from "../src/replay/index.js";

const steps = [
  { category: "llm", type: "llm.request", data: { model: "openai/gpt-5.2" } },
  { category: "tool", type: "tool.request", data: { tool: "web_search" } },
  { category: "message", type: "message.outbound", data: { text: "done" } },
] as const;

const run = runReplayScenario({
  replayId: "replay-001",
  sessionId: "session-abc",
  agentId: "agent:dev:pi",
  steps,
  now: createDeterministicReplayClock("2026-01-01T00:00:00.000Z", 25),
});

const sequence = checkReplaySequence({
  actual: run.events,
  expected: [
    { category: "llm", type: "llm.request" },
    { category: "tool", type: "tool.request" },
    { category: "message", type: "message.outbound" },
  ],
});

if (!sequence.ok) {
  throw new Error(JSON.stringify(sequence.violations, null, 2));
}
```

## Configuration

Replay behavior is configured via recorder/scenario options (not global `openclaw.json` flags yet).

### Recorder options (`ReplayRecorderOptions`)

- `replayId` (required): logical replay run id
- `sessionId` (required): source session id
- `agentId` (required): agent id used for run
- `categories` (optional): categories to annotate in manifest recording config
- `redacted` (optional, default `false`): mark payloads as redacted
- `enabled` (optional, default `true`): if `false`, `emit()` still returns sequenced events but they are not stored in recorder output
- `startedAt` (optional): override session start timestamp
- `now` (optional): custom clock function returning ISO timestamps

### Deterministic clocks

- `createDeterministicClock({ start, stepMs })`
- `createDeterministicReplayClock(start, stepMs)` convenience helper

Use deterministic clocks in tests to keep timestamps stable between runs.

## File formats and validation

### Replay manifest (`ReplayManifest`)

Key fields:

- `schemaVersion` (currently `1`)
- `replayId`
- `session`: `{ sessionId, agentId, startedAt, endedAt }`
- `environment`: `{ nodeVersion, platform, architecture }`
- `recording`: `{ categories[], redacted }`
- `stats`: total count + per-category counts
- `eventFingerprint`: SHA-256 of normalized event payloads

### Event JSONL

One JSON object per line. Parse with `parseReplayEventJSONL(...)`.

- Empty lines are ignored
- Invalid JSON includes line-numbered errors
- Schema violations include line-numbered errors

### Session-level replay manifests

`src/sessions/replay-manifest.ts` provides session lifecycle types (`recording`, `recorded`, `replaying`, etc.), event log types, and parse/serialize helpers.

Note: `exportSessionManifest(...)` is currently a stub and returns serialized JSON. It does not yet write to storage.

## Troubleshooting

### `Invalid deterministic clock start timestamp`

Cause: `start` is not parseable as a date.

Fix: pass ISO timestamps, for example `2026-01-01T00:00:00.000Z`.

### `Invalid replay manifest JSON` / `Invalid replay event JSON`

Cause: malformed JSON.

Fix: validate JSON syntax before parsing.

### `Invalid replay event JSON on line N`

Cause: JSONL line is malformed.

Fix: inspect the indicated line; ensure each line is a complete JSON object.

### `Invalid replay event on line N`

Cause: JSON parsed, but failed schema validation.

Fix: confirm required fields exist and are valid:

- `seq` non-negative integer
- `ts` ISO-like timestamp
- valid `category`
- non-empty `type`
- object `data`

### Sequence mismatch despite “similar” behavior

Cause: strict sequence checking compares exact `(category, type)` ordering.

Fixes:

- verify expected list order
- isolate nondeterministic steps into different assertions
- keep event types stable when refactoring tool/model adapters

## Related docs

- [Testing](/help/testing)
- [Session](/concepts/session)
- [Session Tool](/concepts/session-tool)
- Source: `src/replay/*`, `src/sessions/replay-manifest.ts`
