# 06 — Session Cost Capture & Custom Usage Ledger

## Problem

OpenClaw tracks LLM costs **only** for the embedded Pi agent runner path.
Multiple other subsystems make paid external API calls — TTS, embeddings,
audio transcription, image/video understanding — with **zero cost tracking**
and no session association. Extensions that want to record billing data
(e.g. external API calls, storage costs) have no standardised place to
write it.

### Goals

1. **Capture all cost-incurring API calls** via a unified ledger.
2. **Async disk writes** — callers capture a timestamp and submit; writes
   never block the hot path.
3. **Out-of-order tolerance** — entries are sorted by timestamp at query
   time (or on session end), not on write.
4. **Extension-contributed entries** — any plugin can record ad-hoc cost
   entries (structured, typed) into the same ledger.
5. **Separate files** — cost capture primitives live in their own modules,
   not inside `session-runtime-store.ts`.

---

## Complete Inventory of Cost-Incurring Code Paths

### Fully Tracked (Embedded Pi Agent Runner)

| Subsystem         | File                                           | Line    | API                                  | Session                    | Cost                                  |
| ----------------- | ---------------------------------------------- | ------- | ------------------------------------ | -------------------------- | ------------------------------------- |
| LLM completion    | `src/agents/pi-embedded-runner/run/attempt.ts` | 209     | `streamSimple()`                     | sessionKey, runId, agentId | Token-based via `estimateUsageCost()` |
| Usage emission    | `src/auto-reply/reply/agent-runner.ts`         | 550-579 | `emitDiagnosticEvent("model.usage")` | sessionKey, sessionId      | Full breakdown emitted                |
| Per-call emission | `src/agents/pi-embedded-subscribe.ts`          | 276     | `emitDiagnosticEvent("model.call")`  | sessionKey, runId          | Delta + cumulative                    |

### Untracked — LLM Calls

| Subsystem           | File                                                | Line   | Function           | Session Available Upstream?                                                             | Cost Model                         |
| ------------------- | --------------------------------------------------- | ------ | ------------------ | --------------------------------------------------------------------------------------- | ---------------------------------- |
| TTS summarization   | `src/tts/tts-core.ts`                               | 448    | `completeSimple()` | **Yes** — called from reply pipeline which has sessionKey                               | Token-based (provider/model known) |
| Image understanding | `src/media-understanding/providers/image.ts`        | 56     | `complete()`       | **Partially** — called from tool execution (toolCallId available) or inbound processing | Token-based                        |
| Video understanding | `src/media-understanding/providers/google/video.ts` | varies | `complete()`       | **Partially** — same as image                                                           | Token-based                        |

### Untracked — Embedding Calls

| Subsystem          | File                                    | Line   | Function                        | Session Available?                     | Cost Model                     |
| ------------------ | --------------------------------------- | ------ | ------------------------------- | -------------------------------------- | ------------------------------ |
| OpenAI embeddings  | `src/memory/embeddings-remote-fetch.ts` | 11     | `postJson()`                    | **No** — memory ops are agent-agnostic | Per token                      |
| Voyage embeddings  | `src/memory/embeddings-voyage.ts`       | 50     | `fetchRemoteEmbeddingVectors()` | **No**                                 | Per token                      |
| Gemini embeddings  | `src/memory/embeddings-gemini.ts`       | varies | Remote call                     | **No**                                 | Per token                      |
| Mistral embeddings | `src/memory/embeddings-mistral.ts`      | varies | Remote call                     | **No**                                 | Per token                      |
| Batch OpenAI       | `src/memory/batch-openai.ts`            | varies | `postJsonWithRetry()`           | **No**                                 | Per token (cheaper batch rate) |
| Batch Voyage       | `src/memory/batch-voyage.ts`            | varies | `postJsonWithRetry()`           | **No**                                 | Per token                      |
| Batch Gemini       | `src/memory/batch-gemini.ts`            | varies | batch API                       | **No**                                 | Per token                      |

### Untracked — Audio Transcription

| Subsystem      | File                                                  | Line   | Function                         | Session Available?                      | Cost Model          |
| -------------- | ----------------------------------------------------- | ------ | -------------------------------- | --------------------------------------- | ------------------- |
| OpenAI Whisper | `src/media-understanding/providers/openai/audio.ts`   | 47     | `postTranscriptionRequest()`     | **No** — pre-session inbound processing | Per minute of audio |
| Deepgram       | `src/media-understanding/providers/deepgram/audio.ts` | 58     | `postTranscriptionRequest()`     | **No**                                  | Per minute of audio |
| Gemini audio   | `src/media-understanding/providers/google/audio.ts`   | 11     | `generateGeminiInlineDataText()` | **No**                                  | Token-based         |
| Groq (Whisper) | `src/media-understanding/providers/groq/index.ts`     | varies | Whisper-compatible               | **No**                                  | Per minute of audio |

### Untracked — TTS Synthesis

| Subsystem      | File                  | Line | Function                    | Session Available?         | Cost Model    |
| -------------- | --------------------- | ---- | --------------------------- | -------------------------- | ------------- |
| OpenAI TTS     | `src/tts/tts-core.ts` | 612  | `fetch(/audio/speech)`      | **Yes** — reply pipeline   | Per character |
| ElevenLabs TTS | `src/tts/tts-core.ts` | 552  | `fetch(/v1/text-to-speech)` | **Yes** — reply pipeline   | Per character |
| Edge TTS       | `src/tts/tts-core.ts` | 672  | `EdgeTTS.ttsPromise()`      | Yes but **free** (no cost) | Free          |

---

## Plumbing Assessment — How Much Change Per Subsystem?

### Low Effort (session context already nearby)

| Subsystem                             | Change Required                                                                                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TTS summarization**                 | Thread `sessionKey?` from `textToSpeech()` → `summarizeText()`. The reply pipeline always has sessionKey. ~3 lines to add param, ~5 lines to emit. |
| **TTS synthesis (OpenAI/ElevenLabs)** | Same — thread `sessionKey?` from `textToSpeech()` into provider functions. Emit character count + provider. ~5 lines per provider.                 |
| **Image understanding (tool path)**   | When called from agent tool execution, `toolCallId` is available. Thread it through `describeImageWithModel()`. ~5 lines.                          |

### Medium Effort (need a context parameter)

| Subsystem                                    | Change Required                                                                                                                                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Audio transcription**                      | Add optional `CostContext` param to transcription runner entries. When called during inbound processing, the message context has channel + chat info (not always sessionKey since it's pre-session). ~10 lines per provider. |
| **Image/video understanding (inbound path)** | Same as audio — add optional context. ~10 lines.                                                                                                                                                                             |

### Higher Effort (no session context available)

| Subsystem                | Change Required                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Embedding operations** | Memory manager is agent-agnostic. Would need to either: (a) thread an optional `CostContext` through manager → provider, or (b) emit at the manager level without session binding, using a "system" source label. Recommend (b) initially — track embedding cost globally, not per-session. ~15 lines in `manager-embedding-ops.ts`. |
| **Batch embedding**      | Same as above but for batch operations. ~10 lines per batch module.                                                                                                                                                                                                                                                                  |

### Summary: ~80–100 lines of call-site changes total

The core primitives (ledger, async queue, types) are the bulk of the work.
Call-site instrumentation is lightweight — mostly adding an optional context
param and a single `recordCost()` or `emitDiagnosticEvent()` call.

---

## Architecture

### Async Write Queue

All disk I/O goes through an `AsyncWriteQueue` that:

1. Accepts entries with **pre-captured timestamps** (captured by caller
   before submitting).
2. Buffers entries in memory.
3. Flushes to an append-only JSONL file on a configurable interval (or
   on explicit `drain()`).
4. Never blocks the caller — `enqueue()` is synchronous and O(1).
5. On process exit / `close()`, drains remaining entries.

```
caller → enqueue(entry)   [sync, O(1)]
                ↓
         memory buffer     [Array<T>]
                ↓
         periodic flush    [setInterval]
                ↓
         append to .jsonl  [fs.appendFileSync in microtask]
```

### Session Cost Ledger

A typed wrapper around `AsyncWriteQueue` specifically for cost entries:

```typescript
type CostEntry = {
  /** Monotonic ID for dedup/ordering */
  id: string;
  /** When the cost was incurred (captured before async submit) */
  timestamp: number;
  /** What produced this cost */
  source: CostSource;
  /** Cost in USD (null if unknown/free) */
  costUsd?: number;
  /** Session association (when available) */
  sessionKey?: string;
  runId?: string;
  agentId?: string;
  toolCallId?: string;
  /** Provider + model for LLM/embedding/TTS calls */
  provider?: string;
  model?: string;
  /** Token usage (for token-based billing) */
  usage?: { input?: number; output?: number; total?: number };
  /** Duration of the API call */
  durationMs?: number;
  /** Extension-defined structured metadata */
  meta?: Record<string, unknown>;
};

type CostSource =
  | "llm.completion" // embedded pi runner
  | "llm.auxiliary" // non-agent LLM calls (TTS summarization, etc.)
  | "tts.synthesis" // text-to-speech API calls
  | "embedding.query" // single embedding lookups
  | "embedding.batch" // batch embedding operations
  | "transcription.audio" // audio-to-text
  | "media.vision" // image/video understanding
  | "custom"; // extension-contributed
```

### Querying / Sorting

Entries are written in arrival order (which may be out-of-order relative to
timestamps). Consumers sort by `timestamp` at read time:

- **Session end**: the telemetry plugin can sort + compact the ledger.
- **CLI / HTTP queries**: sort in the query layer (already done for the
  SQLite indexer which has `ORDER BY ts`).
- **In-memory rollup**: `SessionCostLedger.summarize(sessionKey?)` sorts
  entries before aggregating.

### File Layout

```
src/plugin-sdk/
  session-cost-ledger.ts          # CostEntry type, SessionCostLedger class
  session-cost-ledger.test.ts     # Tests
  async-write-queue.ts            # Generic async JSONL append queue
  async-write-queue.test.ts       # Tests
```

These are **separate files** from `session-runtime-store.ts`. The ledger
uses the async write queue internally but does not depend on the store.

### Diagnostic Integration

A new diagnostic event type for non-agent API calls:

```typescript
type DiagnosticAuxiliaryCostEvent = DiagnosticBaseEvent & {
  type: "cost.recorded";
  source: CostSource;
  sessionKey?: string;
  runId?: string;
  provider?: string;
  model?: string;
  costUsd?: number;
  durationMs?: number;
  usage?: { input?: number; output?: number; total?: number };
};
```

Added to `DiagnosticEventPayload` union so telemetry/OTEL extensions can
subscribe without any additional wiring.

### Extension Usage

```typescript
import { createSessionCostLedger, type CostEntry } from "openclaw/plugin-sdk";

// In plugin activate():
const ledger = createSessionCostLedger({
  stateDir: path.join(ctx.stateDir, "my-extension"),
  flushIntervalMs: 2000, // async flush every 2s
  emitDiagnostic: true, // also emit cost.recorded diagnostic events
});

api.registerService(ledger.toPluginService("my-cost-ledger"));

// Record a cost entry (sync, non-blocking):
const timestamp = Date.now();
// ... do expensive API call ...
ledger.record({
  timestamp,
  source: "custom",
  costUsd: 0.002,
  sessionKey: ctx.sessionKey,
  provider: "elevenlabs",
  meta: { characters: 1500, voice: "alloy" },
});

// Query costs for a session:
const summary = ledger.summarize("session-key-123");
// { totalCostUsd, bySource: Map<CostSource, number>, entries: CostEntry[] }
```

---

## Implementation Plan

### Phase A: Core Primitives (this branch)

1. `async-write-queue.ts` — generic append-only async JSONL queue
2. `session-cost-ledger.ts` — typed cost entry ledger with summarize
3. Tests for both
4. Export from `plugin-sdk/index.ts`

### Phase B: Diagnostic Event (this branch)

1. Add `DiagnosticAuxiliaryCostEvent` to `diagnostic-events.ts`
2. Wire ledger to optionally emit diagnostic events on record

### Phase C: Call-site Instrumentation (separate commits)

1. TTS: thread `sessionKey?` + emit cost entries
2. Image/video understanding: thread `toolCallId?` + emit
3. Audio transcription: add optional cost context + emit
4. Embeddings: emit at manager level without session binding

### Phase D: Telemetry Plugin Integration

1. Subscribe to `cost.recorded` diagnostic events
2. Index cost entries in SQLite alongside existing events
3. Add `telemetry costs` CLI command
4. Add `/telemetry/costs` HTTP route
