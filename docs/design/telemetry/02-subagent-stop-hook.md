# SubagentStop Hook — Blocking Subagent Completion

> Design specification for a `subagent_stopping` hook that can intercept subagent completion, inject new prompts to redirect work, and prevent premature termination — with loop protection.

## Commit Strategy

When implementing the `subagent_stopping` hook, use the following commit structure:

1. **Types commit**: Add `PluginHookSubagentStoppingEvent`, `PluginHookSubagentStoppingResult`, `PluginHookSubagentStoppingContext` types to `src/plugins/types.ts`. Add hook name to union. (~45 lines)

2. **Hook runner commit**: Add `runSubagentStopping()` sequential hook function to `src/plugins/hooks.ts`. (~25 lines)

3. **Call site commit**: Insert hook invocation in `completeSubagentRun()`, including max steers enforcement and steer-restart logic. (~40 lines)

4. **Helper function commit**: Add `readLastAssistantMessage()` helper for extracting subagent's final response. (~25 lines)

5. **Tracking commit**: Add `steerCount?: number` to `SubagentRunRecord` type and update `replaceSubagentRunAfterSteer()` to carry it forward. (~10 lines)

6. **Config commit**: Add `maxSteerRestarts` default to agent limits. (~3 lines)

7. **Tests commit**: Comprehensive tests for steer logic, loop protection, and fail-open behavior. (~100 lines)

Each commit enables isolated review of the blocking mechanism, loop protection, error handling, and registry changes. Avoid bundling the reader helper with the hook logic — it should be a separate, testable function.

---

## 1. Problem Statement

When a subagent finishes its work, the result is immediately announced to the parent session. There is no opportunity to:

- Inspect the subagent's output and decide if the work is actually complete
- Inject a follow-up prompt to steer the subagent toward a better result
- Apply quality gates (e.g., "did the subagent actually run tests?")
- Prevent premature completion (subagent said "done" but missed requirements)

Claude Code's `SubagentStop` hook supports blocking — if the hook returns `{ decision: "block", reason: "..." }`, the subagent continues working with the reason as its next instruction. OpenClaw's `subagent_ended` hook is fire-and-forget and cannot block.

## 2. Design: Sequential Hook at `completeSubagentRun`

### 2.1 Insertion Point

**File:** `src/agents/subagent-registry.ts`, inside `completeSubagentRun()` (function starts at line 316; hook insertion point at line ~350, between persist and steer-restart check).

**Current flow:**

```
completeSubagentRun(params) {
  1. Update entry: endedAt, outcome, endedReason         // line 316-348
  2. persistSubagentRuns()                                // line 347
  3. Check suppressedForSteerRestart                      // line 350
  4. Maybe emit subagent_ended hook (early)               // line 362-369
  5. startSubagentAnnounceCleanupFlow()                   // line 377
}
```

**New flow:**

```
completeSubagentRun(params) {
  1. Update entry: endedAt, outcome, endedReason
  2. persistSubagentRuns()
  3. Check suppressedForSteerRestart
  4. ★ Run subagent_stopping hook (sequential) ★          // NEW
     ├── If hook returns { allow: false, prompt: "..." }:
     │   a. markSubagentRunForSteerRestart(runId)
     │   b. Execute steer-restart flow
     │   c. return (skip announce + subagent_ended)
     └── If hook returns { allow: true } or no handlers:
         → Continue existing flow
  5. Maybe emit subagent_ended hook (early)
  6. startSubagentAnnounceCleanupFlow()
}
```

### 2.2 Why This Insertion Point

- **After `endedAt` is set:** The run is marked as complete, so we have timing data.
- **After outcome is determined:** We know if it succeeded, errored, or timed out.
- **Before `subagent_ended` fires:** The observation-only hook hasn't fired yet — we can suppress it on redirect.
- **Before announce:** The parent hasn't been notified yet — no stale results delivered.
- **The steer-restart mechanism already exists here:** `suppressedForSteerRestart` is checked at line 350. Our hook integrates naturally into this existing pattern.

### 2.3 Leveraging the Existing Steer Mechanism

The codebase already has a complete steer-restart flow used by the `subagents` tool's "steer" action (`src/agents/tools/subagents-tool.ts:570-660`):

```
markSubagentRunForSteerRestart(runId)
  → Sets entry.suppressAnnounceReason = "steer-restart"
  → Persists to subagents.json

abortEmbeddedPiRun(sessionId)
  → Aborts current Pi agent run (no-op if already ended)

clearSessionQueues([childKey, sessionId])
  → Clears any pending followup messages

callGateway({ method: "agent.wait", ... })
  → Waits for interrupted run to settle

callGateway({ method: "agent", message: newPrompt, sessionKey: childKey })
  → Sends new message to child session → starts new run

replaceSubagentRunAfterSteer({ previousRunId, nextRunId })
  → Creates new SubagentRunRecord linked to the original
  → Carries forward: task, label, requester, cleanup policy
```

Our hook uses this exact same flow. No new mechanisms needed.

## 3. Hook Specification

### 3.1 Event Type

```typescript
export type PluginHookSubagentStoppingEvent = {
  // Identity
  runId: string;
  childSessionKey: string;
  requesterSessionKey: string;
  agentId: string;

  // What the subagent was doing
  task?: string; // Original prompt/task given to subagent
  label?: string; // Human-readable name

  // How it ended
  outcome: "ok" | "error" | "timeout";
  reason: string; // SUBAGENT_ENDED_REASON_COMPLETE, etc.
  error?: string; // Error message if outcome != "ok"

  // Output
  lastAssistantMessage?: string; // Final response text from subagent

  // Metrics
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
  durationMs?: number; // Wall clock time for this run
  toolsUsed?: string[]; // Tools called during this run

  // Loop protection
  steerCount: number; // How many times hook has redirected so far
  maxSteers: number; // Current limit (from config, default 3)
};
```

### 3.2 Result Type

```typescript
export type PluginHookSubagentStoppingResult = {
  allow?: boolean; // Default: true. Set false to redirect.
  prompt?: string; // New prompt to inject (REQUIRED if allow=false)
  reason?: string; // Why the hook is redirecting (logged)
  extendMaxSteers?: number; // Raise the steer limit (cannot lower)
};
```

### 3.3 Context Type

```typescript
export type PluginHookSubagentStoppingContext = {
  agentId: string;
  runId: string;
  childSessionKey: string;
  requesterSessionKey: string;
};
```

### 3.4 Execution Model

- **Sequential** (async): handlers run in priority order
- First handler returning `{ allow: false, prompt: "..." }` wins — remaining handlers are skipped
- If `allow: false` but no `prompt` is provided, the hook is treated as `{ allow: true }` (cannot redirect without a prompt)
- If handler throws: error is logged, treated as `{ allow: true }` (fail-open)

## 4. Loop Protection

### 4.1 Steer Count Tracking

A `steerCount` field is added to `SubagentRunRecord`:

```typescript
// src/agents/subagent-registry.types.ts
export type SubagentRunRecord = {
  // ... existing fields ...
  steerCount?: number; // NEW: how many times subagent_stopping has redirected
};
```

When `replaceSubagentRunAfterSteer()` creates the replacement run record, it carries forward `steerCount + 1`:

```typescript
// In replaceSubagentRunAfterSteer():
const nextEntry: SubagentRunRecord = {
  ...fallback,
  runId: nextRunId,
  startedAt: Date.now(),
  endedAt: undefined,
  outcome: undefined,
  steerCount: (previousEntry.steerCount ?? 0) + 1, // Increment
  // ... rest of fields
};
```

### 4.2 Max Steers Enforcement

```typescript
const maxSteers = resolveMaxSteers(config); // Default: 3

// In completeSubagentRun(), before running the hook:
const currentSteerCount = entry.steerCount ?? 0;
if (currentSteerCount >= maxSteers) {
  log.warn(
    `subagent_stopping hook skipped: steerCount=${currentSteerCount} >= maxSteers=${maxSteers} ` +
      `runId=${params.runId} childKey=${entry.childSessionKey}`,
  );
  // Skip hook entirely — allow completion
} else {
  // Run the hook
  const result = await hookRunner.runSubagentStopping(event, ctx);
  if (result?.allow === false && typeof result.prompt === "string" && result.prompt.trim()) {
    // Execute steer-restart
  }
}
```

### 4.3 Configuration

```yaml
# openclaw config
agents:
  defaults:
    subagents:
      maxSteerRestarts: 3 # Default: 3. Max times subagent_stopping can redirect.
```

Plugins can request an extension via `extendMaxSteers` in the result, but cannot lower the limit.

### 4.4 What Happens After a Redirect

1. Hook returns `{ allow: false, prompt: "Run the tests and verify output" }`
2. `markSubagentRunForSteerRestart(runId)` — suppresses announce for current run
3. New message is sent to child session via `callGateway({ method: "agent", message: prompt })`
4. Child session starts a new embedded Pi run
5. New run processes the injected prompt (has full conversation history)
6. When new run completes → `completeSubagentRun()` fires again
7. `subagent_stopping` hook fires again (with `steerCount: 1`)
8. If hook allows → announce to parent
9. If hook redirects again → repeat (up to `maxSteers`)

```
Subagent run #1 ends
  → subagent_stopping hook fires (steerCount: 0)
  → Hook: { allow: false, prompt: "Check test results" }
  → Steer-restart: new run #2 starts
  ↓
Subagent run #2 ends
  → subagent_stopping hook fires (steerCount: 1)
  → Hook: { allow: false, prompt: "Fix the failing test" }
  → Steer-restart: new run #3 starts
  ↓
Subagent run #3 ends
  → subagent_stopping hook fires (steerCount: 2)
  → Hook: { allow: true }
  → Result announced to parent
```

### 4.5 Edge Cases

| Scenario                                    | Behavior                                                                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `steerCount >= maxSteers`                   | Hook is skipped entirely. Run completes normally. Warning logged.                                                                       |
| Hook throws an error                        | Error logged. Run completes normally (fail-open).                                                                                       |
| `allow: false` but no `prompt`              | Treated as `allow: true`. Warning logged.                                                                                               |
| `allow: false` but `prompt` is empty string | Treated as `allow: true`. Warning logged.                                                                                               |
| Subagent was killed (not completed)         | Hook does NOT fire for killed subagents. `subagent_ended` fires directly with `outcome: "killed"`.                                      |
| Subagent timed out                          | Hook DOES fire with `outcome: "timeout"`. Plugin can redirect with a shorter task.                                                      |
| Steer-restart gateway call fails            | `clearSubagentRunSteerRestart()` is called to restore normal announce. Error logged. Completion proceeds as if hook was not registered. |
| `suppressedForSteerRestart` already true    | Hook is skipped (a parent steer is already in progress).                                                                                |

## 5. Reading `lastAssistantMessage`

The hook provides `lastAssistantMessage` — the subagent's final response text. This must be read BEFORE the hook fires.

**Approach:** Read from the subagent's session JSONL transcript. The file is flushed by the time `completeSubagentRun` is called (the embedded Pi run has ended).

```typescript
// Helper function:
async function readLastAssistantMessage(
  sessionId: string,
  agentId: string,
): Promise<string | undefined> {
  const sessionDir = resolveSessionDir(agentId);
  const transcriptPath = path.join(sessionDir, `${sessionId}.jsonl`);
  // Read last N lines, find last assistant message
  const lines = await readLastLines(transcriptPath, 50);
  for (const line of lines.reverse()) {
    try {
      const record = JSON.parse(line);
      if (record.type === "message" && record.message?.role === "assistant") {
        const textBlocks = record.message.content?.filter(
          (b: { type: string }) => b.type === "text",
        );
        if (textBlocks?.length) {
          return textBlocks.map((b: { text: string }) => b.text).join("\n");
        }
      }
    } catch {
      /* skip malformed lines */
    }
  }
  return undefined;
}
```

This is the same pattern used by `subagent-announce.ts:1141-1153` for reading subagent output.

## 6. Implementation Summary

### 6.1 Files Changed

| File                                    | Change                                                                                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/plugins/types.ts`                  | Add `PluginHookSubagentStoppingEvent`, `PluginHookSubagentStoppingResult`, `PluginHookSubagentStoppingContext` types. Add `"subagent_stopping"` to hook name union. Add handler signature to hook map. |
| `src/plugins/hooks.ts`                  | Add `runSubagentStopping()` function (sequential hook runner). Export from hook runner.                                                                                                                |
| `src/agents/subagent-registry.ts`       | In `completeSubagentRun()`: add hook invocation between "persist" and "announce" steps. Add steerCount tracking.                                                                                       |
| `src/agents/subagent-registry.types.ts` | Add `steerCount?: number` to `SubagentRunRecord`.                                                                                                                                                      |
| `src/agents/subagent-registry.ts`       | In `replaceSubagentRunAfterSteer()`: carry forward `steerCount + 1`.                                                                                                                                   |
| `src/config/agent-limits.ts`            | Add `maxSteerRestarts` default.                                                                                                                                                                        |

### 6.2 Diff Estimate

| Component                                       | Lines          |
| ----------------------------------------------- | -------------- |
| Type definitions (3 types + hook map additions) | ~45            |
| Hook runner function                            | ~25            |
| Call site in `completeSubagentRun`              | ~40            |
| `lastAssistantMessage` reader helper            | ~25            |
| `steerCount` tracking in registry               | ~10            |
| Config default                                  | ~3             |
| Tests                                           | ~100           |
| **Total**                                       | **~248 lines** |

### 6.3 Relationship to `subagent_ended`

`subagent_stopping` and `subagent_ended` are complementary:

| Aspect                     | `subagent_stopping` (NEW)       | `subagent_ended` (EXISTING)               |
| -------------------------- | ------------------------------- | ----------------------------------------- |
| When                       | Before announce, before cleanup | After announce (or after stopping allows) |
| Can block                  | Yes — redirect with new prompt  | No — fire-and-forget                      |
| Purpose                    | Quality gate / steering         | Observation / telemetry                   |
| Fires on kill              | No                              | Yes                                       |
| Fires on session-reset     | No                              | Yes                                       |
| Has `lastAssistantMessage` | Yes                             | No (but could be added via enrichment)    |

When `subagent_stopping` redirects, `subagent_ended` does NOT fire for the redirected run. It fires only when the final run is allowed to complete.

## 7. Plugin Usage Example

```typescript
// In extensions/telemetry/index.ts or a quality-gate plugin:
api.on(
  "subagent_stopping",
  async (event, ctx) => {
    // Log the completion attempt
    appendToTelemetryLog({
      kind: "subagent.stop",
      data: event,
    });

    // Quality gate: check if subagent ran tests
    if (event.label === "test-runner" && event.outcome === "ok") {
      const response = event.lastAssistantMessage ?? "";
      if (!response.includes("All tests passed") && !response.includes("✓")) {
        return {
          allow: false,
          prompt:
            "You indicated completion but the test results are not confirmed. " +
            "Please run the test suite and report the results.",
          reason: "Test results not confirmed in output",
        };
      }
    }

    return { allow: true };
  },
  { priority: 100 },
);
```
