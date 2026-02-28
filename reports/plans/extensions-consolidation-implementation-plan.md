# Implementation Plan: Extension Consolidation Strategy (b)

## Phase 1: Baseline and Contracts

- [ ] Define and ratify shared control-plane contracts.
  - [ ] Create event envelope/type registry spec.
  - [ ] Create policy decision explain schema.
  - [ ] Create delegation/handoff metadata schema.
- [ ] Instrument baseline metrics.
  - [ ] Capture current triage flow (calls/time).
  - [ ] Capture current query and policy error rates.

## Phase 2: Shared Runtime Introduction

- [ ] Add shared runtime package for contracts and adapters.
  - [ ] Implement file-backed adapter.
  - [ ] Add optional SQLite adapter scaffold.
  - [ ] Add compatibility shims for existing extensions.
- [ ] Migrate read paths first.
  - [ ] Observability reads from unified query adapter.
  - [ ] Budget/routing reads from unified policy primitives.

## Phase 3: Domain-by-Domain Unification

- [ ] Observability + Event Ledger logical unification.
  - [ ] Route anomaly evidence through unified ledger query.
  - [ ] Remove duplicate event transformation paths.
- [ ] Budget + Routing governance unification.
  - [ ] Add budget-aware routing inputs.
  - [ ] Add shared policy precedence engine.

## Phase 4: Validation and Hardening

- [ ] Run regression suites and incident simulations.
  - [ ] Validate no loss of event fidelity.
  - [ ] Validate policy explainability completeness.
- [ ] Conduct rollout by environment tier.
  - [ ] Canary.
  - [ ] Partial production.
  - [ ] Full rollout.

## Phase 5: Optional Package Merge Decisions

- [ ] Evaluate whether to hard-merge packages.
  - [ ] Compare deploy blast radius vs maintenance gain.
  - [ ] Decide per track (observability plane, governance plane).
- [ ] If approved, execute package merge with rollback plan.
