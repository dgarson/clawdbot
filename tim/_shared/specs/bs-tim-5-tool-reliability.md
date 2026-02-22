# BS-TIM-5 — Tool Reliability Layer

**Owner:** Tim / Roman
**Scope:** OpenClaw tooling invocation path (PI tools and plugin/tool adapters)
**Goal:** prevent duplicate or runaway tool executions under retries, client retries, reconnections, and transient dependency failures.

## 1) Architecture Spec

### 1.1 Tool execution contract

All tool invocations pass through a canonical envelope so reliability concerns can be implemented uniformly in one wrapper.

```ts
/** v1.1 */
export interface ToolCallEnvelope {
  contractVersion: "1.1";
  requestId: string;          // UUIDv7/ULID
  toolCallId?: string;        // LLM-visible id, preserved for observability
  toolName: string;
  toolNamespace: string;      // e.g. "agents.tools.messaging"
  target: {
    agentId?: string;
    sessionKey: string;
    actorId: string;          // user/account identifier
    workspaceId?: string;
    correlationId?: string;
    tenantId?: string;
  };
  payload: {
    version: "1.0";
    params: Record<string, unknown>;
    idempotencyKey?: string;
    callHints?: {
      safetyCritical?: boolean;
      expectedRetrySafe?: boolean;
      timeoutMs?: number;
    };
  };
  transport: {
    dedupeMode: "enforced" | "bestEffort" | "disabled";
    retryBudget: {
      maxAttempts: number;
      maxElapsedMs: number;
    };
    circuitBreakerHint?: "tool" | "dependency" | "global";
  };
  control: {
    deadlineAtMs?: number;
    requestTags?: string[];
    fromHook?: string;
  };
  trace: {
    traceparent?: string;
    baggage?: Record<string, string>;
  };
}

export interface ToolResultEnvelope {
  requestId: string;
  status: "success" | "error" | "retriable_error" | "retry_exhausted" | "circuit_open" | "timeout";
  fromCache: boolean;
  cache?: {
    matchedOn: "inflight" | "completed";
    ageMs: number;
    keyFingerprint: string;
  };
  toolName: string;
  durationMs: number;
  attempts: number;
  output?: {
    content: unknown;
    metadata?: Record<string, unknown>;
  };
  error?: {
    code: string;
    message: string;
    retriable: boolean;
    terminal: boolean;
    breakerState?: CircuitBreakerState;
  };
  retriedBy?: Array<{
    attempt: number;
    delayMs: number;
    reasonCode: string;
    latencyMs: number;
  }>;
}
```

### 1.2 Idempotency key model

#### Key derivation precedence

1. **Caller-provided `payload.idempotencyKey`** (highest priority).
2. **Hook-provided key** (if upstream caller already emits one).
3. **Computed key** only when fallback is needed:
   `sha256(toolNamespace + "::" + toolName + "::" + canonicalJson(payload.params) + "::" + sessionKey + "::" + actorId)`.

#### Canonicalization rules

- Sort object keys recursively.
- Convert equivalent values consistently (`-0`, `+0`, whitespace-insensitive strings, undefined removed).
- Do not include volatile fields (`clientTs`, `retryCount`, previous `traceparent`).

#### Key lifecycle

- `toolIdempotency` scope is **session-aware** by default: same key in a different session does **not** collide.
- Explicit override to `global` scope available only for intentionally safe read operations.
- `idempotencyKey` is always stored in dedupe store for 24h by default; short-lived in-flight locks are separate TTL (default 120s).

#### States

- `INFLIGHT`: request executing.
- `DONE`: request completed successfully.
- `FAILED`: request completed with classified retriable/terminal error.
- `CANCELLED`: caller-cancelled path; key is eligible for manual clear.

Duplicate handling behavior by state:

- `INFLIGHT`: if second caller with same key, return **in-flight marker** (wait for completion if `dedupeMode=enforced`; otherwise fast-fail with 409 semantics).
- `DONE`: return cached `output` with `fromCache=true`.
- `FAILED`: return cached error for same reason unless caller requested `dedupeMode=bestEffort` and the error was retriable.

### 1.3 Dedupe store model (non-breaking)

Use two-layer store with memory-first fallback:

- `DedupeStoreProvider` interface with implementations:
  - `InMemoryDedupeStore` (bounded LRU + periodic sweep)
  - `RedisDedupeStore` (primary)

Record shape (JSON serializable):

```ts
interface DedupeRecord {
  key: string;
  tool: string;
  idempotencyKey: string;
  state: "inflight" | "done" | "failed" | "cancelled";
  createdAtMs: number;
  updatedAtMs: number;
  expiresAtMs: number;
  ttlMs: number;
  request: {
    sessionKey: string;
    actorId: string;
    requestId: string;
    toolCallId?: string;
    paramsDigest: string;
  };
  execution?: {
    attemptCount: number;
    attempts: Array<{
      startedAtMs: number;
      finishedAtMs: number;
      status: "success" | "error";
      retriable: boolean;
      errorCode?: string;
    }>;
  };
  payload?: unknown;
  error?: {
    code: string;
    message: string;
    terminal: boolean;
    shouldRetriable: boolean;
  };
  lockUntilMs?: number;      // inflight short lease
  version: number;           // optimistic concurrency control
}
```

#### Store semantics

- `setIfNotExists` required for atomic claim of `INFLIGHT` key.
- `compareAndSet` with `version` for race-safe finalization.
- Optional `keyIndex` for per-session and per-tool retention sweeps.
- Background janitor: remove entries with `expiresAtMs < now` and optional hard cap eviction.

#### Capacity / TTL defaults

- In-memory fallback max keys: `25_000`
- Completed success TTL: `24h`
- Failed TTL: `5m`
- Inflight TTL: `2m`
- Redis TTL should mirror in-memory values by tool class.

### 1.4 Retry policy

#### Error classification

- **Retriable** by default:
  - Transport errors (`ETIMEDOUT`, `ECONNRESET`, DNS failure)
  - HTTP `408`, `429`, `500`, `502`, `503`, `504`
  - Tool-specific throttles as configured by adapter metadata
- **Non-retriable:**
  - `400`, `401`, `403`, `404`, `413`, `422`
  - Deterministic validation failures
  - Tool-level schema/authorization errors

#### Strategy

- Retry budget: configurable per tool, default `maxAttempts=4` (initial + 3 retries)
- Backoff: exponential with jitter
  - `delayMs = random(0, min(maxRetryDelayMs, baseMs * 2^attempt))`
  - baseMs default `200ms`
  - maxRetryDelay default `4000ms`
- Jitter cap: `full jitter` to avoid thundering herd.
- Retry deadline cap: default `30_000ms`
- Do **not** retry when breaker state is `OPEN`.
- Fail fast when retry budget or deadline exhausted: return `retry_exhausted`.

### 1.5 Circuit breaker state machine

A per-tool per-context breaker protects from cascading failures.

#### State machine

- `CLOSED`: normal forwarding.
- `OPEN`: fail-fast short-circuit; return `circuit_open`.
- `HALF_OPEN`: allow probing traffic.
- `FORCED_OPEN` (optional admin override): treat as `OPEN` until reset.

#### Transition rules

- `CLOSED` -> `OPEN` when **either** condition met in a rolling 120s window:
  1. `>= 5` consecutive failures (hard fail mode)
  2. `failureRate >= 50%` over last `20` calls with at least `10` measured calls
- `OPEN` -> `HALF_OPEN` after `openCooldownMs` elapses (default `30s`).
- `HALF_OPEN` allows **max1 concurrent probe** by default.
- `HALF_OPEN` -> `OPEN` on any failing probe.
- `HALF_OPEN` -> `CLOSED` when **2** consecutive successful probes occur (default), then resume normal tracking.
- `OPEN` -> `FORCED_OPEN` by admin `POST /debug/tool-reliability` or config override.
- Any manual reset transitions immediately to `CLOSED`.

#### Per-tool policy overrides

- Read-only tools: higher threshold (e.g. 8 consecutive failures, 20s cooldown) to avoid unnecessary dampening.
- Mutating tools: lower errorRate threshold, shorter cooldown.
- Optional `global circuit breaker` guard for runaway tool loops remains separate (already exists in loop detection paths).

### 1.6 Observability

#### Logs (JSON)

Emit structured fields at minimum:

- `event:tool_call_start|tool_call_end|tool_call_blocked|tool_call_retry|tool_call_circuit_state`
- `requestId`, `toolName`, `sessionKey`, `idempotencyKeyHash`, `correlationId`, `state`, `attempt`, `elapsedMs`, `fromCache`
- `errorCode`, `retriable`, `breakerState`

#### Metrics (Prometheus/OpenTelemetry)

- `openclaw_tool_calls_total{tool, status, scope}` counter
- `openclaw_tool_call_duration_ms_bucket{tool, status}` histogram
- `openclaw_tool_retry_attempts_total{tool, reason}` counter
- `openclaw_tool_idempotency_hits_total{tool, state}` counter
- `openclaw_tool_dedupe_cache_size{tool,scope}` gauge
- `openclaw_tool_dedupe_ttl_seconds{tool,state}` gauge/summary
- `openclaw_tool_circuit_breaker_state{tool,state}` gauge
- `openclaw_tool_circuit_breaker_transitions_total{tool,from_state,to_state}` counter

#### Tracing

- `tool_execution` span around wrapper.
- child spans for retry delays and downstream network dependencies.
- attach key attrs: `tool.name`, `idempotency.key`, `retry.attempt`, `breaker.state`.

#### Alert/SLO examples

- P95 tool latency > 2.5s for 5m for read tools.
- Open-then-open ratio spike in 15m window (possible outage/proxy failure).
- Dedupe cache hit ratio sustained < 40% for retry-heavy operations (possible key fragmentation).
- INFLIGHT stale record ratio > 1% (stuck execution leaks).

## 2) Implementation Plan (phased)

### Phase 0 — Contract stabilization (non-breaking)

- Define contract interfaces + JSON schema in shared module (pure types, no behavior changes).
- Add enum/types for retry class and breaker state.
- Add config defaults and validation for tool reliability (global + per-tool override).

**Deliverables:**
- `src/agents/tool-reliability/types.ts`
- `src/config/types.tools.ts` + schema extensions
- no runtime behavior changes yet

### Phase 1 — Dedupe core + adapter abstraction

- Implement `DedupeStore` interface + `InMemoryDedupeStore`.
- Add deterministic key derivation + envelope hashing utility.
- Implement `runWithToolIdempotency(...)` helper.
- Hook it through existing `runBeforeToolCallHook` as no-op by default.

**Deliverables:**
- `src/agents/tool-reliability/dedupe.ts`
- `src/agents/tool-reliability/key-derivation.ts`
- `src/agents/pi-tools.before-tool-call.ts` integration (feature-flagged)

### Phase 2 — Retry + breaker wrapper

- Implement retry policy executor and circuit breaker state machine service.
- Add breaker metrics and state store persistence.
- Wrap tool execution path in optional `ToolReliabilityMiddleware`.
- Add `toolCallErrorClassifier` with explicit lists.

**Deliverables:**
- `src/agents/tool-reliability/retry.ts`
- `src/agents/tool-reliability/circuit-breaker.ts`
- `src/agents/tool-reliability/executor.ts`

### Phase 3 — Observability + storage hardening

- Connect OpenTelemetry metrics/logging events.
- Add optional Redis provider behind interface; keep in-memory as default for local/dev.
- Add background janitor and stale-record cleanup.
- Add operational commands/API for manual breaker reset/flush.

**Deliverables:**
- `src/infra/observability/tool-reliability.*`
- `src/agents/tool-reliability/store-redis.ts`
- admin command surface + docs

### Phase 4 — Rollout, controls, and hardening

- Shadow mode rollout first: compute and log outcomes only.
- Enable for read-only safe tools.
- Enable for mutating tools with conservative thresholds.
- Post-launch tuning window with default metrics-driven thresholds.
- Add runtime kill switch: `TOOL_RELIABILITY_ENABLED=false` to bypass wrapper.

**Deliverables:**
- config toggles
- release notes and migration notes
- post-change runbook entry

## 3) Acceptance Test Matrix (minimum)

| ID | Component | Scenario | Inputs | Expected | Non-regression check |
|---|---|---|---|---|---|
| TR-1 | Contract | Envelope validation rejects malformed payload | Missing `toolName`, bad `contractVersion` | Immediate validation error (terminal), no retries, no dedupe record created | valid call still executes |
| TR-2 | Idempotency | Duplicate call before first completes (`INFLIGHT`) | First call sleeps 5s; second arrives same key and `dedupeMode=enabled` | Second waits/returns in-flight marker, not duplicate tool execution | normal duplicate non-blocking for disabled mode |
| TR-3 | Idempotency | Duplicate call after completion | same key + session | second receives cached result, `fromCache=true` | payload digest unchanged |
| TR-4 | Idempotency | Duplicate call with same idempotency key but different params fingerprint | payload differs |
|  |  |  |  | key mismatch forced; treated as independent key or invalid conflict depending policy; no false dedupe | no unexpected cache collisions |
| TR-5 | Retry | Retriable transport error | first attempt timeout, next success | exactly 3 attempts (default), exponential jitter observed, final success | success path still returns in one attempt when stable |
| TR-6 | Retry | Terminal 400 error | returns 400 | no retries, one attempt, error returned with `terminal=true` | 4xx from normal path unchanged |
| TR-7 | Retry | Retry budget exhaustion | repeated 503 with always failing stub | `retry_exhausted`, attempts capped, breaker sees failures | no hanging or unbounded delay |
| TR-8 | Breaker | Consecutive failures -> OPEN | 5 failing mutations | state becomes OPEN; next call fail-fast with `circuit_open` <=10ms | successful call after OPEN remains blocked |
| TR-9 | Breaker | Recovery after cooldown | after OPEN cooldown period single success probe | HALF_OPEN probe succeeds twice -> CLOSED | request latency and success recover post probe |
| TR-10 | Breaker | Probe failure in HALF_OPEN | one failing probe from HALF_OPEN | state returns OPEN and cooldown timer reset | previous success path unaffected |
| TR-11 | Cross-cutting | Circuit breaker + retries interplay | endpoint fails with 503 | no retry when breaker OPEN; retries only when CLOSED/HALF_OPEN | no retry storms during full outage |
| TR-12 | Hooks | Existing before/after tool hooks still fire | plugin registered for tool hook | hooks execute exactly once per attempt, and once for short-circuit paths | baseline hook tests unchanged |
| TR-13 | Observability | Metrics emitted for all transitions | call path includes success/retry/fail/open | counters + labels updated; transition logs emitted | metric cardinality bounded |
| TR-14 | Admin control | Toggle disable | set `TOOL_RELIABILITY_ENABLED=false` and issue call | goes direct no wrapper, behavior identical to baseline | safe rollback path works |
| TR-15 | Security | Sensitive fields redaction | params include token-like strings | logs do not persist raw secrets; no PII leaks | existing redaction tests unchanged |

## 4) Minimal non-breaking scaffolding/tests (hooks-aware)

Given existing tool hook surfaces (`runBeforeToolCallHook`, `wrapToolWithBeforeToolCallHook`, plugin runtimes), add these **safe skeleton tests first** before behavior implementation:

- `src/agents/tool-reliability.scaffold.test.ts`
  - `it.todo` matrix for idempotency, retry, breaker, and hook-interaction.
  - Keeps CI green while the contract/adapter is added.
- `src/plugins/hooks.phase-hooks.test.ts` (optional extension)
  - verifies hook metadata path can carry reliability hints without changing existing contracts.
- `src/agents/pi-tools.before-tool-call.test.ts`
  - add one **non-breaking** assertion: wrapper leaves params unchanged when reliability disabled.

These tests are intentionally minimal so the first implementation pass is non-breaking and allows incremental hardening.

## 5) Risk register

| Risk | Severity | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Key collisions from unstable canonicalization | High | Medium | Incorrect dedupe and stale replay | Strict canonicalization tests; include conflict alarm when same key maps to different canonicalized payloads |
| False sharing across contexts (session/workspace mismatch) | Medium | Medium | User sees wrong cached result | Key scope includes session+actor; explicit scope controls documented and versioned |
| Retry storms during broad platform error | High | High | Increased load and latency | Exponential + jitter + breaker short-circuit; half-open probes limited |
| Cache growth/memory pressure in fallback store | Medium | Medium | OOM in dev or isolated nodes | Hard cap + TTL + janitor + stale eviction + backpressure logs |
| Backward-compatibility regressions in hook order | High | Low | Tool hooks stop executing or double-call | Keep wrapper around existing hook pipeline and gate by feature flag; maintain full parity tests |
| Misclassified retryable errors | Medium | Medium | Data corruption/retries on non-idempotent operations | Explicit allowlist/denylist and per-tool override + audit logs |

## 6) Rollback plan

### Automatic rollback path

1. Set `TOOL_RELIABILITY_ENABLED=false` (or remove feature flag for zero-diff fallback).
2. This bypasses reliability wrapper and restores direct tool invocation order.
3. Keep all existing hook flow unchanged (`runBeforeToolCallHook`/`runAfterToolCallHook`) for immediate continuity.

### Manual rollback steps

1. Keep last-known-good commit available in megabranch.
2. Disable breaker enforcement by setting:
   - `TOOL_RELIABILITY_OPEN_MODE=off`
   - `TOOL_RELIABLE_DERIVE_IDEMPOTENCY=off`
3. Force-flush dedupe/ breaker state for incident scope via admin command (or Redis key prefix delete).
4. Restart affected gateway/runtime pods with clean config.

### Recovery validation after rollback

- Tool success/error mix should match pre-release behavior within 1 run window.
- Alert on breaker transitions should flatten to zero within 5 minutes.
- Re-enable in **staged** mode once root-cause instrumentation is completed.

## Artifact output

Primary artifact for this fallback task:
- `/Users/openclaw/.openclaw/workspace/tim/_shared/specs/bs-tim-5-tool-reliability.md`

