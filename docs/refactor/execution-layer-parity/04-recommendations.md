# Recommendations — Next 20 Steps

> Prioritized action plan for achieving runtime parity between Pi and Claude Agent SDK.
> Each step is sized (S/M/L/XL) and grouped by parallelization opportunities.

---

## Priority Legend

- **S** = Small (< 1 hour, isolated change)
- **M** = Medium (2–4 hours, touches 2–3 files)
- **L** = Large (half-day to full day, cross-cutting)
- **XL** = Extra-large (multi-day, new subsystem or major refactor)

---

## Steps

### Batch 1 — Quick Wins & Correctness Fixes (can all run in parallel)

| #   | Step                                                                                                                                                       | Size  | Parallelizable | Notes                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------------- | ------------------------------------------------------------------ |
| 1   | **Fix `supportsImages` capability for SDK** — Set `supportsImages: false` for `kind === "claude"` in `resolver.ts` until image forwarding is wired up.     | **S** | Yes            | 1-line fix in `resolveCapabilities()`. Prevents silent data loss.  |
| 2   | **Wire image forwarding in SDK runner** — Pass `images` from `SdkRunnerParams` into `sdk.query()` prompt content.                                          | **M** | Yes (with #1)  | Requires understanding SDK prompt format for image content blocks. |
| 3   | **Fix `shouldEmitToolResult`/`shouldEmitToolOutput` asymmetry** — Normalize to function signature `() => boolean` in SDK, or add both to common interface. | **S** | Yes            | Type alignment + one call-site fix in `sdk-runner.ts`.             |
| 4   | **Add `claudeSdkOptions` proper type** — Replace `any` in `agent-scope.ts:35` with a real type.                                                            | **S** | Yes            | Straightforward type definition.                                   |
| 5   | **Surface SDK fallback as an execution event** — Emit a `lifecycle.warning` or similar event when `agent-runtime-dispatch.ts` falls back from SDK to Pi.   | **S** | Yes            | Add event emission in the fallback branch.                         |

### Batch 2 — Error Handling Parity (sequential dependency within, parallelizable across)

| #   | Step                                                                                                                                                             | Size  | Parallelizable | Notes                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------------- | -------------------------------------------------------------------------------------------------------------- |
| 6   | **Define SDK error taxonomy** — Map common SDK failure patterns (rate limit, auth failure, context overflow, refusal) to `ExecutionError.code` values.           | **M** | Yes            | Design + type changes in `types.ts`.                                                                           |
| 7   | **Implement SDK error classification** — Parse SDK error responses and map to the taxonomy from #6 in `sdk-runner-adapter.ts`.                                   | **M** | After #6       | Regex/pattern matching on SDK error messages.                                                                  |
| 8   | **Add role ordering error recovery for SDK** — Detect "roles must alternate" in SDK errors and surface the "use /new" suggestion.                                | **S** | After #6       | Pattern from Pi's `run.ts:517-538`.                                                                            |
| 9   | **Add image size error handling for SDK** — Port `parseImageSizeError`/`parseImageDimensionError` to a shared utility, call from both runtimes.                  | **M** | After #2       | Extract from Pi, make runtime-agnostic.                                                                        |
| 10  | **Add refusal magic string scrubbing for SDK** — Port `ANTHROPIC_MAGIC_STRING_TRIGGER_REFUSAL` scrubbing to a shared pre-processing step in the execution layer. | **S** | Yes            | Could be added to `TurnExecutor` or `ExecutionKernel` as a pre-run sanitization step so both runtimes benefit. |

### Batch 3 — Resilience Features (these are the big ones)

| #   | Step                                                                                                                                                                                                                                                 | Size   | Parallelizable                  | Notes                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 11  | **Design auth failover for SDK** — Design how multi-profile rotation can work with the SDK's single-provider model. Options: (a) wrap SDK run in retry loop at `TurnExecutor` level, (b) pre-resolve ordered credentials and retry at adapter level. | **L**  | Yes (design)                    | Requires design doc. Most impactful single gap.                                                            |
| 12  | **Implement auth failover for SDK** — Build the retry/rotation mechanism from #11.                                                                                                                                                                   | **XL** | After #11                       | Touches `sdk-runner-adapter.ts`, possibly `executor.ts`. Need cooldown tracking, profile state management. |
| 13  | **Design model fallback for SDK** — Design how `config.agents.defaults.model.fallbacks` can work with the SDK. Likely a retry loop wrapping the SDK `run()` call.                                                                                    | **M**  | Yes (design, parallel with #11) | Simpler than auth failover — just retry with different model string.                                       |
| 14  | **Implement model fallback for SDK** — Build the fallback chain from #13.                                                                                                                                                                            | **L**  | After #13                       | Retry loop in `SdkAgentRuntime.run()` or in `TurnExecutor`.                                                |

### Batch 4 — Session & Context Management

| #   | Step                                                                                                                                                                              | Size  | Parallelizable | Notes                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------------- | ---------------------------------------------------------------------- |
| 15  | **Add session lane serialization for SDK** — Prevent concurrent SDK runs from conflicting on the same session. Reuse Pi's lane infrastructure or add SDK-level locking.           | **M** | Yes            | Could reuse `lanes.ts` since it's session-keyed, not runtime-specific. |
| 16  | **Add context window pre-run guard for SDK** — Port `evaluateContextWindowGuard` to work with SDK sessions. May require querying SDK for current context usage.                   | **M** | Yes            | Depends on whether SDK exposes context usage metrics.                  |
| 17  | **Add thinking level fallback for SDK** — When SDK rejects a thinking budget, retry with a lower tier. Map Pi's `pickFallbackThinkingLevel` logic to SDK's `THINKING_BUDGET_MAP`. | **M** | Yes            | Retry loop in SDK runner or adapter.                                   |

### Batch 5 — Observability & Diagnostics

| #   | Step                                                                                                                         | Size  | Parallelizable | Notes                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ----- | -------------- | ------------------------------------------------------------ |
| 18  | **Add system prompt report for SDK** — Track what goes into the SDK system prompt and return diagnostics in result metadata. | **M** | Yes            | Mirror Pi's `buildSystemPromptReport()` pattern.             |
| 19  | **Add turn count tracking for Pi** — Port SDK's `turnCount`/`userMessageCount` tracking to Pi's `EmbeddedPiRunMeta`.         | **S** | Yes            | Pi already tracks turns implicitly; just expose in metadata. |
| 20  | **Add cost estimation for Pi** — Port SDK's `costUsd` field to Pi metadata using token counts + model pricing.               | **M** | Yes            | Shared utility that both runtimes can use.                   |

---

## Parallelization Map

```
Batch 1:  [#1] [#2] [#3] [#4] [#5]     ← all parallel
              │
Batch 2:  [#6] [#10]                     ← parallel
           │  │
          [#7][#8]                        ← after #6
           │
          [#9]                            ← after #2

Batch 3:  [#11 design] [#13 design]      ← parallel
           │             │
          [#12 impl]   [#14 impl]         ← sequential after designs

Batch 4:  [#15] [#16] [#17]              ← all parallel

Batch 5:  [#18] [#19] [#20]              ← all parallel
```

Batches 1–2 should be done first (foundations). Batches 3–5 can be worked in parallel once foundations are in place.

---

## What's NOT on This List (and Why)

| Feature                                    | Reason for exclusion                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| **Pi's multi-turn session management**     | SDK handles this natively via `resume`. Different approach, not a gap.                   |
| **Pi's compaction engine**                 | SDK delegates to its own compaction. Monitoring SDK compaction quality is separate work. |
| **Pi's `onBlockReplyFlush`**               | Low-impact callback. Can be added opportunistically.                                     |
| **SDK's MCP tool bridge**                  | Pi doesn't need this — it uses native tools. Architecture difference, not a gap.         |
| **SDK's built-in Claude Code tools**       | Pi equivalent is its native tool system. Different approach, not a gap.                  |
| **SDK's platform credential store**        | Pi's auth profile store works. Nice-to-have, not a parity requirement.                   |
| **Pi's queue-based mid-run steering**      | SDK architecture doesn't support this pattern. Would require fundamental redesign.       |
| **Pi's block chunking**                    | Streaming nicety. Can be added later.                                                    |
| **CLI runtime kind in `AgentRuntimeKind`** | Low priority. CLI is a separate execution path by design.                                |
