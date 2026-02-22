# Test Strategy and Acceptance Criteria

## Testing objective

Prove CSDK parity against current Pi behavior at integration boundaries, without rewriting the whole test stack.

## Existing assets to reuse

- subscribe harness:
  - `src/agents/pi-embedded-subscribe.e2e-harness.ts`
- subscribe behavior tests:
  - `src/agents/pi-embedded-subscribe.subscribe-embedded-pi-session.*.e2e.test.ts`
- run orchestration tests:
  - `src/agents/pi-embedded-runner.e2e.test.ts`
  - `src/agents/pi-embedded-runner/run.overflow-compaction*.test.ts`

## New test layers

### 1) Adapter unit tests

Target: CSDK event -> normalized event mapping.

Cases:
- assistant text stream sequencing
- reasoning stream sequencing
- tool start/update/end mapping
- compaction start/end with retries
- lifecycle end/error terminalization

### 2) Subscription parity tests (synthetic)

Feed normalized adapter events into existing subscribe harness and assert:
- callback order
- dedupe behavior
- block reply flush before tool start
- waitForCompactionRetry semantics

### 3) Attempt integration tests

Mock CSDK query stream and verify:
- `EmbeddedRunAttemptResult` shape compatibility
- usage aggregation
- timeout/abort flags
- active run registration and cleanup

### 4) Run orchestration regression tests

Exercise `runEmbeddedPiAgent` with runtime switched to CSDK and assert:
- fallback loops
- compaction decisions
- payload shaping parity

## Minimum acceptance gates before shipping flag wider

- Pi baseline tests unchanged and green.
- CSDK adapter test suite green.
- CSDK parity smoke tests for:
  - streaming text
  - one tool success
  - one tool error
  - compaction retry
  - abort during run
- No public API signature changes required by callers.

## Include

- deterministic callback-order assertions using invocation order checks.
- snapshot tests for normalized event traces on representative scenarios.

## Avoid

- only validating final text without callback order checks.
- relying on live network SDK behavior for all tests.
- shipping without compaction and abort test coverage.
