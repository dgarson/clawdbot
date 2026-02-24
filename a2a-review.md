# A2A Protocol Critical Review (Agent-Focused)

This review focuses on what is truly enforceable in code/runtime (high confidence) versus guidance that remains prompt-level policy.

## High-confidence strengths

1. **Strong structural validation coverage**
   - Envelope + payload schemas cover all defined message types with required fields and `additionalProperties: false` on payload-level schemas.
   - Semantic guards catch key cross-field rules (`task_response.reason` when declined/failed/blocked; unresolved concerns required for `changes_requested`).

2. **Operational protections exist at the routing layer**
   - Per-sender rate limiting and pair/correlation loop controls are implemented and tested.
   - Self-send is blocked by default.

3. **Auditability baseline is good**
   - JSONL append with in-process per-file serialization, plus query support and file rotation logic.

4. **Cross-agent access policy is explicit**
   - Session tooling checks combine visibility + allowlist policy before allowing cross-agent operations.

## Highest-impact gaps (ordered)

### 1) Envelope allows unknown top-level fields (enforceability gap)

- Current validator manually checks known envelope keys but does not reject unknown top-level keys.
- Impact: protocol drift and hidden payload-adjacent data can enter routing/audit undetected.
- Why this matters for “95% enforceable”: if unknown fields are accepted, the protocol contract is not closed.

### 2) `timestamp` is not validated as an actual ISO datetime

- Validation only checks non-empty string for envelope timestamp.
- Impact: ordering/filter semantics and forensic confidence degrade if timestamps are malformed.

### 3) SDK construction path is not guaranteed to validate before send

- SDK send helpers construct typed objects but do not run runtime validation before invoking `sendFn`.
- Router validation is optional (`validate?`), and without it, router trusts input.
- Impact: in-process producers can emit structurally invalid messages without a hard fail.

### 4) Ping-pong A2A flow is prompt-constrained, not protocol-constrained

- Conversation stop behavior relies on exact sentinel strings (`REPLY_SKIP`, `ANNOUNCE_SKIP`) in model output.
- Impact: behavior is probabilistic, not deterministic; easy to bypass unintentionally.

### 5) Correlation tracking can grow until pruned

- Correlation map retention depends on explicit prune/clear usage.
- Impact: long-lived process memory growth risk unless prune is scheduled/invoked.

## Strong vs weak suggestion rubric (for agent behavior)

### Strong suggestions (generally enforceable at 95%+)

A suggestion is strong when it can be checked by **deterministic code** in one of these places:

- Schema/validator hard constraints.
- Router policy gates (allow/deny, counters, cooldowns).
- Tool-level guardrails that return explicit forbidden errors.
- CI/test assertions that fail builds.

Examples in this codebase:

- “Cross-agent send must be denied unless `tools.agentToAgent.enabled=true` and allowlist passes.”
- “`task_response` with action `declined` must include non-empty reason.”

### Weak suggestions (not enforceable at 95%)

A suggestion is weak when success depends on LLM compliance or prose interpretation:

- Prompt-instruction-only behavior (“reply exactly token X”).
- “Should” language without a validator/router/tool gate.
- Human convention fields not machine-validated (`reviewLevel`, `authorTier` free-form semantics).

Examples in this codebase:

- Ping-pong termination via exact token response.
- Rich quality guidance in message text without machine checks.

## Concrete improvement plan (prioritized by enforceability gain)

1. **Add strict envelope schema with `additionalProperties: false`**
   - Validate envelope using AJV (or equivalent) instead of manual field-only checks.
   - Include `required` list and explicit field types/formats.

2. **Validate datetime format for `timestamp` and optional date-like fields**
   - Add AJV formats and enforce RFC3339/ISO8601 checks.

3. **Make router validation non-optional in production path**
   - Keep test-only bypass behind explicit test harness.
   - If validation is absent, router should fail closed (not trust input).

4. **Add SDK pre-send validation toggle defaulting ON**
   - Validate every built message before calling `sendFn`.
   - Expose explicit escape hatch for tests only.

5. **Replace prompt-token termination with bounded deterministic orchestration**
   - Keep max turns hard-capped (already present), but remove dependency on model emitting exact skip tokens for critical safety behavior.
   - Use tool-side state transitions to stop/continue.

6. **Schedule prune for limiter/circuit-breaker state in long-running gateway**
   - Ensure periodic cleanup to cap memory growth.

## Enforceability scorecard

- **Schema-level field presence/enums/types**: High (95%+) once envelope is strict.
- **Cross-field semantics currently coded**: High (95%+) for the specific rules implemented.
- **Routing safety (rate/circuit/self-send)**: High (95%+) for covered paths.
- **Agent conversational discipline via prompts**: Medium/Low (<95%).
- **Free-form review quality expectations**: Low (<95%) unless converted into structured required fields + validators.

## Bottom line

The A2A foundation is solid and already above average on structure + safety + tests. The biggest enforceability delta is to **close the envelope contract, make validation mandatory in production routing, and move any critical behavior from prompt text into tool/router state machines**.
