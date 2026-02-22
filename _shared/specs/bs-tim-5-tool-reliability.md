# Tool Reliability Layer: Contracts, Idempotency, and Circuit Breakers

## 1. Architecture Spec

### 1.1. API/Tool Contract Schema
All tool calls must adhere to a strict interface contract to guarantee safe observability and consistent handling.
- **Request Envelope:**
  - `toolId` (string)
  - `executionId` (string, UUIDv4) - uniquely identifies this attempt
  - `idempotencyKey` (string, optional) - user or caller-provided deduplication key
  - `payload` (JSON object) - strict validation via Zod schemas
  - `metadata` (object) - caller info, trace ID, timestamp

- **Response Envelope:**
  - `status` (success | error | timeout | circuit_open)
  - `data` (JSON object, optional)
  - `error` (code, message, retriable flag)
  - `durationMs` (number)
  - `fromCache` (boolean) - true if served from dedupe store

### 1.2. Idempotency Key Strategy
- **Generation:** If a caller omits an `idempotencyKey` for mutating tools, a hash of `toolId + canonicalized(payload) + callerId + temporal_window(1h)` is generated.
- **Lifecycle:**
  - `PENDING`: The tool call is actively executing. Subsequent requests block or fail fast depending on configuration.
  - `COMPLETED`: The execution succeeded. The result is cached.
  - `FAILED`: Execution failed. Cached to prevent tight-loop retries, but allows manual or delayed retry.

### 1.3. Dedupe Store Model
- **Storage:** Redis (primary) or an in-memory fallback (e.g., Map) for local/dev.
- **Data Structure:**
  - Key: `idemp:{toolId}:{idempotencyKey}`
  - Value: `{ status, result?, error?, expiresAt }`
- **TTL:** Configurable per tool, default to 24 hours.

### 1.4. Retry Policy
- **Strategy:** Exponential backoff with jitter.
- **Thresholds:**
  - Max retries: 3 (default)
  - Initial delay: 500ms
  - Max delay: 5000ms
- **Condition:** Only retry on `retriable=true` errors (e.g., 429, 502, 503, 504, network timeouts). Never retry 400s or non-idempotent failed mutations without a strong idempotency guarantee.

### 1.5. Circuit Breaker States & Thresholds
Maintains stability when external services degrade.
- **States:**
  - `CLOSED`: Normal operation.
  - `OPEN`: Failing fast, rejecting calls immediately.
  - `HALF_OPEN`: Testing recovery with a single trial request.
- **Thresholds:**
  - `failureThreshold`: 5 consecutive failures or 50% failure rate over 100 requests.
  - `resetTimeout`: 30 seconds before transitioning to `HALF_OPEN`.
  - `halfOpenConcurrency`: 1 request allowed.

### 1.6. Observability
- **Metrics (Prometheus/StatsD):**
  - `tool_execution_total{tool, status}`
  - `tool_duration_seconds{tool}`
  - `circuit_breaker_state{tool, state}`
  - `idempotency_cache_hits_total{tool}`
- **Tracing (OpenTelemetry):**
  - Spans for `tool_execution` wrapping the raw handler.
  - Trace ID propagation to downstream HTTP calls.
- **Logging:** Structured JSON logging on errors and state transitions.

---

## 2. Implementation Plan

### Phase 1: Core Primitives (Scaffolding)
- Implement `CircuitBreaker` class.
- Implement `IdempotencyManager` interface and in-memory provider.
- Implement `RetryPolicy` utility.
- Add unit tests for all primitives.

### Phase 2: Middleware / Interceptor Integration
- Create a `ToolReliabilityWrapper` that wraps existing tool execution handlers.
- Wire in Idempotency -> Circuit Breaker -> Retry -> Execution.

### Phase 3: Redis Dedupe Store & Observability
- Implement Redis-backed `IdempotencyStore`.
- Emit metrics and tracing spans.

### Phase 4: Gradual Rollout
- Enable in shadow-mode (logging only).
- Enable for non-critical, read-only tools.
- Enable for critical mutating tools.

---

## 3. Test Matrix

| Component | Scenario | Expected Behavior |
| --- | --- | --- |
| CircuitBreaker | 5 consecutive failures | Transitions to OPEN, subsequent calls fail fast |
| CircuitBreaker | Timeout expires | Transitions to HALF_OPEN, allows 1 test call |
| Idempotency | Duplicate concurrent request | Second request waits or returns PENDING |
| Idempotency | Duplicate sequential request | Returns cached result, `fromCache=true` |
| Retry | Network timeout (retriable) | Retries up to 3 times with backoff |
| Retry | 400 Bad Request (non-retriable)| Fails immediately without retry |

---

## 4. Risk Log & Rollback Plan

### Risks
1. **Cache Poisoning/Stale Data:** A bug in idempotency keys could return wrong data to users.
   *Mitigation:* Strict hashing, UUIDv4 namespacing by caller, easy CLI/UI flush mechanism.
2. **Circuit Breaker Deadlock:** An improperly configured breaker might stay OPEN permanently.
   *Mitigation:* Expose administrative overrides (`openclaw tool circuit-breaker reset <tool>`).
3. **Memory Leaks:** In-memory dedupe store growing unbound.
   *Mitigation:* Strict LRU and TTL enforcement.

### Rollback Plan
- The `ToolReliabilityWrapper` will be guarded by a feature flag `TOOL_RELIABILITY_ENABLED` (default: false).
- In case of critical failure, set `TOOL_RELIABILITY_ENABLED=false` via environment variable or platform config. The system falls back to direct raw tool execution.
