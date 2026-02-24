# A2A Protocol PR — Critical Review

## Summary

The A2A protocol adds a structured agent-to-agent messaging layer across 5 workstreams: schema/types/validator, message router, SDK, audit logging, and integration tests — plus an ACP handoff skill. The architecture is well-separated, thoroughly tested, and the existing `a2a-review.md` already identifies several real gaps. This review builds on that foundation with specific, actionable findings.

## Overall Assessment

**Strengths**: Clean module boundaries, good test coverage, solid separation of concerns, type-safe discriminated union for messages. The protocol is thoughtfully designed for the task/review lifecycle.

**Primary risk**: Several enforceability gaps where the protocol _appears_ to guarantee things it doesn't actually enforce at runtime.

---

## Critical Issues

### 1. Envelope validation does not reject unknown top-level fields

**File**: `src/gateway/a2a/validator.ts:93-222`

The `validateEnvelope` function manually checks each known field but has **no guard against extra top-level keys**. A message with `{ ...validFields, _secret: "payload" }` passes validation silently. This undermines the `additionalProperties: false` discipline applied to all payload schemas.

**Fix**: Either use AJV for the full envelope (like payloads), or add an explicit allowlist check:

```ts
const KNOWN_ENVELOPE_KEYS = new Set([
  "protocol", "messageId", "timestamp", "from", "to",
  "type", "priority", "correlationId", "payload",
]);
const unknownKeys = Object.keys(obj).filter(k => !KNOWN_ENVELOPE_KEYS.has(k));
if (unknownKeys.length > 0) {
  errors.push({
    path: "/",
    message: `Unknown top-level field(s): ${unknownKeys.join(", ")}`,
    rule: "additionalProperties",
  });
}
```

### 2. `timestamp` accepts any non-empty string

**File**: `src/gateway/a2a/validator.ts:127-139`

The validator only checks that `timestamp` is a non-empty string. `"not-a-date"` passes validation. This corrupts audit log ordering, query filtering (the `since`/`until` filters in `audit-query.ts:75-81` do string comparison), and forensic integrity.

**Fix**: Add ISO 8601 format validation. At minimum:
```ts
if (isNaN(Date.parse(input.timestamp))) {
  errors.push({ path: "/timestamp", message: "timestamp must be a valid ISO 8601 datetime", rule: "format" });
}
```

Also consider validating `deadline`, `estimatedCompletion`, and other date-like optional fields in payloads.

### 3. SDK sends messages without validation

**File**: `src/gateway/a2a/sdk.ts:88-93`

The `send()` function dispatches directly to `sendFn` without running the validator. The SDK constructs messages from typed TypeScript, so structural issues are unlikely — but semantic rules (e.g., `task_response` with `action: "declined"` requires `reason`) are **not enforced at construction time**. An agent building:

```ts
await sendTaskResponse({
  to: bobRef,
  payload: { taskId: "t1", action: "declined" },  // missing reason
});
```

...will emit an invalid message. The router _may_ catch this if `validate` is configured, but that's optional.

**Fix**: Validate before send, or at minimum add semantic checks in each builder function. The simplest path: import `validateA2AMessage` and call it in `send()`, throwing on invalid.

### 4. Router validation is optional — fails open

**File**: `src/gateway/a2a/router.ts:135-138`

When no `validate` function is provided, the router casts unknown input to `A2AMessage` with a comment acknowledging this is "dangerous". In production, this should fail closed.

```ts
// No validator — trust the input (dangerous, but allows incremental integration)
message = input as A2AMessage;
```

**Fix**: Make `validate` required, or default to `validateA2AMessage` from the validator module. If you truly need a bypass for testing, use an explicit `{ unsafeSkipValidation: true }` flag.

### 5. `A2AMessageLike` in audit duplicates `A2AMessage` — will drift

**File**: `src/gateway/a2a/audit-types.ts:14-24`

The audit system defines its own `A2AMessageLike` interface rather than importing `A2AMessage` from `types.ts`. The comment says "when Workstream A types are integrated, this can be replaced" — but this PR merges all workstreams together. The two interfaces can now drift silently.

**Fix**: Import and use `A2AMessage` from `./types.js` directly. If the audit module needs to accept slightly looser input, use `Pick<A2AMessage, ...>` or a mapped type that stays tethered to the source of truth.

---

## Moderate Issues

### 6. Module-scoped mutable singletons in SDK

**File**: `src/gateway/a2a/sdk.ts:44,79`

`currentContext` and `sendFn` are module-level mutable singletons. In a multi-agent gateway process (or test parallelism), one agent's `initA2ASDK` call overwrites another's context. The integration tests already work around this via `impersonate()` that resets/re-inits between steps — but this pattern is fragile in production.

**Fix**: Return an SDK _instance_ from a factory function rather than using global state:
```ts
function createA2ASDK(context: AgentContext, sendFn: SendFn) {
  return { sendTaskRequest(...), sendTaskResponse(...), ... };
}
```

### 7. No `half-open` state in circuit breaker

**File**: `src/gateway/a2a/circuit-breaker.ts:78-89`

The circuit breaker transitions from `open` directly to `closed` when the cooldown expires. Standard circuit breaker patterns include a `half-open` state that allows a probe message through before fully closing. Without this, a transient storm that tripped the breaker will resume at full throughput the instant the cooldown expires, potentially retripping immediately.

### 8. Correlation tracker memory is unbounded between prunes

**File**: `src/gateway/a2a/circuit-breaker.ts:53,92-104`

The `correlations` map grows with every unique correlationId. Pruning uses `windowMs * 10` as a heuristic (line 168), which is 10 minutes by default. In a high-traffic gateway, this map could grow significantly. There's no `maxSize` cap, and `prune()` is never called automatically — it requires external scheduling.

**Fix**: Either add a size cap with LRU eviction, or auto-prune in `check()` when the map exceeds a threshold (e.g., every 1000 entries, prune expired).

### 9. Rate limiter window model is approximate

**File**: `src/gateway/a2a/rate-limiter.ts:48-55`

The rate limiter uses fixed windows (resets completely when the window expires). An agent can send `maxPerWindow` messages at the end of one window and `maxPerWindow` more at the start of the next, effectively doubling the rate over a short period. A sliding window or token bucket would be more accurate.

Not necessarily a bug — fixed windows are common — but worth documenting as a known limitation.

### 10. `resolveLogFile` has an unbounded loop

**File**: `src/gateway/a2a/audit.ts:68-82`

The `while (true)` loop in `resolveLogFile` increments the file index forever until it finds a file under the size limit. If the filesystem is corrupted or something keeps creating oversized files, this loops indefinitely. Add a max iteration guard (e.g., 1000 rotations per day should be more than enough).

### 11. Audit query loads all matching entries into memory

**File**: `src/gateway/a2a/audit-query.ts:127-136`

`queryA2ALog` reads all entries from all relevant log files into `allMatching[]` before applying `limit`/`offset`. With 50MB log files, this could load hundreds of thousands of entries. The pagination gives the _appearance_ of efficiency without the reality.

**Fix**: Stream/scan entries and stop after reaching `offset + limit` matches, discarding entries beyond the page. For `totalCount`, you'd need a separate scan or accept an approximate count.

---

## Minor / Style Issues

### 12. Spec path references a local machine path

**Files**: All `src/gateway/a2a/*.ts` and `test/a2a/*.ts`

Every file header references:
```
Spec: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md
```

This is a local machine path that doesn't exist for other contributors. Either include the spec in the repo, or reference it by a portable path/URL.

### 13. Duplicate test: "accepts null correlationId" appears twice

**File**: `test/a2a/validator.test.ts:323-327` and `test/a2a/validator.test.ts:335-339`

The test "accepts null correlationId" is defined twice (lines 323 and 335). The second occurrence should be removed.

### 14. `parseA2AMessage` is too lenient

**File**: `src/gateway/a2a/sdk.ts:231-246`

`parseA2AMessage` checks `protocol`, `type`, and `payload` but doesn't check `from`, `to`, `messageId`, `timestamp`, or `priority`. It then casts to `A2AMessage`, giving callers a false sense of type safety. The doc says "lightweight check" but callers may assume more.

### 15. `agentRefSchema` allows `additionalProperties` by omission

**File**: `src/gateway/a2a/schema.ts:24-33`

`agentRefSchema` has `additionalProperties: false`, which is good — but only when used as a standalone schema. When spread into the envelope's manual validation (validator.ts), the AJV validation of `from`/`to` enforces this, but nothing prevents extra fields on the envelope object _around_ `from`/`to`. This ties back to issue #1.

### 16. Type assertion in `deriveCorrelationId`

**File**: `src/gateway/a2a/sdk.ts:267`

```ts
return (originalMessage.correlationId as string) ?? originalMessage.messageId;
```

`correlationId` is typed as `string | null | undefined`. The `as string` cast suppresses the `null` case — but `??` already handles `null`. The cast is unnecessary and slightly misleading. Just:
```ts
return originalMessage.correlationId ?? originalMessage.messageId;
```

### 17. `sendBroadcast` hardcodes wildcard `to` but broadcast schema doesn't validate the recipient

Broadcasts use `{ agentId: "*", role: "*" }` as the `to` field, but nothing in the validator or schema requires this for `broadcast` messages. An agent could construct a broadcast with a specific `to` target and it would pass validation. If wildcarding is a protocol requirement for broadcasts, enforce it in semantic validation.

---

## Test Coverage Notes

- **Good**: All 7 message types have positive and negative validation tests. Router pipeline (validate → self-send → rate-limit → circuit-breaker → deliver → audit) is well-tested. E2E tests cover realistic multi-agent flows.
- **Missing**: No tests for unknown envelope fields passing through (ties to issue #1). No tests for malformed timestamps. No test for SDK sending semantically invalid messages (ties to issue #3). No concurrent test for the SDK singleton issue (#6).
- The `a2a-review.md` file at root (from PR #119) is a good self-assessment but is a review document, not code or docs — consider whether it belongs in the repo long-term or should be a PR comment/issue.

---

## ACP Handoff Skill

The ACP handoff skill (`skills/acp-handoff/SKILL.md`) is well-documented with clear usage, shell scripts, tier config, and SQLite schema. A few notes:

- **No A2A integration**: The handoff skill uses `sessions_send` directly rather than A2A protocol messages. If A2A is the intended inter-agent protocol, the handoff workflow should emit `review_request`/`review_response` A2A messages rather than bypassing the protocol.
- The `docs.acp.md` at root describes the ACP _bridge_ (IDE-to-Gateway), which is separate from A2A. These should not be conflated — the naming overlap between "ACP" (Agent Client Protocol for IDEs) and A2A (agent-to-agent protocol) could confuse contributors.

---

## Recommendations (Priority Order)

1. **Close the envelope contract** — reject unknown top-level fields (#1)
2. **Validate timestamps as ISO 8601** (#2)
3. **Make router validation required** or default to the validator (#4)
4. **Add pre-send validation to the SDK** (#3)
5. **Replace `A2AMessageLike` with actual `A2AMessage` import** (#5)
6. **Add prune scheduling or size caps** for circuit breaker/rate limiter state (#8)
7. **Add `resolveLogFile` loop guard** (#10)
8. **Consider streaming for audit queries** as log volumes grow (#11)
9. **Refactor SDK away from module singletons** before multi-agent use (#6)

The foundation is strong. The biggest delta to "production-ready" is closing the gaps where the protocol _claims_ to enforce things but doesn't at runtime.
