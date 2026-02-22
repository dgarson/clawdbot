# UTEE — Unified Tool Execution Envelope

**RFC Draft** | Created: 2026-02-21 | Author: Larry (subagent)

---

## 1. Problem Framing

OpenClaw agents invoke tools through heterogeneous interfaces. Each tool type (exec, browser, message, etc.) has its own calling convention, error handling, and observability characteristics. This creates friction:

- **Inconsistent error handling:** Some tools throw, some return error objects, some silently fail
- **No unified retry semantics:** Each agent must implement its own backoff/retry logic
- **Observability gaps:** Tracing tool calls across sessions requires manual correlation
- **No capability negotiation:** Agents can't discover tool features at runtime
- **Streaming inconsistency:** Some tools support streaming, others don't; no standard way to express this
- **Testing friction:** Mocking tools requires per-tool mocking infrastructure

**UTEE Goal:** Wrap all tool invocations in a standardized envelope that provides consistent structure for request metadata, response handling, error propagation, retries, and observability—without requiring changes to existing tool implementations.

---

## 2. Envelope Schema

### 2.1 Request Envelope

```yaml
ToolRequest:
  # Core fields (required)
  tool: string              # Tool name, e.g., "exec", "browser"
  action: string            # Action within tool, e.g., "act", "navigate"
  params: object            # Original tool parameters (passthrough)

  # Metadata (optional, defaults applied)
  requestId: string         # UUID for correlation (auto-generated if absent)
  idempotencyKey: string    # Optional; enables safe retries
  timeout: number           # Milliseconds; overrides tool default
  priority: "low" | "normal" | "high"  # Hint for scheduling

  # Observability
  traceId: string           # Distributed trace ID (propagated)
  spanId: string            # Current span ID
  parentSpanId: string      # Parent span for nesting

  # Hints (advisory, tools may ignore)
  hints:
    preferStreaming: boolean    # Prefer streaming response if available
    cacheKey: string            # Optional cache key for idempotent reads
    retryPolicy: RetryPolicy    # Override default retry behavior
```

### 2.2 Response Envelope

```yaml
ToolResponse:
  # Core fields
  requestId: string         # Echoes request ID
  status: "success" | "error" | "partial"  # partial = streaming in progress

  # Result payload
  result: any               # Tool-specific result on success
  error:                    # Present only on error
    code: string            # Machine-readable error code
    message: string         # Human-readable message
    retryable: boolean      # Is this error retriable?
    details: object         # Additional context

  # Metadata
  durationMs: number        # Wall-clock execution time
  toolVersion: string       # Tool implementation version

  # Observability
  spanId: string            # Span ID for this execution
  emittedSpans: string[]    # Child spans created during execution

  # Streaming support
  isStreaming: boolean      # True if more chunks will follow
  chunkIndex: number        # 0-indexed for multi-chunk responses
  finalChunk: boolean       # True on last chunk
```

### 2.3 Retry Policy Schema

```yaml
RetryPolicy:
  maxAttempts: number       # Default: 3
  initialDelayMs: number    # Default: 100
  maxDelayMs: number        # Default: 5000
  backoffMultiplier: number # Default: 2.0
  jitterPercent: number     # Default: 20 (adds randomness)
  retryableErrors: string[] # Error codes to retry; empty = all retryable
```

---

## 3. Retry & Idempotency Semantics

### 3.1 Idempotency Keys

- **Purpose:** Allow safe retries without duplicate side effects
- **Scope:** Keys are scoped per-session; global scope optional
- **TTL:** 24 hours default; configurable
- **Behavior:**
  - If tool receives duplicate `idempotencyKey`, return cached response if available
  - Tools opt-in to idempotency support via capability flag
  - Adapter layer handles caching for non-idempotent-aware tools

### 3.2 Retry Behavior

**Default Retry Policy:**
- 3 attempts total
- Exponential backoff: 100ms → 200ms → 400ms
- 20% jitter to avoid thundering herd
- Max delay cap: 5 seconds

**Retriable Conditions:**
- Network timeouts
- 5xx-equivalent errors (tool unavailable)
- Rate limit errors (429-equivalent) with `Retry-After` hint

**Non-Retriable:**
- Validation errors (400-equivalent)
- Auth errors (401/403-equivalent)
- Explicit `retryable: false` in error response

**Agent Override:**
Agents can provide custom `RetryPolicy` per-request. Tools may ignore if they have internal retry logic.

---

## 4. Observability Fields

### 4.1 Distributed Tracing

Every tool call participates in a trace:

- `traceId`: Correlates calls across agents, sessions, and tools
- `spanId`: Unique per tool invocation
- `parentSpanId`: Links to caller's span (enables call graphs)

**Integration:** Compatible with OpenTelemetry semantic conventions. Adapter layer can emit OTLP spans.

### 4.2 Structured Logging

Adapter emits structured logs for each tool call:

```json
{
  "timestamp": "2026-02-21T11:20:00.000Z",
  "level": "info",
  "event": "tool_invocation",
  "requestId": "abc123",
  "traceId": "trace-456",
  "tool": "exec",
  "action": "run",
  "durationMs": 1523,
  "status": "success"
}
```

### 4.3 Metrics

Standard metrics emitted by adapter:

- `tool.invocation.count` — Counter by tool, action, status
- `tool.invocation.duration` — Histogram by tool, action
- `tool.retry.count` — Counter by tool, error code
- `tool.error.count` — Counter by tool, error code

---

## 5. Backward Compatibility & Phased Rollout

### 5.1 Design Principle

**Existing tools remain unchanged.** UTEE adapter wraps tool calls at the dispatch layer.

```
Agent → UTEE Adapter → Tool Implementation
         ↓
      (envelope added/removed transparently)
```

### 5.2 Phase 1: Observability Foundation (Week 1-2)

- Add UTEE adapter as pass-through layer
- Generate request IDs, trace IDs
- Emit structured logs and metrics
- No retry logic yet
- **Rollout:** Enable for 10% of sessions, monitor

### 5.3 Phase 2: Error Normalization (Week 3-4)

- Catch tool errors and wrap in UTEE error envelope
- Classify errors as retryable/non-retryable
- Add `retryable` flag based on error type
- **Rollout:** Enable for all sessions

### 5.4 Phase 3: Retry Support (Week 5-6)

- Implement retry logic in adapter
- Add `idempotencyKey` support with in-memory cache
- Allow agents to specify `RetryPolicy`
- **Rollout:** Opt-in per agent via capability flag

### 5.5 Phase 4: Capability Negotiation (Week 7-8)

- Tools declare capabilities (streaming, idempotency, caching)
- Agents query capabilities before invocation
- Add streaming response support
- **Rollout:** Enable for tools that support streaming

### 5.6 Phase 5: Native Integration (Future)

- Tools can optionally implement UTEE natively
- Adapter becomes optional for UTEE-native tools
- Migration path for each tool individually

---

## 6. Risks & Tradeoffs

### 6.1 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Performance overhead | Medium | Medium | Adapter is thin; measure in Phase 1 |
| Error misclassification | Medium | Low | Tune heuristics based on production data |
| Memory leak in idempotency cache | Low | High | TTL + LRU eviction + monitoring |
| Breaking existing error handling | Low | High | Phase 2 rollout with fallback flag |
| Increased latency | Medium | Low | Async envelope construction; measure |

### 6.2 Tradeoffs

| Decision | Choice | Alternative | Rationale |
|----------|--------|-------------|-----------|
| Adapter vs. tool modification | Adapter | Modify each tool | Lower risk, faster rollout |
| Opt-in vs. mandatory retry | Opt-in | Mandatory | Some tools have internal retry |
| In-memory vs. persistent cache | In-memory first | Redis/Disk | Simplicity; can upgrade later |
| Trace ID propagation | Header-based | Context-based | Works across process boundaries |
| Error envelope nesting | Flatten | Nest original error | Simpler for agents to handle |

---

## 7. Recommended Next Experiment

**Goal:** Validate performance overhead and error classification accuracy.

**Experiment:**
1. Implement minimal UTEE adapter (Phase 1 scope)
2. Deploy to 5% of sessions for 48 hours
3. Measure:
   - P50/P95/P99 latency overhead (target: <5ms)
   - Error classification accuracy (spot-check 50 errors)
   - Log volume increase
4. Survey: Do structured logs help debugging?

**Success Criteria:**
- Latency overhead < 5ms at P95
- No increase in error rate
- Positive developer feedback on observability

**If Successful:** Proceed to Phase 2 (error normalization).

**If Unsuccessful:** Investigate bottleneck; consider lazy envelope construction.

---

## Appendix A: Example Invocations

### Before UTEE (Current)

```javascript
// Agent code
const result = await exec({ command: "git status" });
if (result.error) {
  // Tool-specific error handling
}
```

### After UTEE (Phase 3+)

```javascript
// Agent code (unchanged, adapter wraps automatically)
const response = await exec({ 
  command: "git status",
  _utee: {
    idempotencyKey: "git-status-repo-x",
    timeout: 5000,
    retryPolicy: { maxAttempts: 2 }
  }
});

if (response.status === "error") {
  // Standardized error handling
  if (response.error.retryable) {
    // Automatic retry already attempted
  }
}
```

---

## Appendix B: Open Questions

1. **Global vs. session-scoped idempotency keys?** Start session-scoped; global requires coordination.
2. **Should adapter retry or tool?** Adapter retries; tool marks `retryable: true/false`.
3. **How to handle streaming tools?** Phase 4; chunked envelope with `isStreaming: true`.
4. **What about tools that already return envelopes?** Adapter detects and avoids double-wrapping.
5. **Cancellation support?** Future addition; `cancellationId` field reserved.

---

*End of RFC Draft*
