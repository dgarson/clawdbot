# Implementation Plan: Tool Consolidation and Expansion (c)

## Phase 1: Contract Definition

- [ ] Define `control_plane` action enum and response envelope.
  - [ ] Enumerate initial read/query actions.
  - [ ] Define schema constraints and size limits.
  - [ ] Define evidence reference format.
- [ ] Define access model.
  - [ ] Worker vs operator permissions matrix.
  - [ ] Audit logging requirements.

## Phase 2: Adapter Layer

- [ ] Implement adapter bindings from existing gateways/methods.
  - [ ] Event ledger adapter.
  - [ ] Observability adapter.
  - [ ] Budget adapter.
  - [ ] Evaluation adapter.
  - [ ] Routing explain adapter.
- [ ] Normalize response mapping.
  - [ ] Add shared mapper utilities.
  - [ ] Add common error taxonomy.

## Phase 3: Tool Rollout

- [ ] Introduce `control_plane` in read-only mode.
  - [ ] Ship with core actions only.
  - [ ] Add documentation/examples.
- [ ] Keep mutation tools unchanged.
  - [ ] Validate no behavior regressions.
  - [ ] Validate permission boundaries.

## Phase 4: Validation and Optimization

- [ ] Add tests.
  - [ ] action routing tests.
  - [ ] envelope conformance tests.
  - [ ] permission gating tests.
- [ ] Measure and tune.
  - [ ] incident flow latency.
  - [ ] action usage distribution.
  - [ ] response payload size.

## Phase 5: Deprecation/Convergence

- [ ] Identify redundant read methods for deprecation.
  - [ ] Publish compatibility timeline.
  - [ ] Add migration guidance.
- [ ] Complete consolidation where safe.
