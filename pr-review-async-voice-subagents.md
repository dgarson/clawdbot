# PR Review: Async Sub-Agent Communication for TTS / Voice Calls

Branch: `codex/implement-async-sub-agent-communication-for-tts`
Reviewer: Claude (claude/review-voice-call-async-X3Ox7)

---

## Summary

This PR introduces an `AsyncSubagentBroker` that fans out async "specialist" sub-agent jobs
(research / scheduler / policy) from a voice call's foreground response loop. The foreground
agent now returns a JSON envelope (`action`, `immediate_text`, `delegations`) instead of raw text;
the broker runs delegation jobs in the background, then speaks results back to the caller when
they complete.

The overall design is sound and the normalization layer is well-tested. Several correctness bugs
and one behavioral regression need to be fixed before merging.

---

## Bugs (must fix)

### 1. `canceled` metric is always ±1 regardless of jobs canceled

**Files:** `async-subagent-broker.ts:236-237` (broker) and `async-subagent-broker.ts:287-289` (runJob early-return)

```ts
// cancelCallJobs — always +1 regardless of how many were queued
cancelCallJobs(callId: string): void {
  this.store.cancelByCall(callId);
  this._metrics.canceled += 1;   // ← always 1, even if 0 or 10 jobs canceled
}
```

And in `runJob`:

```ts
if (!this.opts.isCallActive(job.callId)) {
  this.store.cancelByCall(job.callId); // cancels 0-N queued siblings
  this._metrics.canceled += 1; // ← still only +1
  return;
}
```

Two problems:

- Both sites blindly add 1 to `canceled`, even when `cancelByCall` cancels 0 jobs.
- The `webhook.ts` call to `cancelCallJobs` fires for the terminal event, **and then** any
  concurrently running `runJob` instance also calls `cancelByCall` + `+1`, double-counting.

**Fix:** Have `InMemorySubagentJobStore.cancelByCall` return the count of newly-canceled jobs,
and accumulate that count instead of a fixed 1:

```ts
// store interface
cancelByCall(callId: string): number;  // returns # canceled

// InMemorySubagentJobStore
cancelByCall(callId: string): number {
  let count = 0;
  const now = Date.now();
  for (const job of this.jobsById.values()) {
    if (job.callId !== callId || job.state !== "queued") continue;
    job.state = "canceled";
    job.updatedAt = now;
    this.terminalCount += 1;
    count += 1;
  }
  this.maybePrune();
  return count;
}

// broker
cancelCallJobs(callId: string): void {
  this._metrics.canceled += this.store.cancelByCall(callId);
}
```

---

### 2. Response format instruction injected even when subagents are disabled

**File:** `response-generator.ts:113-122`

The `envelopePrompt` block is unconditionally appended to the system prompt:

```ts
// Always added — no check for voiceConfig.subagents?.enabled
const extraSystemPrompt = `${basePrompt}${historyBlock}${envelopePrompt}`;
```

This means **every** voice deployment — including those that never set `subagents.enabled: true` —
now receives a system prompt asking the LLM to output a JSON envelope. While
`normalizeForegroundEnvelope` handles plain-text responses gracefully (it falls through to
`respond_now`), there are real consequences:

- Existing deployments with custom `responseSystemPrompt` that conflict with the JSON instruction
  will silently produce different output.
- Users who tuned the system prompt for terse spoken answers may now get JSON blobs if their LLM
  strictly follows the `## RESPONSE FORMAT (CRITICAL)` heading.
- The LLM spends tokens reasoning about JSON format on every turn, even for simple responses.

**Fix:** Guard the envelope prompt with a subagents check:

```ts
const envelopePrompt = voiceConfig.subagents?.enabled
  ? [
      "",
      "## RESPONSE FORMAT (CRITICAL)",
      // ...
    ].join("\n")
  : "";

const extraSystemPrompt = `${basePrompt}${historyBlock}${envelopePrompt}`;
```

When subagents are disabled, no JSON envelope is requested, and the broker is null so
`result.delegations` is never consumed anyway.

---

### 3. `toSafeSpokenSummary` allows empty-string through `normalizeForegroundEnvelope` fallback path

**File:** `async-subagent-broker.ts:421-424` and `subagent-normalization.ts:248-252`

When `normalizeForegroundEnvelope` falls back due to a completely unparseable foreground response,
`immediate_text` defaults to `"One moment while I check that."`. This is fine. But if the
foreground response parses as a valid JSON object that has `action: "respond_now"` but no
`immediate_text`, the schema default of `"One moment while I check that."` is used even though
there is no delegation — so the caller hears a placeholder but no sub-agent is running.

This isn't a crash, but it's caller-visible and confusing.

**Fix:** If `action === "respond_now"` and `immediate_text` is the default placeholder string
(indicating it was missing from the LLM output rather than intentionally set), log a warning and
optionally suppress the speak call, or instruct the LLM more forcefully to always provide
`immediate_text` in the schema description.

---

## Correctness Concerns (should fix or consciously accept)

### 4. `callForEvent` pre-capture is correct but the fallback is redundant

**File:** `webhook.ts:360-366`

```ts
const callForEvent =
  this.manager.getCall(event.callId) ||
  (event.providerCallId
    ? this.manager.getCallByProviderCallId(event.providerCallId)
    : undefined);
try {
  this.manager.processEvent(event);
  if (event.type === "call.ended" || ...) {
    const endedCallId = callForEvent?.callId ?? event.callId;  // ← same value
    this.subagentBroker.cancelCallJobs(endedCallId);
  }
}
```

Pre-capturing `callForEvent` before `processEvent` mutates state is intentional and correct
(the call is removed from the manager on `call.ended`). However, `callForEvent?.callId` and
`event.callId` are always the same value in this system — `event.callId` is the internal call ID,
not a provider ID. The `?? event.callId` fallback adds no value and could mask a case where
`callForEvent` is null because the call was never known to the manager (in which case the broker
also wouldn't have any jobs for it).

**Recommendation:** Keep the pattern but add a guard:

```ts
if (
  this.subagentBroker &&
  callForEvent &&
  (event.type === "call.ended" || (event.type === "call.error" && !event.retryable))
) {
  this.subagentBroker.cancelCallJobs(callForEvent.callId);
}
```

This avoids calling `cancelCallJobs` for events whose `callId` was never registered with the
manager (and thus the broker), and removes the redundant fallback.

---

### 5. `needs_followup` / `followup_question` are normalized but never surfaced to the caller

**Files:** `subagent-normalization.ts:36-41`, `webhook.ts:46-57`, `async-subagent-broker.ts`

The `SubagentResult` schema includes `needs_followup (boolean)` and `followup_question
(string|null)`, and the sub-agent prompt explicitly requests them. However, the
`onSummaryReady` callback only receives `summary`:

```ts
onSummaryReady: async ({ callId, summary }) => {
  // 'result' (containing needs_followup, followup_question) is received
  // but only 'summary' is spoken
  await this.manager.speak(callId, summary);
},
```

The full `result: SubagentResult` is passed to the callback but `followup_question` is silently
dropped. Sub-agents that return `needs_followup: true` with a question will never ask it.

**Fix options:**

- Speak `summary + " " + followup_question` when `needs_followup` is true.
- Expose a separate `onFollowupReady` hook for the caller to handle.
- Document this as intentional future work and add a TODO comment.

---

### 6. Concurrent `saveSessionStore` calls are not serialized

**File:** `async-subagent-broker.ts` (runJob try block and finally block)

When `maxConcurrency > 1`, multiple `runJob` calls run simultaneously and each does:

```
loadSessionStore → modify → saveSessionStore
```

If the session store is file-backed (which `loadCoreAgentDeps` resolves), concurrent writes are a
last-writer-wins race. A job that finishes earlier could have its cleanup overwritten by a job
that read the store before the first job wrote it.

This is an existing risk in the session store abstraction (not introduced by this PR), but this PR
is the first to create concurrent writers. The startup `reapOrphanedSessions` provides a safety
net, but orphaned entries can accumulate between restarts if the process crashes mid-job.

**Recommendation:** Either serialize session store updates with a per-broker mutex, or acknowledge
this risk in the broker's class-level JSDoc.

---

### 7. `reapOrphanedSessions` race with in-flight `runJob` finally blocks

**File:** `async-subagent-broker.ts:254-285` (reapOrphanedSessions)

If a job is completing at exactly the same moment as startup reaping:

1. Reaper reads store: sees `{voice-subagent:call:job: entry}`
2. Job's `finally` block reads store, deletes the entry, saves `{}`
3. Reaper overwrites with its modified snapshot: `{voice-subagent:call:job: entry}` restored

The entry is orphaned again until the next restart. The `maxAgeMs` filter (60s default) reduces
the risk window to entries older than 60 seconds, so this is unlikely in practice.

**Recommendation:** Call `reapOrphanedSessions` only after a delay (e.g., 5s) so any in-flight
finally blocks from previous crashes have a chance to complete before the reaper runs. Or use
a dedicated reaper key TTL in the store rather than wall-clock age.

---

## Pattern Improvements for Voice Calls

### 8. The broker has no way to signal backpressure to callers

When the broker is at `maxConcurrency` and the queue grows, `enqueue` silently accepts items.
Under a slow sub-agent (network/tool call), a rapid-speaking caller could accumulate a large queue
whose results all arrive after the call ends (they'll each be canceled when they run, but they
still consume memory).

**Recommendation:** Add a `listByCall` call in `enqueue` and reject (or log a warning) if a
call already has `maxPerCall` jobs queued (not just running):

```ts
// In broker.enqueue:
const existingForCall = this.store.listByCall(params.callId);
const activeForCall = existingForCall.filter((j) => j.state === "queued" || j.state === "running");
if (activeForCall.length >= this.maxPerCall) {
  console.warn(`[voice-call] Dropping delegation for ${params.callId}: at maxPerCall capacity`);
  return;
}
```

---

### 9. No deduplication of delegations from the foreground agent

**File:** `webhook.ts:443-455`

If the LLM returns duplicate delegation objects (same `specialist` + `goal`), all are enqueued.
This can happen when the LLM is uncertain or over-eager.

**Recommendation:** Deduplicate by `specialist + goal` before enqueuing:

```ts
const seen = new Set<string>();
for (const delegation of result.delegations) {
  const key = `${delegation.specialist}:${delegation.goal}`;
  if (seen.has(key)) continue;
  seen.add(key);
  this.subagentBroker.enqueue({ ..., delegation });
}
```

---

### 10. `repairPayload` is not guarded against being called on already-tiny payloads

**File:** `async-subagent-broker.ts:355-390`

The repair path is triggered when `normalizeSubagentResult(raw)` returns `null`. But if `raw` is
empty or a single word (e.g., `"done"`), the repair LLM call is wasteful and unlikely to help.

**Recommendation:** Only invoke repair when the raw payload has enough content to be worth
re-parsing (e.g., at least 20 characters and contains `{` or `"`):

```ts
if (!normalized && raw.trim().length > 20 && (raw.includes("{") || raw.includes('"'))) {
  this._metrics.repairAttempts += 1;
  // ...repair...
}
```

---

### 11. `speak()` can race with call teardown on the `onSummaryReady` → fallback path

**File:** `async-subagent-broker.ts:412-421`, `392-402`

If `onSummaryReady` throws because `manager.speak()` failed (e.g., TTS provider rejected the
call), the `catch` block invokes `speakFallbackIfActive`, which checks `isCallActive` and — if
true (the call manager hasn't yet removed the entry) — calls `onSummaryReady` again with the
fallback text. If the original `speak()` partially succeeded (audio was queued before the error),
the caller could hear both the original summary and the fallback.

**Recommendation:** Track whether `onSummaryReady` was already called successfully before
invoking the fallback, or have `onSummaryReady` swallow non-fatal errors from `speak()` (e.g.,
"call not found") instead of re-throwing them.

---

## Minor Nits

### 12. `FALLBACK_SPOKEN_SUMMARY` sets `needs_followup: true` with `followup_question: null`

**File:** `async-subagent-broker.ts:199`

```ts
const FALLBACK_SPOKEN_SUMMARY = "I am still checking that and will update you shortly.";
// ...
result: {
  summary: FALLBACK_SPOKEN_SUMMARY,
  confidence: 0,
  needs_followup: true,   // ← suggests a follow-up is coming
  followup_question: null, // ← but there's none
  artifacts: [],
},
```

Since issue #5 above means follow-up questions are never surfaced anyway, this is harmless today.
But if/when that is fixed, a fallback result with `needs_followup: true` and no question could
cause unexpected behavior. Set `needs_followup: false` for the fallback.

---

### 13. `VoiceCallSubagentConfigSchema` defaults `enabled: false` but is `.optional()` on the main schema

**File:** `config.ts`

```ts
subagents: VoiceCallSubagentConfigSchema.optional(),
```

Because `subagents` is optional (not `.default()`), `voiceConfig.subagents` can be `undefined`.
The broker creation guard `this.config.subagents?.enabled` handles this correctly, but the
config type makes it easy to accidentally dereference `subagents.maxConcurrency` without a null
check elsewhere. Consider either making it `.default({...})` (consistent with other optional
sub-schemas like `streaming`) or documenting that callers must null-check `subagents`.

---

## Overall Assessment

**Safe to merge?** Yes, with the two must-fix bugs addressed (items 1 and 2).

- The async job pump is correct: no runaway loops, `maxConcurrency` and `maxPerCall` are both
  enforced, and the `finally` block properly decrements counters.
- The normalization layer is robust and very well tested — the character-by-character trailing
  comma stripper and the string-aware comment stripper are particularly careful.
- The `reapOrphanedSessions` + `cancelCallJobs` safety nets mean that system state is always
  eventually cleaned up even on crash.
- The `toSafeSpokenSummary` truncation (320 chars) and control-character scrubbing are good
  defensive measures for TTS output.
- The `repairPayload` LLM fallback is time-boxed (4s) and correctly hoisted into the caller's
  `tempFiles` cleanup list.
- Disabling subagents (the default) leaves the existing code path completely unchanged except
  for the system prompt regression identified in issue #2.

**Priority fixes:**

1. Fix `canceled` metric count (issue #1) — observability accuracy
2. Guard `envelopePrompt` on `subagents?.enabled` (issue #2) — behavioral regression for all
   existing voice call users
3. Surface or document `needs_followup` / `followup_question` (issue #5) — currently dead code
